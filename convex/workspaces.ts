import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

// Helper to check if user has sufficient permissions
function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Generate URL-friendly slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

// Generate random invite token
function generateInviteToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Plan limits
const PLAN_LIMITS = {
  free: { memberLimit: 3 },
  pro: { memberLimit: 25 },
  enterprise: { memberLimit: 1000 },
} as const;

// ===================
// WORKSPACE QUERIES
// ===================

// List all workspaces the user is a member of
export const listMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Get all workspace memberships for this user
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Fetch workspace details for each membership
    const workspacesWithRole = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId);
        if (!workspace) return null;

        // Get member count
        const memberCount = (
          await ctx.db
            .query("workspaceMembers")
            .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
            .collect()
        ).length;

        return {
          ...workspace,
          role: membership.role,
          memberCount,
          joinedAt: membership.joinedAt,
        };
      })
    );

    return workspacesWithRole.filter((w) => w !== null);
  },
});

// Get a specific workspace with details
export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Check membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Get all members
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    // Get pending invitations (only for admins+)
    let invitations: Doc<"workspaceInvitations">[] = [];
    if (hasPermission(membership.role, "admin")) {
      invitations = await ctx.db
        .query("workspaceInvitations")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
    }

    return {
      ...workspace,
      role: membership.role,
      members,
      invitations,
      memberCount: members.length,
    };
  },
});

// Get workspace by slug (for URL routing)
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) => {
    const userId = await getUserId(ctx);

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .unique();

    if (!workspace) {
      return null;
    }

    // Check membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      return null;
    }

    return {
      ...workspace,
      role: membership.role,
    };
  },
});

// Get workspace members
export const getMembers = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    // Fetch user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("byExternalId", (q) => q.eq("externalId", member.userId))
          .unique();

        return {
          ...member,
          userName: user?.name || "Unknown User",
          userEmail: user?.email,
          userImage: user?.imageUrl,
        };
      })
    );

    return membersWithDetails;
  },
});

// Get pending invitations for the current user
export const getMyInvitations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      return [];
    }

    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("byEmail", (q) => q.eq("email", identity.email!))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Fetch workspace details for each invitation
    const invitationsWithWorkspace = await Promise.all(
      invitations.map(async (invitation) => {
        const workspace = await ctx.db.get(invitation.workspaceId);
        return {
          ...invitation,
          workspaceName: workspace?.name || "Unknown Workspace",
        };
      })
    );

    return invitationsWithWorkspace;
  },
});

// Get workspace activity log
export const getActivity = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit = 50 }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role, "admin")) {
      throw new Error("You don't have permission to view activity logs");
    }

    const activity = await ctx.db
      .query("workspaceActivity")
      .withIndex("byWorkspaceAndTimestamp", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(limit);

    // Fetch user details for each activity
    const activityWithUsers = await Promise.all(
      activity.map(async (item) => {
        const user = await ctx.db
          .query("users")
          .withIndex("byExternalId", (q) => q.eq("externalId", item.userId))
          .unique();

        return {
          ...item,
          userName: user?.name || "Unknown User",
        };
      })
    );

    return activityWithUsers;
  },
});

// ===================
// WORKSPACE MUTATIONS
// ===================

// Create a new workspace
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, description }) => {
    const userId = await getUserId(ctx);

    // Generate unique slug
    let slug = generateSlug(name);
    let slugSuffix = 0;
    while (true) {
      const existing = await ctx.db
        .query("workspaces")
        .withIndex("bySlug", (q) => q.eq("slug", slug))
        .unique();

      if (!existing) break;
      slugSuffix++;
      slug = `${generateSlug(name)}-${slugSuffix}`;
    }

    const now = Date.now();

    // Create the workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      slug,
      description,
      ownerId: userId,
      settings: {
        allowMemberInvites: false,
        defaultDocVisibility: "workspace",
        requireApprovalForPublic: true,
      },
      plan: "free",
      memberLimit: PLAN_LIMITS.free.memberLimit,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner member
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      joinedAt: now,
    });

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: "workspace_created",
      timestamp: now,
    });

    return { workspaceId, slug };
  },
});

// Update workspace settings
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    settings: v.optional(
      v.object({
        allowMemberInvites: v.optional(v.boolean()),
        defaultDocVisibility: v.optional(v.union(v.literal("workspace"), v.literal("private"))),
        requireApprovalForPublic: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, { workspaceId, name, description, settings }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role, "admin")) {
      throw new Error("You don't have permission to update this workspace");
    }

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const updates: Partial<Doc<"workspaces">> = {
      updatedAt: Date.now(),
    };

    if (name !== undefined) {
      updates.name = name;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (settings !== undefined) {
      updates.settings = {
        ...workspace.settings,
        ...settings,
      };
    }

    await ctx.db.patch(workspaceId, updates);

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: "settings_updated",
      metadata: { updates: Object.keys(updates) },
      timestamp: Date.now(),
    });
  },
});

// Delete workspace (owner only)
export const remove = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.ownerId !== userId) {
      throw new Error("Only the workspace owner can delete it");
    }

    // Delete all related data
    // 1. Delete members
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // 2. Delete invitations
    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    // 3. Delete activity logs
    const activities = await ctx.db
      .query("workspaceActivity")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }

    // 4. Update projects to remove workspace association
    const projects = await ctx.db
      .query("projects")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const project of projects) {
      await ctx.db.patch(project._id, { workspaceId: undefined });
    }

    // 5. Update documents to remove workspace association
    const documents = await ctx.db
      .query("documents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const doc of documents) {
      await ctx.db.patch(doc._id, { workspaceId: undefined });
    }

    // Finally, delete the workspace
    await ctx.db.delete(workspaceId);
  },
});

// ===================
// MEMBER MANAGEMENT
// ===================

// Invite a user to the workspace
export const inviteMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, { workspaceId, email, role }) => {
    const userId = await getUserId(ctx);

    // Verify permission
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Check if user can invite
    const canInvite =
      hasPermission(membership.role, "admin") ||
      (workspace.settings.allowMemberInvites && hasPermission(membership.role, "member"));

    if (!canInvite) {
      throw new Error("You don't have permission to invite members");
    }

    // Can't invite with role higher than your own
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[membership.role]) {
      throw new Error("You cannot invite someone with equal or higher role than yours");
    }

    // Check member limit
    const currentMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    if (currentMembers.length >= workspace.memberLimit) {
      throw new Error(`Workspace member limit (${workspace.memberLimit}) reached. Upgrade your plan to add more members.`);
    }

    // Check for existing pending invitation
    const existingInvitation = await ctx.db
      .query("workspaceInvitations")
      .withIndex("byEmail", (q) => q.eq("email", email.toLowerCase()))
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), workspaceId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existingInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    // Check if user is already a member
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email.toLowerCase()))
      .first();

    if (existingUser) {
      const existingMember = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", existingUser.externalId)
        )
        .unique();

      if (existingMember) {
        throw new Error("This user is already a member of this workspace");
      }
    }

    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Create invitation
    const invitationId = await ctx.db.insert("workspaceInvitations", {
      workspaceId,
      email: email.toLowerCase(),
      role,
      invitedBy: userId,
      token: generateInviteToken(),
      status: "pending",
      expiresAt,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: "member_invited",
      targetType: "invitation",
      targetId: invitationId,
      metadata: { email, role },
      timestamp: now,
    });

    return { invitationId };
  },
});

// Accept an invitation
export const acceptInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, { invitationId }) => {
    const userId = await getUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("This invitation is no longer valid");
    }

    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitationId, { status: "expired" });
      throw new Error("This invitation has expired");
    }

    // Verify email matches
    if (identity?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address");
    }

    const workspace = await ctx.db.get(invitation.workspaceId);
    if (!workspace) {
      throw new Error("Workspace no longer exists");
    }

    // Check member limit
    const currentMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", invitation.workspaceId))
      .collect();

    if (currentMembers.length >= workspace.memberLimit) {
      throw new Error("Workspace member limit reached");
    }

    const now = Date.now();

    // Add as member
    await ctx.db.insert("workspaceMembers", {
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      joinedAt: now,
      invitedBy: invitation.invitedBy,
    });

    // Update invitation status
    await ctx.db.patch(invitationId, { status: "accepted" });

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId: invitation.workspaceId,
      userId,
      action: "member_joined",
      metadata: { role: invitation.role },
      timestamp: now,
    });

    return { workspaceId: invitation.workspaceId };
  },
});

// Decline an invitation
export const declineInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, { invitationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (identity.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("You can only decline invitations sent to your email");
    }

    await ctx.db.patch(invitationId, { status: "declined" });
  },
});

// Cancel a pending invitation (admin only)
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, { invitationId }) => {
    const userId = await getUserId(ctx);

    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", invitation.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role, "admin")) {
      throw new Error("You don't have permission to cancel invitations");
    }

    await ctx.db.delete(invitationId);

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId: invitation.workspaceId,
      userId,
      action: "invitation_cancelled",
      metadata: { email: invitation.email },
      timestamp: Date.now(),
    });
  },
});

// Update member role
export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
    newRole: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, { workspaceId, targetUserId, newRole }) => {
    const userId = await getUserId(ctx);

    // Can't change your own role
    if (userId === targetUserId) {
      throw new Error("You cannot change your own role");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role, "admin")) {
      throw new Error("You don't have permission to update member roles");
    }

    // Find target member
    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", targetUserId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Can't modify owner
    if (targetMembership.role === "owner") {
      throw new Error("Cannot change the role of the workspace owner");
    }

    // Can't set role higher than your own
    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY[membership.role]) {
      throw new Error("You cannot set a role equal to or higher than your own");
    }

    await ctx.db.patch(targetMembership._id, { role: newRole });

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: "member_role_changed",
      targetType: "member",
      targetId: targetUserId,
      metadata: { oldRole: targetMembership.role, newRole },
      timestamp: Date.now(),
    });
  },
});

// Remove a member from workspace
export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
  },
  handler: async (ctx, { workspaceId, targetUserId }) => {
    const userId = await getUserId(ctx);

    // Verify admin access (or user removing themselves)
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    const isSelfRemoval = userId === targetUserId;
    const isAdmin = hasPermission(membership.role, "admin");

    if (!isSelfRemoval && !isAdmin) {
      throw new Error("You don't have permission to remove members");
    }

    // Find target member
    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", targetUserId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Can't remove owner
    if (targetMembership.role === "owner") {
      throw new Error("The workspace owner cannot be removed. Transfer ownership first.");
    }

    // Admins can't remove other admins (only owner can)
    if (!isSelfRemoval && targetMembership.role === "admin" && membership.role !== "owner") {
      throw new Error("Only the workspace owner can remove admins");
    }

    await ctx.db.delete(targetMembership._id);

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: isSelfRemoval ? "member_left" : "member_removed",
      targetType: "member",
      targetId: targetUserId,
      timestamp: Date.now(),
    });
  },
});

// Transfer ownership
export const transferOwnership = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    newOwnerId: v.string(),
  },
  handler: async (ctx, { workspaceId, newOwnerId }) => {
    const userId = await getUserId(ctx);

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.ownerId !== userId) {
      throw new Error("Only the current owner can transfer ownership");
    }

    if (userId === newOwnerId) {
      throw new Error("You are already the owner");
    }

    // Find new owner membership
    const newOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", newOwnerId)
      )
      .unique();

    if (!newOwnerMembership) {
      throw new Error("New owner must be a member of the workspace");
    }

    // Find current owner membership
    const currentOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!currentOwnerMembership) {
      throw new Error("Current owner membership not found");
    }

    // Update workspace owner
    await ctx.db.patch(workspaceId, {
      ownerId: newOwnerId,
      updatedAt: Date.now(),
    });

    // Update roles
    await ctx.db.patch(newOwnerMembership._id, { role: "owner" });
    await ctx.db.patch(currentOwnerMembership._id, { role: "admin" });

    // Log activity
    await ctx.db.insert("workspaceActivity", {
      workspaceId,
      userId,
      action: "ownership_transferred",
      targetType: "member",
      targetId: newOwnerId,
      timestamp: Date.now(),
    });
  },
});

// ===================
// WORKSPACE PROJECTS/DOCS QUERIES
// ===================

// Get projects in a workspace
export const getProjects = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    return await ctx.db
      .query("projects")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

// Get documents in a workspace
export const getDocuments = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { workspaceId, projectId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    let docs = await ctx.db
      .query("documents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    if (projectId) {
      docs = docs.filter((doc) => doc.projectId === projectId);
    }

    return docs;
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Check if user has access to workspace
export const checkAccess = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    requiredRole: v.optional(v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer"))),
  },
  handler: async (ctx, { workspaceId, userId, requiredRole = "viewer" }) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      return { hasAccess: false, role: null };
    }

    return {
      hasAccess: hasPermission(membership.role, requiredRole),
      role: membership.role,
    };
  },
});

// Log workspace activity (internal)
export const logActivity = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("workspaceActivity", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// ===================
// REST API Internal Functions
// ===================

// List workspaces for API
export const listForApi = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Get all workspace memberships for this user
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Fetch workspace details for each membership
    const workspacesWithRole = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId);
        if (!workspace) return null;

        const memberCount = (
          await ctx.db
            .query("workspaceMembers")
            .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
            .collect()
        ).length;

        return {
          _id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: membership.role,
          memberCount,
          plan: workspace.plan,
        };
      })
    );

    return workspacesWithRole.filter((w) => w !== null);
  },
});

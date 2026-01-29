import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";

// ===============================================================
// SSO Session Types
// ===============================================================

type SessionStatus = "active" | "expired" | "revoked" | "logged_out";

// Role hierarchy for permission checks
type Role = "owner" | "admin" | "member" | "viewer";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Default session duration: 8 hours
const DEFAULT_SESSION_DURATION = 8 * 60 * 60 * 1000;

// ===============================================================
// SSO Session Queries
// ===============================================================

// Get active SSO sessions for current user
export const getMySessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byUserAndStatus", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    // Enrich with workspace and config info
    return Promise.all(
      sessions.map(async (session) => {
        const workspace = await ctx.db.get(session.workspaceId);
        const config = await ctx.db.get(session.configId);

        return {
          _id: session._id,
          workspaceId: session.workspaceId,
          workspaceName: workspace?.name || "Unknown Workspace",
          configId: session.configId,
          configName: config?.name || "Unknown Provider",
          provider: config?.provider,
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
        };
      })
    );
  },
});

// Get all sessions for a user (admin view)
export const getUserSessions = query({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
  },
  handler: async (ctx, { workspaceId, targetUserId }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view user sessions");
    }

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byUser", (q) => q.eq("userId", targetUserId))
      .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
      .collect();

    return Promise.all(
      sessions.map(async (session) => {
        const config = await ctx.db.get(session.configId);

        return {
          _id: session._id,
          status: session.status,
          configName: config?.name || "Unknown Provider",
          provider: config?.provider,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
          terminatedAt: session.terminatedAt,
        };
      })
    );
  },
});

// Get all active sessions for a workspace
export const getWorkspaceSessions = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("revoked"),
      v.literal("logged_out")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, status = "active", limit = 100 }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view workspace sessions");
    }

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.eq(q.field("status"), status))
      .order("desc")
      .take(limit);

    // Enrich with user and config info
    return Promise.all(
      sessions.map(async (session) => {
        const config = await ctx.db.get(session.configId);
        const user = await ctx.db
          .query("users")
          .withIndex("byExternalId", (q) => q.eq("externalId", session.userId))
          .unique();

        return {
          _id: session._id,
          userId: session.userId,
          userName: user?.name || "Unknown User",
          userEmail: user?.email,
          configName: config?.name || "Unknown Provider",
          provider: config?.provider,
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
        };
      })
    );
  },
});

// Validate a session
export const validateSession = query({
  args: {
    sessionId: v.id("ssoSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);

    if (!session) {
      return { valid: false, reason: "Session not found" };
    }

    if (session.status !== "active") {
      return { valid: false, reason: `Session is ${session.status}` };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      return { valid: false, reason: "Session has expired" };
    }

    return {
      valid: true,
      userId: session.userId,
      workspaceId: session.workspaceId,
      configId: session.configId,
      expiresAt: session.expiresAt,
    };
  },
});

// ===============================================================
// SSO Session Mutations
// ===============================================================

// Create a new SSO session
export const createSSOSession = internalMutation({
  args: {
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    configId: v.id("ssoConfigurations"),
    idpSessionId: v.optional(v.string()),
    idpSubject: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    deviceInfo: v.optional(v.object({
      browser: v.optional(v.string()),
      os: v.optional(v.string()),
      device: v.optional(v.string()),
    })),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const duration = args.duration || DEFAULT_SESSION_DURATION;

    const sessionId = await ctx.db.insert("ssoSessions", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      configId: args.configId,
      idpSessionId: args.idpSessionId,
      idpSubject: args.idpSubject,
      status: "active",
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      idToken: args.idToken,
      tokenExpiresAt: args.tokenExpiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      deviceInfo: args.deviceInfo,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + duration,
    });

    // Log the session creation
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: args.workspaceId,
      configId: args.configId,
      userId: args.userId,
      sessionId,
      eventType: "session_created",
      success: true,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: now,
    });

    return { sessionId };
  },
});

// Update session activity
export const updateSessionActivity = internalMutation({
  args: {
    sessionId: v.id("ssoSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "active") {
      return { updated: false };
    }

    await ctx.db.patch(sessionId, {
      lastActivityAt: Date.now(),
    });

    return { updated: true };
  },
});

// Refresh OIDC tokens
export const refreshSessionTokens = internalMutation({
  args: {
    sessionId: v.id("ssoSessions"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "active") {
      return { refreshed: false, error: "Session not active" };
    }

    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken || session.refreshToken,
      idToken: args.idToken || session.idToken,
      tokenExpiresAt: args.tokenExpiresAt,
      lastActivityAt: now,
    });

    // Log the refresh
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: session.workspaceId,
      configId: session.configId,
      userId: session.userId,
      sessionId: args.sessionId,
      eventType: "session_refreshed",
      success: true,
      timestamp: now,
    });

    return { refreshed: true };
  },
});

// Terminate a session (user-initiated logout)
export const terminateSession = mutation({
  args: {
    sessionId: v.id("ssoSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getUserId(ctx);
    const session = await ctx.db.get(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Users can only terminate their own sessions
    if (session.userId !== userId) {
      // Check if admin
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", session.workspaceId).eq("userId", userId)
        )
        .unique();

      if (!membership || !hasPermission(membership.role as Role, "admin")) {
        throw new Error("You can only terminate your own sessions");
      }
    }

    if (session.status !== "active") {
      throw new Error("Session is not active");
    }

    const now = Date.now();

    await ctx.db.patch(sessionId, {
      status: "logged_out",
      terminatedAt: now,
    });

    // Log the logout
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: session.workspaceId,
      configId: session.configId,
      userId: session.userId,
      sessionId,
      eventType: "logout_success",
      success: true,
      timestamp: now,
    });

    return { terminated: true, idpSessionId: session.idpSessionId };
  },
});

// Terminate all sessions for a user
export const terminateAllSessions = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);
    const now = Date.now();

    let sessions;
    if (workspaceId) {
      sessions = await ctx.db
        .query("ssoSessions")
        .withIndex("byUserAndStatus", (q) =>
          q.eq("userId", userId).eq("status", "active")
        )
        .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
        .collect();
    } else {
      sessions = await ctx.db
        .query("ssoSessions")
        .withIndex("byUserAndStatus", (q) =>
          q.eq("userId", userId).eq("status", "active")
        )
        .collect();
    }

    const idpSessionIds: string[] = [];

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "logged_out",
        terminatedAt: now,
      });

      if (session.idpSessionId) {
        idpSessionIds.push(session.idpSessionId);
      }

      // Log each logout
      await ctx.db.insert("ssoAuditLog", {
        workspaceId: session.workspaceId,
        configId: session.configId,
        userId: session.userId,
        sessionId: session._id,
        eventType: "logout_success",
        success: true,
        timestamp: now,
      });
    }

    return {
      terminatedCount: sessions.length,
      idpSessionIds,
    };
  },
});

// Admin: Terminate sessions for a specific user
export const adminTerminateUserSessions = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
  },
  handler: async (ctx, { workspaceId, targetUserId }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to terminate user sessions");
    }

    const now = Date.now();

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byUser", (q) => q.eq("userId", targetUserId))
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), workspaceId),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "revoked",
        terminatedAt: now,
      });

      // Log the revocation
      await ctx.db.insert("ssoAuditLog", {
        workspaceId: session.workspaceId,
        configId: session.configId,
        userId: session.userId,
        sessionId: session._id,
        eventType: "session_revoked",
        success: true,
        metadata: { revokedBy: userId },
        timestamp: now,
      });
    }

    return { terminatedCount: sessions.length };
  },
});

// Admin: Terminate all sessions for a workspace
export const adminTerminateAllWorkspaceSessions = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    excludeAdmins: v.optional(v.boolean()),
  },
  handler: async (ctx, { workspaceId, excludeAdmins = false }) => {
    const userId = await getUserId(ctx);

    // Verify owner access
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      throw new Error("Only the workspace owner can terminate all sessions");
    }

    const now = Date.now();

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    let terminatedCount = 0;

    for (const session of sessions) {
      // Optionally exclude admins
      if (excludeAdmins) {
        const targetMembership = await ctx.db
          .query("workspaceMembers")
          .withIndex("byWorkspaceAndUser", (q) =>
            q.eq("workspaceId", workspaceId).eq("userId", session.userId)
          )
          .unique();

        if (targetMembership && hasPermission(targetMembership.role as Role, "admin")) {
          continue;
        }
      }

      await ctx.db.patch(session._id, {
        status: "revoked",
        terminatedAt: now,
      });

      // Log the revocation
      await ctx.db.insert("ssoAuditLog", {
        workspaceId: session.workspaceId,
        configId: session.configId,
        userId: session.userId,
        sessionId: session._id,
        eventType: "session_revoked",
        success: true,
        metadata: { revokedBy: userId, massRevocation: true },
        timestamp: now,
      });

      terminatedCount++;
    }

    return { terminatedCount };
  },
});

// ===============================================================
// Session Cleanup (Internal)
// ===============================================================

// Mark expired sessions
export const markExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired active sessions
    const expiredSessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byExpiry", (q) => q.lt("expiresAt", now))
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(100);

    for (const session of expiredSessions) {
      await ctx.db.patch(session._id, {
        status: "expired",
        terminatedAt: now,
      });

      // Log the expiration
      await ctx.db.insert("ssoAuditLog", {
        workspaceId: session.workspaceId,
        configId: session.configId,
        userId: session.userId,
        sessionId: session._id,
        eventType: "session_expired",
        success: true,
        timestamp: now,
      });
    }

    return { expiredCount: expiredSessions.length };
  },
});

// Cleanup old auth states
export const cleanupAuthStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired auth states
    const expiredStates = await ctx.db
      .query("ssoAuthState")
      .withIndex("byExpiry", (q) => q.lt("expiresAt", now))
      .take(100);

    for (const state of expiredStates) {
      await ctx.db.delete(state._id);
    }

    return { cleanedCount: expiredStates.length };
  },
});

// ===============================================================
// Internal Helpers
// ===============================================================

// Get session by ID (internal)
export const getSessionInternal = internalQuery({
  args: {
    sessionId: v.id("ssoSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

// Find session by IdP session ID (for SLO)
export const findByIdpSession = internalQuery({
  args: {
    idpSessionId: v.string(),
  },
  handler: async (ctx, { idpSessionId }) => {
    return await ctx.db
      .query("ssoSessions")
      .withIndex("byIdpSession", (q) => q.eq("idpSessionId", idpSessionId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

// Handle IdP-initiated logout (SLO)
export const handleIdpLogout = internalMutation({
  args: {
    idpSessionId: v.string(),
  },
  handler: async (ctx, { idpSessionId }) => {
    const session = await ctx.db
      .query("ssoSessions")
      .withIndex("byIdpSession", (q) => q.eq("idpSessionId", idpSessionId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!session) {
      return { found: false };
    }

    const now = Date.now();

    await ctx.db.patch(session._id, {
      status: "logged_out",
      terminatedAt: now,
    });

    // Log the IdP-initiated logout
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: session.workspaceId,
      configId: session.configId,
      userId: session.userId,
      sessionId: session._id,
      eventType: "logout_success",
      success: true,
      metadata: { initiatedBy: "idp" },
      timestamp: now,
    });

    return { found: true, userId: session.userId };
  },
});

// Get session statistics for a workspace
export const getSessionStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view session statistics");
    }

    const allSessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const stats = {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter((s) => s.status === "active").length,
      expiredSessions: allSessions.filter((s) => s.status === "expired").length,
      revokedSessions: allSessions.filter((s) => s.status === "revoked").length,
      loggedOutSessions: allSessions.filter((s) => s.status === "logged_out").length,
      sessionsLast24h: allSessions.filter((s) => s.createdAt > oneDayAgo).length,
      sessionsLastWeek: allSessions.filter((s) => s.createdAt > oneWeekAgo).length,
      uniqueUsersActive: new Set(
        allSessions.filter((s) => s.status === "active").map((s) => s.userId)
      ).size,
    };

    return stats;
  },
});

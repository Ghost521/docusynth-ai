import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id } from "./_generated/dataModel";

// Predefined colors for user cursors
const CURSOR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#06b6d4", // cyan
];

// Presence timeout - users are considered "gone" after this time of inactivity
const PRESENCE_TIMEOUT_MS = 30000; // 30 seconds

// Get a consistent color for a user based on their ID
function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ═══════════════════════════════════════════════════════════════
// Presence Queries
// ═══════════════════════════════════════════════════════════════

// Get all active users viewing a document
export const getDocumentPresence = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    // Get presence records that are recent
    const cutoffTime = Date.now() - PRESENCE_TIMEOUT_MS;

    const presenceRecords = await ctx.db
      .query("documentPresence")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Filter out stale presence and exclude current user
    const activePresence = presenceRecords
      .filter((p) => p.lastActivity > cutoffTime)
      .map((p) => ({
        id: p._id,
        sessionId: p.sessionId,
        userId: p.userId,
        userName: p.userName,
        userImage: p.userImage,
        userColor: p.userColor,
        cursorPosition: p.cursorPosition,
        selectionStart: p.selectionStart,
        selectionEnd: p.selectionEnd,
        isEditing: p.isEditing,
        isCurrentUser: p.userId === userId,
      }));

    return activePresence;
  },
});

// Get presence count for a document (for badges)
export const getPresenceCount = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - PRESENCE_TIMEOUT_MS;

    const presenceRecords = await ctx.db
      .query("documentPresence")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .collect();

    const activeCount = presenceRecords.filter((p) => p.lastActivity > cutoffTime).length;

    return activeCount;
  },
});

// ═══════════════════════════════════════════════════════════════
// Presence Mutations
// ═══════════════════════════════════════════════════════════════

// Join a document session (called when opening a document)
export const joinDocument = mutation({
  args: {
    documentId: v.id("documents"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user info
    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", userId))
      .first();

    if (!user) throw new Error("User not found");

    // Check if this session already exists
    const existingPresence = await ctx.db
      .query("documentPresence")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();
    const userColor = getUserColor(userId);

    if (existingPresence) {
      // Update existing presence
      await ctx.db.patch(existingPresence._id, {
        documentId: args.documentId,
        lastActivity: now,
      });
      return existingPresence._id;
    }

    // Create new presence record
    const presenceId = await ctx.db.insert("documentPresence", {
      documentId: args.documentId,
      userId,
      userName: user.name,
      userImage: user.imageUrl,
      userColor,
      isEditing: false,
      lastActivity: now,
      sessionId: args.sessionId,
    });

    return presenceId;
  },
});

// Leave a document session (called when closing/navigating away)
export const leaveDocument = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return;

    const presence = await ctx.db
      .query("documentPresence")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence && presence.userId === userId) {
      await ctx.db.delete(presence._id);
    }
  },
});

// Update cursor position
export const updateCursor = mutation({
  args: {
    sessionId: v.string(),
    cursorPosition: v.optional(v.number()),
    selectionStart: v.optional(v.number()),
    selectionEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return;

    const presence = await ctx.db
      .query("documentPresence")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence && presence.userId === userId) {
      await ctx.db.patch(presence._id, {
        cursorPosition: args.cursorPosition,
        selectionStart: args.selectionStart,
        selectionEnd: args.selectionEnd,
        lastActivity: Date.now(),
      });
    }
  },
});

// Update editing state
export const updateEditingState = mutation({
  args: {
    sessionId: v.string(),
    isEditing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return;

    const presence = await ctx.db
      .query("documentPresence")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence && presence.userId === userId) {
      await ctx.db.patch(presence._id, {
        isEditing: args.isEditing,
        lastActivity: Date.now(),
      });
    }
  },
});

// Heartbeat to keep presence alive
export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return;

    const presence = await ctx.db
      .query("documentPresence")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence && presence.userId === userId) {
      await ctx.db.patch(presence._id, {
        lastActivity: Date.now(),
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Collaborative Editing
// ═══════════════════════════════════════════════════════════════

// Get document collaboration state
export const getCollabState = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("documentCollabState")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .first();

    if (!state) {
      return {
        version: 0,
        lastEditedBy: null,
        lastEditedAt: null,
      };
    }

    // Get the editor's name
    const editor = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", state.lastEditedBy))
      .first();

    return {
      version: state.version,
      lastEditedBy: editor?.name || "Unknown",
      lastEditedAt: state.lastEditedAt,
    };
  },
});

// Apply a content update with version tracking
export const applyEdit = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    baseVersion: v.number(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify access to document
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");

    // Check access
    if (document.userId !== userId && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (!membership || membership.role === "viewer") {
        throw new Error("Access denied");
      }
    } else if (document.userId !== userId) {
      throw new Error("Access denied");
    }

    // Get current collab state
    let collabState = await ctx.db
      .query("documentCollabState")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .first();

    const currentVersion = collabState?.version || 0;
    const now = Date.now();

    // Check for version conflict
    if (args.baseVersion < currentVersion) {
      // Version conflict - return current state for client to handle
      return {
        success: false,
        conflict: true,
        currentVersion,
        currentContent: document.content,
      };
    }

    // Update document content
    await ctx.db.patch(args.documentId, {
      content: args.content,
    });

    // Update collab state
    const newVersion = currentVersion + 1;

    if (collabState) {
      await ctx.db.patch(collabState._id, {
        version: newVersion,
        lastEditedBy: userId,
        lastEditedAt: now,
      });
    } else {
      await ctx.db.insert("documentCollabState", {
        documentId: args.documentId,
        version: newVersion,
        lastEditedBy: userId,
        lastEditedAt: now,
      });
    }

    return {
      success: true,
      conflict: false,
      newVersion,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Cleanup (internal)
// ═══════════════════════════════════════════════════════════════

// Clean up stale presence records (called periodically)
export const cleanupStalePresence = internalMutation({
  handler: async (ctx) => {
    const cutoffTime = Date.now() - PRESENCE_TIMEOUT_MS * 2; // Double the timeout for cleanup

    const staleRecords = await ctx.db
      .query("documentPresence")
      .withIndex("byLastActivity", (q) => q.lt("lastActivity", cutoffTime))
      .collect();

    for (const record of staleRecords) {
      await ctx.db.delete(record._id);
    }

    return { cleaned: staleRecords.length };
  },
});

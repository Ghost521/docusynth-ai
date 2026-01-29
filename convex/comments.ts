import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Comment Queries
// ═══════════════════════════════════════════════════════════════

// List all comments for a document
export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"), v.literal("wontfix"))),
    includeReplies: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    // Verify user has access to the document
    const document = await ctx.db.get(args.documentId);
    if (!document) return [];

    // Check access - user owns doc, or doc is in a workspace they belong to
    if (document.userId !== userId && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (!membership) return [];
    } else if (document.userId !== userId) {
      return [];
    }

    // Get comments
    let commentsQuery = ctx.db
      .query("documentComments")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId));

    const allComments = await commentsQuery.collect();

    // Filter by status if specified
    const comments = args.status
      ? allComments.filter((c) => c.status === args.status)
      : allComments;

    // Sort by creation time (newest first for resolved, oldest first for open)
    comments.sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return a.createdAt - b.createdAt;
    });

    // Optionally include replies
    if (args.includeReplies) {
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await ctx.db
            .query("commentReplies")
            .withIndex("byComment", (q) => q.eq("commentId", comment._id))
            .collect();

          // Get user info for comment author
          const author = await ctx.db
            .query("users")
            .withIndex("byExternalId", (q) => q.eq("externalId", comment.userId))
            .first();

          // Get user info for each reply author
          const repliesWithAuthors = await Promise.all(
            replies.map(async (reply) => {
              const replyAuthor = await ctx.db
                .query("users")
                .withIndex("byExternalId", (q) => q.eq("externalId", reply.userId))
                .first();
              return {
                ...reply,
                authorName: replyAuthor?.name || "Unknown User",
                authorImage: replyAuthor?.imageUrl,
              };
            })
          );

          return {
            ...comment,
            authorName: author?.name || "Unknown User",
            authorImage: author?.imageUrl,
            replies: repliesWithAuthors.sort((a, b) => a.createdAt - b.createdAt),
            replyCount: replies.length,
          };
        })
      );

      return commentsWithReplies;
    }

    // Get user info for each comment
    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db
          .query("users")
          .withIndex("byExternalId", (q) => q.eq("externalId", comment.userId))
          .first();

        const replyCount = await ctx.db
          .query("commentReplies")
          .withIndex("byComment", (q) => q.eq("commentId", comment._id))
          .collect()
          .then((r) => r.length);

        return {
          ...comment,
          authorName: author?.name || "Unknown User",
          authorImage: author?.imageUrl,
          replyCount,
        };
      })
    );

    return commentsWithAuthors;
  },
});

// Get a single comment with replies
export const get = query({
  args: {
    commentId: v.id("documentComments"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) return null;

    // Verify access to the document
    const document = await ctx.db.get(comment.documentId);
    if (!document) return null;

    if (document.userId !== userId && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (!membership) return null;
    } else if (document.userId !== userId) {
      return null;
    }

    // Get author info
    const author = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", comment.userId))
      .first();

    // Get replies with author info
    const replies = await ctx.db
      .query("commentReplies")
      .withIndex("byComment", (q) => q.eq("commentId", comment._id))
      .collect();

    const repliesWithAuthors = await Promise.all(
      replies.map(async (reply) => {
        const replyAuthor = await ctx.db
          .query("users")
          .withIndex("byExternalId", (q) => q.eq("externalId", reply.userId))
          .first();
        return {
          ...reply,
          authorName: replyAuthor?.name || "Unknown User",
          authorImage: replyAuthor?.imageUrl,
        };
      })
    );

    return {
      ...comment,
      authorName: author?.name || "Unknown User",
      authorImage: author?.imageUrl,
      replies: repliesWithAuthors.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// Get comment count for a document
export const getCount = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return { total: 0, open: 0, resolved: 0 };

    const comments = await ctx.db
      .query("documentComments")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .collect();

    return {
      total: comments.length,
      open: comments.filter((c) => c.status === "open").length,
      resolved: comments.filter((c) => c.status === "resolved" || c.status === "wontfix").length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Comment Mutations
// ═══════════════════════════════════════════════════════════════

// Create a new comment
export const create = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    selectionStart: v.optional(v.number()),
    selectionEnd: v.optional(v.number()),
    selectedText: v.optional(v.string()),
    lineNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user has access to the document
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");

    // Check access
    let workspaceId: Id<"workspaces"> | undefined;
    if (document.userId !== userId && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (!membership) throw new Error("Access denied");
      workspaceId = document.workspaceId;
    } else if (document.userId !== userId) {
      throw new Error("Access denied");
    } else {
      workspaceId = document.workspaceId;
    }

    const now = Date.now();

    const commentId = await ctx.db.insert("documentComments", {
      documentId: args.documentId,
      userId,
      workspaceId,
      selectionStart: args.selectionStart,
      selectionEnd: args.selectionEnd,
      selectedText: args.selectedText,
      lineNumber: args.lineNumber,
      content: args.content,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    // Log activity if in a workspace
    if (workspaceId) {
      await ctx.db.insert("workspaceActivity", {
        workspaceId,
        userId,
        action: "comment_created",
        targetType: "comment",
        targetId: commentId,
        metadata: { documentId: args.documentId },
        timestamp: now,
      });
    }

    return commentId;
  },
});

// Update a comment
export const update = mutation({
  args: {
    commentId: v.id("documentComments"),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Only the author can edit their comment
    if (comment.userId !== userId) {
      throw new Error("Only the author can edit this comment");
    }

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.commentId;
  },
});

// Resolve a comment
export const resolve = mutation({
  args: {
    commentId: v.id("documentComments"),
    status: v.union(v.literal("resolved"), v.literal("wontfix")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Verify access to the document
    const document = await ctx.db.get(comment.documentId);
    if (!document) throw new Error("Document not found");

    // Check if user can resolve - document owner, comment author, or workspace admin
    let canResolve = document.userId === userId || comment.userId === userId;

    if (!canResolve && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (membership && (membership.role === "owner" || membership.role === "admin")) {
        canResolve = true;
      }
    }

    if (!canResolve) {
      throw new Error("You don't have permission to resolve this comment");
    }

    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      status: args.status,
      resolvedBy: userId,
      resolvedAt: now,
      updatedAt: now,
    });

    return args.commentId;
  },
});

// Reopen a resolved comment
export const reopen = mutation({
  args: {
    commentId: v.id("documentComments"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Verify access to the document
    const document = await ctx.db.get(comment.documentId);
    if (!document) throw new Error("Document not found");

    // Check if user can reopen
    let canReopen = document.userId === userId || comment.userId === userId;

    if (!canReopen && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (membership) {
        canReopen = true;
      }
    }

    if (!canReopen) {
      throw new Error("You don't have permission to reopen this comment");
    }

    await ctx.db.patch(args.commentId, {
      status: "open",
      resolvedBy: undefined,
      resolvedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.commentId;
  },
});

// Delete a comment
export const remove = mutation({
  args: {
    commentId: v.id("documentComments"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Verify access to the document
    const document = await ctx.db.get(comment.documentId);
    if (!document) throw new Error("Document not found");

    // Check if user can delete - document owner, comment author, or workspace admin
    let canDelete = document.userId === userId || comment.userId === userId;

    if (!canDelete && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (membership && (membership.role === "owner" || membership.role === "admin")) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      throw new Error("You don't have permission to delete this comment");
    }

    // Delete all replies first
    const replies = await ctx.db
      .query("commentReplies")
      .withIndex("byComment", (q) => q.eq("commentId", args.commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    // Delete the comment
    await ctx.db.delete(args.commentId);

    return args.commentId;
  },
});

// ═══════════════════════════════════════════════════════════════
// Reply Mutations
// ═══════════════════════════════════════════════════════════════

// Add a reply to a comment
export const addReply = mutation({
  args: {
    commentId: v.id("documentComments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Verify access to the document
    const document = await ctx.db.get(comment.documentId);
    if (!document) throw new Error("Document not found");

    // Check access
    if (document.userId !== userId && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (!membership) throw new Error("Access denied");
    } else if (document.userId !== userId) {
      throw new Error("Access denied");
    }

    const now = Date.now();

    const replyId = await ctx.db.insert("commentReplies", {
      commentId: args.commentId,
      userId,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    // Update the comment's updatedAt to bring it to attention
    await ctx.db.patch(args.commentId, {
      updatedAt: now,
    });

    return replyId;
  },
});

// Update a reply
export const updateReply = mutation({
  args: {
    replyId: v.id("commentReplies"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const reply = await ctx.db.get(args.replyId);
    if (!reply) throw new Error("Reply not found");

    // Only the author can edit their reply
    if (reply.userId !== userId) {
      throw new Error("Only the author can edit this reply");
    }

    await ctx.db.patch(args.replyId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.replyId;
  },
});

// Delete a reply
export const removeReply = mutation({
  args: {
    replyId: v.id("commentReplies"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const reply = await ctx.db.get(args.replyId);
    if (!reply) throw new Error("Reply not found");

    const comment = await ctx.db.get(reply.commentId);
    if (!comment) throw new Error("Comment not found");

    const document = await ctx.db.get(comment.documentId);
    if (!document) throw new Error("Document not found");

    // Check if user can delete - reply author, document owner, or workspace admin
    let canDelete = reply.userId === userId || document.userId === userId;

    if (!canDelete && document.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", document.workspaceId!).eq("userId", userId)
        )
        .first();
      if (membership && (membership.role === "owner" || membership.role === "admin")) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      throw new Error("You don't have permission to delete this reply");
    }

    await ctx.db.delete(args.replyId);

    return args.replyId;
  },
});

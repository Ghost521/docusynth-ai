// Embeddings queries and mutations - separate file without Node.js dependencies
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════
// Embedding Constants (exported for use elsewhere)
// ═══════════════════════════════════════════════════════════════

export const EMBEDDING_CONFIG = {
  // OpenAI text-embedding-3-small dimensions
  DIMENSION: 1536,
  // Max tokens per chunk (leaving room for overlap)
  CHUNK_SIZE: 500,
  // Overlap between chunks for context continuity
  CHUNK_OVERLAP: 50,
  // Minimum similarity score for search results (0-1)
  MIN_SIMILARITY: 0.5,
  // Default number of results
  DEFAULT_LIMIT: 10,
} as const;

// ═══════════════════════════════════════════════════════════════
// Internal Helper Mutations and Queries
// ═══════════════════════════════════════════════════════════════

/**
 * Queue a document for embedding generation.
 * Used for batch processing and updates.
 */
export const queueDocumentForEmbedding = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
    priority: v.optional(v.union(v.literal("high"), v.literal("normal"), v.literal("low"))),
  },
  handler: async (ctx, { documentId, userId, priority = "normal" }) => {
    // Check if already queued
    const existing = await ctx.db
      .query("embeddingQueue")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    if (existing) {
      // Update priority if higher
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (priorityOrder[priority] < priorityOrder[existing.priority]) {
        await ctx.db.patch(existing._id, { priority });
      }
      return existing._id;
    }

    // Add to queue
    return await ctx.db.insert("embeddingQueue", {
      documentId,
      userId,
      priority,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    });
  },
});

export const recordEmbeddingInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    chunkCount: v.number(),
    entryId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, userId, status, chunkCount, entryId, error }) => {
    // Check if record exists
    const existing = await ctx.db
      .query("documentEmbeddings")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        chunkCount,
        entryId,
        error,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("documentEmbeddings", {
      documentId,
      userId,
      status,
      chunkCount,
      entryId,
      error,
      model: "text-embedding-3-small",
      dimension: EMBEDDING_CONFIG.DIMENSION,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getEmbeddingRecordInternal = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    return await ctx.db
      .query("documentEmbeddings")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();
  },
});

export const deleteEmbeddingRecordInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const existing = await ctx.db
      .query("documentEmbeddings")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getPendingQueueItemsInternal = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, { limit }) => {
    // Get pending items, prioritizing high priority and older items
    const highPriority = await ctx.db
      .query("embeddingQueue")
      .withIndex("byStatusAndPriority", (q) => q.eq("status", "pending").eq("priority", "high"))
      .take(limit);

    if (highPriority.length >= limit) {
      return highPriority;
    }

    const remaining = limit - highPriority.length;
    const normalPriority = await ctx.db
      .query("embeddingQueue")
      .withIndex("byStatusAndPriority", (q) => q.eq("status", "pending").eq("priority", "normal"))
      .take(remaining);

    if (highPriority.length + normalPriority.length >= limit) {
      return [...highPriority, ...normalPriority];
    }

    const lowRemaining = limit - highPriority.length - normalPriority.length;
    const lowPriority = await ctx.db
      .query("embeddingQueue")
      .withIndex("byStatusAndPriority", (q) => q.eq("status", "pending").eq("priority", "low"))
      .take(lowRemaining);

    return [...highPriority, ...normalPriority, ...lowPriority];
  },
});

export const updateQueueItemStatusInternal = internalMutation({
  args: {
    id: v.id("embeddingQueue"),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("failed")),
    error: v.optional(v.string()),
    incrementAttempts: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, status, error, incrementAttempts }) => {
    const item = await ctx.db.get(id);
    if (!item) return;

    const updates: Record<string, unknown> = { status };
    if (error) updates.error = error;
    if (incrementAttempts) updates.attempts = item.attempts + 1;

    await ctx.db.patch(id, updates);
  },
});

export const removeQueueItemInternal = internalMutation({
  args: {
    id: v.id("embeddingQueue"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const getAllUserDocumentsInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
  },
});

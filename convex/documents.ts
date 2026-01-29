import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { projectId, workspaceId }) => {
    const userId = await getUserId(ctx);

    // If both projectId and workspaceId are specified, filter by project
    if (projectId) {
      return await ctx.db
        .query("documents")
        .withIndex("byUserAndProject", (q) =>
          q.eq("userId", userId).eq("projectId", projectId)
        )
        .collect();
    }

    // If workspace is specified, get documents from that workspace
    if (workspaceId) {
      return await ctx.db
        .query("documents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    }

    // Get personal documents (no workspace)
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Filter to only personal documents
    return allDocs.filter(doc => !doc.workspaceId);
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

export const create = mutation({
  args: {
    topic: v.string(),
    content: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const id = await ctx.db.insert("documents", {
      userId,
      workspaceId: args.workspaceId,
      topic: args.topic,
      content: args.content,
      sources: args.sources,
      projectId: args.projectId,
      visibility: args.visibility,
      createdAt: Date.now(),
    });

    // Queue for embedding generation (semantic search indexing)
    await ctx.db.insert("embeddingQueue", {
      documentId: id,
      userId,
      priority: "normal",
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    });

    return id;
  },
});

export const updateContent = mutation({
  args: {
    id: v.id("documents"),
    content: v.string(),
    versionLabel: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, versionLabel }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Create version snapshot of old content
    await ctx.db.insert("docVersions", {
      userId,
      documentId: id,
      content: doc.content,
      label: versionLabel || "Auto-save",
      createdAt: Date.now(),
    });

    await ctx.db.patch(id, { content });

    // Queue for re-embedding (semantic search re-indexing)
    // Check if already queued
    const existingQueue = await ctx.db
      .query("embeddingQueue")
      .withIndex("byDocument", (q) => q.eq("documentId", id))
      .unique();

    if (!existingQueue) {
      await ctx.db.insert("embeddingQueue", {
        documentId: id,
        userId,
        priority: "normal",
        status: "pending",
        createdAt: Date.now(),
        attempts: 0,
      });
    }
  },
});

export const updateVisibility = mutation({
  args: {
    id: v.id("documents"),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, { id, visibility }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }
    await ctx.db.patch(id, { visibility });
  },
});

export const moveToProject = mutation({
  args: {
    id: v.id("documents"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { id, projectId }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }
    await ctx.db.patch(id, { projectId });
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Delete all versions
    const versions = await ctx.db
      .query("docVersions")
      .withIndex("byDocument", (q) => q.eq("documentId", id))
      .collect();

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete embedding record (actual vector deletion handled by action)
    const embedding = await ctx.db
      .query("documentEmbeddings")
      .withIndex("byDocument", (q) => q.eq("documentId", id))
      .unique();

    if (embedding) {
      await ctx.db.delete(embedding._id);
    }

    // Remove from embedding queue if present
    const queueItem = await ctx.db
      .query("embeddingQueue")
      .withIndex("byDocument", (q) => q.eq("documentId", id))
      .unique();

    if (queueItem) {
      await ctx.db.delete(queueItem._id);
    }

    await ctx.db.delete(id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const docs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    for (const doc of docs) {
      const versions = await ctx.db
        .query("docVersions")
        .withIndex("byDocument", (q) => q.eq("documentId", doc._id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }
      await ctx.db.delete(doc._id);
    }
  },
});

// Internal functions for server-side use by actions
export const createInternal = internalMutation({
  args: {
    userId: v.string(),
    topic: v.string(),
    content: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    projectId: v.optional(v.id("projects")),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      userId: args.userId,
      topic: args.topic,
      content: args.content,
      sources: args.sources,
      projectId: args.projectId,
      visibility: args.visibility,
      createdAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, { documentId, userId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

export const listByProjectInternal = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { userId, projectId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("byUserAndProject", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .collect();
  },
});

// ===================
// REST API Internal Functions
// ===================

// List documents for API (with optional filters)
export const listForApi = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, projectId, workspaceId }) => {
    if (projectId) {
      return await ctx.db
        .query("documents")
        .withIndex("byUserAndProject", (q) =>
          q.eq("userId", userId).eq("projectId", projectId as any)
        )
        .collect();
    }

    if (workspaceId) {
      return await ctx.db
        .query("documents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId as any))
        .collect();
    }

    // Get personal documents only
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    return allDocs.filter(doc => !doc.workspaceId);
  },
});

// Get single document for API
export const getForApi = internalQuery({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { userId, documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

// Create document for API
export const createForApi = internalMutation({
  args: {
    userId: v.string(),
    topic: v.string(),
    content: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      topic: args.topic,
      content: args.content,
      sources: args.sources,
      projectId: args.projectId,
      visibility: args.visibility,
      createdAt: Date.now(),
    });
  },
});

// Update document for API
export const updateForApi = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    content: v.optional(v.string()),
    topic: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("workspace"))),
  },
  handler: async (ctx, { userId, documentId, ...updates }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(documentId, filtered);
    }
  },
});

// Delete document for API
export const deleteForApi = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { userId, documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Delete all versions
    const versions = await ctx.db
      .query("docVersions")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .collect();

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    await ctx.db.delete(documentId);
  },
});

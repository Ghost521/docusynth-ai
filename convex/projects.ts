import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // If workspace is specified, get projects from that workspace
    if (workspaceId) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      return projects.sort((a, b) => a.order - b.order);
    }

    // Otherwise, get personal projects (no workspace)
    const projects = await ctx.db
      .query("projects")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Filter to only personal projects (no workspaceId)
    const personalProjects = projects.filter(p => !p.workspaceId);
    return personalProjects.sort((a, b) => a.order - b.order);
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) return null;
    return project;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing projects count for ordering
    let existingCount = 0;
    if (args.workspaceId) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      existingCount = existing.length;
    } else {
      const existing = await ctx.db
        .query("projects")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .collect();
      existingCount = existing.length;
    }

    const id = await ctx.db.insert("projects", {
      userId,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      visibility: args.visibility,
      order: existingCount,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getUserId(ctx);
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.visibility !== undefined) patch.visibility = updates.visibility;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Unlink documents from this project
    const docs = await ctx.db
      .query("documents")
      .withIndex("byUserAndProject", (q) =>
        q.eq("userId", userId).eq("projectId", id)
      )
      .collect();

    for (const doc of docs) {
      await ctx.db.patch(doc._id, { projectId: undefined });
    }

    await ctx.db.delete(id);
  },
});

export const reorder = mutation({
  args: { projectIds: v.array(v.id("projects")) },
  handler: async (ctx, { projectIds }) => {
    const userId = await getUserId(ctx);
    for (let i = 0; i < projectIds.length; i++) {
      const project = await ctx.db.get(projectIds[i]);
      if (project && project.userId === userId) {
        await ctx.db.patch(projectIds[i], { order: i });
      }
    }
  },
});

// Internal query for server-side use by actions
export const getInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, { projectId, userId }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  },
});

// ===================
// REST API Internal Functions
// ===================

// List projects for API
export const listForApi = internalQuery({
  args: {
    userId: v.string(),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, workspaceId }) => {
    if (workspaceId) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId as any))
        .collect();
      return projects.sort((a, b) => a.order - b.order);
    }

    // Get personal projects only
    const projects = await ctx.db
      .query("projects")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const personalProjects = projects.filter(p => !p.workspaceId);
    return personalProjects.sort((a, b) => a.order - b.order);
  },
});

// Get single project for API
export const getForApi = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { userId, projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  },
});

// Create project for API
export const createForApi = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
  },
  handler: async (ctx, args) => {
    // Get existing projects count for ordering
    let existingCount = 0;
    if (args.workspaceId) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      existingCount = existing.length;
    } else {
      const existing = await ctx.db
        .query("projects")
        .withIndex("byUser", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .collect();
      existingCount = existing.length;
    }

    return await ctx.db.insert("projects", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      visibility: args.visibility,
      order: existingCount,
      createdAt: Date.now(),
    });
  },
});

// Update project for API
export const updateForApi = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("workspace"))),
  },
  handler: async (ctx, { userId, projectId, ...updates }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(projectId, filtered);
    }
  },
});

// Delete project for API
export const deleteForApi = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { userId, projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Unlink documents from this project
    const docs = await ctx.db
      .query("documents")
      .withIndex("byUserAndProject", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .collect();

    for (const doc of docs) {
      await ctx.db.patch(doc._id, { projectId: undefined });
    }

    await ctx.db.delete(projectId);
  },
});

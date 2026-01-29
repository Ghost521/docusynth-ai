import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const insertProject = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private")),
    order: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", args);
  },
});

export const insertDocument = internalMutation({
  args: {
    userId: v.string(),
    topic: v.string(),
    content: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    projectId: v.optional(v.id("projects")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", args);
  },
});

export const insertVersion = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    content: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("docVersions", args);
  },
});

export const deleteProjectById = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    await ctx.db.delete(projectId);
    return { deleted: true };
  },
});

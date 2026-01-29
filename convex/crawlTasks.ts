import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    return await ctx.db
      .query("crawlTasks")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const id = await ctx.db.insert("crawlTasks", {
      userId,
      url: args.url,
      title: args.title,
      status: "pending",
      projectId: args.projectId,
      createdAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.crawlTasks.processNextTask, {
      userId,
    });

    return id;
  },
});

export const createBatch = mutation({
  args: {
    links: v.array(v.object({ url: v.string(), title: v.string() })),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { links, projectId }) => {
    const userId = await getUserId(ctx);

    for (const link of links) {
      await ctx.db.insert("crawlTasks", {
        userId,
        url: link.url,
        title: link.title,
        status: "pending",
        projectId,
        createdAt: Date.now(),
      });
    }

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.crawlTasks.processNextTask, {
      userId,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    taskId: v.id("crawlTasks"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, { taskId, status, error, documentId }) => {
    const patch: Record<string, unknown> = { status };
    if (error !== undefined) patch.error = error;
    if (documentId !== undefined) patch.documentId = documentId;
    await ctx.db.patch(taskId, patch);
  },
});

export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const tasks = await ctx.db
      .query("crawlTasks")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    for (const task of tasks) {
      if (task.status === "completed" || task.status === "failed") {
        await ctx.db.delete(task._id);
      }
    }
  },
});

export const processNextTask = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Find next pending task
    const tasks = await ctx.runQuery(internal.crawlTasks.listPendingForUser, {
      userId,
    });

    if (tasks.length === 0) return;

    const task = tasks[0];

    // Mark as processing
    await ctx.runMutation(internal.crawlTasks.updateStatus, {
      taskId: task._id,
      status: "processing",
    });

    try {
      // Generate documentation via Gemini
      const result = await ctx.runAction(
        internal.geminiActions.generateForCrawlTask,
        {
          url: task.url,
          userId,
        }
      );

      // Create document
      const documentId = await ctx.runMutation(
        internal.crawlTasks.createDocumentFromTask,
        {
          userId,
          topic: task.title,
          content: result.content,
          sources: result.sources,
          projectId: task.projectId,
        }
      );

      // Mark completed
      await ctx.runMutation(internal.crawlTasks.updateStatus, {
        taskId: task._id,
        status: "completed",
        documentId,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.crawlTasks.updateStatus, {
        taskId: task._id,
        status: "failed",
        error: error.message || "Unknown error",
      });
    }

    // Get user settings for delay
    const settings = await ctx.runQuery(
      internal.userSettings.getInternal,
      { userId }
    );
    const delay = settings?.crawlDelay || 1000;

    // Check for more pending tasks
    const remaining = await ctx.runQuery(
      internal.crawlTasks.listPendingForUser,
      { userId }
    );

    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(delay, internal.crawlTasks.processNextTask, {
        userId,
      });
    }
  },
});

export const listPendingForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("crawlTasks")
      .withIndex("byUserAndStatus", (q) =>
        q.eq("userId", userId).eq("status", "pending")
      )
      .collect();
  },
});

export const createDocumentFromTask = internalMutation({
  args: {
    userId: v.string(),
    topic: v.string(),
    content: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      userId: args.userId,
      topic: args.topic,
      content: args.content,
      sources: args.sources,
      projectId: args.projectId,
      visibility: "private",
      createdAt: Date.now(),
    });
  },
});

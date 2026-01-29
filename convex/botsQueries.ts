// Bot queries and mutations - separate file without Node.js dependencies
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { BOT_COMMANDS } from "./botTypes";

// ===================
// Database Queries
// ===================

// Get bot configuration by platform and team/guild
export const getBotConfig = internalQuery({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    teamId: v.optional(v.string()),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, { platform, teamId, guildId }) => {
    if (platform === "slack" && teamId) {
      return await ctx.db
        .query("botConfigurations")
        .withIndex("byPlatformAndTeam", (q) =>
          q.eq("platform", "slack").eq("teamId", teamId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
    }

    if (platform === "discord" && guildId) {
      return await ctx.db
        .query("botConfigurations")
        .withIndex("byPlatformAndGuild", (q) =>
          q.eq("platform", "discord").eq("guildId", guildId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
    }

    return null;
  },
});

// Get linked DocuSynth user from platform user
export const getLinkedUser = internalQuery({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    platformUserId: v.string(),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, { platform, platformUserId, teamId }) => {
    if (teamId) {
      return await ctx.db
        .query("botLinkedUsers")
        .withIndex("byPlatformAndTeam", (q) =>
          q.eq("platform", platform).eq("teamId", teamId).eq("platformUserId", platformUserId)
        )
        .first();
    }

    return await ctx.db
      .query("botLinkedUsers")
      .withIndex("byPlatformUser", (q) =>
        q.eq("platform", platform).eq("platformUserId", platformUserId)
      )
      .first();
  },
});

// Log bot command
export const logBotCommand = internalMutation({
  args: {
    botConfigId: v.id("botConfigurations"),
    userId: v.string(),
    platform: v.union(v.literal("slack"), v.literal("discord")),
    command: v.string(),
    args: v.string(),
    channelId: v.string(),
    platformUserId: v.string(),
    platformUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("botCommandLogs", {
      ...args,
      status: "pending",
      responseTimeMs: null,
      errorMessage: null,
      timestamp: Date.now(),
    });
  },
});

// Update bot command log
export const updateBotCommandLog = internalMutation({
  args: {
    logId: v.id("botCommandLogs"),
    status: v.union(v.literal("pending"), v.literal("success"), v.literal("failed")),
    responseTimeMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, { logId, ...updates }) => {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    await ctx.db.patch(logId, filtered);
  },
});

// Update bot config last activity
export const updateBotActivity = internalMutation({
  args: {
    botConfigId: v.id("botConfigurations"),
  },
  handler: async (ctx, { botConfigId }) => {
    await ctx.db.patch(botConfigId, {
      lastActivityAt: Date.now(),
    });
  },
});

// ===================
// Command Handlers
// ===================

// Search documents for bot
export const searchForBot = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, query: searchQuery, limit = 10 }) => {
    if (!searchQuery.trim()) {
      return [];
    }

    // Use full-text search
    const results = await ctx.db
      .query("documentSearchIndex")
      .withSearchIndex("search_content", (q) =>
        q.search("searchableText", searchQuery).eq("userId", userId)
      )
      .take(limit);

    // Get full document details
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const doc = await ctx.db.get(result.documentId);
        if (!doc) return null;

        return {
          _id: doc._id.toString(),
          topic: doc.topic,
          matchSnippet: result.contentPreview,
          createdAt: doc.createdAt,
        };
      })
    );

    return enrichedResults.filter((r) => r !== null);
  },
});

// List recent documents for bot
export const listRecentForBot = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return documents.map((doc) => ({
      _id: doc._id.toString(),
      topic: doc.topic,
      createdAt: doc.createdAt,
      contentPreview: doc.content.substring(0, 200),
    }));
  },
});

// Get document for sharing
export const getDocumentForShare = internalQuery({
  args: {
    userId: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, { userId, documentId }) => {
    try {
      const doc = await ctx.db.get(documentId as Id<"documents">);
      if (!doc) return null;

      // Check ownership or public visibility
      if (doc.userId !== userId && doc.visibility !== "public") {
        return null;
      }

      return {
        _id: doc._id.toString(),
        topic: doc.topic,
        content: doc.content,
        sources: doc.sources,
        visibility: doc.visibility,
        createdAt: doc.createdAt,
      };
    } catch {
      return null;
    }
  },
});

// ===================
// Public API for Managing Bot Configs
// ===================

// List user's bot configurations
export const listConfigurations = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (workspaceId) {
      return await ctx.db
        .query("botConfigurations")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    }

    const configs = await ctx.db
      .query("botConfigurations")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Mask bot tokens
    return configs.map((c) => ({
      ...c,
      botToken: c.botToken.substring(0, 10) + "...",
    }));
  },
});

// Create bot configuration
export const createConfiguration = mutation({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    botToken: v.string(),
    teamId: v.optional(v.string()),
    guildId: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    defaultChannelId: v.optional(v.string()),
    allowedChannels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Validate platform-specific requirements
    if (args.platform === "slack" && !args.teamId) {
      throw new Error("Slack team ID is required");
    }
    if (args.platform === "discord" && !args.guildId) {
      throw new Error("Discord guild ID is required");
    }

    const id = await ctx.db.insert("botConfigurations", {
      userId,
      workspaceId: args.workspaceId,
      platform: args.platform,
      teamId: args.teamId,
      guildId: args.guildId,
      botToken: args.botToken,
      defaultChannelId: args.defaultChannelId,
      allowedChannels: args.allowedChannels || [],
      enabledCommands: Object.keys(BOT_COMMANDS),
      isActive: true,
      lastActivityAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Update bot configuration
export const updateConfiguration = mutation({
  args: {
    configId: v.id("botConfigurations"),
    botToken: v.optional(v.string()),
    defaultChannelId: v.optional(v.string()),
    allowedChannels: v.optional(v.array(v.string())),
    enabledCommands: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { configId, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const config = await ctx.db.get(configId);
    if (!config || config.userId !== userId) {
      throw new Error("Bot configuration not found");
    }

    const filtered: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    await ctx.db.patch(configId, filtered);
  },
});

// Delete bot configuration
export const deleteConfiguration = mutation({
  args: {
    configId: v.id("botConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const config = await ctx.db.get(configId);
    if (!config || config.userId !== userId) {
      throw new Error("Bot configuration not found");
    }

    // Delete command logs
    const logs = await ctx.db
      .query("botCommandLogs")
      .withIndex("byBotConfig", (q) => q.eq("botConfigId", configId))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(configId);
  },
});

// Get command logs
export const getCommandLogs = query({
  args: {
    configId: v.id("botConfigurations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { configId, limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const config = await ctx.db.get(configId);
    if (!config || config.userId !== userId) {
      throw new Error("Bot configuration not found");
    }

    return await ctx.db
      .query("botCommandLogs")
      .withIndex("byBotConfig", (q) => q.eq("botConfigId", configId))
      .order("desc")
      .take(limit);
  },
});

// Link platform user to DocuSynth account
export const linkPlatformUser = mutation({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    platformUserId: v.string(),
    platformUserName: v.optional(v.string()),
    teamId: v.optional(v.string()),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check if already linked
    const existing = await ctx.db
      .query("botLinkedUsers")
      .withIndex("byPlatformUser", (q) =>
        q.eq("platform", args.platform).eq("platformUserId", args.platformUserId)
      )
      .first();

    if (existing) {
      // Update existing link
      await ctx.db.patch(existing._id, {
        userId,
        platformUserName: args.platformUserName,
      });
      return existing._id;
    }

    // Create new link
    return await ctx.db.insert("botLinkedUsers", {
      userId,
      platform: args.platform,
      platformUserId: args.platformUserId,
      platformUserName: args.platformUserName,
      teamId: args.teamId,
      guildId: args.guildId,
      linkedAt: Date.now(),
    });
  },
});

// Unlink platform user
export const unlinkPlatformUser = mutation({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    platformUserId: v.string(),
  },
  handler: async (ctx, { platform, platformUserId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("botLinkedUsers")
      .withIndex("byPlatformUser", (q) =>
        q.eq("platform", platform).eq("platformUserId", platformUserId)
      )
      .first();

    if (existing && existing.userId === userId) {
      await ctx.db.delete(existing._id);
    }
  },
});

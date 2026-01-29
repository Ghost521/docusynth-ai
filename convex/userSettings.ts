import { query, mutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";

const DEFAULT_SETTINGS = {
  ollamaEndpoint: "http://localhost:11434",
  ollamaBaseModel: "llama3",
  tabnineEnabled: false,
  cursorRulesEnabled: false,
  claudeModelPreference: "claude-sonnet-4-20250514",
  geminiModelPreference: "gemini-2.0-flash",
  openAiEnabled: false,
  openAiModelPreference: "gpt-4o",
  crawlMaxPages: 20,
  crawlDepth: 1,
  crawlDelay: 1000,
  crawlExcludePatterns: "login, signup, auth, pricing, terms, privacy",
  preferredProvider: "gemini" as const,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      return {
        ...DEFAULT_SETTINGS,
        hasGithubToken: false,
        hasClaudeApiKey: false,
        hasOpenAiApiKey: false,
      };
    }

    // Return settings with secrets redacted
    return {
      ollamaEndpoint: settings.ollamaEndpoint,
      ollamaBaseModel: settings.ollamaBaseModel,
      tabnineEnabled: settings.tabnineEnabled,
      cursorRulesEnabled: settings.cursorRulesEnabled,
      claudeModelPreference: settings.claudeModelPreference,
      geminiModelPreference: settings.geminiModelPreference,
      openAiEnabled: settings.openAiEnabled,
      openAiModelPreference: settings.openAiModelPreference,
      customSystemInstruction: settings.customSystemInstruction,
      crawlMaxPages: settings.crawlMaxPages,
      crawlDepth: settings.crawlDepth,
      crawlDelay: settings.crawlDelay,
      crawlExcludePatterns: settings.crawlExcludePatterns,
      preferredProvider: settings.preferredProvider || "gemini",
      // Boolean flags for whether secrets are set
      hasGithubToken: !!settings.githubToken,
      hasClaudeApiKey: !!settings.claudeApiKey,
      hasOpenAiApiKey: !!settings.openAiApiKey,
    };
  },
});

export const upsert = mutation({
  args: {
    ollamaEndpoint: v.optional(v.string()),
    ollamaBaseModel: v.optional(v.string()),
    tabnineEnabled: v.optional(v.boolean()),
    cursorRulesEnabled: v.optional(v.boolean()),
    claudeModelPreference: v.optional(v.string()),
    geminiModelPreference: v.optional(v.string()),
    openAiEnabled: v.optional(v.boolean()),
    openAiModelPreference: v.optional(v.string()),
    customSystemInstruction: v.optional(v.string()),
    crawlMaxPages: v.optional(v.number()),
    crawlDepth: v.optional(v.number()),
    crawlDelay: v.optional(v.number()),
    crawlExcludePatterns: v.optional(v.string()),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        ...DEFAULT_SETTINGS,
        ...updates,
      });
    }
  },
});

// Legacy mutation for updating secrets (kept for backwards compatibility)
// Secrets are now stored encrypted via the encryption service
export const updateSecrets = mutation({
  args: {
    githubToken: v.optional(v.string()),
    claudeApiKey: v.optional(v.string()),
    openAiApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();

    const updates: Record<string, unknown> = {};
    if (args.githubToken !== undefined) updates.githubToken = args.githubToken;
    if (args.claudeApiKey !== undefined) updates.claudeApiKey = args.claudeApiKey;
    if (args.openAiApiKey !== undefined) updates.openAiApiKey = args.openAiApiKey;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        ...DEFAULT_SETTINGS,
        ...updates,
      });
    }
  },
});

// Secure action for updating secrets with encryption
export const updateSecretsSecure = action({
  args: {
    githubToken: v.optional(v.string()),
    claudeApiKey: v.optional(v.string()),
    openAiApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Store each secret with encryption
    if (args.githubToken !== undefined) {
      await ctx.runAction(internal.encryption.storeSecret, {
        userId,
        secretType: "githubToken",
        value: args.githubToken,
      });
    }

    if (args.claudeApiKey !== undefined) {
      await ctx.runAction(internal.encryption.storeSecret, {
        userId,
        secretType: "claudeApiKey",
        value: args.claudeApiKey,
      });
    }

    if (args.openAiApiKey !== undefined) {
      await ctx.runAction(internal.encryption.storeSecret, {
        userId,
        secretType: "openAiApiKey",
        value: args.openAiApiKey,
      });
    }

    return { success: true };
  },
});

// Migrate existing plaintext secrets to encrypted format
export const migrateToEncryptedSecrets = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const result = await ctx.runAction(internal.encryption.migrateSecrets, {
      userId,
    });

    return result;
  },
});

export const getInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();
  },
});

// Get settings with decrypted secrets (for internal actions that need API keys)
export const getInternalWithSecrets = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      return {
        ...DEFAULT_SETTINGS,
        // API keys will be fetched via encryption.getApiKey
        claudeApiKey: null,
        openAiApiKey: null,
        githubToken: null,
      };
    }

    // Note: The actual decryption happens in encryption.getApiKey
    // This returns the raw settings - callers should use encryption.getApiKey
    // for the actual decrypted values
    return settings;
  },
});

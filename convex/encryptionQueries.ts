// Encryption queries and mutations - separate file without Node.js dependencies
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get raw user settings (with encrypted values).
 * This is used by internal actions that need to decrypt the values.
 */
export const getUserSettingsRaw = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();
  },
});

/**
 * Store an already-encrypted secret value.
 * The encryption happens in the action that calls this.
 */
export const storeSecretInternal = internalMutation({
  args: {
    userId: v.string(),
    secretType: v.union(
      v.literal("githubToken"),
      v.literal("claudeApiKey"),
      v.literal("openAiApiKey")
    ),
    encryptedValue: v.string(),
  },
  handler: async (ctx, { userId, secretType, encryptedValue }) => {
    // Get existing settings
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .unique();

    const update = { [secretType]: encryptedValue };

    if (settings) {
      await ctx.db.patch(settings._id, update);
    } else {
      // Create new settings with default values
      await ctx.db.insert("userSettings", {
        userId,
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
        ...update,
      });
    }
  },
});

/**
 * Update multiple secret fields at once (for migration).
 */
export const updateSecretsInternal = internalMutation({
  args: {
    settingsId: v.id("userSettings"),
    updates: v.object({
      githubToken: v.optional(v.string()),
      claudeApiKey: v.optional(v.string()),
      openAiApiKey: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { settingsId, updates }) => {
    const filteredUpdates: Record<string, string> = {};
    if (updates.githubToken !== undefined) filteredUpdates.githubToken = updates.githubToken;
    if (updates.claudeApiKey !== undefined) filteredUpdates.claudeApiKey = updates.claudeApiKey;
    if (updates.openAiApiKey !== undefined) filteredUpdates.openAiApiKey = updates.openAiApiKey;

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(settingsId, filteredUpdates);
    }
  },
});

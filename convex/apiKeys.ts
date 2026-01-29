import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id } from "./_generated/dataModel";

// Available API scopes
export const API_SCOPES = {
  "documents:read": "Read documents",
  "documents:write": "Create and update documents",
  "documents:delete": "Delete documents",
  "projects:read": "Read projects",
  "projects:write": "Create and update projects",
  "projects:delete": "Delete projects",
  "generate": "Trigger document generation",
  "workspaces:read": "Read workspace data",
  "workspaces:write": "Manage workspace settings",
  "webhooks:manage": "Manage webhooks",
} as const;

export type ApiScope = keyof typeof API_SCOPES;

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert ArrayBuffer to base64url string
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Generate a secure random API key using Web Crypto API
async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  // Generate 32 random bytes (256 bits)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = `ds_${bufferToBase64Url(randomBytes.buffer)}`;
  const prefix = key.substring(0, 11); // "ds_" + first 8 chars

  // Hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = bufferToHex(hashBuffer);

  return { key, prefix, hash };
}

// Hash an API key for comparison using Web Crypto API
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

// ===================
// PUBLIC QUERIES
// ===================

// List all API keys for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Return keys without the hash (security)
    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      rateLimit: key.rateLimit,
      isActive: key.isActive,
      createdAt: key.createdAt,
    }));
  },
});

// Get available scopes
export const getScopes = query({
  args: {},
  handler: async () => {
    return Object.entries(API_SCOPES).map(([id, description]) => ({
      id,
      description,
    }));
  },
});

// ===================
// PUBLIC MUTATIONS
// ===================

// Create a new API key
export const create = action({
  args: {
    name: v.string(),
    scopes: v.array(v.string()),
    expiresInDays: v.optional(v.number()), // null = never expires
    rateLimit: v.optional(v.number()), // Requests per hour, default 1000
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Validate scopes
    const validScopes = Object.keys(API_SCOPES);
    for (const scope of args.scopes) {
      if (!validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }

    if (args.scopes.length === 0) {
      throw new Error("At least one scope is required");
    }

    // Generate the key
    const { key, prefix, hash } = await generateApiKey();

    // Calculate expiration
    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : null;

    // Store the key
    const keyId = await ctx.runMutation(internal.apiKeys.createInternal, {
      userId,
      name: args.name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: args.scopes,
      expiresAt,
      rateLimit: args.rateLimit || 1000,
    });

    // Return the full key (only shown once!)
    return {
      id: keyId,
      key,
      prefix,
      message: "Save this key securely - it won't be shown again!",
    };
  },
});

// Update an API key
export const update = mutation({
  args: {
    keyId: v.id("apiKeys"),
    name: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    rateLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }

    const updates: Record<string, any> = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.scopes !== undefined) {
      const validScopes = Object.keys(API_SCOPES);
      for (const scope of args.scopes) {
        if (!validScopes.includes(scope)) {
          throw new Error(`Invalid scope: ${scope}`);
        }
      }
      updates.scopes = args.scopes;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    if (args.rateLimit !== undefined) {
      updates.rateLimit = args.rateLimit;
    }

    await ctx.db.patch(args.keyId, updates);
  },
});

// Revoke (delete) an API key
export const revoke = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, { keyId }) => {
    const userId = await getUserId(ctx);

    const key = await ctx.db.get(keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }

    await ctx.db.delete(keyId);
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Internal mutation to create API key
export const createInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.union(v.number(), v.null()),
    rateLimit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      userId: args.userId,
      name: args.name,
      keyPrefix: args.keyPrefix,
      keyHash: args.keyHash,
      scopes: args.scopes,
      lastUsedAt: null,
      expiresAt: args.expiresAt,
      rateLimit: args.rateLimit,
      requestCount: 0,
      requestCountResetAt: Date.now() + 3600000, // 1 hour from now
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// Validate an API key and return user info + scopes
export const validateKey = internalQuery({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, { apiKey }) => {
    // Hash the provided key
    const keyHash = await hashApiKey(apiKey);

    // Find the key by hash
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("byKeyHash", (q) => q.eq("keyHash", keyHash))
      .unique();

    if (!key) {
      return { valid: false, error: "Invalid API key" };
    }

    if (!key.isActive) {
      return { valid: false, error: "API key is disabled" };
    }

    if (key.expiresAt && key.expiresAt < Date.now()) {
      return { valid: false, error: "API key has expired" };
    }

    // Check rate limit
    const now = Date.now();
    if (now >= key.requestCountResetAt) {
      // Reset counter if window has passed
      return {
        valid: true,
        keyId: key._id,
        userId: key.userId,
        scopes: key.scopes,
        needsReset: true,
      };
    }

    if (key.requestCount >= key.rateLimit) {
      const resetIn = Math.ceil((key.requestCountResetAt - now) / 1000);
      return {
        valid: false,
        error: `Rate limit exceeded. Resets in ${resetIn} seconds`,
        retryAfter: resetIn,
      };
    }

    return {
      valid: true,
      keyId: key._id,
      userId: key.userId,
      scopes: key.scopes,
      needsReset: false,
    };
  },
});

// Update key usage (called after successful API request)
export const recordUsage = internalMutation({
  args: {
    keyId: v.id("apiKeys"),
    needsReset: v.boolean(),
  },
  handler: async (ctx, { keyId, needsReset }) => {
    const key = await ctx.db.get(keyId);
    if (!key) return;

    const now = Date.now();

    if (needsReset) {
      // Reset the counter for new window
      await ctx.db.patch(keyId, {
        requestCount: 1,
        requestCountResetAt: now + 3600000,
        lastUsedAt: now,
      });
    } else {
      // Increment counter
      await ctx.db.patch(keyId, {
        requestCount: key.requestCount + 1,
        lastUsedAt: now,
      });
    }
  },
});

// Log an API request
export const logRequest = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    userId: v.string(),
    method: v.string(),
    path: v.string(),
    statusCode: v.number(),
    responseTimeMs: v.number(),
    errorMessage: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiRequestLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get API usage stats for a user
export const getUsageStats = query({
  args: {
    keyId: v.optional(v.id("apiKeys")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { keyId, days = 7 }) => {
    const userId = await getUserId(ctx);

    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    let logsQuery = ctx.db
      .query("apiRequestLogs")
      .withIndex("byUser", (q) => q.eq("userId", userId));

    const logs = await logsQuery.collect();

    // Filter by time and optionally by key
    const filtered = logs.filter((log) => {
      if (log.timestamp < since) return false;
      if (keyId && log.apiKeyId !== keyId) return false;
      return true;
    });

    // Calculate stats
    const totalRequests = filtered.length;
    const successfulRequests = filtered.filter((l) => l.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgResponseTime =
      filtered.length > 0
        ? Math.round(filtered.reduce((sum, l) => sum + l.responseTimeMs, 0) / filtered.length)
        : 0;

    // Group by day
    const byDay: Record<string, number> = {};
    filtered.forEach((log) => {
      const day = new Date(log.timestamp).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    // Group by endpoint
    const byEndpoint: Record<string, number> = {};
    filtered.forEach((log) => {
      const key = `${log.method} ${log.path}`;
      byEndpoint[key] = (byEndpoint[key] || 0) + 1;
    });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      byDay,
      byEndpoint,
    };
  },
});

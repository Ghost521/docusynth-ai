import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

const MAX_RECENT_SEARCHES = 5;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const searches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    // Return sorted by most recent, capped at MAX
    return searches
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RECENT_SEARCHES);
  },
});

export const add = mutation({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const userId = await getUserId(ctx);

    // Remove duplicate if exists
    const existing = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    const duplicate = existing.find((s) => s.query === searchQuery);
    if (duplicate) {
      await ctx.db.delete(duplicate._id);
    }

    // Add new entry
    await ctx.db.insert("recentSearches", {
      userId,
      query: searchQuery,
      createdAt: Date.now(),
    });

    // Trim old entries beyond MAX
    const allSearches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    const sorted = allSearches.sort((a, b) => b.createdAt - a.createdAt);
    for (let i = MAX_RECENT_SEARCHES; i < sorted.length; i++) {
      await ctx.db.delete(sorted[i]._id);
    }
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const searches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    for (const search of searches) {
      await ctx.db.delete(search._id);
    }
  },
});

// Internal query for server-side use by actions
export const getRecent = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 5 }) => {
    const searches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    return searches
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
});

// Internal mutation for server-side use by actions
export const addInternal = internalMutation({
  args: {
    userId: v.string(),
    query: v.string(),
  },
  handler: async (ctx, { userId, query: searchQuery }) => {
    // Remove duplicate if exists
    const existing = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    const duplicate = existing.find((s) => s.query === searchQuery);
    if (duplicate) {
      await ctx.db.delete(duplicate._id);
    }

    await ctx.db.insert("recentSearches", {
      userId,
      query: searchQuery,
      createdAt: Date.now(),
    });

    // Trim old entries
    const allSearches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    const sorted = allSearches.sort((a, b) => b.createdAt - a.createdAt);
    for (let i = 5; i < sorted.length; i++) {
      await ctx.db.delete(sorted[i]._id);
    }
  },
});

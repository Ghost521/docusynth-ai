import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_REQUESTS_PER_HOUR = 50;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const check = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const cutoff = Date.now() - ONE_HOUR_MS;
    const events = await ctx.db
      .query("rateLimitEvents")
      .withIndex("byUserAndTimestamp", (q) =>
        q.eq("userId", userId).gte("timestamp", cutoff)
      )
      .collect();

    return {
      allowed: events.length < MAX_REQUESTS_PER_HOUR,
      remaining: MAX_REQUESTS_PER_HOUR - events.length,
      used: events.length,
    };
  },
});

export const record = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await ctx.db.insert("rateLimitEvents", {
      userId,
      timestamp: Date.now(),
    });

    // Clean up old events (older than 1 hour)
    const cutoff = Date.now() - ONE_HOUR_MS;
    const oldEvents = await ctx.db
      .query("rateLimitEvents")
      .withIndex("byUserAndTimestamp", (q) =>
        q.eq("userId", userId).lt("timestamp", cutoff)
      )
      .collect();

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }
  },
});

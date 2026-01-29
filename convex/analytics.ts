import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";

// Event types for analytics
export type AnalyticsEventType =
  | "document_generated"
  | "document_viewed"
  | "document_exported"
  | "document_refreshed"
  | "document_deleted"
  | "mcp_generated"
  | "crawl_started"
  | "crawl_completed"
  | "crawl_failed"
  | "search_performed"
  | "template_used"
  | "provider_used"
  | "api_call"
  | "webhook_delivered"
  | "bot_command"
  | "import_completed"
  | "project_created"
  | "project_deleted";

export type GenerationMode = "search" | "crawl" | "github" | "mcp";

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "custom";

// Helper to get time boundary from time range
function getTimeBoundary(timeRange: TimeRange, customStart?: number): number {
  const now = Date.now();
  switch (timeRange) {
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return now - 90 * 24 * 60 * 60 * 1000;
    case "custom":
      return customStart || now - 30 * 24 * 60 * 60 * 1000;
    default:
      return now - 30 * 24 * 60 * 60 * 1000;
  }
}

// Helper to format date as YYYY-MM-DD
function formatDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════
// EVENT TRACKING
// ═══════════════════════════════════════════════════════════════

// Track an analytics event (client-side)
export const trackEvent = mutation({
  args: {
    eventType: v.string(),
    eventData: v.optional(v.any()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    generationMode: v.optional(v.union(
      v.literal("search"),
      v.literal("crawl"),
      v.literal("github"),
      v.literal("mcp")
    )),
    durationMs: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorType: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    sourceCount: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    await ctx.db.insert("analyticsEvents", {
      userId,
      workspaceId: args.workspaceId,
      eventType: args.eventType,
      eventData: args.eventData,
      provider: args.provider,
      model: args.model,
      tokensUsed: args.tokensUsed,
      generationMode: args.generationMode,
      durationMs: args.durationMs,
      success: args.success,
      errorType: args.errorType,
      wordCount: args.wordCount,
      sourceCount: args.sourceCount,
      timestamp: Date.now(),
    });
  },
});

// Internal version for server-side tracking
export const trackEventInternal = internalMutation({
  args: {
    userId: v.string(),
    eventType: v.string(),
    eventData: v.optional(v.any()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    generationMode: v.optional(v.union(
      v.literal("search"),
      v.literal("crawl"),
      v.literal("github"),
      v.literal("mcp")
    )),
    durationMs: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorType: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    sourceCount: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      eventType: args.eventType,
      eventData: args.eventData,
      provider: args.provider,
      model: args.model,
      tokensUsed: args.tokensUsed,
      generationMode: args.generationMode,
      durationMs: args.durationMs,
      success: args.success,
      errorType: args.errorType,
      wordCount: args.wordCount,
      sourceCount: args.sourceCount,
      timestamp: Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════════════════════

// Get comprehensive dashboard overview
export const getOverview = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { timeRange, customStartTime, workspaceId }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);
    const now = Date.now();

    // Get events in time range
    let events: Doc<"analyticsEvents">[];
    if (workspaceId) {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Calculate previous period for comparison
    const periodLength = now - startTime;
    const previousStartTime = startTime - periodLength;

    let previousEvents: Doc<"analyticsEvents">[];
    if (workspaceId) {
      previousEvents = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), previousStartTime),
            q.lt(q.field("timestamp"), startTime)
          )
        )
        .collect();
    } else {
      previousEvents = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), previousStartTime),
            q.lt(q.field("timestamp"), startTime)
          )
        )
        .collect();
    }

    // Calculate key metrics
    const documentEvents = events.filter(e => e.eventType === "document_generated");
    const previousDocEvents = previousEvents.filter(e => e.eventType === "document_generated");

    const totalDocuments = documentEvents.length;
    const previousTotalDocuments = previousDocEvents.length;
    const documentsTrend = previousTotalDocuments > 0
      ? ((totalDocuments - previousTotalDocuments) / previousTotalDocuments) * 100
      : totalDocuments > 0 ? 100 : 0;

    const successfulDocs = documentEvents.filter(e => e.success !== false).length;
    const failedDocs = documentEvents.filter(e => e.success === false).length;
    const successRate = totalDocuments > 0 ? (successfulDocs / totalDocuments) * 100 : 0;

    const totalTokens = events.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const previousTokens = previousEvents.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const tokensTrend = previousTokens > 0
      ? ((totalTokens - previousTokens) / previousTokens) * 100
      : totalTokens > 0 ? 100 : 0;

    const totalWords = events.reduce((sum, e) => sum + (e.wordCount || 0), 0);
    const avgDocLength = totalDocuments > 0
      ? Math.round(totalWords / totalDocuments)
      : 0;

    const durations = documentEvents
      .filter(e => e.durationMs)
      .map(e => e.durationMs!);
    const avgGenerationTime = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const apiCalls = events.filter(e => e.eventType === "api_call").length;
    const previousApiCalls = previousEvents.filter(e => e.eventType === "api_call").length;
    const apiCallsTrend = previousApiCalls > 0
      ? ((apiCalls - previousApiCalls) / previousApiCalls) * 100
      : apiCalls > 0 ? 100 : 0;

    const webhookDeliveries = events.filter(e => e.eventType === "webhook_delivered").length;
    const botCommands = events.filter(e => e.eventType === "bot_command").length;
    const imports = events.filter(e => e.eventType === "import_completed").length;

    // Generation mode breakdown
    const byMode = {
      search: documentEvents.filter(e => e.generationMode === "search").length,
      crawl: documentEvents.filter(e => e.generationMode === "crawl").length,
      github: documentEvents.filter(e => e.generationMode === "github").length,
      mcp: documentEvents.filter(e => e.generationMode === "mcp").length,
    };

    return {
      totalDocuments,
      documentsTrend,
      successRate,
      successfulDocs,
      failedDocs,
      totalTokens,
      tokensTrend,
      avgDocLength,
      avgGenerationTime,
      apiCalls,
      apiCallsTrend,
      webhookDeliveries,
      botCommands,
      imports,
      byMode,
      timeRange,
      startTime,
      endTime: now,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// DOCUMENT STATISTICS
// ═══════════════════════════════════════════════════════════════

// Get detailed document generation statistics
export const getDocumentStats = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { timeRange, customStartTime, workspaceId }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);

    // Get document-related events
    let events: Doc<"analyticsEvents">[];
    if (workspaceId) {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.or(
              q.eq(q.field("eventType"), "document_generated"),
              q.eq(q.field("eventType"), "document_refreshed"),
              q.eq(q.field("eventType"), "document_exported"),
              q.eq(q.field("eventType"), "document_viewed")
            )
          )
        )
        .collect();
    } else {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.or(
              q.eq(q.field("eventType"), "document_generated"),
              q.eq(q.field("eventType"), "document_refreshed"),
              q.eq(q.field("eventType"), "document_exported"),
              q.eq(q.field("eventType"), "document_viewed")
            )
          )
        )
        .collect();
    }

    const generated = events.filter(e => e.eventType === "document_generated");
    const refreshed = events.filter(e => e.eventType === "document_refreshed");
    const exported = events.filter(e => e.eventType === "document_exported");
    const viewed = events.filter(e => e.eventType === "document_viewed");

    // Daily breakdown
    const byDay: Record<string, {
      generated: number;
      refreshed: number;
      exported: number;
      viewed: number;
    }> = {};

    // Initialize days
    const dayCount = timeRange === "24h" ? 1 :
                     timeRange === "7d" ? 7 :
                     timeRange === "30d" ? 30 : 90;
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = formatDateKey(date.getTime());
      byDay[dayKey] = { generated: 0, refreshed: 0, exported: 0, viewed: 0 };
    }

    // Count events by day
    events.forEach(event => {
      const dayKey = formatDateKey(event.timestamp);
      if (byDay[dayKey]) {
        switch (event.eventType) {
          case "document_generated":
            byDay[dayKey].generated++;
            break;
          case "document_refreshed":
            byDay[dayKey].refreshed++;
            break;
          case "document_exported":
            byDay[dayKey].exported++;
            break;
          case "document_viewed":
            byDay[dayKey].viewed++;
            break;
        }
      }
    });

    // Mode breakdown
    const byMode = {
      search: generated.filter(e => e.generationMode === "search").length,
      crawl: generated.filter(e => e.generationMode === "crawl").length,
      github: generated.filter(e => e.generationMode === "github").length,
      mcp: generated.filter(e => e.generationMode === "mcp").length,
    };

    // Generation time distribution
    const times = generated.filter(e => e.durationMs).map(e => e.durationMs!);
    const timeDistribution = {
      fast: times.filter(t => t < 5000).length, // < 5s
      medium: times.filter(t => t >= 5000 && t < 15000).length, // 5-15s
      slow: times.filter(t => t >= 15000 && t < 30000).length, // 15-30s
      verySlow: times.filter(t => t >= 30000).length, // > 30s
    };

    // Word count distribution
    const wordCounts = generated.filter(e => e.wordCount).map(e => e.wordCount!);
    const avgWordCount = wordCounts.length > 0
      ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
      : 0;
    const maxWordCount = wordCounts.length > 0 ? Math.max(...wordCounts) : 0;
    const minWordCount = wordCounts.length > 0 ? Math.min(...wordCounts) : 0;

    return {
      total: {
        generated: generated.length,
        refreshed: refreshed.length,
        exported: exported.length,
        viewed: viewed.length,
      },
      byDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts })),
      byMode,
      timeDistribution,
      wordStats: {
        avg: avgWordCount,
        max: maxWordCount,
        min: minWordCount,
      },
      successRate: generated.length > 0
        ? (generated.filter(e => e.success !== false).length / generated.length) * 100
        : 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// USER ACTIVITY (Workspace-level)
// ═══════════════════════════════════════════════════════════════

// Get user activity metrics for a workspace
export const getUserActivity = query({
  args: {
    workspaceId: v.id("workspaces"),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, timeRange, customStartTime }) => {
    await getUserId(ctx); // Verify auth
    const startTime = getTimeBoundary(timeRange, customStartTime);

    // Get all events for this workspace
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    // Group events by user
    const userActivity: Record<string, {
      userId: string;
      eventCount: number;
      documentsGenerated: number;
      lastActivity: number;
    }> = {};

    events.forEach(event => {
      if (!userActivity[event.userId]) {
        userActivity[event.userId] = {
          userId: event.userId,
          eventCount: 0,
          documentsGenerated: 0,
          lastActivity: 0,
        };
      }

      userActivity[event.userId].eventCount++;
      if (event.eventType === "document_generated") {
        userActivity[event.userId].documentsGenerated++;
      }
      if (event.timestamp > userActivity[event.userId].lastActivity) {
        userActivity[event.userId].lastActivity = event.timestamp;
      }
    });

    // Activity by hour of day (UTC)
    const byHour: Record<number, number> = {};
    for (let i = 0; i < 24; i++) byHour[i] = 0;

    events.forEach(event => {
      const hour = new Date(event.timestamp).getUTCHours();
      byHour[hour]++;
    });

    // Activity by day of week
    const byDayOfWeek: Record<number, number> = {};
    for (let i = 0; i < 7; i++) byDayOfWeek[i] = 0;

    events.forEach(event => {
      const day = new Date(event.timestamp).getUTCDay();
      byDayOfWeek[day]++;
    });

    // Feature usage breakdown
    const featureUsage: Record<string, number> = {};
    events.forEach(event => {
      featureUsage[event.eventType] = (featureUsage[event.eventType] || 0) + 1;
    });

    const activeUsers = Object.keys(userActivity).length;
    const totalEvents = events.length;

    return {
      activeUsers,
      totalEvents,
      userBreakdown: Object.values(userActivity)
        .sort((a, b) => b.eventCount - a.eventCount),
      byHour: Object.entries(byHour)
        .map(([hour, count]) => ({ hour: parseInt(hour), count })),
      byDayOfWeek: Object.entries(byDayOfWeek)
        .map(([day, count]) => ({ day: parseInt(day), count })),
      featureUsage,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// API & INTEGRATION USAGE
// ═══════════════════════════════════════════════════════════════

// Get API and integration usage metrics
export const getApiUsage = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { timeRange, customStartTime, workspaceId }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);

    // Get API-related events
    let events: Doc<"analyticsEvents">[];
    if (workspaceId) {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.or(
              q.eq(q.field("eventType"), "api_call"),
              q.eq(q.field("eventType"), "webhook_delivered"),
              q.eq(q.field("eventType"), "bot_command"),
              q.eq(q.field("eventType"), "import_completed")
            )
          )
        )
        .collect();
    } else {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.or(
              q.eq(q.field("eventType"), "api_call"),
              q.eq(q.field("eventType"), "webhook_delivered"),
              q.eq(q.field("eventType"), "bot_command"),
              q.eq(q.field("eventType"), "import_completed")
            )
          )
        )
        .collect();
    }

    const apiCalls = events.filter(e => e.eventType === "api_call");
    const webhooks = events.filter(e => e.eventType === "webhook_delivered");
    const botCommands = events.filter(e => e.eventType === "bot_command");
    const imports = events.filter(e => e.eventType === "import_completed");

    // Daily breakdown
    const byDay: Record<string, {
      apiCalls: number;
      webhooks: number;
      botCommands: number;
      imports: number;
    }> = {};

    const dayCount = timeRange === "24h" ? 1 :
                     timeRange === "7d" ? 7 :
                     timeRange === "30d" ? 30 : 90;
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = formatDateKey(date.getTime());
      byDay[dayKey] = { apiCalls: 0, webhooks: 0, botCommands: 0, imports: 0 };
    }

    events.forEach(event => {
      const dayKey = formatDateKey(event.timestamp);
      if (byDay[dayKey]) {
        switch (event.eventType) {
          case "api_call":
            byDay[dayKey].apiCalls++;
            break;
          case "webhook_delivered":
            byDay[dayKey].webhooks++;
            break;
          case "bot_command":
            byDay[dayKey].botCommands++;
            break;
          case "import_completed":
            byDay[dayKey].imports++;
            break;
        }
      }
    });

    // Webhook delivery success rate
    const webhookSuccess = webhooks.filter(e => e.success !== false).length;
    const webhookSuccessRate = webhooks.length > 0
      ? (webhookSuccess / webhooks.length) * 100
      : 0;

    // Import source breakdown
    const importsBySource: Record<string, number> = {};
    imports.forEach(event => {
      const source = event.eventData?.sourceType || "unknown";
      importsBySource[source] = (importsBySource[source] || 0) + 1;
    });

    return {
      total: {
        apiCalls: apiCalls.length,
        webhooks: webhooks.length,
        botCommands: botCommands.length,
        imports: imports.length,
      },
      byDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts })),
      webhookSuccessRate,
      importsBySource,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE METRICS
// ═══════════════════════════════════════════════════════════════

// Get performance metrics
export const getPerformanceMetrics = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { timeRange, customStartTime, workspaceId }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);

    // Get events with timing data
    let events: Doc<"analyticsEvents">[];
    if (workspaceId) {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    const timedEvents = events.filter(e => e.durationMs !== undefined);

    // Response time statistics
    const durations = timedEvents.map(e => e.durationMs!);
    const avgResponseTime = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const p50 = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.5)]
      : 0;
    const p95 = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
      : 0;
    const p99 = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)]
      : 0;

    // Error rates by feature
    const errorsByFeature: Record<string, { total: number; errors: number; rate: number }> = {};
    events.forEach(event => {
      if (!errorsByFeature[event.eventType]) {
        errorsByFeature[event.eventType] = { total: 0, errors: 0, rate: 0 };
      }
      errorsByFeature[event.eventType].total++;
      if (event.success === false) {
        errorsByFeature[event.eventType].errors++;
      }
    });

    Object.values(errorsByFeature).forEach(stats => {
      stats.rate = stats.total > 0 ? (stats.errors / stats.total) * 100 : 0;
    });

    // Overall error rate
    const totalEvents = events.length;
    const totalErrors = events.filter(e => e.success === false).length;
    const overallErrorRate = totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0;

    // Error type breakdown
    const errorTypes: Record<string, number> = {};
    events
      .filter(e => e.errorType)
      .forEach(event => {
        errorTypes[event.errorType!] = (errorTypes[event.errorType!] || 0) + 1;
      });

    // Response time by event type
    const responseTimeByType: Record<string, { avg: number; count: number }> = {};
    timedEvents.forEach(event => {
      if (!responseTimeByType[event.eventType]) {
        responseTimeByType[event.eventType] = { avg: 0, count: 0 };
      }
      const current = responseTimeByType[event.eventType];
      current.avg = (current.avg * current.count + event.durationMs!) / (current.count + 1);
      current.count++;
    });

    Object.values(responseTimeByType).forEach(stats => {
      stats.avg = Math.round(stats.avg);
    });

    return {
      responseTime: {
        avg: avgResponseTime,
        p50,
        p95,
        p99,
      },
      errorRate: {
        overall: overallErrorRate,
        byFeature: errorsByFeature,
        byType: errorTypes,
      },
      responseTimeByType,
      totalEvents,
      totalErrors,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// TOP CONTENT
// ═══════════════════════════════════════════════════════════════

// Get top/popular content
export const getTopContent = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    limit: v.optional(v.number()),
    customStartTime: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { timeRange, limit = 10, customStartTime, workspaceId }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);

    // Get document events
    let events: Doc<"analyticsEvents">[];
    if (workspaceId) {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.eq(q.field("eventType"), "document_generated")
          )
        )
        .collect();
    } else {
      events = await ctx.db
        .query("analyticsEvents")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), startTime),
            q.eq(q.field("eventType"), "document_generated")
          )
        )
        .collect();
    }

    // Extract topics/tags from event data
    const topicCounts: Record<string, number> = {};
    events.forEach(event => {
      const topic = event.eventData?.topic;
      if (topic) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([topic, count]) => ({ topic, count }));

    // Source distribution
    const sourceCounts: Record<string, number> = {};
    events.forEach(event => {
      const mode = event.generationMode || "unknown";
      sourceCounts[mode] = (sourceCounts[mode] || 0) + 1;
    });

    // Provider distribution
    const providerCounts: Record<string, number> = {};
    events.forEach(event => {
      if (event.provider) {
        providerCounts[event.provider] = (providerCounts[event.provider] || 0) + 1;
      }
    });

    const topProviders = Object.entries(providerCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([provider, count]) => ({ provider, count }));

    return {
      topTopics,
      sourceDistribution: sourceCounts,
      providerDistribution: topProviders,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY QUERIES
// ═══════════════════════════════════════════════════════════════

// Get usage statistics (legacy - for backward compatibility)
export const getUsageStats = query({
  args: {
    timeRange: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"), v.literal("all"))),
  },
  handler: async (ctx, { timeRange = "month" }) => {
    const userId = await getUserId(ctx);

    // Map legacy time range to new format
    const newTimeRange = timeRange === "day" ? "24h" :
                         timeRange === "week" ? "7d" :
                         timeRange === "month" ? "30d" : "90d";
    const startTime = getTimeBoundary(newTimeRange);

    // Get all events in time range
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    // Calculate statistics
    const stats = {
      totalEvents: events.length,
      documentsGenerated: 0,
      documentsViewed: 0,
      documentsExported: 0,
      mcpServersGenerated: 0,
      crawlsCompleted: 0,
      searchesPerformed: 0,
      templatesUsed: 0,
      totalTokensUsed: 0,
      providerUsage: {} as Record<string, number>,
      modelUsage: {} as Record<string, number>,
      eventsByDay: {} as Record<string, number>,
    };

    events.forEach((event) => {
      switch (event.eventType) {
        case "document_generated":
          stats.documentsGenerated++;
          break;
        case "document_viewed":
          stats.documentsViewed++;
          break;
        case "document_exported":
          stats.documentsExported++;
          break;
        case "mcp_generated":
          stats.mcpServersGenerated++;
          break;
        case "crawl_completed":
          stats.crawlsCompleted++;
          break;
        case "search_performed":
          stats.searchesPerformed++;
          break;
        case "template_used":
          stats.templatesUsed++;
          break;
      }

      if (event.tokensUsed) {
        stats.totalTokensUsed += event.tokensUsed;
      }

      if (event.provider) {
        stats.providerUsage[event.provider] =
          (stats.providerUsage[event.provider] || 0) + 1;
      }

      if (event.model) {
        stats.modelUsage[event.model] =
          (stats.modelUsage[event.model] || 0) + 1;
      }

      const day = new Date(event.timestamp).toISOString().split("T")[0];
      stats.eventsByDay[day] = (stats.eventsByDay[day] || 0) + 1;
    });

    return stats;
  },
});

// Get recent activity
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getUserId(ctx);

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return events.map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      eventData: event.eventData,
      provider: event.provider,
      model: event.model,
      timestamp: event.timestamp,
    }));
  },
});

// Get provider statistics
export const getProviderStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("provider"), undefined))
      .collect();

    const providerStats: Record<
      string,
      {
        totalCalls: number;
        totalTokens: number;
        avgTokensPerCall: number;
        models: Record<string, number>;
        lastUsed: number;
      }
    > = {};

    events.forEach((event) => {
      if (!event.provider) return;

      if (!providerStats[event.provider]) {
        providerStats[event.provider] = {
          totalCalls: 0,
          totalTokens: 0,
          avgTokensPerCall: 0,
          models: {},
          lastUsed: 0,
        };
      }

      const stats = providerStats[event.provider];
      stats.totalCalls++;
      stats.totalTokens += event.tokensUsed || 0;
      stats.lastUsed = Math.max(stats.lastUsed, event.timestamp);

      if (event.model) {
        stats.models[event.model] = (stats.models[event.model] || 0) + 1;
      }
    });

    Object.values(providerStats).forEach((stats) => {
      stats.avgTokensPerCall =
        stats.totalCalls > 0
          ? Math.round(stats.totalTokens / stats.totalCalls)
          : 0;
    });

    return providerStats;
  },
});

// Get generation history chart data
export const getGenerationHistory = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = 30 }) => {
    const userId = await getUserId(ctx);
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startTime),
          q.eq(q.field("eventType"), "document_generated")
        )
      )
      .collect();

    const byDay: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = date.toISOString().split("T")[0];
      byDay[dayKey] = 0;
    }

    events.forEach((event) => {
      const dayKey = new Date(event.timestamp).toISOString().split("T")[0];
      if (byDay[dayKey] !== undefined) {
        byDay[dayKey]++;
      }
    });

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  },
});

// ═══════════════════════════════════════════════════════════════
// DATA AGGREGATION & MAINTENANCE
// ═══════════════════════════════════════════════════════════════

// Aggregate daily stats (called by cron job)
export const aggregateDailyStats = internalMutation({
  args: {
    date: v.string(), // YYYY-MM-DD (empty string = yesterday)
  },
  handler: async (ctx, { date }) => {
    // If date is empty, use yesterday's date
    const targetDate = date || formatDateKey(Date.now() - 24 * 60 * 60 * 1000);

    // Get all events for this date
    const startOfDay = new Date(targetDate).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byTimestamp")
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startOfDay),
          q.lt(q.field("timestamp"), endOfDay)
        )
      )
      .collect();

    // Group by userId
    const byUser: Record<string, Doc<"analyticsEvents">[]> = {};
    events.forEach(event => {
      if (!byUser[event.userId]) byUser[event.userId] = [];
      byUser[event.userId].push(event);
    });

    // Create/update daily stats for each user
    for (const [userId, userEvents] of Object.entries(byUser)) {
      const docEvents = userEvents.filter(e => e.eventType === "document_generated");

      const stats = {
        userId,
        date: targetDate,
        documentsGenerated: docEvents.length,
        documentsByMode: {
          search: docEvents.filter(e => e.generationMode === "search").length,
          crawl: docEvents.filter(e => e.generationMode === "crawl").length,
          github: docEvents.filter(e => e.generationMode === "github").length,
          mcp: docEvents.filter(e => e.generationMode === "mcp").length,
        },
        avgGenerationTimeMs: docEvents.length > 0
          ? Math.round(
              docEvents
                .filter(e => e.durationMs)
                .reduce((sum, e) => sum + e.durationMs!, 0) /
              docEvents.filter(e => e.durationMs).length || 1
            )
          : 0,
        successCount: docEvents.filter(e => e.success !== false).length,
        failureCount: docEvents.filter(e => e.success === false).length,
        totalWordCount: userEvents.reduce((sum, e) => sum + (e.wordCount || 0), 0),
        totalTokensUsed: userEvents.reduce((sum, e) => sum + (e.tokensUsed || 0), 0),
        totalSourcesUsed: userEvents.reduce((sum, e) => sum + (e.sourceCount || 0), 0),
        apiCallCount: userEvents.filter(e => e.eventType === "api_call").length,
        webhookDeliveryCount: userEvents.filter(e => e.eventType === "webhook_delivered").length,
        botCommandCount: userEvents.filter(e => e.eventType === "bot_command").length,
        importCount: userEvents.filter(e => e.eventType === "import_completed").length,
        providerUsage: userEvents.reduce((acc, e) => {
          if (e.provider) acc[e.provider] = (acc[e.provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        modelUsage: userEvents.reduce((acc, e) => {
          if (e.model) acc[e.model] = (acc[e.model] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        aggregatedAt: Date.now(),
      };

      // Check if stats already exist for this user/date
      const existing = await ctx.db
        .query("dailyStats")
        .withIndex("byUserAndDate", (q) => q.eq("userId", userId).eq("date", targetDate))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, stats);
      } else {
        await ctx.db.insert("dailyStats", stats);
      }
    }
  },
});

// Clear old events (older than 90 days)
export const clearOldEvents = mutation({
  args: {
    olderThanDays: v.number(),
  },
  handler: async (ctx, { olderThanDays }) => {
    const userId = await getUserId(ctx);
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const oldEvents = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: oldEvents.length };
  },
});

// Internal: Clean up old events (for cron job)
export const cleanupOldEventsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days

    // Delete old events in batches
    const oldEvents = await ctx.db
      .query("analyticsEvents")
      .withIndex("byTimestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .take(1000);

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: oldEvents.length };
  },
});

// ═══════════════════════════════════════════════════════════════
// EXPORT ANALYTICS DATA
// ═══════════════════════════════════════════════════════════════

// Export analytics data as JSON or CSV
export const exportData = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    format: v.union(v.literal("json"), v.literal("csv")),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, { timeRange, format, customStartTime }) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(timeRange, customStartTime);

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    if (format === "json") {
      return {
        format: "json",
        data: events.map(e => ({
          eventType: e.eventType,
          provider: e.provider,
          model: e.model,
          tokensUsed: e.tokensUsed,
          generationMode: e.generationMode,
          durationMs: e.durationMs,
          success: e.success,
          wordCount: e.wordCount,
          timestamp: e.timestamp,
          date: new Date(e.timestamp).toISOString(),
        })),
      };
    }

    // CSV format
    const headers = ["date", "eventType", "provider", "model", "tokensUsed", "generationMode", "durationMs", "success", "wordCount"];
    const rows = events.map(e => [
      new Date(e.timestamp).toISOString(),
      e.eventType,
      e.provider || "",
      e.model || "",
      e.tokensUsed?.toString() || "",
      e.generationMode || "",
      e.durationMs?.toString() || "",
      e.success?.toString() || "",
      e.wordCount?.toString() || "",
    ].join(","));

    return {
      format: "csv",
      data: [headers.join(","), ...rows].join("\n"),
    };
  },
});

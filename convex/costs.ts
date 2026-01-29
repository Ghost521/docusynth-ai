import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "custom";
export type CostScope = "workspace" | "project" | "user";

// Provider pricing per 1M tokens (in cents)
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  "openai:gpt-4o": { input: 250, output: 1000 },
  "openai:gpt-4o-mini": { input: 15, output: 60 },
  "openai:gpt-4-turbo": { input: 1000, output: 3000 },
  "openai:gpt-3.5-turbo": { input: 50, output: 150 },
  "anthropic:claude-opus-4": { input: 1500, output: 7500 },
  "anthropic:claude-sonnet-4": { input: 300, output: 1500 },
  "anthropic:claude-3-5-haiku": { input: 100, output: 500 },
  "google:gemini-2.0-flash": { input: 10, output: 40 },
  "google:gemini-2.5-pro": { input: 125, output: 250 },
  "google:gemini-1.5-pro": { input: 125, output: 500 },
  // Aliases
  "gemini:gemini-2.0-flash": { input: 10, output: 40 },
  "gemini:gemini-2.5-pro-preview-05-06": { input: 125, output: 250 },
  "claude:claude-sonnet-4-20250514": { input: 300, output: 1500 },
  "claude:claude-opus-4-20250514": { input: 1500, output: 7500 },
};

// Default pricing if model not found
const DEFAULT_PRICING = { input: 100, output: 300 };

// Helper to get time boundary
function getTimeBoundary(timeRange: TimeRange, customStart?: number): number {
  const now = Date.now();
  switch (timeRange) {
    case "24h": return now - 24 * 60 * 60 * 1000;
    case "7d": return now - 7 * 24 * 60 * 60 * 1000;
    case "30d": return now - 30 * 24 * 60 * 60 * 1000;
    case "90d": return now - 90 * 24 * 60 * 60 * 1000;
    case "custom": return customStart || now - 30 * 24 * 60 * 60 * 1000;
    default: return now - 30 * 24 * 60 * 60 * 1000;
  }
}

// Helper to calculate cost
function calculateCostFromTokens(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model: string
): number {
  const key = `${provider.toLowerCase()}:${model}`;
  const pricing = PROVIDER_PRICING[key] || DEFAULT_PRICING;

  // Calculate cost in dollars (pricing is in cents per 1M tokens)
  const inputCost = (inputTokens * pricing.input) / 1_000_000 / 100;
  const outputCost = (outputTokens * pricing.output) / 1_000_000 / 100;

  return inputCost + outputCost;
}

// Format date as YYYY-MM-DD
function formatDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════
// RECORD USAGE
// ═══════════════════════════════════════════════════════════════

// Record usage from client
export const recordUsage = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    operation: v.string(),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Calculate cost
    const cost = calculateCostFromTokens(
      args.inputTokens,
      args.outputTokens,
      args.provider,
      args.model
    );

    // Record usage
    const recordId = await ctx.db.insert("usageRecords", {
      userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      documentId: args.documentId,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cost,
      operation: args.operation,
      metadata: args.metadata,
      timestamp: Date.now(),
    });

    // Check budgets and trigger alerts if needed
    await ctx.scheduler.runAfter(0, internal.budgets.checkBudgetsForUsage, {
      userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      cost,
    });

    return { recordId, cost };
  },
});

// Internal version for server-side recording
export const recordUsageInternal = internalMutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    operation: v.string(),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const cost = calculateCostFromTokens(
      args.inputTokens,
      args.outputTokens,
      args.provider,
      args.model
    );

    const recordId = await ctx.db.insert("usageRecords", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      documentId: args.documentId,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cost,
      operation: args.operation,
      metadata: args.metadata,
      timestamp: Date.now(),
    });

    // Check budgets
    await ctx.scheduler.runAfter(0, internal.budgets.checkBudgetsForUsage, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      cost,
    });

    return { recordId, cost };
  },
});

// ═══════════════════════════════════════════════════════════════
// USAGE SUMMARY
// ═══════════════════════════════════════════════════════════════

// Get usage summary for a scope
export const getUsageSummary = query({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    // Build query based on scope
    let records: Doc<"usageRecords">[];

    if (args.scope === "workspace" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.scopeId as Id<"workspaces">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else if (args.scope === "project" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byProject", (q) => q.eq("projectId", args.scopeId as Id<"projects">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Calculate totals
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const requestCount = records.length;

    // Calculate previous period for comparison
    const periodLength = Date.now() - startTime;
    const previousStartTime = startTime - periodLength;

    let previousRecords: Doc<"usageRecords">[];
    if (args.scope === "workspace" && args.scopeId) {
      previousRecords = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.scopeId as Id<"workspaces">))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), previousStartTime),
            q.lt(q.field("timestamp"), startTime)
          )
        )
        .collect();
    } else if (args.scope === "project" && args.scopeId) {
      previousRecords = await ctx.db
        .query("usageRecords")
        .withIndex("byProject", (q) => q.eq("projectId", args.scopeId as Id<"projects">))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), previousStartTime),
            q.lt(q.field("timestamp"), startTime)
          )
        )
        .collect();
    } else {
      previousRecords = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), previousStartTime),
            q.lt(q.field("timestamp"), startTime)
          )
        )
        .collect();
    }

    const previousCost = previousRecords.reduce((sum, r) => sum + r.cost, 0);
    const costTrend = previousCost > 0
      ? ((totalCost - previousCost) / previousCost) * 100
      : totalCost > 0 ? 100 : 0;

    // Calculate average cost per request
    const avgCostPerRequest = requestCount > 0 ? totalCost / requestCount : 0;

    // Daily projected cost
    const daysInPeriod = periodLength / (24 * 60 * 60 * 1000);
    const dailyAvgCost = daysInPeriod > 0 ? totalCost / daysInPeriod : 0;
    const projectedMonthlyCost = dailyAvgCost * 30;

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      requestCount,
      costTrend,
      avgCostPerRequest,
      dailyAvgCost,
      projectedMonthlyCost,
      timeRange: args.timeRange,
      startTime,
      endTime: Date.now(),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// COSTS BY PROVIDER
// ═══════════════════════════════════════════════════════════════

// Get cost breakdown by provider
export const getCostsByProvider = query({
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
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    let records: Doc<"usageRecords">[];
    if (args.workspaceId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Group by provider
    const byProvider: Record<string, {
      provider: string;
      cost: number;
      tokens: number;
      requests: number;
      models: Record<string, { cost: number; tokens: number; requests: number }>;
    }> = {};

    records.forEach((record) => {
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = {
          provider: record.provider,
          cost: 0,
          tokens: 0,
          requests: 0,
          models: {},
        };
      }

      byProvider[record.provider].cost += record.cost;
      byProvider[record.provider].tokens += record.totalTokens;
      byProvider[record.provider].requests++;

      if (!byProvider[record.provider].models[record.model]) {
        byProvider[record.provider].models[record.model] = {
          cost: 0,
          tokens: 0,
          requests: 0,
        };
      }
      byProvider[record.provider].models[record.model].cost += record.cost;
      byProvider[record.provider].models[record.model].tokens += record.totalTokens;
      byProvider[record.provider].models[record.model].requests++;
    });

    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    return {
      providers: Object.values(byProvider).sort((a, b) => b.cost - a.cost),
      totalCost,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// COSTS BY USER (Workspace-level)
// ═══════════════════════════════════════════════════════════════

// Get cost breakdown by user within a workspace
export const getCostsByUser = query({
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
  handler: async (ctx, args) => {
    await getUserId(ctx); // Verify auth
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    const records = await ctx.db
      .query("usageRecords")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    // Group by user
    const byUser: Record<string, {
      userId: string;
      cost: number;
      tokens: number;
      requests: number;
    }> = {};

    records.forEach((record) => {
      if (!byUser[record.userId]) {
        byUser[record.userId] = {
          userId: record.userId,
          cost: 0,
          tokens: 0,
          requests: 0,
        };
      }
      byUser[record.userId].cost += record.cost;
      byUser[record.userId].tokens += record.totalTokens;
      byUser[record.userId].requests++;
    });

    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    return {
      users: Object.values(byUser).sort((a, b) => b.cost - a.cost),
      totalCost,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// COSTS BY PROJECT
// ═══════════════════════════════════════════════════════════════

// Get cost breakdown by project
export const getCostsByProject = query({
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
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    let records: Doc<"usageRecords">[];
    if (args.workspaceId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Group by project
    const byProject: Record<string, {
      projectId: string | null;
      cost: number;
      tokens: number;
      requests: number;
    }> = {};

    records.forEach((record) => {
      const projectKey = record.projectId?.toString() || "unassigned";
      if (!byProject[projectKey]) {
        byProject[projectKey] = {
          projectId: record.projectId?.toString() || null,
          cost: 0,
          tokens: 0,
          requests: 0,
        };
      }
      byProject[projectKey].cost += record.cost;
      byProject[projectKey].tokens += record.totalTokens;
      byProject[projectKey].requests++;
    });

    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Get project names
    const projectIds = Object.values(byProject)
      .filter(p => p.projectId)
      .map(p => p.projectId as string);

    const projects: Array<{
      projectId: string | null;
      projectName: string;
      cost: number;
      tokens: number;
      requests: number;
    }> = [];

    for (const [key, data] of Object.entries(byProject)) {
      let projectName = "Unassigned";
      if (data.projectId) {
        try {
          const project = await ctx.db.get(data.projectId as Id<"projects">);
          projectName = project?.name || "Unknown Project";
        } catch {
          projectName = "Unknown Project";
        }
      }
      projects.push({ ...data, projectName });
    }

    return {
      projects: projects.sort((a, b) => b.cost - a.cost),
      totalCost,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// COST TRENDS
// ═══════════════════════════════════════════════════════════════

// Get cost trends over time
export const getCostTrends = query({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    let records: Doc<"usageRecords">[];

    if (args.scope === "workspace" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.scopeId as Id<"workspaces">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else if (args.scope === "project" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byProject", (q) => q.eq("projectId", args.scopeId as Id<"projects">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Group by day
    const byDay: Record<string, {
      date: string;
      cost: number;
      tokens: number;
      requests: number;
    }> = {};

    // Initialize all days in range
    const dayCount = args.timeRange === "24h" ? 1 :
                     args.timeRange === "7d" ? 7 :
                     args.timeRange === "30d" ? 30 : 90;

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = formatDateKey(date.getTime());
      byDay[dayKey] = { date: dayKey, cost: 0, tokens: 0, requests: 0 };
    }

    // Aggregate records
    records.forEach((record) => {
      const dayKey = formatDateKey(record.timestamp);
      if (byDay[dayKey]) {
        byDay[dayKey].cost += record.cost;
        byDay[dayKey].tokens += record.totalTokens;
        byDay[dayKey].requests++;
      }
    });

    const trends = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate moving average
    const movingAvg = trends.map((day, index) => {
      const windowSize = Math.min(7, index + 1);
      const window = trends.slice(Math.max(0, index - windowSize + 1), index + 1);
      const avg = window.reduce((sum, d) => sum + d.cost, 0) / windowSize;
      return { ...day, movingAvg: avg };
    });

    return {
      trends: movingAvg,
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// TOP COST DRIVERS
// ═══════════════════════════════════════════════════════════════

// Get top cost-driving operations/documents
export const getTopCostDrivers = query({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
    limit: v.optional(v.number()),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);
    const limit = args.limit || 10;

    let records: Doc<"usageRecords">[];

    if (args.scope === "workspace" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.scopeId as Id<"workspaces">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else if (args.scope === "project" && args.scopeId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byProject", (q) => q.eq("projectId", args.scopeId as Id<"projects">))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    // Group by operation
    const byOperation: Record<string, {
      operation: string;
      cost: number;
      tokens: number;
      requests: number;
      avgCost: number;
    }> = {};

    records.forEach((record) => {
      if (!byOperation[record.operation]) {
        byOperation[record.operation] = {
          operation: record.operation,
          cost: 0,
          tokens: 0,
          requests: 0,
          avgCost: 0,
        };
      }
      byOperation[record.operation].cost += record.cost;
      byOperation[record.operation].tokens += record.totalTokens;
      byOperation[record.operation].requests++;
    });

    // Calculate averages
    Object.values(byOperation).forEach((op) => {
      op.avgCost = op.requests > 0 ? op.cost / op.requests : 0;
    });

    // Get top single requests
    const topRequests = records
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit)
      .map((r) => ({
        id: r._id,
        operation: r.operation,
        provider: r.provider,
        model: r.model,
        cost: r.cost,
        tokens: r.totalTokens,
        timestamp: r.timestamp,
      }));

    return {
      byOperation: Object.values(byOperation)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, limit),
      topRequests,
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// COST ESTIMATION
// ═══════════════════════════════════════════════════════════════

// Estimate cost for a given number of tokens
export const estimateCost = query({
  args: {
    inputTokens: v.number(),
    outputTokens: v.number(),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await getUserId(ctx);

    const cost = calculateCostFromTokens(
      args.inputTokens,
      args.outputTokens,
      args.provider,
      args.model
    );

    return {
      estimatedCost: cost,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
    };
  },
});

// Get pricing for all providers
export const getPricing = query({
  args: {},
  handler: async (ctx) => {
    await getUserId(ctx);

    // Format pricing data for display
    const providers: Record<string, Array<{
      model: string;
      inputPer1M: number;
      outputPer1M: number;
    }>> = {};

    Object.entries(PROVIDER_PRICING).forEach(([key, pricing]) => {
      const [provider, model] = key.split(":");
      if (!providers[provider]) {
        providers[provider] = [];
      }
      // Avoid duplicates
      if (!providers[provider].find(p => p.model === model)) {
        providers[provider].push({
          model,
          inputPer1M: pricing.input,
          outputPer1M: pricing.output,
        });
      }
    });

    return providers;
  },
});

// ═══════════════════════════════════════════════════════════════
// USAGE RECORDS LIST
// ═══════════════════════════════════════════════════════════════

// Get detailed usage records with pagination
export const getUsageRecords = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    projectId: v.optional(v.id("projects")),
    provider: v.optional(v.string()),
    operation: v.optional(v.string()),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);
    const limit = args.limit || 50;

    let query;

    if (args.workspaceId) {
      query = ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId));
    } else if (args.projectId) {
      query = ctx.db
        .query("usageRecords")
        .withIndex("byProject", (q) => q.eq("projectId", args.projectId));
    } else {
      query = ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId));
    }

    let records = await query
      .filter((q) => {
        let conditions = q.gte(q.field("timestamp"), startTime);

        if (args.provider) {
          conditions = q.and(conditions, q.eq(q.field("provider"), args.provider));
        }
        if (args.operation) {
          conditions = q.and(conditions, q.eq(q.field("operation"), args.operation));
        }

        return conditions;
      })
      .order("desc")
      .take(limit + 1);

    const hasMore = records.length > limit;
    if (hasMore) {
      records = records.slice(0, limit);
    }

    return {
      records: records.map((r) => ({
        _id: r._id,
        provider: r.provider,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        cost: r.cost,
        operation: r.operation,
        timestamp: r.timestamp,
      })),
      hasMore,
      nextCursor: hasMore ? records[records.length - 1]._id : null,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

// Export usage data as CSV
export const exportUsageData = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d"),
      v.literal("custom")
    ),
    customStartTime: v.optional(v.number()),
    format: v.union(v.literal("json"), v.literal("csv")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const startTime = getTimeBoundary(args.timeRange, args.customStartTime);

    let records: Doc<"usageRecords">[];

    if (args.workspaceId) {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    } else {
      records = await ctx.db
        .query("usageRecords")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), startTime))
        .collect();
    }

    if (args.format === "json") {
      return {
        format: "json",
        data: records.map((r) => ({
          date: new Date(r.timestamp).toISOString(),
          provider: r.provider,
          model: r.model,
          operation: r.operation,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          totalTokens: r.totalTokens,
          cost: r.cost,
        })),
      };
    }

    // CSV format
    const headers = [
      "date",
      "provider",
      "model",
      "operation",
      "inputTokens",
      "outputTokens",
      "totalTokens",
      "cost",
    ];

    const rows = records.map((r) =>
      [
        new Date(r.timestamp).toISOString(),
        r.provider,
        r.model,
        r.operation,
        r.inputTokens.toString(),
        r.outputTokens.toString(),
        r.totalTokens.toString(),
        r.cost.toFixed(6),
      ].join(",")
    );

    return {
      format: "csv",
      data: [headers.join(","), ...rows].join("\n"),
    };
  },
});

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type BudgetScope = "workspace" | "project" | "user";
export type BudgetPeriod = "daily" | "weekly" | "monthly";
export type AlertThreshold = 50 | 80 | 100;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// Get the start of the current period
function getPeriodStart(period: BudgetPeriod): number {
  const now = new Date();

  switch (period) {
    case "daily": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    case "weekly": {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day;
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.getTime();
    }
    default:
      return now.getTime();
  }
}

// Get end of current period
function getPeriodEnd(period: BudgetPeriod): number {
  const now = new Date();

  switch (period) {
    case "daily": {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end.getTime();
    }
    case "weekly": {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + 6;
      start.setDate(diff);
      start.setHours(23, 59, 59, 999);
      return start.getTime();
    }
    case "monthly": {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return end.getTime();
    }
    default:
      return now.getTime();
  }
}

// Days remaining in period
function getDaysRemaining(period: BudgetPeriod): number {
  const now = Date.now();
  const end = getPeriodEnd(period);
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
}

// ═══════════════════════════════════════════════════════════════
// CREATE BUDGET
// ═══════════════════════════════════════════════════════════════

export const createBudget = mutation({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
    name: v.string(),
    amount: v.number(),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    currency: v.optional(v.string()),
    alertThresholds: v.array(v.number()),
    hardLimit: v.boolean(),
    rollover: v.optional(v.boolean()),
    notifyEmail: v.optional(v.boolean()),
    notifyInApp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify user has access to the scope
    if (args.scope === "workspace" && args.scopeId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", args.scopeId as Id<"workspaces">).eq("userId", userId)
        )
        .unique();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("You don't have permission to create budgets for this workspace");
      }
    } else if (args.scope === "project" && args.scopeId) {
      const project = await ctx.db.get(args.scopeId as Id<"projects">);
      if (!project || project.userId !== userId) {
        throw new Error("You don't have permission to create budgets for this project");
      }
    }

    // Check for existing budget with same scope
    const existing = await ctx.db
      .query("budgets")
      .withIndex("byScopeAndPeriod", (q) =>
        q
          .eq("scope", args.scope)
          .eq("scopeId", args.scopeId || userId)
          .eq("period", args.period)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      throw new Error(`An active ${args.period} budget already exists for this scope`);
    }

    const budgetId = await ctx.db.insert("budgets", {
      userId,
      scope: args.scope,
      scopeId: args.scopeId || userId,
      name: args.name,
      amount: args.amount,
      period: args.period,
      currency: args.currency || "USD",
      alertThresholds: args.alertThresholds,
      hardLimit: args.hardLimit,
      rollover: args.rollover || false,
      currentSpend: 0,
      periodStart: getPeriodStart(args.period),
      periodEnd: getPeriodEnd(args.period),
      isActive: true,
      notifyEmail: args.notifyEmail ?? true,
      notifyInApp: args.notifyInApp ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { budgetId };
  },
});

// ═══════════════════════════════════════════════════════════════
// UPDATE BUDGET
// ═══════════════════════════════════════════════════════════════

export const updateBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    alertThresholds: v.optional(v.array(v.number())),
    hardLimit: v.optional(v.boolean()),
    rollover: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    notifyEmail: v.optional(v.boolean()),
    notifyInApp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Verify ownership
    if (budget.userId !== userId) {
      // Check workspace admin access
      if (budget.scope === "workspace") {
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("byWorkspaceAndUser", (q) =>
            q.eq("workspaceId", budget.scopeId as Id<"workspaces">).eq("userId", userId)
          )
          .unique();

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new Error("You don't have permission to update this budget");
        }
      } else {
        throw new Error("You don't have permission to update this budget");
      }
    }

    const updates: Partial<Doc<"budgets">> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.alertThresholds !== undefined) updates.alertThresholds = args.alertThresholds;
    if (args.hardLimit !== undefined) updates.hardLimit = args.hardLimit;
    if (args.rollover !== undefined) updates.rollover = args.rollover;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.notifyEmail !== undefined) updates.notifyEmail = args.notifyEmail;
    if (args.notifyInApp !== undefined) updates.notifyInApp = args.notifyInApp;

    await ctx.db.patch(args.budgetId, updates);

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// DELETE BUDGET
// ═══════════════════════════════════════════════════════════════

export const deleteBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Verify ownership
    if (budget.userId !== userId) {
      if (budget.scope === "workspace") {
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("byWorkspaceAndUser", (q) =>
            q.eq("workspaceId", budget.scopeId as Id<"workspaces">).eq("userId", userId)
          )
          .unique();

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new Error("You don't have permission to delete this budget");
        }
      } else {
        throw new Error("You don't have permission to delete this budget");
      }
    }

    // Delete associated alerts
    const alerts = await ctx.db
      .query("budgetAlerts")
      .withIndex("byBudget", (q) => q.eq("budgetId", args.budgetId))
      .collect();

    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    await ctx.db.delete(args.budgetId);

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// GET BUDGET
// ═══════════════════════════════════════════════════════════════

export const getBudget = query({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
    period: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const scopeId = args.scopeId || userId;

    let budgetsQuery = ctx.db
      .query("budgets")
      .filter((q) =>
        q.and(
          q.eq(q.field("scope"), args.scope),
          q.eq(q.field("scopeId"), scopeId),
          q.eq(q.field("isActive"), true)
        )
      );

    const budgets = await budgetsQuery.collect();

    // Filter by period if specified
    const filteredBudgets = args.period
      ? budgets.filter((b) => b.period === args.period)
      : budgets;

    if (filteredBudgets.length === 0) {
      return null;
    }

    const budget = filteredBudgets[0];

    // Calculate utilization
    const utilization = budget.amount > 0
      ? (budget.currentSpend / budget.amount) * 100
      : 0;

    // Get days remaining
    const daysRemaining = getDaysRemaining(budget.period);

    // Project spend
    const daysElapsed = Math.max(1, Math.ceil(
      (Date.now() - budget.periodStart) / (24 * 60 * 60 * 1000)
    ));
    const dailyRate = budget.currentSpend / daysElapsed;
    const projectedSpend = dailyRate * (daysElapsed + daysRemaining);

    return {
      ...budget,
      utilization,
      daysRemaining,
      projectedSpend,
      onTrackToExceed: projectedSpend > budget.amount,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// LIST BUDGETS
// ═══════════════════════════════════════════════════════════════

export const listBudgets = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    let budgets: Doc<"budgets">[];

    if (args.workspaceId) {
      // Get workspace budgets
      budgets = await ctx.db
        .query("budgets")
        .filter((q) =>
          q.or(
            // Workspace-level budgets
            q.and(
              q.eq(q.field("scope"), "workspace"),
              q.eq(q.field("scopeId"), args.workspaceId)
            ),
            // Project budgets within workspace
            q.and(
              q.eq(q.field("scope"), "project"),
              q.eq(q.field("userId"), userId)
            ),
            // User budgets for members
            q.and(
              q.eq(q.field("scope"), "user"),
              q.eq(q.field("userId"), userId)
            )
          )
        )
        .collect();
    } else {
      // Get user's budgets
      budgets = await ctx.db
        .query("budgets")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .collect();
    }

    if (!args.includeInactive) {
      budgets = budgets.filter((b) => b.isActive);
    }

    // Enrich with utilization data
    return budgets.map((budget) => {
      const utilization = budget.amount > 0
        ? (budget.currentSpend / budget.amount) * 100
        : 0;

      const daysRemaining = getDaysRemaining(budget.period);

      const daysElapsed = Math.max(1, Math.ceil(
        (Date.now() - budget.periodStart) / (24 * 60 * 60 * 1000)
      ));
      const dailyRate = budget.currentSpend / daysElapsed;
      const projectedSpend = dailyRate * (daysElapsed + daysRemaining);

      return {
        ...budget,
        utilization,
        daysRemaining,
        projectedSpend,
        onTrackToExceed: projectedSpend > budget.amount,
        status: utilization >= 100 ? "exceeded" :
                utilization >= 80 ? "critical" :
                utilization >= 50 ? "warning" : "healthy",
      };
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// CHECK BUDGET
// ═══════════════════════════════════════════════════════════════

export const checkBudget = query({
  args: {
    scope: v.union(v.literal("workspace"), v.literal("project"), v.literal("user")),
    scopeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const scopeId = args.scopeId || userId;

    // Get all active budgets for scope
    const budgets = await ctx.db
      .query("budgets")
      .filter((q) =>
        q.and(
          q.eq(q.field("scope"), args.scope),
          q.eq(q.field("scopeId"), scopeId),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();

    if (budgets.length === 0) {
      return { hasActiveBudget: false, canProceed: true };
    }

    // Check each budget
    const budgetStatuses = budgets.map((budget) => {
      const utilization = budget.amount > 0
        ? (budget.currentSpend / budget.amount) * 100
        : 0;

      return {
        budgetId: budget._id,
        name: budget.name,
        period: budget.period,
        utilization,
        exceeded: utilization >= 100,
        hardLimit: budget.hardLimit,
        remaining: budget.amount - budget.currentSpend,
      };
    });

    // Check if any hard limit is exceeded
    const hardLimitExceeded = budgetStatuses.some(
      (b) => b.exceeded && b.hardLimit
    );

    return {
      hasActiveBudget: true,
      canProceed: !hardLimitExceeded,
      budgets: budgetStatuses,
      hardLimitExceeded,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// GET BUDGET ALERTS
// ═══════════════════════════════════════════════════════════════

export const getBudgetAlerts = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    includeDismissed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const limit = args.limit || 20;

    // Get user's budgets first
    let budgetIds: Id<"budgets">[];

    if (args.workspaceId) {
      const budgets = await ctx.db
        .query("budgets")
        .filter((q) =>
          q.and(
            q.eq(q.field("scope"), "workspace"),
            q.eq(q.field("scopeId"), args.workspaceId)
          )
        )
        .collect();
      budgetIds = budgets.map((b) => b._id);
    } else {
      const budgets = await ctx.db
        .query("budgets")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .collect();
      budgetIds = budgets.map((b) => b._id);
    }

    // Get alerts for these budgets
    let alerts: Doc<"budgetAlerts">[] = [];

    for (const budgetId of budgetIds) {
      const budgetAlerts = await ctx.db
        .query("budgetAlerts")
        .withIndex("byBudget", (q) => q.eq("budgetId", budgetId))
        .order("desc")
        .take(limit);

      alerts.push(...budgetAlerts);
    }

    // Filter dismissed if needed
    if (!args.includeDismissed) {
      alerts = alerts.filter((a) => !a.dismissed);
    }

    // Sort by timestamp and limit
    alerts = alerts
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);

    // Enrich with budget info
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const budget = await ctx.db.get(alert.budgetId);
        return {
          ...alert,
          budgetName: budget?.name || "Unknown Budget",
          budgetScope: budget?.scope || "unknown",
          budgetAmount: budget?.amount || 0,
        };
      })
    );

    return enrichedAlerts;
  },
});

// ═══════════════════════════════════════════════════════════════
// DISMISS ALERT
// ═══════════════════════════════════════════════════════════════

export const dismissAlert = mutation({
  args: {
    alertId: v.id("budgetAlerts"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    // Verify ownership through budget
    const budget = await ctx.db.get(alert.budgetId);
    if (!budget || budget.userId !== userId) {
      throw new Error("You don't have permission to dismiss this alert");
    }

    await ctx.db.patch(args.alertId, {
      dismissed: true,
      dismissedAt: Date.now(),
    });

    return { success: true };
  },
});

// Dismiss all alerts for a budget
export const dismissAllAlerts = mutation({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.userId !== userId) {
      throw new Error("You don't have permission to dismiss alerts for this budget");
    }

    const alerts = await ctx.db
      .query("budgetAlerts")
      .withIndex("byBudget", (q) => q.eq("budgetId", args.budgetId))
      .filter((q) => q.eq(q.field("dismissed"), false))
      .collect();

    const now = Date.now();
    for (const alert of alerts) {
      await ctx.db.patch(alert._id, {
        dismissed: true,
        dismissedAt: now,
      });
    }

    return { dismissed: alerts.length };
  },
});

// ═══════════════════════════════════════════════════════════════
// INTERNAL: CHECK BUDGETS FOR USAGE
// ═══════════════════════════════════════════════════════════════

export const checkBudgetsForUsage = internalMutation({
  args: {
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    projectId: v.optional(v.id("projects")),
    cost: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all applicable budgets
    const budgets: Doc<"budgets">[] = [];

    // User budgets
    const userBudgets = await ctx.db
      .query("budgets")
      .filter((q) =>
        q.and(
          q.eq(q.field("scope"), "user"),
          q.eq(q.field("scopeId"), args.userId),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();
    budgets.push(...userBudgets);

    // Workspace budgets
    if (args.workspaceId) {
      const workspaceBudgets = await ctx.db
        .query("budgets")
        .filter((q) =>
          q.and(
            q.eq(q.field("scope"), "workspace"),
            q.eq(q.field("scopeId"), args.workspaceId),
            q.eq(q.field("isActive"), true)
          )
        )
        .collect();
      budgets.push(...workspaceBudgets);
    }

    // Project budgets
    if (args.projectId) {
      const projectBudgets = await ctx.db
        .query("budgets")
        .filter((q) =>
          q.and(
            q.eq(q.field("scope"), "project"),
            q.eq(q.field("scopeId"), args.projectId),
            q.eq(q.field("isActive"), true)
          )
        )
        .collect();
      budgets.push(...projectBudgets);
    }

    // Update each budget and check thresholds
    for (const budget of budgets) {
      // Check if we need to reset for new period
      const now = Date.now();
      if (now > budget.periodEnd) {
        // Reset period
        const carryover = budget.rollover
          ? Math.max(0, budget.amount - budget.currentSpend)
          : 0;

        await ctx.db.patch(budget._id, {
          currentSpend: args.cost,
          periodStart: getPeriodStart(budget.period),
          periodEnd: getPeriodEnd(budget.period),
          amount: budget.amount + carryover,
          updatedAt: now,
        });

        continue;
      }

      // Update current spend
      const newSpend = budget.currentSpend + args.cost;
      await ctx.db.patch(budget._id, {
        currentSpend: newSpend,
        updatedAt: now,
      });

      // Check thresholds
      const previousUtilization = (budget.currentSpend / budget.amount) * 100;
      const newUtilization = (newSpend / budget.amount) * 100;

      for (const threshold of budget.alertThresholds) {
        if (previousUtilization < threshold && newUtilization >= threshold) {
          // Check if alert already exists for this threshold
          const existingAlert = await ctx.db
            .query("budgetAlerts")
            .withIndex("byBudgetAndThreshold", (q) =>
              q.eq("budgetId", budget._id).eq("threshold", threshold)
            )
            .filter((q) =>
              q.gte(q.field("triggeredAt"), budget.periodStart)
            )
            .first();

          if (!existingAlert) {
            // Create alert
            await ctx.db.insert("budgetAlerts", {
              budgetId: budget._id,
              userId: args.userId,
              threshold,
              currentSpend: newSpend,
              budgetAmount: budget.amount,
              utilization: newUtilization,
              triggeredAt: now,
              dismissed: false,
            });
          }
        }
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// INTERNAL: PROCESS BUDGET ALERTS (CRON)
// ═══════════════════════════════════════════════════════════════

export const processBudgetAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active budgets
    const budgets = await ctx.db
      .query("budgets")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const now = Date.now();

    for (const budget of budgets) {
      // Check if period needs reset
      if (now > budget.periodEnd) {
        const carryover = budget.rollover
          ? Math.max(0, budget.amount - budget.currentSpend)
          : 0;

        await ctx.db.patch(budget._id, {
          currentSpend: 0,
          periodStart: getPeriodStart(budget.period),
          periodEnd: getPeriodEnd(budget.period),
          amount: budget.rollover ? budget.amount + carryover : budget.amount,
          updatedAt: now,
        });
      }
    }

    return { processed: budgets.length };
  },
});

// ═══════════════════════════════════════════════════════════════
// RESET BUDGET SPEND (Manual)
// ═══════════════════════════════════════════════════════════════

export const resetBudgetSpend = mutation({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Verify ownership
    if (budget.userId !== userId) {
      if (budget.scope === "workspace") {
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("byWorkspaceAndUser", (q) =>
            q.eq("workspaceId", budget.scopeId as Id<"workspaces">).eq("userId", userId)
          )
          .unique();

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new Error("You don't have permission to reset this budget");
        }
      } else {
        throw new Error("You don't have permission to reset this budget");
      }
    }

    await ctx.db.patch(args.budgetId, {
      currentSpend: 0,
      periodStart: getPeriodStart(budget.period),
      periodEnd: getPeriodEnd(budget.period),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

import { query, mutation, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";

// Schedule frequency options
export const FREQUENCY_OPTIONS = {
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
} as const;

export type ScheduleFrequency = keyof typeof FREQUENCY_OPTIONS;

// Calculate the next run time based on schedule configuration
function calculateNextRunTime(
  frequency: ScheduleFrequency,
  hourOfDay: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
  fromTime?: number
): number {
  const now = fromTime || Date.now();
  const date = new Date(now);

  // Set to the target hour (UTC)
  date.setUTCHours(hourOfDay, 0, 0, 0);

  switch (frequency) {
    case "daily":
      // If we've passed the target hour today, schedule for tomorrow
      if (date.getTime() <= now) {
        date.setUTCDate(date.getUTCDate() + 1);
      }
      break;

    case "weekly":
      // Find the next occurrence of the target day of week
      const targetDay = dayOfWeek ?? 0; // Default to Sunday
      const currentDay = date.getUTCDay();
      let daysUntilTarget = targetDay - currentDay;

      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && date.getTime() <= now)) {
        daysUntilTarget += 7;
      }

      date.setUTCDate(date.getUTCDate() + daysUntilTarget);
      break;

    case "biweekly":
      // Same as weekly but add 2 weeks
      const biweeklyTargetDay = dayOfWeek ?? 0;
      const biweeklyCurrentDay = date.getUTCDay();
      let biweeklyDaysUntil = biweeklyTargetDay - biweeklyCurrentDay;

      if (biweeklyDaysUntil < 0 || (biweeklyDaysUntil === 0 && date.getTime() <= now)) {
        biweeklyDaysUntil += 14;
      } else {
        // Add an extra week to make it biweekly
        biweeklyDaysUntil += 7;
      }

      date.setUTCDate(date.getUTCDate() + biweeklyDaysUntil);
      break;

    case "monthly":
      // Find the next occurrence of the target day of month
      const targetDayOfMonth = dayOfMonth ?? 1;

      // Start from current month
      date.setUTCDate(targetDayOfMonth);

      // If we've passed it this month, go to next month
      if (date.getTime() <= now) {
        date.setUTCMonth(date.getUTCMonth() + 1);
        date.setUTCDate(targetDayOfMonth);
      }

      // Handle months with fewer days
      if (date.getUTCDate() !== targetDayOfMonth) {
        // Day doesn't exist in this month, use last day
        date.setUTCDate(0); // Goes to last day of previous month
      }
      break;
  }

  return date.getTime();
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Hash content for change detection using Web Crypto API
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer).substring(0, 16);
}

// ===================
// PUBLIC QUERIES
// ===================

// List all schedules for the current user
export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    let schedules;
    if (workspaceId) {
      schedules = await ctx.db
        .query("documentSchedules")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
        .collect();
    } else {
      schedules = await ctx.db
        .query("documentSchedules")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .collect();
    }

    // Fetch document details for each schedule
    const schedulesWithDocs = await Promise.all(
      schedules.map(async (schedule) => {
        const doc = await ctx.db.get(schedule.documentId);
        return {
          ...schedule,
          documentTopic: doc?.topic || "Unknown Document",
          documentDeleted: !doc,
        };
      })
    );

    return schedulesWithDocs;
  },
});

// Get a specific schedule
export const get = query({
  args: {
    scheduleId: v.id("documentSchedules"),
  },
  handler: async (ctx, { scheduleId }) => {
    const userId = await getUserId(ctx);

    const schedule = await ctx.db.get(scheduleId);
    if (!schedule || schedule.userId !== userId) {
      return null;
    }

    const doc = await ctx.db.get(schedule.documentId);

    return {
      ...schedule,
      documentTopic: doc?.topic || "Unknown Document",
      documentDeleted: !doc,
    };
  },
});

// Get schedule for a specific document
export const getByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    const schedule = await ctx.db
      .query("documentSchedules")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();

    return schedule;
  },
});

// Get run history for a schedule
export const getRunHistory = query({
  args: {
    scheduleId: v.id("documentSchedules"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { scheduleId, limit = 20 }) => {
    const userId = await getUserId(ctx);

    // Verify ownership
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule || schedule.userId !== userId) {
      throw new Error("Schedule not found");
    }

    const history = await ctx.db
      .query("scheduleRunHistory")
      .withIndex("bySchedule", (q) => q.eq("scheduleId", scheduleId))
      .order("desc")
      .take(limit);

    return history;
  },
});

// Get upcoming scheduled updates
export const getUpcoming = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    const userId = await getUserId(ctx);

    const schedules = await ctx.db
      .query("documentSchedules")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Sort by nextRunAt and take limit
    const sorted = schedules
      .sort((a, b) => a.nextRunAt - b.nextRunAt)
      .slice(0, limit);

    // Fetch document details
    const withDocs = await Promise.all(
      sorted.map(async (schedule) => {
        const doc = await ctx.db.get(schedule.documentId);
        return {
          ...schedule,
          documentTopic: doc?.topic || "Unknown Document",
        };
      })
    );

    return withDocs;
  },
});

// ===================
// PUBLIC MUTATIONS
// ===================

// Create a new schedule
export const create = mutation({
  args: {
    documentId: v.id("documents"),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    hourOfDay: v.number(),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify document ownership
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Check if schedule already exists
    const existing = await ctx.db
      .query("documentSchedules")
      .withIndex("byDocument", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (existing) {
      throw new Error("A schedule already exists for this document. Update or delete it first.");
    }

    // Validate hour
    if (args.hourOfDay < 0 || args.hourOfDay > 23) {
      throw new Error("Hour must be between 0 and 23");
    }

    // Validate day of week for weekly/biweekly
    if ((args.frequency === "weekly" || args.frequency === "biweekly") && args.dayOfWeek !== undefined) {
      if (args.dayOfWeek < 0 || args.dayOfWeek > 6) {
        throw new Error("Day of week must be between 0 (Sunday) and 6 (Saturday)");
      }
    }

    // Validate day of month for monthly
    if (args.frequency === "monthly" && args.dayOfMonth !== undefined) {
      if (args.dayOfMonth < 1 || args.dayOfMonth > 31) {
        throw new Error("Day of month must be between 1 and 31");
      }
    }

    const now = Date.now();
    const nextRunAt = calculateNextRunTime(
      args.frequency,
      args.hourOfDay,
      args.dayOfWeek,
      args.dayOfMonth
    );

    const scheduleId = await ctx.db.insert("documentSchedules", {
      userId,
      documentId: args.documentId,
      workspaceId: doc.workspaceId,
      frequency: args.frequency,
      hourOfDay: args.hourOfDay,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      isActive: true,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunError: null,
      nextRunAt,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { scheduleId, nextRunAt };
  },
});

// Update a schedule
export const update = mutation({
  args: {
    scheduleId: v.id("documentSchedules"),
    frequency: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    )),
    hourOfDay: v.optional(v.number()),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule || schedule.userId !== userId) {
      throw new Error("Schedule not found");
    }

    const updates: Partial<Doc<"documentSchedules">> = {
      updatedAt: Date.now(),
    };

    if (args.frequency !== undefined) updates.frequency = args.frequency;
    if (args.hourOfDay !== undefined) updates.hourOfDay = args.hourOfDay;
    if (args.dayOfWeek !== undefined) updates.dayOfWeek = args.dayOfWeek;
    if (args.dayOfMonth !== undefined) updates.dayOfMonth = args.dayOfMonth;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    // Recalculate next run time if schedule changed
    const frequency = args.frequency ?? schedule.frequency;
    const hourOfDay = args.hourOfDay ?? schedule.hourOfDay;
    const dayOfWeek = args.dayOfWeek ?? schedule.dayOfWeek;
    const dayOfMonth = args.dayOfMonth ?? schedule.dayOfMonth;

    updates.nextRunAt = calculateNextRunTime(frequency, hourOfDay, dayOfWeek, dayOfMonth);

    await ctx.db.patch(args.scheduleId, updates);

    return { nextRunAt: updates.nextRunAt };
  },
});

// Delete a schedule
export const remove = mutation({
  args: {
    scheduleId: v.id("documentSchedules"),
  },
  handler: async (ctx, { scheduleId }) => {
    const userId = await getUserId(ctx);

    const schedule = await ctx.db.get(scheduleId);
    if (!schedule || schedule.userId !== userId) {
      throw new Error("Schedule not found");
    }

    // Delete run history
    const history = await ctx.db
      .query("scheduleRunHistory")
      .withIndex("bySchedule", (q) => q.eq("scheduleId", scheduleId))
      .collect();

    for (const run of history) {
      await ctx.db.delete(run._id);
    }

    await ctx.db.delete(scheduleId);
  },
});

// Manually trigger a scheduled update
export const triggerNow = action({
  args: {
    scheduleId: v.id("documentSchedules"),
  },
  handler: async (ctx, { scheduleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const schedule = await ctx.runQuery(internal.schedules.getScheduleInternal, { scheduleId });
    if (!schedule || schedule.userId !== identity.subject) {
      throw new Error("Schedule not found");
    }

    // Run the update
    const result = await ctx.runAction(internal.schedules.executeScheduledUpdate, {
      scheduleId,
      isManual: true,
    });

    return result;
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Get schedule by ID (internal)
export const getScheduleInternal = internalQuery({
  args: {
    scheduleId: v.id("documentSchedules"),
  },
  handler: async (ctx, { scheduleId }) => {
    return await ctx.db.get(scheduleId);
  },
});

// Get due schedules (for the cron job)
export const getDueSchedules = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    const now = Date.now();

    // Get active schedules that are due
    const dueSchedules = await ctx.db
      .query("documentSchedules")
      .withIndex("byActiveAndNextRun", (q) =>
        q.eq("isActive", true).lte("nextRunAt", now)
      )
      .take(limit);

    return dueSchedules;
  },
});

// Create a run history entry
export const createRunEntry = internalMutation({
  args: {
    scheduleId: v.id("documentSchedules"),
    documentId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scheduleRunHistory", {
      scheduleId: args.scheduleId,
      documentId: args.documentId,
      userId: args.userId,
      status: "pending",
      startedAt: Date.now(),
      completedAt: null,
      durationMs: null,
      previousContentHash: null,
      newContentHash: null,
      contentChanged: null,
      provider: null,
      model: null,
      tokensUsed: null,
      errorMessage: null,
    });
  },
});

// Update run entry status
export const updateRunEntry = internalMutation({
  args: {
    runId: v.id("scheduleRunHistory"),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    previousContentHash: v.optional(v.string()),
    newContentHash: v.optional(v.string()),
    contentChanged: v.optional(v.boolean()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { runId, ...updates }) => {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    filtered.status = updates.status;
    await ctx.db.patch(runId, filtered);
  },
});

// Update schedule after a run
export const updateScheduleAfterRun = internalMutation({
  args: {
    scheduleId: v.id("documentSchedules"),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { scheduleId, success, errorMessage }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return;

    const now = Date.now();

    // Calculate next run time
    const nextRunAt = calculateNextRunTime(
      schedule.frequency,
      schedule.hourOfDay,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      now
    );

    await ctx.db.patch(scheduleId, {
      lastRunAt: now,
      lastRunStatus: success ? "success" : "failed",
      lastRunError: errorMessage || null,
      nextRunAt,
      totalRuns: schedule.totalRuns + 1,
      successfulRuns: success ? schedule.successfulRuns + 1 : schedule.successfulRuns,
      failedRuns: success ? schedule.failedRuns : schedule.failedRuns + 1,
      updatedAt: now,
    });
  },
});

// Execute a scheduled update
export const executeScheduledUpdate = internalAction({
  args: {
    scheduleId: v.id("documentSchedules"),
    isManual: v.optional(v.boolean()),
  },
  handler: async (ctx, { scheduleId, isManual }) => {
    const schedule = await ctx.runQuery(internal.schedules.getScheduleInternal, { scheduleId });
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // Get the document
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId: schedule.documentId,
      userId: schedule.userId,
    });

    if (!doc) {
      // Document was deleted, skip
      await ctx.runMutation(internal.schedules.updateScheduleAfterRun, {
        scheduleId,
        success: false,
        errorMessage: "Document not found (may have been deleted)",
      });
      return { success: false, error: "Document not found" };
    }

    // Create run entry
    const runId = await ctx.runMutation(internal.schedules.createRunEntry, {
      scheduleId,
      documentId: schedule.documentId,
      userId: schedule.userId,
    });

    // Mark as running
    await ctx.runMutation(internal.schedules.updateRunEntry, {
      runId,
      status: "running",
      previousContentHash: await hashContent(doc.content),
    });

    const startTime = Date.now();

    try {
      // Get user settings for provider preference
      const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
        userId: schedule.userId,
      });

      // Determine the mode based on document topic
      // If it looks like a URL, use crawl mode; if it looks like a GitHub repo, use github mode
      let mode: "search" | "crawl" | "github" = "search";
      const topic = doc.topic;

      if (topic.startsWith("http://") || topic.startsWith("https://")) {
        mode = "crawl";
      } else if (topic.includes("github.com") || topic.match(/^[\w-]+\/[\w-]+$/)) {
        mode = "github";
      }

      // Create a streaming session for the regeneration
      const sessionId = await ctx.runMutation(internal.streaming.createSession, {
        userId: schedule.userId,
        topic: doc.topic,
        mode,
        projectId: doc.projectId,
      });

      // Run the generation
      const result = await ctx.runAction(internal.streaming.performStreamingGeneration, {
        sessionId,
        userId: schedule.userId,
        topic: doc.topic,
        mode,
        preferredProvider: userSettings?.preferredProvider,
      });

      // Get the session to retrieve the new content
      const session = await ctx.runQuery(internal.streaming.getSessionByIdInternal, { sessionId });

      if (!session || session.status !== "completed") {
        throw new Error("Generation did not complete successfully");
      }

      const newContentHash = await hashContent(session.content);
      const oldContentHash = await hashContent(doc.content);
      const contentChanged = newContentHash !== oldContentHash;

      // Update the document with new content if it changed
      if (contentChanged) {
        await ctx.runMutation(internal.documents.updateForApi, {
          userId: schedule.userId,
          documentId: schedule.documentId,
          content: session.content,
        });
      }

      const endTime = Date.now();

      // Update run entry
      await ctx.runMutation(internal.schedules.updateRunEntry, {
        runId,
        status: "success",
        completedAt: endTime,
        durationMs: endTime - startTime,
        newContentHash,
        contentChanged,
        provider: session.provider || undefined,
        model: session.model || undefined,
        tokensUsed: session.tokensUsed || undefined,
      });

      // Update schedule
      await ctx.runMutation(internal.schedules.updateScheduleAfterRun, {
        scheduleId,
        success: true,
      });

      // Trigger webhook if content changed
      if (contentChanged) {
        await ctx.runAction(internal.webhooks.triggerEvent, {
          userId: schedule.userId,
          eventType: "document.updated",
          data: {
            documentId: schedule.documentId,
            topic: doc.topic,
            updateType: "scheduled",
            contentChanged: true,
          },
          workspaceId: schedule.workspaceId,
        });
      }

      return {
        success: true,
        contentChanged,
        durationMs: endTime - startTime,
      };

    } catch (error: any) {
      const endTime = Date.now();

      // Update run entry
      await ctx.runMutation(internal.schedules.updateRunEntry, {
        runId,
        status: "failed",
        completedAt: endTime,
        durationMs: endTime - startTime,
        errorMessage: error.message || "Unknown error",
      });

      // Update schedule
      await ctx.runMutation(internal.schedules.updateScheduleAfterRun, {
        scheduleId,
        success: false,
        errorMessage: error.message || "Unknown error",
      });

      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
});

// Process all due schedules (called by cron)
export const processDueSchedules = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueSchedules = await ctx.runQuery(internal.schedules.getDueSchedules, { limit: 20 });

    if (dueSchedules.length === 0) {
      return { processed: 0 };
    }

    const results = await Promise.allSettled(
      dueSchedules.map((schedule) =>
        ctx.runAction(internal.schedules.executeScheduledUpdate, {
          scheduleId: schedule._id,
          isManual: false,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      processed: dueSchedules.length,
      successful,
      failed,
    };
  },
});

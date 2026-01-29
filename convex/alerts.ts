import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";

// Alert status types
export type AlertStatus = "pending" | "read" | "dismissed" | "snoozed" | "actioned";

// Change types
export type ChangeType =
  | "content_modified"
  | "new_release"
  | "new_commit"
  | "source_unavailable"
  | "major_update"
  | "minor_update";

// Snooze duration options
export const SNOOZE_DURATIONS = {
  "1_hour": { label: "1 hour", ms: 60 * 60 * 1000 },
  "4_hours": { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  "1_day": { label: "1 day", ms: 24 * 60 * 60 * 1000 },
  "1_week": { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
} as const;

export type SnoozeDuration = keyof typeof SNOOZE_DURATIONS;

// ===================
// PUBLIC QUERIES
// ===================

// List alerts for the current user
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("read"),
        v.literal("dismissed"),
        v.literal("snoozed"),
        v.literal("actioned"),
        v.literal("all")
      )
    ),
    documentId: v.optional(v.id("documents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status = "all", documentId, limit = 50 }) => {
    const userId = await getUserId(ctx);

    let alertsQuery;

    if (documentId) {
      alertsQuery = ctx.db
        .query("changeAlerts")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .filter((q) => q.eq(q.field("userId"), userId));
    } else if (status !== "all") {
      alertsQuery = ctx.db
        .query("changeAlerts")
        .withIndex("byUserAndStatus", (q) =>
          q.eq("userId", userId).eq("status", status)
        );
    } else {
      alertsQuery = ctx.db
        .query("changeAlerts")
        .withIndex("byUser", (q) => q.eq("userId", userId));
    }

    const alerts = await alertsQuery.order("desc").take(limit);

    // Enrich with document info
    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        const doc = await ctx.db.get(alert.documentId) as { topic?: string } | null;
        return {
          ...alert,
          documentTopic: doc?.topic || "Unknown Document",
          documentDeleted: !doc,
        };
      })
    );

    return enriched;
  },
});

// Get pending alert count
export const getPendingCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const alerts = await ctx.db
      .query("changeAlerts")
      .withIndex("byUserAndStatus", (q) =>
        q.eq("userId", userId).eq("status", "pending")
      )
      .collect();

    // Also count snoozed alerts that have expired
    const snoozedAlerts = await ctx.db
      .query("changeAlerts")
      .withIndex("byUserAndStatus", (q) =>
        q.eq("userId", userId).eq("status", "snoozed")
      )
      .collect();

    const now = Date.now();
    const expiredSnoozeCount = snoozedAlerts.filter(
      (a) => a.snoozeUntil && a.snoozeUntil <= now
    ).length;

    return alerts.length + expiredSnoozeCount;
  },
});

// Get a single alert
export const get = query({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      return null;
    }

    const doc = await ctx.db.get(alert.documentId);

    return {
      ...alert,
      documentTopic: doc?.topic || "Unknown Document",
      documentDeleted: !doc,
    };
  },
});

// Get alert preferences
export const getPreferences = query({
  args: {
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    // Get document-specific preferences first
    if (documentId) {
      const docPrefs = await ctx.db
        .query("alertPreferences")
        .withIndex("byUserAndDocument", (q) =>
          q.eq("userId", userId).eq("documentId", documentId)
        )
        .first();

      if (docPrefs) return docPrefs;
    }

    // Fall back to global preferences
    const globalPrefs = await ctx.db
      .query("alertPreferences")
      .withIndex("byUserAndDocument", (q) =>
        q.eq("userId", userId).eq("documentId", null as any)
      )
      .first();

    return globalPrefs;
  },
});

// Get all alert preferences for user
export const listPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const prefs = await ctx.db
      .query("alertPreferences")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Enrich with document info
    const enriched = await Promise.all(
      prefs.map(async (pref) => {
        if (pref.documentId) {
          const doc = await ctx.db.get(pref.documentId);
          return {
            ...pref,
            documentTopic: doc?.topic || "Unknown Document",
            isGlobal: false,
          };
        }
        return {
          ...pref,
          documentTopic: null,
          isGlobal: true,
        };
      })
    );

    return enriched;
  },
});

// ===================
// PUBLIC MUTATIONS
// ===================

// Mark alert as read
export const markAsRead = mutation({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found");
    }

    await ctx.db.patch(alertId, {
      status: "read",
      readAt: Date.now(),
    });
  },
});

// Mark all alerts as read
export const markAllAsRead = mutation({
  args: {
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);
    const now = Date.now();

    let alerts;
    if (documentId) {
      alerts = await ctx.db
        .query("changeAlerts")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("status"), "pending")
          )
        )
        .collect();
    } else {
      alerts = await ctx.db
        .query("changeAlerts")
        .withIndex("byUserAndStatus", (q) =>
          q.eq("userId", userId).eq("status", "pending")
        )
        .collect();
    }

    for (const alert of alerts) {
      await ctx.db.patch(alert._id, {
        status: "read",
        readAt: now,
      });
    }

    return { count: alerts.length };
  },
});

// Dismiss alert
export const dismiss = mutation({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found");
    }

    await ctx.db.patch(alertId, {
      status: "dismissed",
    });
  },
});

// Snooze alert
export const snooze = mutation({
  args: {
    alertId: v.id("changeAlerts"),
    duration: v.union(
      v.literal("1_hour"),
      v.literal("4_hours"),
      v.literal("1_day"),
      v.literal("1_week")
    ),
  },
  handler: async (ctx, { alertId, duration }) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found");
    }

    const snoozeUntil = Date.now() + SNOOZE_DURATIONS[duration].ms;

    await ctx.db.patch(alertId, {
      status: "snoozed",
      snoozeUntil,
    });

    return { snoozeUntil };
  },
});

// Bulk dismiss alerts
export const bulkDismiss = mutation({
  args: {
    alertIds: v.array(v.id("changeAlerts")),
  },
  handler: async (ctx, { alertIds }) => {
    const userId = await getUserId(ctx);

    let dismissed = 0;
    for (const alertId of alertIds) {
      const alert = await ctx.db.get(alertId);
      if (alert && alert.userId === userId) {
        await ctx.db.patch(alertId, {
          status: "dismissed",
        });
        dismissed++;
      }
    }

    return { dismissed };
  },
});

// Delete alert
export const remove = mutation({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    const userId = await getUserId(ctx);

    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found");
    }

    await ctx.db.delete(alertId);
  },
});

// Update alert preferences
export const updatePreferences = mutation({
  args: {
    documentId: v.union(v.id("documents"), v.null()),
    notifyInApp: v.optional(v.boolean()),
    notifyEmail: v.optional(v.boolean()),
    notifyWebhook: v.optional(v.boolean()),
    webhookUrl: v.optional(v.union(v.string(), v.null())),
    notifySlack: v.optional(v.boolean()),
    notifyDiscord: v.optional(v.boolean()),
    autoRegenerate: v.optional(v.boolean()),
    minSignificance: v.optional(v.number()),
    checkFrequency: v.optional(
      v.union(
        v.literal("hourly"),
        v.literal("every_6_hours"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
  },
  handler: async (ctx, { documentId, ...updates }) => {
    const userId = await getUserId(ctx);
    const now = Date.now();

    // Find existing preferences
    const existing = await ctx.db
      .query("alertPreferences")
      .withIndex("byUserAndDocument", (q) =>
        q.eq("userId", userId).eq("documentId", documentId)
      )
      .first();

    if (existing) {
      // Update existing
      const filtered: Record<string, any> = { updatedAt: now };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          filtered[key] = value;
        }
      }
      await ctx.db.patch(existing._id, filtered);
      return existing._id;
    } else {
      // Create new
      const defaults = {
        notifyInApp: true,
        notifyEmail: false,
        notifyWebhook: false,
        webhookUrl: null,
        notifySlack: false,
        notifyDiscord: false,
        autoRegenerate: false,
        minSignificance: 20,
        checkFrequency: "daily" as const,
      };

      const merged = { ...defaults, ...updates };

      return await ctx.db.insert("alertPreferences", {
        userId,
        documentId,
        ...merged,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Delete alert preferences
export const deletePreferences = mutation({
  args: {
    preferencesId: v.id("alertPreferences"),
  },
  handler: async (ctx, { preferencesId }) => {
    const userId = await getUserId(ctx);

    const prefs = await ctx.db.get(preferencesId);
    if (!prefs || prefs.userId !== userId) {
      throw new Error("Preferences not found");
    }

    await ctx.db.delete(preferencesId);
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Create alert (internal)
export const createAlertInternal = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    changeType: v.union(
      v.literal("content_modified"),
      v.literal("new_release"),
      v.literal("new_commit"),
      v.literal("source_unavailable"),
      v.literal("major_update"),
      v.literal("minor_update")
    ),
    significance: v.number(),
    diffSummary: v.string(),
    diffDetails: v.optional(
      v.object({
        addedLines: v.number(),
        removedLines: v.number(),
        changedSections: v.array(v.string()),
      })
    ),
    previousHash: v.string(),
    newHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Get document to check workspace
    const doc = await ctx.db.get(args.documentId);

    // Check preferences to see if we should create this alert
    const prefs = await ctx.db
      .query("alertPreferences")
      .withIndex("byUserAndDocument", (q) =>
        q.eq("userId", args.userId).eq("documentId", args.documentId)
      )
      .first();

    // Fall back to global preferences
    const globalPrefs = prefs
      ? null
      : await ctx.db
          .query("alertPreferences")
          .withIndex("byUserAndDocument", (q) =>
            q.eq("userId", args.userId).eq("documentId", null as any)
          )
          .first();

    const effectivePrefs = prefs || globalPrefs;

    // Check minimum significance threshold
    if (effectivePrefs && args.significance < effectivePrefs.minSignificance) {
      return null; // Don't create alert for low-significance changes
    }

    const now = Date.now();

    const alertId = await ctx.db.insert("changeAlerts", {
      userId: args.userId,
      workspaceId: doc?.workspaceId,
      documentId: args.documentId,
      sourceUrl: args.sourceUrl,
      changeType: args.changeType,
      significance: args.significance,
      diffSummary: args.diffSummary,
      diffDetails: args.diffDetails,
      previousHash: args.previousHash,
      newHash: args.newHash,
      status: "pending",
      snoozeUntil: null,
      createdAt: now,
      readAt: null,
      actionedAt: null,
    });

    return alertId;
  },
});

// Get preferences (internal)
export const getPreferencesInternal = internalQuery({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { userId, documentId }) => {
    // Document-specific first
    const docPrefs = await ctx.db
      .query("alertPreferences")
      .withIndex("byUserAndDocument", (q) =>
        q.eq("userId", userId).eq("documentId", documentId)
      )
      .first();

    if (docPrefs) return docPrefs;

    // Fall back to global
    return await ctx.db
      .query("alertPreferences")
      .withIndex("byUserAndDocument", (q) =>
        q.eq("userId", userId).eq("documentId", null as any)
      )
      .first();
  },
});

// Trigger auto-regenerate for a document
export const triggerAutoRegenerate = internalAction({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { userId, documentId }) => {
    // Get the document
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });

    if (!doc) {
      return { success: false, error: "Document not found" };
    }

    // Get user settings for provider preference
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Determine mode based on topic
    let mode: "search" | "crawl" | "github" = "search";
    if (doc.topic.startsWith("http://") || doc.topic.startsWith("https://")) {
      mode = "crawl";
    } else if (doc.topic.includes("github.com") || doc.topic.match(/^[\w-]+\/[\w-]+$/)) {
      mode = "github";
    }

    // Create streaming session
    const sessionId = await ctx.runMutation(internal.streaming.createSession, {
      userId,
      topic: doc.topic,
      mode,
      projectId: doc.projectId,
    });

    // Run generation
    await ctx.runAction(internal.streaming.performStreamingGeneration, {
      sessionId,
      userId,
      topic: doc.topic,
      mode,
      preferredProvider: userSettings?.preferredProvider,
    });

    // Get session result
    const session = await ctx.runQuery(internal.streaming.getSessionByIdInternal, {
      sessionId,
    });

    if (!session || session.status !== "completed") {
      return { success: false, error: "Generation failed" };
    }

    // Update document with new content
    await ctx.runMutation(internal.documents.updateForApi, {
      userId,
      documentId,
      content: session.content,
    });

    // Trigger webhook notification
    await ctx.runAction(internal.webhooks.triggerEvent, {
      userId,
      eventType: "document.updated",
      data: {
        documentId,
        topic: doc.topic,
        updateType: "auto_regenerate",
        reason: "source_changed",
      },
      workspaceId: doc.workspaceId,
    });

    return { success: true };
  },
});

// Send external alert notifications
export const sendExternalNotifications = internalAction({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    const alert = await ctx.runQuery(internal.alerts.getAlertInternal, { alertId });
    if (!alert) return;

    const prefs = await ctx.runQuery(internal.alerts.getPreferencesInternal, {
      userId: alert.userId,
      documentId: alert.documentId,
    });

    if (!prefs) return;

    const doc = await ctx.runQuery(internal.documents.getForApi, {
      userId: alert.userId,
      documentId: alert.documentId,
    });

    const baseUrl = process.env.APP_URL || "https://docusynth.ai";

    // Send webhook notification
    if (prefs.notifyWebhook && prefs.webhookUrl) {
      try {
        await fetch(prefs.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "DocuSynth-AI",
          },
          body: JSON.stringify({
            event: "source.changed",
            alert: {
              id: alertId,
              documentId: alert.documentId,
              documentTopic: doc?.topic,
              sourceUrl: alert.sourceUrl,
              changeType: alert.changeType,
              significance: alert.significance,
              summary: alert.diffSummary,
              url: `${baseUrl}/documents/${alert.documentId}`,
            },
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error("Failed to send webhook notification:", error);
      }
    }

    // Send Slack notification via bot
    if (prefs.notifySlack) {
      // Get bot config and send message
      const botConfig = await ctx.runQuery(internal.bots.getBotConfig, {
        platform: "slack",
        teamId: undefined, // Would need to store this in preferences
      });

      if (botConfig) {
        // Would integrate with Slack bot to send notification
        console.log("Slack notification would be sent here");
      }
    }

    // Send Discord notification via bot
    if (prefs.notifyDiscord) {
      const botConfig = await ctx.runQuery(internal.bots.getBotConfig, {
        platform: "discord",
        guildId: undefined, // Would need to store this in preferences
      });

      if (botConfig) {
        // Would integrate with Discord bot to send notification
        console.log("Discord notification would be sent here");
      }
    }
  },
});

// Get alert (internal)
export const getAlertInternal = internalQuery({
  args: {
    alertId: v.id("changeAlerts"),
  },
  handler: async (ctx, { alertId }) => {
    return await ctx.db.get(alertId);
  },
});

// Unsnooze expired alerts
export const unsnoozeExpiredAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all snoozed alerts that have expired
    const snoozedAlerts = await ctx.db
      .query("changeAlerts")
      .filter((q) => q.eq(q.field("status"), "snoozed"))
      .collect();

    let unsnoozeCount = 0;
    for (const alert of snoozedAlerts) {
      if (alert.snoozeUntil && alert.snoozeUntil <= now) {
        await ctx.db.patch(alert._id, {
          status: "pending",
          snoozeUntil: null,
        });
        unsnoozeCount++;
      }
    }

    return { unsnoozeCount };
  },
});

// Cleanup old dismissed alerts
export const cleanupOldAlerts = internalMutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, { olderThanDays = 30 }) => {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const oldAlerts = await ctx.db
      .query("changeAlerts")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "dismissed"),
            q.eq(q.field("status"), "actioned")
          ),
          q.lt(q.field("createdAt"), cutoffTime)
        )
      )
      .collect();

    for (const alert of oldAlerts) {
      await ctx.db.delete(alert._id);
    }

    return { deletedCount: oldAlerts.length };
  },
});

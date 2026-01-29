import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process due scheduled document updates every 15 minutes
crons.interval(
  "process-scheduled-updates",
  { minutes: 15 },
  internal.schedules.processDueSchedules
);

// Clean up stale presence records every 5 minutes
crons.interval(
  "cleanup-stale-presence",
  { minutes: 5 },
  internal.presence.cleanupStalePresence
);

// Process embedding queue every 2 minutes
crons.interval(
  "process-embedding-queue",
  { minutes: 2 },
  internal.embeddings.processEmbeddingQueue
);

// ═══════════════════════════════════════════════════════════════
// Change Detection & Alerts (Feature #27)
// ═══════════════════════════════════════════════════════════════

// Process change detection queue every 6 hours
crons.interval(
  "process-change-detection",
  { hours: 6 },
  internal.changeDetection.processChangeQueue
);

// Unsnooze expired alerts every hour
crons.interval(
  "unsnooze-alerts",
  { hours: 1 },
  internal.alerts.unsnoozeExpiredAlerts
);

// Cleanup old snapshots weekly (keep last 10 per source)
crons.weekly(
  "cleanup-old-snapshots",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.changeDetection.cleanupOldSnapshots
);

// Cleanup old dismissed/actioned alerts monthly
crons.monthly(
  "cleanup-old-alerts",
  { day: 1, hourUTC: 4, minuteUTC: 0 },
  internal.alerts.cleanupOldAlerts
);

// ═══════════════════════════════════════════════════════════════
// Analytics Aggregation (Feature #16)
// ═══════════════════════════════════════════════════════════════

// Aggregate daily analytics stats at midnight UTC
crons.daily(
  "aggregate-daily-analytics",
  { hourUTC: 0, minuteUTC: 5 },
  internal.analytics.aggregateDailyStats,
  { date: "" } // Will compute yesterday's date in the handler
);

// Clean up old analytics events (older than 90 days) weekly
crons.weekly(
  "cleanup-old-analytics",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.analytics.cleanupOldEventsInternal
);

// ═══════════════════════════════════════════════════════════════
// Audit Log Retention (Feature #19)
// ═══════════════════════════════════════════════════════════════

// Clean up old audit logs based on retention policies daily
crons.daily(
  "cleanup-old-audit-logs",
  { hourUTC: 1, minuteUTC: 30 },
  internal.auditLog.cleanupOldEvents
);

// ═══════════════════════════════════════════════════════════════
// Cost Management & Budgets (Feature #21)
// ═══════════════════════════════════════════════════════════════

// Process budget alerts and reset periods at midnight UTC
crons.daily(
  "process-budget-alerts",
  { hourUTC: 0, minuteUTC: 10 },
  internal.budgets.processBudgetAlerts
);

export default crons;

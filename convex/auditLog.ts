import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG TYPES
// ═══════════════════════════════════════════════════════════════

// All action types that can be logged
export const AUDIT_ACTION_TYPES = {
  // Authentication
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_PASSWORD_CHANGED: "auth.password_changed",
  AUTH_SESSION_CREATED: "auth.session_created",
  AUTH_SESSION_REVOKED: "auth.session_revoked",

  // Documents
  DOC_CREATED: "document.created",
  DOC_READ: "document.read",
  DOC_UPDATED: "document.updated",
  DOC_DELETED: "document.deleted",
  DOC_SHARED: "document.shared",
  DOC_EXPORTED: "document.exported",
  DOC_MOVED: "document.moved",
  DOC_VISIBILITY_CHANGED: "document.visibility_changed",

  // Projects
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_DELETED: "project.deleted",
  PROJECT_MEMBER_ADDED: "project.member_added",
  PROJECT_MEMBER_REMOVED: "project.member_removed",

  // Workspaces
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_UPDATED: "workspace.updated",
  WORKSPACE_DELETED: "workspace.deleted",
  WORKSPACE_MEMBER_INVITED: "workspace.member_invited",
  WORKSPACE_MEMBER_JOINED: "workspace.member_joined",
  WORKSPACE_MEMBER_REMOVED: "workspace.member_removed",
  WORKSPACE_MEMBER_ROLE_CHANGED: "workspace.member_role_changed",
  WORKSPACE_OWNERSHIP_TRANSFERRED: "workspace.ownership_transferred",
  WORKSPACE_SETTINGS_CHANGED: "workspace.settings_changed",

  // API
  API_KEY_CREATED: "api.key_created",
  API_KEY_REVOKED: "api.key_revoked",
  API_KEY_UPDATED: "api.key_updated",
  API_CALL: "api.call",

  // Webhooks
  WEBHOOK_CREATED: "webhook.created",
  WEBHOOK_UPDATED: "webhook.updated",
  WEBHOOK_DELETED: "webhook.deleted",
  WEBHOOK_DELIVERED: "webhook.delivered",

  // Admin
  ADMIN_USER_CREATED: "admin.user_created",
  ADMIN_USER_UPDATED: "admin.user_updated",
  ADMIN_USER_SUSPENDED: "admin.user_suspended",
  ADMIN_USER_RESTORED: "admin.user_restored",
  ADMIN_BILLING_CHANGED: "admin.billing_changed",
  ADMIN_PLAN_CHANGED: "admin.plan_changed",
  ADMIN_SETTINGS_CHANGED: "admin.settings_changed",

  // System
  SYSTEM_CRON_EXECUTED: "system.cron_executed",
  SYSTEM_SCHEDULED_TASK: "system.scheduled_task",
  SYSTEM_DATA_EXPORT: "system.data_export",
  SYSTEM_DATA_IMPORT: "system.data_import",

  // Security
  SECURITY_PERMISSION_DENIED: "security.permission_denied",
  SECURITY_SUSPICIOUS_ACTIVITY: "security.suspicious_activity",
  SECURITY_RATE_LIMITED: "security.rate_limited",
} as const;

export type AuditActionType = typeof AUDIT_ACTION_TYPES[keyof typeof AUDIT_ACTION_TYPES];

// Resource types that can be audited
export const AUDIT_RESOURCE_TYPES = {
  USER: "user",
  DOCUMENT: "document",
  PROJECT: "project",
  WORKSPACE: "workspace",
  API_KEY: "api_key",
  WEBHOOK: "webhook",
  SCHEDULE: "schedule",
  BOT: "bot",
  IMPORT: "import",
  SYSTEM: "system",
} as const;

export type AuditResourceType = typeof AUDIT_RESOURCE_TYPES[keyof typeof AUDIT_RESOURCE_TYPES];

// ═══════════════════════════════════════════════════════════════
// INTERNAL LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Internal mutation to log an audit event (no auth check - called by other functions)
export const logEventInternal = internalMutation({
  args: {
    userId: v.string(),
    userEmail: v.optional(v.string()),
    action: v.string(),
    actionCategory: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
    })),
    metadata: v.optional(v.any()),
    severity: v.optional(v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    )),
  },
  handler: async (ctx, args) => {
    // Audit logs are immutable - insert only
    const auditLogId = await ctx.db.insert("auditLogs", {
      timestamp: Date.now(),
      userId: args.userId,
      userEmail: args.userEmail,
      action: args.action,
      actionCategory: args.actionCategory,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      resourceName: args.resourceName,
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      changes: args.changes,
      metadata: args.metadata,
      severity: args.severity || "info",
    });

    return auditLogId;
  },
});

// Public mutation to log an event (with auth check)
export const logEvent = mutation({
  args: {
    action: v.string(),
    actionCategory: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    sessionId: v.optional(v.string()),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
    })),
    metadata: v.optional(v.any()),
    severity: v.optional(v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();

    await ctx.db.insert("auditLogs", {
      timestamp: Date.now(),
      userId,
      userEmail: identity?.email || undefined,
      action: args.action,
      actionCategory: args.actionCategory,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      resourceName: args.resourceName,
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      ipAddress: undefined, // Not available in client context
      userAgent: undefined, // Not available in client context
      changes: args.changes,
      metadata: args.metadata,
      severity: args.severity || "info",
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// List audit events with filtering and pagination
export const listEvents = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.string()),
    action: v.optional(v.string()),
    actionCategory: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    severity: v.optional(v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    )),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // Timestamp cursor for pagination
  },
  handler: async (ctx, args) => {
    const currentUserId = await getUserId(ctx);
    const {
      workspaceId,
      userId,
      action,
      actionCategory,
      resourceType,
      resourceId,
      severity,
      startTime,
      endTime,
      limit = 50,
      cursor,
    } = args;

    // If workspace is specified, verify user has access
    if (workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
        )
        .unique();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("You don't have permission to view audit logs for this workspace");
      }
    }

    // Build query with filters
    let query = ctx.db
      .query("auditLogs")
      .withIndex("byTimestamp")
      .order("desc");

    // Apply timestamp filters
    const events = await query.collect();

    // Filter in-memory (Convex doesn't support complex multi-field queries)
    let filtered = events.filter((event) => {
      if (workspaceId && event.workspaceId !== workspaceId) return false;
      if (userId && event.userId !== userId) return false;
      if (action && event.action !== action) return false;
      if (actionCategory && event.actionCategory !== actionCategory) return false;
      if (resourceType && event.resourceType !== resourceType) return false;
      if (resourceId && event.resourceId !== resourceId) return false;
      if (severity && event.severity !== severity) return false;
      if (startTime && event.timestamp < startTime) return false;
      if (endTime && event.timestamp > endTime) return false;
      if (cursor && event.timestamp >= cursor) return false;

      // For personal logs (no workspace), only show user's own events
      if (!workspaceId && event.userId !== currentUserId) return false;

      return true;
    });

    // Apply pagination
    const pageEvents = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor = hasMore && pageEvents.length > 0
      ? pageEvents[pageEvents.length - 1].timestamp
      : null;

    return {
      events: pageEvents,
      hasMore,
      nextCursor,
      totalCount: filtered.length,
    };
  },
});

// Get a single audit event by ID
export const getEvent = query({
  args: {
    eventId: v.id("auditLogs"),
  },
  handler: async (ctx, { eventId }) => {
    const currentUserId = await getUserId(ctx);
    const event = await ctx.db.get(eventId);

    if (!event) {
      return null;
    }

    // Check access
    if (event.workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", event.workspaceId!).eq("userId", currentUserId)
        )
        .unique();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("You don't have permission to view this audit event");
      }
    } else if (event.userId !== currentUserId) {
      throw new Error("You don't have permission to view this audit event");
    }

    return event;
  },
});

// Get aggregate statistics for audit events
export const getEventStats = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, startTime, endTime }) => {
    const currentUserId = await getUserId(ctx);
    const now = Date.now();
    const defaultStartTime = startTime || now - 30 * 24 * 60 * 60 * 1000; // 30 days
    const defaultEndTime = endTime || now;

    // Verify workspace access if specified
    if (workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
        )
        .unique();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("You don't have permission to view audit statistics");
      }
    }

    // Fetch events
    let events: Doc<"auditLogs">[];
    if (workspaceId) {
      events = await ctx.db
        .query("auditLogs")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), defaultStartTime),
            q.lte(q.field("timestamp"), defaultEndTime)
          )
        )
        .collect();
    } else {
      events = await ctx.db
        .query("auditLogs")
        .withIndex("byUser", (q) => q.eq("userId", currentUserId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), defaultStartTime),
            q.lte(q.field("timestamp"), defaultEndTime)
          )
        )
        .collect();
    }

    // Calculate statistics
    const totalEvents = events.length;
    const bySeverity: Record<string, number> = { info: 0, warning: 0, critical: 0 };
    const byCategory: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    events.forEach((event) => {
      // By severity
      const sev = event.severity || "info";
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;

      // By category
      byCategory[event.actionCategory] = (byCategory[event.actionCategory] || 0) + 1;

      // By action
      byAction[event.action] = (byAction[event.action] || 0) + 1;

      // By user
      byUser[event.userId] = (byUser[event.userId] || 0) + 1;

      // By day
      const day = new Date(event.timestamp).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    // Get top actions and users
    const topActions = Object.entries(byAction)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    const topUsers = Object.entries(byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Daily trend
    const dailyTrend = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalEvents,
      bySeverity,
      byCategory,
      topActions,
      topUsers,
      dailyTrend,
      timeRange: {
        start: defaultStartTime,
        end: defaultEndTime,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Export audit events for compliance
export const exportEvents = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    format: v.union(v.literal("json"), v.literal("csv")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    actionCategory: v.optional(v.string()),
    severity: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getUserId(ctx);
    const {
      workspaceId,
      format,
      startTime,
      endTime,
      actionCategory,
      severity,
      limit = 10000, // Max export limit
    } = args;

    // Verify access
    if (workspaceId) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
        )
        .unique();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("You don't have permission to export audit logs");
      }
    }

    // Fetch events
    let events: Doc<"auditLogs">[];
    if (workspaceId) {
      events = await ctx.db
        .query("auditLogs")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .order("desc")
        .collect();
    } else {
      events = await ctx.db
        .query("auditLogs")
        .withIndex("byUser", (q) => q.eq("userId", currentUserId))
        .order("desc")
        .collect();
    }

    // Apply filters
    let filtered = events.filter((event) => {
      if (startTime && event.timestamp < startTime) return false;
      if (endTime && event.timestamp > endTime) return false;
      if (actionCategory && event.actionCategory !== actionCategory) return false;
      if (severity && event.severity !== severity) return false;
      return true;
    }).slice(0, limit);

    // Format output
    if (format === "json") {
      return {
        format: "json",
        exportedAt: Date.now(),
        count: filtered.length,
        data: filtered.map((event) => ({
          id: event._id,
          timestamp: event.timestamp,
          timestampISO: new Date(event.timestamp).toISOString(),
          userId: event.userId,
          userEmail: event.userEmail,
          action: event.action,
          actionCategory: event.actionCategory,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          resourceName: event.resourceName,
          workspaceId: event.workspaceId,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          severity: event.severity,
          changes: event.changes,
          metadata: event.metadata,
        })),
      };
    }

    // CSV format
    const headers = [
      "timestamp",
      "timestamp_iso",
      "user_id",
      "user_email",
      "action",
      "action_category",
      "resource_type",
      "resource_id",
      "resource_name",
      "severity",
      "ip_address",
      "session_id",
    ];

    const rows = filtered.map((event) =>
      [
        event.timestamp.toString(),
        new Date(event.timestamp).toISOString(),
        event.userId,
        event.userEmail || "",
        event.action,
        event.actionCategory,
        event.resourceType || "",
        event.resourceId || "",
        event.resourceName || "",
        event.severity || "info",
        event.ipAddress || "",
        event.sessionId || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );

    return {
      format: "csv",
      exportedAt: Date.now(),
      count: filtered.length,
      data: [headers.join(","), ...rows].join("\n"),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// REAL-TIME STREAMING
// ═══════════════════════════════════════════════════════════════

// Subscribe to recent audit events (for SIEM integration)
export const streamEvents = query({
  args: {
    workspaceId: v.id("workspaces"),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, since, limit = 100 }) => {
    const currentUserId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
      )
      .unique();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("You don't have permission to stream audit events");
    }

    // Get recent events
    const sinceTime = since || Date.now() - 5 * 60 * 1000; // Default: last 5 minutes

    const events = await ctx.db
      .query("auditLogs")
      .withIndex("byWorkspaceAndTimestamp", (q) =>
        q.eq("workspaceId", workspaceId).gte("timestamp", sinceTime)
      )
      .order("desc")
      .take(limit);

    return {
      events,
      lastTimestamp: events.length > 0 ? events[0].timestamp : sinceTime,
      serverTime: Date.now(),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// RETENTION POLICY
// ═══════════════════════════════════════════════════════════════

// Set retention policy for a workspace
export const setRetentionPolicy = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    retentionDays: v.number(),
  },
  handler: async (ctx, { workspaceId, retentionDays }) => {
    const currentUserId = await getUserId(ctx);

    // Verify owner access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
      )
      .unique();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only workspace owners can set retention policies");
    }

    // Validate retention days (minimum 30, maximum 2555 (7 years))
    if (retentionDays < 30 || retentionDays > 2555) {
      throw new Error("Retention period must be between 30 and 2555 days");
    }

    // Check if policy exists
    const existingPolicy = await ctx.db
      .query("auditRetentionPolicies")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();

    if (existingPolicy) {
      await ctx.db.patch(existingPolicy._id, {
        retentionDays,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("auditRetentionPolicies", {
        workspaceId,
        retentionDays,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Log the policy change
    await ctx.scheduler.runAfter(0, internal.auditLog.logEventInternal, {
      userId: currentUserId,
      action: "workspace.retention_policy_changed",
      actionCategory: "workspace",
      resourceType: "workspace",
      resourceId: workspaceId,
      workspaceId,
      changes: {
        after: { retentionDays },
      },
      severity: "warning",
    });
  },
});

// Get retention policy for a workspace
export const getRetentionPolicy = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const currentUserId = await getUserId(ctx);

    // Verify access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", currentUserId)
      )
      .unique();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("You don't have permission to view retention policy");
    }

    const policy = await ctx.db
      .query("auditRetentionPolicies")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();

    return policy || { retentionDays: 365 }; // Default 1 year
  },
});

// ═══════════════════════════════════════════════════════════════
// CLEANUP & MAINTENANCE
// ═══════════════════════════════════════════════════════════════

// Clean up old audit events based on retention policies (cron job)
export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let totalDeleted = 0;

    // Get all retention policies
    const policies = await ctx.db.query("auditRetentionPolicies").collect();

    // Process each workspace with a custom policy
    for (const policy of policies) {
      const cutoffTime = now - policy.retentionDays * 24 * 60 * 60 * 1000;

      const oldEvents = await ctx.db
        .query("auditLogs")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", policy.workspaceId))
        .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
        .take(1000); // Process in batches

      for (const event of oldEvents) {
        await ctx.db.delete(event._id);
        totalDeleted++;
      }
    }

    // Clean up events for workspaces without custom policies (default 365 days)
    const defaultCutoff = now - 365 * 24 * 60 * 60 * 1000;
    const workspacesWithPolicies = new Set(policies.map((p) => p.workspaceId));

    const oldDefaultEvents = await ctx.db
      .query("auditLogs")
      .withIndex("byTimestamp")
      .filter((q) => q.lt(q.field("timestamp"), defaultCutoff))
      .take(1000);

    for (const event of oldDefaultEvents) {
      if (event.workspaceId && workspacesWithPolicies.has(event.workspaceId)) {
        continue; // Skip, handled by custom policy
      }
      await ctx.db.delete(event._id);
      totalDeleted++;
    }

    return { deleted: totalDeleted };
  },
});

// ═══════════════════════════════════════════════════════════════
// ACTION CATEGORIES
// ═══════════════════════════════════════════════════════════════

// Get available action categories for filtering
export const getActionCategories = query({
  args: {},
  handler: async () => {
    return [
      { id: "auth", name: "Authentication", description: "Login, logout, password changes" },
      { id: "document", name: "Documents", description: "Document CRUD operations" },
      { id: "project", name: "Projects", description: "Project management" },
      { id: "workspace", name: "Workspaces", description: "Workspace and team management" },
      { id: "api", name: "API", description: "API key management and calls" },
      { id: "webhook", name: "Webhooks", description: "Webhook configuration and delivery" },
      { id: "admin", name: "Administration", description: "User and billing management" },
      { id: "system", name: "System", description: "Cron jobs and scheduled tasks" },
      { id: "security", name: "Security", description: "Security-related events" },
    ];
  },
});

// Get all action types for filtering
export const getActionTypes = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (_, { category }) => {
    const allActions = Object.entries(AUDIT_ACTION_TYPES).map(([key, value]) => ({
      key,
      value,
      category: value.split(".")[0],
    }));

    if (category) {
      return allActions.filter((a) => a.category === category);
    }

    return allActions;
  },
});

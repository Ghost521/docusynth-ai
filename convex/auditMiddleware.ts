import { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// AUDIT MIDDLEWARE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Context information extracted for audit logging
 */
export interface AuditContext {
  userId: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Options for creating an audit log entry
 */
export interface AuditLogOptions {
  action: string;
  actionCategory: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  workspaceId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: any;
  severity?: "info" | "warning" | "critical";
}

/**
 * Extract audit context from mutation/query context
 */
export async function createAuditContext(
  ctx: MutationCtx | QueryCtx
): Promise<AuditContext | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  // Extract user ID from identity
  // Clerk uses tokenIdentifier, Auth0 uses subject, etc.
  const userId = identity.tokenIdentifier || identity.subject || "";

  return {
    userId,
    userEmail: identity.email || undefined,
    // Note: sessionId, ipAddress, userAgent are not available in Convex context
    // They need to be passed from the client or HTTP layer
  };
}

/**
 * Capture changes between two objects for audit logging
 * Returns a diff showing before/after values for changed fields only
 */
export function captureChanges<T extends Record<string, any>>(
  before: T | null | undefined,
  after: T | null | undefined,
  options?: {
    excludeFields?: string[];
    includeOnlyFields?: string[];
  }
): { before: Record<string, any>; after: Record<string, any> } | null {
  const excludeFields = new Set([
    "_id",
    "_creationTime",
    ...( options?.excludeFields || []),
  ]);

  const includeOnlyFields = options?.includeOnlyFields
    ? new Set(options.includeOnlyFields)
    : null;

  const beforeDiff: Record<string, any> = {};
  const afterDiff: Record<string, any> = {};

  // Handle null/undefined cases
  if (!before && !after) {
    return null;
  }

  if (!before && after) {
    // New record created
    const cleaned = { ...after } as Record<string, any>;
    for (const key of excludeFields) {
      delete cleaned[key];
    }
    if (includeOnlyFields) {
      for (const key of Object.keys(cleaned)) {
        if (!includeOnlyFields.has(key)) {
          delete cleaned[key];
        }
      }
    }
    return { before: {}, after: sanitizeForLog(cleaned) };
  }

  if (before && !after) {
    // Record deleted
    const cleaned = { ...before } as Record<string, any>;
    for (const key of excludeFields) {
      delete cleaned[key];
    }
    if (includeOnlyFields) {
      for (const key of Object.keys(cleaned)) {
        if (!includeOnlyFields.has(key)) {
          delete cleaned[key];
        }
      }
    }
    return { before: sanitizeForLog(cleaned), after: {} };
  }

  // Both exist - find differences
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const key of allKeys) {
    if (excludeFields.has(key)) continue;
    if (includeOnlyFields && !includeOnlyFields.has(key)) continue;

    const beforeVal = (before as any)?.[key];
    const afterVal = (after as any)?.[key];

    if (!deepEqual(beforeVal, afterVal)) {
      beforeDiff[key] = beforeVal;
      afterDiff[key] = afterVal;
    }
  }

  if (Object.keys(beforeDiff).length === 0 && Object.keys(afterDiff).length === 0) {
    return null;
  }

  return {
    before: sanitizeForLog(beforeDiff),
    after: sanitizeForLog(afterDiff),
  };
}

/**
 * Deep equality check for objects/arrays
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Sanitize data for logging - remove sensitive fields
 */
export function sanitizeForLog<T extends Record<string, any>>(data: T): Record<string, any> {
  if (!data || typeof data !== "object") {
    return data;
  }

  // Fields that should never be logged
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /apikey/i,
    /api_key/i,
    /credential/i,
    /private/i,
    /^key$/i,
    /authorization/i,
    /auth/i,
    /ssn/i,
    /credit.*card/i,
    /cvv/i,
    /pin/i,
  ];

  // Fields that should be truncated
  const truncateFields = new Set([
    "content",
    "body",
    "description",
    "markdown",
    "html",
    "text",
    "raw",
  ]);

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if field name matches sensitive patterns
    const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (truncateFields.has(key.toLowerCase()) && typeof value === "string") {
      // Truncate long content fields
      sanitized[key] = value.length > 200
        ? value.substring(0, 200) + `... (${value.length} chars total)`
        : value;
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      sanitized[key] = value.map((item) =>
        typeof item === "object" && item !== null ? sanitizeForLog(item) : item
      );
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as Partial<T>;
}

/**
 * Format a resource for display in audit logs
 */
export function formatResourceName(
  resourceType: string,
  resource: Record<string, any> | null | undefined
): string {
  if (!resource) {
    return "Unknown";
  }

  // Try common name fields
  const nameFields = ["name", "title", "topic", "label", "slug", "email"];

  for (const field of nameFields) {
    if (resource[field] && typeof resource[field] === "string") {
      return resource[field];
    }
  }

  // Fall back to ID
  if (resource._id) {
    return `${resourceType}:${resource._id}`;
  }

  return "Unknown";
}

/**
 * Extract action category from action string
 * e.g., "document.created" -> "document"
 */
export function extractActionCategory(action: string): string {
  const parts = action.split(".");
  return parts[0] || "unknown";
}

/**
 * Determine severity based on action type
 */
export function determineSeverity(
  action: string
): "info" | "warning" | "critical" {
  const criticalActions = [
    "auth.login_failed",
    "security.permission_denied",
    "security.suspicious_activity",
    "admin.user_suspended",
    "workspace.deleted",
    "api.key_revoked",
  ];

  const warningActions = [
    "document.deleted",
    "project.deleted",
    "workspace.member_removed",
    "api.key_created",
    "webhook.deleted",
    "admin.billing_changed",
    "admin.plan_changed",
  ];

  if (criticalActions.some((a) => action.includes(a) || a.includes(action))) {
    return "critical";
  }

  if (warningActions.some((a) => action.includes(a) || a.includes(action))) {
    return "warning";
  }

  return "info";
}

/**
 * Create a structured audit log entry
 */
export function createAuditEntry(
  context: AuditContext,
  options: AuditLogOptions
): {
  userId: string;
  userEmail?: string;
  action: string;
  actionCategory: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  workspaceId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: { before?: any; after?: any };
  metadata?: any;
  severity: "info" | "warning" | "critical";
} {
  return {
    userId: context.userId,
    userEmail: context.userEmail,
    action: options.action,
    actionCategory: options.actionCategory,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    resourceName: options.resourceName,
    workspaceId: options.workspaceId,
    sessionId: context.sessionId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    changes: options.changes,
    metadata: options.metadata,
    severity: options.severity || determineSeverity(options.action),
  };
}

/**
 * Helper to log audit event from a mutation context
 * Usage: await logAudit(ctx, { action: "document.created", ... })
 */
export async function logAudit(
  ctx: MutationCtx,
  options: AuditLogOptions
): Promise<void> {
  const auditContext = await createAuditContext(ctx);

  if (!auditContext) {
    console.warn("Cannot log audit event: no authenticated user");
    return;
  }

  const entry = createAuditEntry(auditContext, options);

  await ctx.scheduler.runAfter(0, internal.auditLog.logEventInternal, {
    userId: entry.userId,
    userEmail: entry.userEmail,
    action: entry.action,
    actionCategory: entry.actionCategory,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName,
    workspaceId: entry.workspaceId ? (entry.workspaceId as any) : undefined,
    sessionId: entry.sessionId,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    changes: entry.changes,
    metadata: entry.metadata,
    severity: entry.severity,
  });
}

/**
 * Create a wrapper for mutations that automatically logs audit events
 * This is a helper pattern for consistent audit logging
 *
 * Example usage:
 * ```
 * const myMutation = withAuditLog(
 *   mutation({ ... }),
 *   "document.created",
 *   (args, result) => ({
 *     resourceType: "document",
 *     resourceId: result._id,
 *     resourceName: args.title,
 *   })
 * );
 * ```
 */
export function createAuditedMutation<TArgs, TResult>(
  handler: (ctx: MutationCtx, args: TArgs) => Promise<TResult>,
  getAuditOptions: (
    args: TArgs,
    result: TResult,
    ctx: MutationCtx
  ) => AuditLogOptions | null
): (ctx: MutationCtx, args: TArgs) => Promise<TResult> {
  return async (ctx: MutationCtx, args: TArgs): Promise<TResult> => {
    const result = await handler(ctx, args);

    const auditOptions = getAuditOptions(args, result, ctx);

    if (auditOptions) {
      await logAudit(ctx, auditOptions);
    }

    return result;
  };
}

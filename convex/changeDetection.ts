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

// Source types
export type SourceType = "url" | "github_repo" | "github_release" | "api_docs";

// Check frequency options
export const CHECK_FREQUENCIES = {
  hourly: { label: "Every hour", ms: 60 * 60 * 1000 },
  every_6_hours: { label: "Every 6 hours", ms: 6 * 60 * 60 * 1000 },
  daily: { label: "Daily", ms: 24 * 60 * 60 * 1000 },
  weekly: { label: "Weekly", ms: 7 * 24 * 60 * 60 * 1000 },
} as const;

export type CheckFrequency = keyof typeof CHECK_FREQUENCIES;

// ===================
// Content Processing Utilities
// ===================

/**
 * Normalize content for comparison - removes dynamic elements that shouldn't trigger alerts
 */
function normalizeContent(content: string): string {
  return content
    // Remove timestamps and dates
    .replace(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/g, "[DATE]")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, "[DATE]")
    // Remove common dynamic elements
    .replace(/<!--[\s\S]*?-->/g, "") // HTML comments
    .replace(/<script[\s\S]*?<\/script>/gi, "") // Scripts
    .replace(/<style[\s\S]*?<\/style>/gi, "") // Styles
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/^\s+|\s+$/gm, "") // Trim lines
    .toLowerCase()
    .trim();
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate SHA-256 hash of content using Web Crypto API
 */
async function calculateContentHash(content: string): Promise<string> {
  const normalized = normalizeContent(content);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Generate a summary of the content (first 500 chars or key points)
 */
function generateContentSummary(content: string): string {
  // Remove markdown formatting for cleaner summary
  const cleaned = content
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\*|_/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "[code]")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();

  return cleaned.substring(0, 500) + (cleaned.length > 500 ? "..." : "");
}

/**
 * Calculate significance score for a change (0-100)
 * Higher scores indicate more significant changes
 */
function calculateSignificance(
  oldContent: string,
  newContent: string,
  diffStats: { added: number; removed: number }
): number {
  const oldNormalized = normalizeContent(oldContent);
  const newNormalized = normalizeContent(newContent);

  // If content is identical after normalization, no significance
  if (oldNormalized === newNormalized) return 0;

  const oldLength = oldNormalized.length;
  const newLength = newNormalized.length;

  // Calculate percentage change
  const lengthChange = Math.abs(newLength - oldLength) / Math.max(oldLength, 1);
  const totalChanges = diffStats.added + diffStats.removed;
  const changeRatio = totalChanges / Math.max(oldLength / 100, 1); // Changes per 100 chars

  // Factors that increase significance:
  // 1. Large amount of content added/removed
  // 2. High percentage of content changed
  // 3. Changes to headers/important sections

  let score = 0;

  // Base score from change ratio (0-40 points)
  score += Math.min(40, changeRatio * 10);

  // Length change contribution (0-30 points)
  score += Math.min(30, lengthChange * 100);

  // Check for structural changes (headers, code blocks)
  const oldHeaders = (oldContent.match(/^#{1,3}\s+.+$/gm) || []).length;
  const newHeaders = (newContent.match(/^#{1,3}\s+.+$/gm) || []).length;
  if (oldHeaders !== newHeaders) {
    score += 15;
  }

  // Check for API/code changes (more significant)
  const oldCodeBlocks = (oldContent.match(/```[\s\S]*?```/g) || []).length;
  const newCodeBlocks = (newContent.match(/```[\s\S]*?```/g) || []).length;
  if (oldCodeBlocks !== newCodeBlocks) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Generate a simple diff summary
 */
function generateDiffSummary(
  oldContent: string,
  newContent: string
): { summary: string; added: number; removed: number; changedSections: string[] } {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const oldSet = new Set(oldLines.map((l) => l.trim()).filter(Boolean));
  const newSet = new Set(newLines.map((l) => l.trim()).filter(Boolean));

  let added = 0;
  let removed = 0;
  const changedSections: string[] = [];

  // Count added lines
  for (const line of newLines) {
    const trimmed = line.trim();
    if (trimmed && !oldSet.has(trimmed)) {
      added++;
      // Track changed sections (headers)
      if (trimmed.startsWith("#")) {
        changedSections.push(trimmed);
      }
    }
  }

  // Count removed lines
  for (const line of oldLines) {
    const trimmed = line.trim();
    if (trimmed && !newSet.has(trimmed)) {
      removed++;
    }
  }

  // Generate human-readable summary
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} lines added`);
  if (removed > 0) parts.push(`${removed} lines removed`);
  if (changedSections.length > 0) {
    parts.push(`sections modified: ${changedSections.slice(0, 3).join(", ")}`);
  }

  return {
    summary: parts.length > 0 ? parts.join(", ") : "Minor changes detected",
    added,
    removed,
    changedSections: changedSections.slice(0, 10),
  };
}

/**
 * Detect the source type from a URL
 */
function detectSourceType(url: string): SourceType {
  if (url.includes("github.com")) {
    if (url.includes("/releases")) return "github_release";
    return "github_repo";
  }
  if (
    url.includes("/api/") ||
    url.includes("/docs/api") ||
    url.includes("swagger") ||
    url.includes("openapi")
  ) {
    return "api_docs";
  }
  return "url";
}

/**
 * Calculate the next check time based on frequency
 */
function calculateNextCheckTime(
  frequency: CheckFrequency,
  fromTime?: number
): number {
  const now = fromTime || Date.now();
  return now + CHECK_FREQUENCIES[frequency].ms;
}

// ===================
// PUBLIC QUERIES
// ===================

// Get monitored sources for a document
export const getMonitoredSources = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    const sources = await ctx.db
      .query("sourceMonitorQueue")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Get latest snapshot for each source
    const withSnapshots = await Promise.all(
      sources.map(async (source) => {
        const snapshot = await ctx.db
          .query("sourceSnapshots")
          .withIndex("byDocumentAndSource", (q) =>
            q.eq("documentId", documentId).eq("sourceUrl", source.sourceUrl)
          )
          .order("desc")
          .first();

        return {
          ...source,
          lastSnapshot: snapshot,
        };
      })
    );

    return withSnapshots;
  },
});

// Get recent source changes for user's documents
export const getRecentChanges = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getUserId(ctx);

    const alerts = await ctx.db
      .query("changeAlerts")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Enrich with document info
    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        const doc = await ctx.db.get(alert.documentId);
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

// ===================
// PUBLIC MUTATIONS
// ===================

// Add a source to monitoring
export const addSourceToMonitor = mutation({
  args: {
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    checkFrequency: v.optional(
      v.union(
        v.literal("hourly"),
        v.literal("every_6_hours"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
  },
  handler: async (ctx, { documentId, sourceUrl, checkFrequency = "daily" }) => {
    const userId = await getUserId(ctx);

    // Verify document ownership
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Check if already monitoring this source
    const existing = await ctx.db
      .query("sourceMonitorQueue")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .filter((q) => q.eq(q.field("sourceUrl"), sourceUrl))
      .first();

    if (existing) {
      throw new Error("Source is already being monitored");
    }

    const sourceType = detectSourceType(sourceUrl);
    const now = Date.now();

    const id = await ctx.db.insert("sourceMonitorQueue", {
      userId,
      documentId,
      sourceUrl,
      sourceType,
      lastCheckedAt: null,
      nextCheckAt: now, // Check immediately
      checkFrequency,
      isActive: true,
      consecutiveFailures: 0,
      lastError: null,
      createdAt: now,
    });

    return id;
  },
});

// Remove a source from monitoring
export const removeSourceFromMonitor = mutation({
  args: {
    monitorId: v.id("sourceMonitorQueue"),
  },
  handler: async (ctx, { monitorId }) => {
    const userId = await getUserId(ctx);

    const monitor = await ctx.db.get(monitorId);
    if (!monitor || monitor.userId !== userId) {
      throw new Error("Monitor not found");
    }

    await ctx.db.delete(monitorId);
  },
});

// Update monitoring settings
export const updateMonitorSettings = mutation({
  args: {
    monitorId: v.id("sourceMonitorQueue"),
    checkFrequency: v.optional(
      v.union(
        v.literal("hourly"),
        v.literal("every_6_hours"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { monitorId, checkFrequency, isActive }) => {
    const userId = await getUserId(ctx);

    const monitor = await ctx.db.get(monitorId);
    if (!monitor || monitor.userId !== userId) {
      throw new Error("Monitor not found");
    }

    const updates: Partial<Doc<"sourceMonitorQueue">> = {};

    if (checkFrequency !== undefined) {
      updates.checkFrequency = checkFrequency;
      updates.nextCheckAt = calculateNextCheckTime(checkFrequency);
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    await ctx.db.patch(monitorId, updates);
  },
});

// Auto-register sources from document
export const registerDocumentSources = mutation({
  args: {
    documentId: v.id("documents"),
    checkFrequency: v.optional(
      v.union(
        v.literal("hourly"),
        v.literal("every_6_hours"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
  },
  handler: async (ctx, { documentId, checkFrequency = "daily" }) => {
    const userId = await getUserId(ctx);

    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    const now = Date.now();
    const addedSources: string[] = [];

    for (const source of doc.sources) {
      // Check if already monitoring
      const existing = await ctx.db
        .query("sourceMonitorQueue")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .filter((q) => q.eq(q.field("sourceUrl"), source.url))
        .first();

      if (!existing) {
        const sourceType = detectSourceType(source.url);
        await ctx.db.insert("sourceMonitorQueue", {
          userId,
          documentId,
          sourceUrl: source.url,
          sourceType,
          lastCheckedAt: null,
          nextCheckAt: now,
          checkFrequency,
          isActive: true,
          consecutiveFailures: 0,
          lastError: null,
          createdAt: now,
        });
        addedSources.push(source.url);
      }
    }

    return { addedCount: addedSources.length, sources: addedSources };
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Get sources due for checking
export const getDueSources = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    const now = Date.now();

    return await ctx.db
      .query("sourceMonitorQueue")
      .withIndex("byActiveAndNextCheck", (q) =>
        q.eq("isActive", true).lte("nextCheckAt", now)
      )
      .take(limit);
  },
});

// Get source monitor by ID (internal)
export const getMonitorInternal = internalQuery({
  args: {
    monitorId: v.id("sourceMonitorQueue"),
  },
  handler: async (ctx, { monitorId }) => {
    return await ctx.db.get(monitorId);
  },
});

// Get latest snapshot for a source
export const getLatestSnapshot = internalQuery({
  args: {
    documentId: v.id("documents"),
    sourceUrl: v.string(),
  },
  handler: async (ctx, { documentId, sourceUrl }) => {
    return await ctx.db
      .query("sourceSnapshots")
      .withIndex("byDocumentAndSource", (q) =>
        q.eq("documentId", documentId).eq("sourceUrl", sourceUrl)
      )
      .order("desc")
      .first();
  },
});

// Record a new snapshot
export const recordSnapshot = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    sourceType: v.union(
      v.literal("url"),
      v.literal("github_repo"),
      v.literal("github_release"),
      v.literal("api_docs")
    ),
    contentHash: v.string(),
    contentSummary: v.string(),
    metadata: v.optional(
      v.object({
        commitSha: v.optional(v.string()),
        releaseTag: v.optional(v.string()),
        lastModified: v.optional(v.string()),
        etag: v.optional(v.string()),
        contentLength: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sourceSnapshots", {
      ...args,
      checkedAt: now,
      createdAt: now,
    });
  },
});

// Update monitor after check
export const updateMonitorAfterCheck = internalMutation({
  args: {
    monitorId: v.id("sourceMonitorQueue"),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { monitorId, success, errorMessage }) => {
    const monitor = await ctx.db.get(monitorId);
    if (!monitor) return;

    const now = Date.now();
    const nextCheckAt = calculateNextCheckTime(monitor.checkFrequency, now);

    if (success) {
      await ctx.db.patch(monitorId, {
        lastCheckedAt: now,
        nextCheckAt,
        consecutiveFailures: 0,
        lastError: null,
      });
    } else {
      const newFailures = monitor.consecutiveFailures + 1;
      // Disable after 5 consecutive failures
      const shouldDisable = newFailures >= 5;

      await ctx.db.patch(monitorId, {
        lastCheckedAt: now,
        nextCheckAt,
        consecutiveFailures: newFailures,
        lastError: errorMessage || "Unknown error",
        isActive: !shouldDisable,
      });
    }
  },
});

// Check a single source for changes
export const checkSourceForChanges = internalAction({
  args: {
    monitorId: v.id("sourceMonitorQueue"),
  },
  handler: async (ctx, { monitorId }) => {
    const monitor = await ctx.runQuery(internal.changeDetection.getMonitorInternal, {
      monitorId,
    });

    if (!monitor) {
      return { success: false, error: "Monitor not found" };
    }

    try {
      // Fetch the source content
      let content: string;
      let metadata: {
        commitSha?: string;
        releaseTag?: string;
        lastModified?: string;
        etag?: string;
        contentLength?: number;
      } = {};

      if (monitor.sourceType === "github_repo" || monitor.sourceType === "github_release") {
        // Extract owner/repo from GitHub URL
        const match = monitor.sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          throw new Error("Invalid GitHub URL");
        }
        const [, owner, repo] = match;

        if (monitor.sourceType === "github_release") {
          // Fetch latest release
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, "")}/releases/latest`,
            {
              headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "DocuSynth-AI",
              },
            }
          );

          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }

          const release = await response.json();
          content = JSON.stringify({
            tag: release.tag_name,
            name: release.name,
            body: release.body,
            published_at: release.published_at,
          });
          metadata.releaseTag = release.tag_name;
        } else {
          // Fetch latest commit
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, "")}/commits?per_page=1`,
            {
              headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "DocuSynth-AI",
              },
            }
          );

          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }

          const commits = await response.json();
          if (commits.length > 0) {
            const commit = commits[0];
            content = JSON.stringify({
              sha: commit.sha,
              message: commit.commit.message,
              date: commit.commit.committer.date,
            });
            metadata.commitSha = commit.sha;
          } else {
            content = "No commits found";
          }
        }
      } else {
        // Fetch URL content
        const response = await fetch(monitor.sourceUrl, {
          headers: {
            "User-Agent": "DocuSynth-AI",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        content = await response.text();
        metadata.lastModified = response.headers.get("last-modified") || undefined;
        metadata.etag = response.headers.get("etag") || undefined;
        metadata.contentLength = parseInt(response.headers.get("content-length") || "0") || undefined;
      }

      // Calculate hash of new content
      const newHash = await calculateContentHash(content);
      const contentSummary = generateContentSummary(content);

      // Get previous snapshot
      const previousSnapshot = await ctx.runQuery(
        internal.changeDetection.getLatestSnapshot,
        {
          documentId: monitor.documentId,
          sourceUrl: monitor.sourceUrl,
        }
      );

      // Record new snapshot
      await ctx.runMutation(internal.changeDetection.recordSnapshot, {
        userId: monitor.userId,
        documentId: monitor.documentId,
        sourceUrl: monitor.sourceUrl,
        sourceType: monitor.sourceType,
        contentHash: newHash,
        contentSummary,
        metadata,
      });

      // Check if content changed
      if (previousSnapshot && previousSnapshot.contentHash !== newHash) {
        // Content changed - create alert
        const diffResult = generateDiffSummary(
          previousSnapshot.contentSummary,
          contentSummary
        );
        const significance = calculateSignificance(
          previousSnapshot.contentSummary,
          contentSummary,
          { added: diffResult.added, removed: diffResult.removed }
        );

        // Determine change type
        let changeType: "content_modified" | "new_release" | "new_commit" | "major_update" | "minor_update" =
          "content_modified";
        if (monitor.sourceType === "github_release" && metadata.releaseTag) {
          changeType = "new_release";
        } else if (monitor.sourceType === "github_repo" && metadata.commitSha) {
          changeType = "new_commit";
        } else if (significance >= 50) {
          changeType = "major_update";
        } else if (significance < 20) {
          changeType = "minor_update";
        }

        // Create alert
        await ctx.runMutation(internal.alerts.createAlertInternal, {
          userId: monitor.userId,
          documentId: monitor.documentId,
          sourceUrl: monitor.sourceUrl,
          changeType,
          significance,
          diffSummary: diffResult.summary,
          diffDetails: {
            addedLines: diffResult.added,
            removedLines: diffResult.removed,
            changedSections: diffResult.changedSections,
          },
          previousHash: previousSnapshot.contentHash,
          newHash,
        });

        // Check if auto-regenerate is enabled
        const prefs = await ctx.runQuery(internal.alerts.getPreferencesInternal, {
          userId: monitor.userId,
          documentId: monitor.documentId,
        });

        if (prefs?.autoRegenerate && significance >= (prefs.minSignificance || 0)) {
          // Trigger document regeneration
          await ctx.scheduler.runAfter(0, internal.alerts.triggerAutoRegenerate, {
            userId: monitor.userId,
            documentId: monitor.documentId,
          });
        }
      }

      // Update monitor
      await ctx.runMutation(internal.changeDetection.updateMonitorAfterCheck, {
        monitorId,
        success: true,
      });

      return {
        success: true,
        changed: previousSnapshot ? previousSnapshot.contentHash !== newHash : false,
      };
    } catch (error: any) {
      // Update monitor with error
      await ctx.runMutation(internal.changeDetection.updateMonitorAfterCheck, {
        monitorId,
        success: false,
        errorMessage: error.message,
      });

      return { success: false, error: error.message };
    }
  },
});

// Process the change detection queue
export const processChangeQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueSources = await ctx.runQuery(internal.changeDetection.getDueSources, {
      limit: 20,
    });

    if (dueSources.length === 0) {
      return { processed: 0 };
    }

    const results = await Promise.allSettled(
      dueSources.map((source) =>
        ctx.runAction(internal.changeDetection.checkSourceForChanges, {
          monitorId: source._id,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      processed: dueSources.length,
      successful,
      failed,
    };
  },
});

// Cleanup old snapshots (keep last N per source)
export const cleanupOldSnapshots = internalMutation({
  args: {
    keepCount: v.optional(v.number()),
  },
  handler: async (ctx, { keepCount = 10 }) => {
    // Get all unique document/source combinations
    const snapshots = await ctx.db.query("sourceSnapshots").collect();

    // Group by document and source
    const groups = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots) {
      const key = `${snapshot.documentId}:${snapshot.sourceUrl}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(snapshot);
    }

    let deletedCount = 0;

    // For each group, keep only the latest N snapshots
    const groupEntries = Array.from(groups.entries());
    for (let g = 0; g < groupEntries.length; g++) {
      const groupSnapshots = groupEntries[g][1];
      // Sort by createdAt descending
      groupSnapshots.sort((a, b) => b.createdAt - a.createdAt);

      // Delete old snapshots
      for (let i = keepCount; i < groupSnapshots.length; i++) {
        await ctx.db.delete(groupSnapshots[i]._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

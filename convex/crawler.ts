
/**
 * Advanced Web Crawler Backend
 *
 * This module provides the main crawler functionality:
 * - Crawl job management (create, pause, resume, cancel)
 * - Queue processing with priority support
 * - Real-time status tracking
 * - Content extraction and document generation
 */

import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserId } from "./users";
import {
  normalizeUrl,
  extractDomain,
  shouldCrawl,
  parseRobotsTxt,
  parseSitemap,
  isSitemapIndex,
  extractContent,
  htmlToMarkdown,
  generateContentHash,
  calculatePriority,
  RobotsTxtRules,
  CrawlConfig,
} from "./crawlerUtils";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CrawlJobConfig {
  name: string;
  startUrl: string;
  projectId?: Id<"projects">;
  workspaceId?: Id<"workspaces">;
  // URL filtering
  includePatterns?: string[];
  excludePatterns?: string[];
  domainRestriction?: "same" | "subdomains" | "any";
  // Content filtering
  contentTypes?: string[];
  // Limits
  maxPages?: number;
  maxDepth?: number;
  // Rate limiting
  requestDelayMs?: number;
  maxConcurrent?: number;
  // Authentication
  authType?: "none" | "basic" | "bearer" | "cookie";
  authCredentials?: string;
  customHeaders?: Record<string, string>;
  // Scheduling
  scheduleEnabled?: boolean;
  scheduleFrequency?: "daily" | "weekly" | "monthly";
  scheduleHour?: number;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all crawl jobs for the current user
 */
export const listJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("queued"),
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit = 50 }) => {
    const userId = await getUserId(ctx);

    let jobsQuery = ctx.db
      .query("crawlJobs")
      .withIndex("byUser", (q) => q.eq("userId", userId));

    if (status) {
      jobsQuery = ctx.db
        .query("crawlJobs")
        .withIndex("byUserAndStatus", (q) => q.eq("userId", userId).eq("status", status));
    }

    const jobs = await jobsQuery.order("desc").take(limit);
    return jobs;
  },
});

/**
 * Get a specific crawl job with detailed status
 */
export const getJob = query({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    return job;
  },
});

/**
 * Get real-time status for a crawl job
 */
export const getJobStatus = query({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    // Get current queue stats
    const pendingCount = await ctx.db
      .query("crawlQueue")
      .withIndex("byJobAndStatus", (q) => q.eq("jobId", jobId).eq("status", "pending"))
      .collect()
      .then((items) => items.length);

    const processingCount = await ctx.db
      .query("crawlQueue")
      .withIndex("byJobAndStatus", (q) => q.eq("jobId", jobId).eq("status", "processing"))
      .collect()
      .then((items) => items.length);

    // Calculate speed (pages per minute)
    let speed = 0;
    if (job.startedAt && job.status === "running") {
      const elapsedMinutes = (Date.now() - job.startedAt) / 60000;
      if (elapsedMinutes > 0) {
        speed = Math.round(job.pagesCrawled / elapsedMinutes);
      }
    }

    return {
      status: job.status,
      pagesDiscovered: job.pagesDiscovered,
      pagesCrawled: job.pagesCrawled,
      pagesSuccessful: job.pagesSuccessful,
      pagesFailed: job.pagesFailed,
      pagesSkipped: job.pagesSkipped,
      queuePending: pendingCount,
      queueProcessing: processingCount,
      totalWords: job.totalWords,
      totalLinks: job.totalLinks,
      speed,
      lastError: job.lastError,
      errorCount: job.errorCount,
      startedAt: job.startedAt,
      lastActivityAt: job.lastActivityAt,
    };
  },
});

/**
 * Get crawled pages for a job
 */
export const getJobPages = query({
  args: {
    jobId: v.id("crawlJobs"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, { jobId, limit = 50, offset = 0 }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    const pages = await ctx.db
      .query("crawlPages")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .order("desc")
      .collect();

    return pages.slice(offset, offset + limit);
  },
});

/**
 * Get queue items for a job (for debugging/monitoring)
 */
export const getJobQueue = query({
  args: {
    jobId: v.id("crawlJobs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("skipped")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { jobId, status, limit = 100 }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    let query = ctx.db.query("crawlQueue").withIndex("byJob", (q) => q.eq("jobId", jobId));

    if (status) {
      query = ctx.db
        .query("crawlQueue")
        .withIndex("byJobAndStatus", (q) => q.eq("jobId", jobId).eq("status", status));
    }

    return await query.take(limit);
  },
});

/**
 * Get crawl history for a job
 */
export const getJobHistory = query({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    return await ctx.db
      .query("crawlRunHistory")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .order("desc")
      .collect();
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Public Mutations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new crawl job
 */
export const createJob = mutation({
  args: {
    name: v.string(),
    startUrl: v.string(),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.optional(v.id("workspaces")),
    includePatterns: v.optional(v.array(v.string())),
    excludePatterns: v.optional(v.array(v.string())),
    domainRestriction: v.optional(
      v.union(v.literal("same"), v.literal("subdomains"), v.literal("any"))
    ),
    contentTypes: v.optional(v.array(v.string())),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
    requestDelayMs: v.optional(v.number()),
    maxConcurrent: v.optional(v.number()),
    authType: v.optional(
      v.union(
        v.literal("none"),
        v.literal("basic"),
        v.literal("bearer"),
        v.literal("cookie")
      )
    ),
    authCredentials: v.optional(v.string()),
    customHeaders: v.optional(v.string()),
    scheduleEnabled: v.optional(v.boolean()),
    scheduleFrequency: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))
    ),
    scheduleHour: v.optional(v.number()),
    scheduleDayOfWeek: v.optional(v.number()),
    scheduleDayOfMonth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate URL
    try {
      new URL(args.startUrl);
    } catch {
      throw new Error("Invalid start URL");
    }

    const now = Date.now();

    const jobId = await ctx.db.insert("crawlJobs", {
      userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      name: args.name,
      startUrl: normalizeUrl(args.startUrl),
      includePatterns: args.includePatterns || [],
      excludePatterns: args.excludePatterns || [],
      domainRestriction: args.domainRestriction || "same",
      contentTypes: args.contentTypes || ["text/html"],
      maxPages: args.maxPages || 100,
      maxDepth: args.maxDepth || 3,
      requestDelayMs: args.requestDelayMs || 1000,
      maxConcurrent: args.maxConcurrent || 1,
      authType: args.authType || "none",
      authCredentials: args.authCredentials,
      customHeaders: args.customHeaders,
      scheduleEnabled: args.scheduleEnabled || false,
      scheduleFrequency: args.scheduleFrequency,
      scheduleHour: args.scheduleHour,
      scheduleDayOfWeek: args.scheduleDayOfWeek,
      scheduleDayOfMonth: args.scheduleDayOfMonth,
      nextScheduledRun: undefined,
      status: "idle",
      pagesDiscovered: 0,
      pagesCrawled: 0,
      pagesSuccessful: 0,
      pagesFailed: 0,
      pagesSkipped: 0,
      totalWords: 0,
      totalLinks: 0,
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return jobId;
  },
});

/**
 * Start a crawl job
 */
export const startJob = mutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    if (job.status === "running") {
      throw new Error("Job is already running");
    }

    // Reset stats if starting fresh
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "queued",
      pagesDiscovered: 0,
      pagesCrawled: 0,
      pagesSuccessful: 0,
      pagesFailed: 0,
      pagesSkipped: 0,
      totalWords: 0,
      totalLinks: 0,
      errorCount: 0,
      startedAt: now,
      pausedAt: undefined,
      completedAt: undefined,
      lastActivityAt: now,
      lastError: undefined,
      updatedAt: now,
    });

    // Clear existing queue
    const existingQueue = await ctx.db
      .query("crawlQueue")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    for (const item of existingQueue) {
      await ctx.db.delete(item._id);
    }

    // Add start URL to queue
    await ctx.db.insert("crawlQueue", {
      jobId,
      userId,
      url: job.startUrl,
      normalizedUrl: normalizeUrl(job.startUrl),
      depth: 0,
      priority: 100, // Highest priority
      status: "pending",
      attempts: 0,
      createdAt: now,
    });

    // Increment pages discovered
    await ctx.db.patch(jobId, { pagesDiscovered: 1 });

    // Schedule the crawler to start
    await ctx.scheduler.runAfter(0, internal.crawler.processQueue, { jobId });
  },
});

/**
 * Pause a running crawl job
 */
export const pauseJob = mutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    if (job.status !== "running" && job.status !== "queued") {
      throw new Error("Job is not running");
    }

    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "paused",
      pausedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Resume a paused crawl job
 */
export const resumeJob = mutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    if (job.status !== "paused") {
      throw new Error("Job is not paused");
    }

    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "queued",
      pausedAt: undefined,
      lastActivityAt: now,
      updatedAt: now,
    });

    // Resume processing
    await ctx.scheduler.runAfter(0, internal.crawler.processQueue, { jobId });
  },
});

/**
 * Cancel a crawl job
 */
export const cancelJob = mutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    if (job.status === "completed" || job.status === "cancelled") {
      throw new Error("Job is already finished");
    }

    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "cancelled",
      completedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Delete a crawl job and all associated data
 */
export const deleteJob = mutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    // Delete queue items
    const queueItems = await ctx.db
      .query("crawlQueue")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    for (const item of queueItems) {
      await ctx.db.delete(item._id);
    }

    // Delete crawled pages
    const pages = await ctx.db
      .query("crawlPages")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    for (const page of pages) {
      await ctx.db.delete(page._id);
    }

    // Delete history
    const history = await ctx.db
      .query("crawlRunHistory")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    for (const run of history) {
      await ctx.db.delete(run._id);
    }

    // Delete sitemap cache
    const sitemaps = await ctx.db
      .query("sitemapCache")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    for (const sitemap of sitemaps) {
      await ctx.db.delete(sitemap._id);
    }

    // Delete the job
    await ctx.db.delete(jobId);
  },
});

/**
 * Update URL priority in the queue
 */
export const updatePriority = mutation({
  args: {
    queueItemId: v.id("crawlQueue"),
    priority: v.number(),
  },
  handler: async (ctx, { queueItemId, priority }) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(queueItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Queue item not found");
    }

    if (item.status !== "pending") {
      throw new Error("Can only update priority for pending items");
    }

    await ctx.db.patch(queueItemId, {
      priority: Math.max(0, Math.min(100, priority)),
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Internal Functions - Queue Processing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main queue processor - called recursively
 */
export const processQueue = internalAction({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    // Check job status
    const job = await ctx.runQuery(internal.crawler.getJobInternal, { jobId });
    if (!job) return;

    // Stop if not in a running state
    if (job.status !== "queued" && job.status !== "running") {
      return;
    }

    // Update to running if queued
    if (job.status === "queued") {
      await ctx.runMutation(internal.crawler.updateJobStatus, {
        jobId,
        status: "running",
      });
    }

    // Check if we've reached the page limit
    if (job.pagesCrawled >= job.maxPages) {
      await ctx.runMutation(internal.crawler.completeJob, { jobId });
      return;
    }

    // Get next item to process
    const nextItem = await ctx.runQuery(internal.crawler.getNextQueueItem, { jobId });

    if (!nextItem) {
      // No more items to process
      await ctx.runMutation(internal.crawler.completeJob, { jobId });
      return;
    }

    // Mark item as processing
    await ctx.runMutation(internal.crawler.updateQueueItemStatus, {
      queueItemId: nextItem._id,
      status: "processing",
    });

    try {
      // Fetch robots.txt if not cached
      let robotsRules: RobotsTxtRules | null = null;
      const domain = extractDomain(nextItem.url);
      const cachedRobots = await ctx.runQuery(internal.crawler.getRobotsCache, { domain });

      if (cachedRobots && cachedRobots.expiresAt > Date.now()) {
        robotsRules = JSON.parse(cachedRobots.rules) as RobotsTxtRules;
      } else {
        // Fetch and cache robots.txt
        robotsRules = await ctx.runAction(internal.crawler.fetchAndCacheRobots, {
          url: nextItem.url,
          domain,
        });
      }

      // Check if we should crawl this URL
      const crawlConfig: CrawlConfig = {
        includePatterns: job.includePatterns,
        excludePatterns: job.excludePatterns,
        domainRestriction: job.domainRestriction,
        maxDepth: job.maxDepth,
        contentTypes: job.contentTypes,
      };

      const { allowed, reason } = shouldCrawl(
        nextItem.url,
        job.startUrl,
        crawlConfig,
        nextItem.depth,
        robotsRules || undefined
      );

      if (!allowed) {
        await ctx.runMutation(internal.crawler.skipQueueItem, {
          queueItemId: nextItem._id,
          reason: reason || "Not allowed",
        });
      } else {
        // Crawl the page
        await ctx.runAction(internal.crawler.crawlPage, {
          jobId,
          queueItemId: nextItem._id,
          url: nextItem.url,
          depth: nextItem.depth,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.crawler.failQueueItem, {
        queueItemId: nextItem._id,
        error: errorMessage,
      });
    }

    // Schedule next processing with delay
    const delay = job.requestDelayMs || 1000;
    await ctx.scheduler.runAfter(delay, internal.crawler.processQueue, { jobId });
  },
});

/**
 * Crawl a single page
 */
export const crawlPage = internalAction({
  args: {
    jobId: v.id("crawlJobs"),
    queueItemId: v.id("crawlQueue"),
    url: v.string(),
    depth: v.number(),
  },
  handler: async (ctx, { jobId, queueItemId, url, depth }) => {
    const job = await ctx.runQuery(internal.crawler.getJobInternal, { jobId });
    if (!job) throw new Error("Job not found");

    // Build headers
    const headers: Record<string, string> = {
      "User-Agent": "DocuSynth-Crawler/1.0 (+https://docusynth.ai/bot)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    };

    // Add custom headers
    if (job.customHeaders) {
      try {
        const custom = JSON.parse(job.customHeaders) as Record<string, string>;
        Object.assign(headers, custom);
      } catch {
        // Ignore invalid JSON
      }
    }

    // Add authentication
    if (job.authType === "bearer" && job.authCredentials) {
      headers["Authorization"] = `Bearer ${job.authCredentials}`;
    } else if (job.authType === "basic" && job.authCredentials) {
      headers["Authorization"] = `Basic ${Buffer.from(job.authCredentials).toString("base64")}`;
    } else if (job.authType === "cookie" && job.authCredentials) {
      headers["Cookie"] = job.authCredentials;
    }

    // Fetch the page
    const response = await fetch(url, {
      headers,
      redirect: "follow",
    });

    const finalUrl = response.url;
    const statusCode = response.status;
    const contentType = response.headers.get("content-type") || "text/html";
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);

    // Check for successful response
    if (!response.ok) {
      throw new Error(`HTTP ${statusCode}: ${response.statusText}`);
    }

    // Check content type
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    if (!isHtml) {
      await ctx.runMutation(internal.crawler.skipQueueItem, {
        queueItemId,
        reason: `Unsupported content type: ${contentType}`,
      });
      return;
    }

    // Read the HTML
    const html = await response.text();

    // Extract content
    const extracted = extractContent(html, finalUrl);

    // Generate content hash
    const contentHash = await generateContentHash(extracted.markdown);

    // Save the crawled page
    await ctx.runMutation(internal.crawler.saveCrawledPage, {
      jobId,
      queueItemId,
      url,
      finalUrl,
      statusCode,
      contentType,
      contentLength,
      title: extracted.title,
      description: extracted.description,
      author: extracted.author,
      publishedDate: extracted.publishedDate,
      markdownContent: extracted.markdown,
      rawHtmlSize: html.length,
      wordCount: extracted.wordCount,
      linkCount: extracted.links.length,
      imageCount: extracted.images.length,
      codeBlockCount: extracted.codeBlocks.length,
      tableCount: extracted.tables.length,
      outgoingLinks: extracted.links,
      structuredData: extracted.structuredData
        ? JSON.stringify(extracted.structuredData)
        : undefined,
      contentHash,
    });

    // Add discovered links to queue
    if (depth < job.maxDepth) {
      await ctx.runMutation(internal.crawler.addLinksToQueue, {
        jobId,
        links: extracted.links,
        depth: depth + 1,
        sourceUrl: url,
      });
    }
  },
});

/**
 * Fetch and cache robots.txt
 */
export const fetchAndCacheRobots = internalAction({
  args: {
    url: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, { url, domain }) => {
    try {
      const protocol = new URL(url).protocol;
      const robotsUrl = `${protocol}//${domain}/robots.txt`;

      const response = await fetch(robotsUrl, {
        headers: {
          "User-Agent": "DocuSynth-Crawler/1.0 (+https://docusynth.ai/bot)",
        },
      });

      let rules: RobotsTxtRules = {
        allowedPaths: [],
        disallowedPaths: [],
        sitemaps: [],
      };

      let robotsTxt: string | undefined;

      if (response.ok) {
        robotsTxt = await response.text();
        rules = parseRobotsTxt(robotsTxt);
      }

      // Cache for 24 hours
      await ctx.runMutation(internal.crawler.cacheRobots, {
        domain,
        robotsTxt,
        rules: JSON.stringify(rules),
        sitemaps: rules.sitemaps,
        crawlDelay: rules.crawlDelay,
      });

      return rules;
    } catch {
      return null;
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Internal Queries
// ═══════════════════════════════════════════════════════════════════════════

export const getJobInternal = internalQuery({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const getNextQueueItem = internalQuery({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    // Get highest priority pending item
    const items = await ctx.db
      .query("crawlQueue")
      .withIndex("byJobAndStatus", (q) => q.eq("jobId", jobId).eq("status", "pending"))
      .collect();

    if (items.length === 0) return null;

    // Sort by priority (descending) and return the first
    items.sort((a, b) => b.priority - a.priority);
    return items[0];
  },
});

export const getRobotsCache = internalQuery({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    return await ctx.db
      .query("robotsCache")
      .withIndex("byDomain", (q) => q.eq("domain", domain))
      .unique();
  },
});

export const checkUrlInQueue = internalQuery({
  args: {
    jobId: v.id("crawlJobs"),
    normalizedUrl: v.string(),
  },
  handler: async (ctx, { jobId, normalizedUrl }) => {
    const existing = await ctx.db
      .query("crawlQueue")
      .withIndex("byNormalizedUrl", (q) =>
        q.eq("jobId", jobId).eq("normalizedUrl", normalizedUrl)
      )
      .unique();

    return existing !== null;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Internal Mutations
// ═══════════════════════════════════════════════════════════════════════════

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    status: v.union(
      v.literal("idle"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { jobId, status }) => {
    await ctx.db.patch(jobId, {
      status,
      lastActivityAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateQueueItemStatus = internalMutation({
  args: {
    queueItemId: v.id("crawlQueue"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, { queueItemId, status }) => {
    const now = Date.now();
    await ctx.db.patch(queueItemId, {
      status,
      lastAttemptAt: now,
      processedAt: status !== "pending" && status !== "processing" ? now : undefined,
    });
  },
});

export const skipQueueItem = internalMutation({
  args: {
    queueItemId: v.id("crawlQueue"),
    reason: v.string(),
  },
  handler: async (ctx, { queueItemId, reason }) => {
    const item = await ctx.db.get(queueItemId);
    if (!item) return;

    await ctx.db.patch(queueItemId, {
      status: "skipped",
      skipReason: reason,
      processedAt: Date.now(),
    });

    // Update job stats
    const job = await ctx.db.get(item.jobId);
    if (job) {
      await ctx.db.patch(item.jobId, {
        pagesSkipped: job.pagesSkipped + 1,
        pagesCrawled: job.pagesCrawled + 1,
        lastActivityAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const failQueueItem = internalMutation({
  args: {
    queueItemId: v.id("crawlQueue"),
    error: v.string(),
  },
  handler: async (ctx, { queueItemId, error }) => {
    const item = await ctx.db.get(queueItemId);
    if (!item) return;

    const attempts = item.attempts + 1;
    const maxRetries = 3;

    if (attempts < maxRetries) {
      // Schedule retry with exponential backoff
      const backoffMs = Math.pow(2, attempts) * 1000;
      await ctx.db.patch(queueItemId, {
        status: "pending",
        attempts,
        lastAttemptAt: Date.now(),
        nextRetryAt: Date.now() + backoffMs,
        errorMessage: error,
      });
    } else {
      // Max retries reached
      await ctx.db.patch(queueItemId, {
        status: "failed",
        attempts,
        lastAttemptAt: Date.now(),
        processedAt: Date.now(),
        errorMessage: error,
      });

      // Update job stats
      const job = await ctx.db.get(item.jobId);
      if (job) {
        await ctx.db.patch(item.jobId, {
          pagesFailed: job.pagesFailed + 1,
          pagesCrawled: job.pagesCrawled + 1,
          errorCount: job.errorCount + 1,
          lastError: error,
          lastActivityAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const saveCrawledPage = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    queueItemId: v.id("crawlQueue"),
    url: v.string(),
    finalUrl: v.string(),
    statusCode: v.number(),
    contentType: v.string(),
    contentLength: v.optional(v.number()),
    title: v.string(),
    description: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedDate: v.optional(v.string()),
    markdownContent: v.string(),
    rawHtmlSize: v.number(),
    wordCount: v.number(),
    linkCount: v.number(),
    imageCount: v.number(),
    codeBlockCount: v.number(),
    tableCount: v.number(),
    outgoingLinks: v.array(v.string()),
    structuredData: v.optional(v.string()),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const now = Date.now();

    // Save the page
    await ctx.db.insert("crawlPages", {
      jobId: args.jobId,
      userId: job.userId,
      queueItemId: args.queueItemId,
      url: args.url,
      finalUrl: args.finalUrl,
      statusCode: args.statusCode,
      contentType: args.contentType,
      contentLength: args.contentLength,
      title: args.title,
      description: args.description,
      author: args.author,
      publishedDate: args.publishedDate,
      markdownContent: args.markdownContent,
      rawHtmlSize: args.rawHtmlSize,
      wordCount: args.wordCount,
      linkCount: args.linkCount,
      imageCount: args.imageCount,
      codeBlockCount: args.codeBlockCount,
      tableCount: args.tableCount,
      outgoingLinks: args.outgoingLinks,
      structuredData: args.structuredData,
      contentHash: args.contentHash,
      crawledAt: now,
    });

    // Update queue item
    await ctx.db.patch(args.queueItemId, {
      status: "completed",
      processedAt: now,
    });

    // Update job stats
    await ctx.db.patch(args.jobId, {
      pagesSuccessful: job.pagesSuccessful + 1,
      pagesCrawled: job.pagesCrawled + 1,
      totalWords: job.totalWords + args.wordCount,
      totalLinks: job.totalLinks + args.linkCount,
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

export const addLinksToQueue = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    links: v.array(v.string()),
    depth: v.number(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, { jobId, links, depth, sourceUrl }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    // Get current discovered count
    let discoveredCount = job.pagesDiscovered;

    for (const link of links) {
      // Stop if we've discovered enough pages
      if (discoveredCount >= job.maxPages) break;

      const normalized = normalizeUrl(link);

      // Check if already in queue
      const existing = await ctx.db
        .query("crawlQueue")
        .withIndex("byNormalizedUrl", (q) =>
          q.eq("jobId", jobId).eq("normalizedUrl", normalized)
        )
        .unique();

      if (existing) continue;

      // Calculate priority
      const priority = calculatePriority(link, undefined, depth);

      // Add to queue
      await ctx.db.insert("crawlQueue", {
        jobId,
        userId: job.userId,
        url: link,
        normalizedUrl: normalized,
        depth,
        priority,
        discoveredFrom: sourceUrl,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });

      discoveredCount++;
    }

    // Update discovered count
    if (discoveredCount > job.pagesDiscovered) {
      await ctx.db.patch(jobId, {
        pagesDiscovered: discoveredCount,
        updatedAt: Date.now(),
      });
    }
  },
});

export const completeJob = internalMutation({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    const now = Date.now();

    await ctx.db.patch(jobId, {
      status: "completed",
      completedAt: now,
      lastActivityAt: now,
      updatedAt: now,
    });

    // Get run number
    const history = await ctx.db
      .query("crawlRunHistory")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();

    const runNumber = history.length + 1;

    // Calculate changed/new pages if previous runs exist
    let pagesChanged = 0;
    let pagesNew = 0;

    if (history.length > 0) {
      // Compare with previous run (simplified - just count new)
      pagesNew = job.pagesSuccessful; // In a real implementation, compare content hashes
    } else {
      pagesNew = job.pagesSuccessful;
    }

    // Save run history
    await ctx.db.insert("crawlRunHistory", {
      jobId,
      userId: job.userId,
      runNumber,
      pagesDiscovered: job.pagesDiscovered,
      pagesCrawled: job.pagesCrawled,
      pagesSuccessful: job.pagesSuccessful,
      pagesFailed: job.pagesFailed,
      pagesChanged,
      pagesNew,
      totalWords: job.totalWords,
      totalLinks: job.totalLinks,
      startedAt: job.startedAt || now,
      completedAt: now,
      durationMs: now - (job.startedAt || now),
    });
  },
});

export const cacheRobots = internalMutation({
  args: {
    domain: v.string(),
    robotsTxt: v.optional(v.string()),
    rules: v.string(),
    sitemaps: v.array(v.string()),
    crawlDelay: v.optional(v.number()),
  },
  handler: async (ctx, { domain, robotsTxt, rules, sitemaps, crawlDelay }) => {
    const existing = await ctx.db
      .query("robotsCache")
      .withIndex("byDomain", (q) => q.eq("domain", domain))
      .unique();

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    if (existing) {
      await ctx.db.patch(existing._id, {
        robotsTxt,
        rules,
        sitemaps,
        crawlDelay,
        fetchedAt: now,
        expiresAt,
      });
    } else {
      await ctx.db.insert("robotsCache", {
        domain,
        robotsTxt,
        rules,
        sitemaps,
        crawlDelay,
        fetchedAt: now,
        expiresAt,
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Public Actions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a document from crawled pages
 */
export const generateDocument = action({
  args: {
    jobId: v.id("crawlJobs"),
    title: v.optional(v.string()),
    combinePages: v.optional(v.boolean()),
  },
  handler: async (ctx, { jobId, title, combinePages = true }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get job and verify ownership
    const job = await ctx.runQuery(internal.crawler.getJobInternal, { jobId });
    if (!job || job.userId !== userId) {
      throw new Error("Crawl job not found");
    }

    // Get all crawled pages
    const pages = await ctx.runQuery(internal.crawler.getCrawledPagesInternal, { jobId });

    if (pages.length === 0) {
      throw new Error("No pages crawled yet");
    }

    if (combinePages) {
      // Combine all pages into a single document
      const content = pages
        .map(
          (page) =>
            `# ${page.title}\n\n` +
            `> Source: ${page.url}\n\n` +
            `${page.markdownContent}\n\n` +
            `---\n\n`
        )
        .join("");

      // Create document
      const documentId = await ctx.runMutation(internal.documents.createInternal, {
        userId,
        topic: title || job.name,
        content,
        sources: pages.map((p) => ({ title: p.title, url: p.url })),
        projectId: job.projectId,
        visibility: "private",
      });

      return { documentId, pageCount: pages.length };
    } else {
      // Create separate documents for each page
      const documentIds: Id<"documents">[] = [];

      for (const page of pages) {
        const documentId = await ctx.runMutation(internal.documents.createInternal, {
          userId,
          topic: page.title,
          content: page.markdownContent,
          sources: [{ title: page.title, url: page.url }],
          projectId: job.projectId,
          visibility: "private",
        });

        documentIds.push(documentId);
      }

      return { documentIds, pageCount: pages.length };
    }
  },
});

/**
 * Fetch sitemap for a URL
 */
export const fetchSitemapAction = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    try {
      const domain = extractDomain(url);
      const protocol = new URL(url).protocol;

      // Try common sitemap locations
      const sitemapUrls = [
        `${protocol}//${domain}/sitemap.xml`,
        `${protocol}//${domain}/sitemap_index.xml`,
        `${protocol}//${domain}/sitemap/sitemap.xml`,
      ];

      for (const sitemapUrl of sitemapUrls) {
        const response = await fetch(sitemapUrl, {
          headers: {
            "User-Agent": "DocuSynth-Crawler/1.0 (+https://docusynth.ai/bot)",
            Accept: "application/xml, text/xml, */*",
          },
        });

        if (response.ok) {
          const content = await response.text();
          const urls = parseSitemap(content);

          return {
            found: true,
            sitemapUrl,
            isIndex: isSitemapIndex(content),
            urls,
          };
        }
      }

      return { found: false, urls: [] };
    } catch {
      return { found: false, urls: [] };
    }
  },
});

// Internal query for getting crawled pages
export const getCrawledPagesInternal = internalQuery({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("crawlPages")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .collect();
  },
});

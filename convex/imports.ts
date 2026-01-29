import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";
import { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Import Sources Management
// ═══════════════════════════════════════════════════════════════

// List all import sources for the current user
export const listSources = query({
  args: {
    sourceType: v.optional(v.union(v.literal("notion"), v.literal("confluence"))),
  },
  handler: async (ctx, { sourceType }) => {
    const userId = await getUserId(ctx);

    if (sourceType) {
      return await ctx.db
        .query("importSources")
        .withIndex("byUserAndType", (q) => q.eq("userId", userId).eq("sourceType", sourceType))
        .collect();
    }

    return await ctx.db
      .query("importSources")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get a single import source
export const getSource = query({
  args: { id: v.id("importSources") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const source = await ctx.db.get(id);
    if (!source || source.userId !== userId) return null;

    // Don't return sensitive tokens
    return {
      ...source,
      accessToken: source.accessToken ? "••••••••" : undefined,
      apiToken: source.apiToken ? "••••••••" : undefined,
    };
  },
});

// Create a new import source
export const createSource = mutation({
  args: {
    sourceType: v.union(v.literal("notion"), v.literal("confluence")),
    name: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { sourceType, name, workspaceId }) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("importSources", {
      userId,
      workspaceId,
      sourceType,
      name,
      isActive: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update import source credentials
export const updateSourceCredentials = mutation({
  args: {
    id: v.id("importSources"),
    // Notion
    accessToken: v.optional(v.string()),
    // Confluence
    baseUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    apiToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, accessToken, baseUrl, email, apiToken }) => {
    const userId = await getUserId(ctx);
    const source = await ctx.db.get(id);

    if (!source || source.userId !== userId) {
      throw new Error("Import source not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (accessToken !== undefined) updates.accessToken = accessToken;
    if (baseUrl !== undefined) updates.baseUrl = baseUrl;
    if (email !== undefined) updates.email = email;
    if (apiToken !== undefined) updates.apiToken = apiToken;

    // Mark as active if credentials are provided
    const hasCredentials = source.sourceType === "notion"
      ? !!(accessToken || source.accessToken)
      : !!(apiToken || source.apiToken) && !!(baseUrl || source.baseUrl) && !!(email || source.email);

    if (hasCredentials) {
      updates.isActive = true;
    }

    await ctx.db.patch(id, updates);
  },
});

// Delete an import source
export const deleteSource = mutation({
  args: { id: v.id("importSources") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const source = await ctx.db.get(id);

    if (!source || source.userId !== userId) {
      throw new Error("Import source not found");
    }

    // Delete associated import history
    const history = await ctx.db
      .query("importHistory")
      .withIndex("bySource", (q) => q.eq("sourceId", id))
      .collect();

    for (const h of history) {
      await ctx.db.delete(h._id);
    }

    // Delete associated import jobs
    const jobs = await ctx.db
      .query("importJobs")
      .withIndex("bySource", (q) => q.eq("sourceId", id))
      .collect();

    for (const j of jobs) {
      await ctx.db.delete(j._id);
    }

    await ctx.db.delete(id);
  },
});

// ═══════════════════════════════════════════════════════════════
// Import Jobs Management
// ═══════════════════════════════════════════════════════════════

// List import jobs
export const listJobs = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    )),
    sourceId: v.optional(v.id("importSources")),
  },
  handler: async (ctx, { status, sourceId }) => {
    const userId = await getUserId(ctx);

    let jobs;
    if (status) {
      jobs = await ctx.db
        .query("importJobs")
        .withIndex("byUserAndStatus", (q) => q.eq("userId", userId).eq("status", status))
        .collect();
    } else {
      jobs = await ctx.db
        .query("importJobs")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .collect();
    }

    if (sourceId) {
      jobs = jobs.filter(j => j.sourceId === sourceId);
    }

    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single import job
export const getJob = query({
  args: { id: v.id("importJobs") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(id);
    if (!job || job.userId !== userId) return null;
    return job;
  },
});

// Create an import job
export const createJob = mutation({
  args: {
    sourceId: v.id("importSources"),
    projectId: v.optional(v.id("projects")),
    importType: v.union(
      v.literal("page"),
      v.literal("database"),
      v.literal("space"),
      v.literal("batch")
    ),
    sourcePageIds: v.array(v.string()),
    sourcePageTitles: v.array(v.string()),
  },
  handler: async (ctx, { sourceId, projectId, importType, sourcePageIds, sourcePageTitles }) => {
    const userId = await getUserId(ctx);
    const source = await ctx.db.get(sourceId);

    if (!source || source.userId !== userId) {
      throw new Error("Import source not found");
    }

    if (!source.isActive) {
      throw new Error("Import source is not configured");
    }

    return await ctx.db.insert("importJobs", {
      userId,
      workspaceId: source.workspaceId,
      sourceId,
      projectId,
      sourceType: source.sourceType,
      importType,
      sourcePageIds,
      sourcePageTitles,
      status: "pending",
      totalItems: sourcePageIds.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      documentIds: [],
      errors: [],
      startedAt: null,
      completedAt: null,
      createdAt: Date.now(),
    });
  },
});

// Cancel an import job
export const cancelJob = mutation({
  args: { id: v.id("importJobs") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(id);

    if (!job || job.userId !== userId) {
      throw new Error("Import job not found");
    }

    if (job.status !== "pending" && job.status !== "running") {
      throw new Error("Cannot cancel job in current status");
    }

    await ctx.db.patch(id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

// Internal mutation to update job progress
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    processedItems: v.number(),
    successfulItems: v.number(),
    failedItems: v.number(),
    documentIds: v.array(v.id("documents")),
    errors: v.array(v.object({
      pageId: v.string(),
      pageTitle: v.string(),
      error: v.string(),
    })),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, { jobId, processedItems, successfulItems, failedItems, documentIds, errors, status }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    const updates: Record<string, unknown> = {
      processedItems,
      successfulItems,
      failedItems,
      documentIds,
      errors,
    };

    if (status) {
      updates.status = status;
      if (status === "running" && !job.startedAt) {
        updates.startedAt = Date.now();
      }
      if (status === "completed" || status === "failed" || status === "cancelled") {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(jobId, updates);
  },
});

// Internal query to get source with credentials
export const getSourceInternal = internalQuery({
  args: { sourceId: v.id("importSources") },
  handler: async (ctx, { sourceId }) => {
    return await ctx.db.get(sourceId);
  },
});

// Internal query to check import history
export const getImportHistory = internalQuery({
  args: {
    sourceId: v.id("importSources"),
    sourcePageId: v.string(),
  },
  handler: async (ctx, { sourceId, sourcePageId }) => {
    return await ctx.db
      .query("importHistory")
      .withIndex("bySourceAndPage", (q) => q.eq("sourceId", sourceId).eq("sourcePageId", sourcePageId))
      .unique();
  },
});

// Internal mutation to record import history
export const recordImportHistory = internalMutation({
  args: {
    userId: v.string(),
    sourceId: v.id("importSources"),
    sourcePageId: v.string(),
    documentId: v.id("documents"),
    versionHash: v.string(),
  },
  handler: async (ctx, { userId, sourceId, sourcePageId, documentId, versionHash }) => {
    const existing = await ctx.db
      .query("importHistory")
      .withIndex("bySourceAndPage", (q) => q.eq("sourceId", sourceId).eq("sourcePageId", sourcePageId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        documentId,
        lastImportedVersion: versionHash,
        lastImportedAt: Date.now(),
        importCount: existing.importCount + 1,
      });
    } else {
      await ctx.db.insert("importHistory", {
        userId,
        sourceId,
        sourcePageId,
        documentId,
        lastImportedVersion: versionHash,
        lastImportedAt: Date.now(),
        importCount: 1,
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Notion API Integration
// ═══════════════════════════════════════════════════════════════

// Test Notion connection
export const testNotionConnection = action({
  args: { sourceId: v.id("importSources") },
  handler: async (ctx, { sourceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.accessToken) {
      throw new Error("Notion access token not configured");
    }

    try {
      const response = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          "Authorization": `Bearer ${source.accessToken}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect to Notion");
      }

      const user = await response.json();
      return {
        success: true,
        user: {
          name: user.name,
          type: user.type,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Connection failed",
      };
    }
  },
});

// Browse Notion pages/databases
export const browseNotion = action({
  args: {
    sourceId: v.id("importSources"),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, { sourceId, cursor, pageSize = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.accessToken) {
      throw new Error("Notion access token not configured");
    }

    try {
      const body: Record<string, unknown> = {
        page_size: Math.min(pageSize, 100),
      };

      if (cursor) {
        body.start_cursor = cursor;
      }

      const response = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${source.accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search Notion");
      }

      const data = await response.json();

      const items = data.results.map((item: any) => ({
        id: item.id,
        type: item.object, // "page" or "database"
        title: getNotionTitle(item),
        icon: item.icon?.emoji || item.icon?.external?.url || null,
        lastEditedTime: item.last_edited_time,
        url: item.url,
        parentType: item.parent?.type,
        parentId: item.parent?.page_id || item.parent?.database_id || item.parent?.workspace,
      }));

      return {
        items,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to browse Notion");
    }
  },
});

// Get Notion page content
export const getNotionPage = action({
  args: {
    sourceId: v.id("importSources"),
    pageId: v.string(),
  },
  handler: async (ctx, { sourceId, pageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.accessToken) {
      throw new Error("Notion access token not configured");
    }

    try {
      // Get page metadata
      const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
          "Authorization": `Bearer ${source.accessToken}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!pageResponse.ok) {
        const error = await pageResponse.json();
        throw new Error(error.message || "Failed to get Notion page");
      }

      const page = await pageResponse.json();

      // Get page blocks (content)
      const blocks = await fetchAllNotionBlocks(source.accessToken, pageId);

      // Convert to markdown
      const markdown = convertNotionBlocksToMarkdown(blocks);

      return {
        id: page.id,
        title: getNotionTitle(page),
        content: markdown,
        lastEditedTime: page.last_edited_time,
        url: page.url,
        versionHash: page.last_edited_time, // Use last edited time as version
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to get Notion page");
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Confluence API Integration
// ═══════════════════════════════════════════════════════════════

// Test Confluence connection
export const testConfluenceConnection = action({
  args: { sourceId: v.id("importSources") },
  handler: async (ctx, { sourceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.baseUrl || !source.email || !source.apiToken) {
      throw new Error("Confluence credentials not fully configured");
    }

    try {
      const auth = Buffer.from(`${source.email}:${source.apiToken}`).toString("base64");

      const response = await fetch(`${source.baseUrl}/wiki/rest/api/user/current`, {
        headers: {
          "Authorization": `Basic ${auth}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to connect to Confluence");
      }

      const user = await response.json();
      return {
        success: true,
        user: {
          displayName: user.displayName,
          email: user.email,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Connection failed",
      };
    }
  },
});

// Browse Confluence spaces
export const browseConfluenceSpaces = action({
  args: {
    sourceId: v.id("importSources"),
    start: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sourceId, start = 0, limit = 25 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.baseUrl || !source.email || !source.apiToken) {
      throw new Error("Confluence credentials not fully configured");
    }

    try {
      const auth = Buffer.from(`${source.email}:${source.apiToken}`).toString("base64");

      const response = await fetch(
        `${source.baseUrl}/wiki/rest/api/space?start=${start}&limit=${limit}&expand=description.plain`,
        {
          headers: {
            "Authorization": `Basic ${auth}`,
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Confluence spaces");
      }

      const data = await response.json();

      const spaces = data.results.map((space: any) => ({
        id: space.id,
        key: space.key,
        name: space.name,
        description: space.description?.plain?.value || "",
        type: space.type,
        url: `${source.baseUrl}/wiki/spaces/${space.key}`,
      }));

      return {
        spaces,
        hasMore: data.size + data.start < data.totalSize,
        nextStart: data.start + data.size,
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to browse Confluence spaces");
    }
  },
});

// Browse pages in a Confluence space
export const browseConfluencePages = action({
  args: {
    sourceId: v.id("importSources"),
    spaceKey: v.string(),
    start: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sourceId, spaceKey, start = 0, limit = 25 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.baseUrl || !source.email || !source.apiToken) {
      throw new Error("Confluence credentials not fully configured");
    }

    try {
      const auth = Buffer.from(`${source.email}:${source.apiToken}`).toString("base64");

      const response = await fetch(
        `${source.baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&type=page&start=${start}&limit=${limit}&expand=history.lastUpdated`,
        {
          headers: {
            "Authorization": `Basic ${auth}`,
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Confluence pages");
      }

      const data = await response.json();

      const pages = data.results.map((page: any) => ({
        id: page.id,
        title: page.title,
        type: page.type,
        status: page.status,
        lastUpdated: page.history?.lastUpdated?.when,
        url: `${source.baseUrl}/wiki${page._links?.webui}`,
      }));

      return {
        pages,
        hasMore: data.size + data.start < data.totalSize,
        nextStart: data.start + data.size,
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to browse Confluence pages");
    }
  },
});

// Get Confluence page content
export const getConfluencePage = action({
  args: {
    sourceId: v.id("importSources"),
    pageId: v.string(),
  },
  handler: async (ctx, { sourceId, pageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || source.userId !== identity.subject) {
      throw new Error("Import source not found");
    }

    if (!source.baseUrl || !source.email || !source.apiToken) {
      throw new Error("Confluence credentials not fully configured");
    }

    try {
      const auth = Buffer.from(`${source.email}:${source.apiToken}`).toString("base64");

      const response = await fetch(
        `${source.baseUrl}/wiki/rest/api/content/${pageId}?expand=body.storage,history.lastUpdated,version`,
        {
          headers: {
            "Authorization": `Basic ${auth}`,
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Confluence page");
      }

      const page = await response.json();

      // Convert Confluence storage format to markdown
      const markdown = convertConfluenceToMarkdown(page.body.storage.value, source.baseUrl);

      return {
        id: page.id,
        title: page.title,
        content: markdown,
        version: page.version.number.toString(),
        lastUpdated: page.history?.lastUpdated?.when,
        url: `${source.baseUrl}/wiki${page._links?.webui}`,
        versionHash: `${page.version.number}`,
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to get Confluence page");
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Import Execution
// ═══════════════════════════════════════════════════════════════

// Start import job
export const startImport = action({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get job details
    const job = await ctx.runQuery(internal.imports.getJobInternal, { jobId });
    if (!job || job.userId !== userId) {
      throw new Error("Import job not found");
    }

    if (job.status !== "pending") {
      throw new Error("Job is not in pending status");
    }

    // Mark job as running
    await ctx.runMutation(internal.imports.updateJobProgress, {
      jobId,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      documentIds: [],
      errors: [],
      status: "running",
    });

    const documentIds: Id<"documents">[] = [];
    const errors: { pageId: string; pageTitle: string; error: string }[] = [];
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;

    // Process each page
    for (let i = 0; i < job.sourcePageIds.length; i++) {
      const pageId = job.sourcePageIds[i];
      const pageTitle = job.sourcePageTitles[i] || pageId;

      // Check if job was cancelled
      const currentJob = await ctx.runQuery(internal.imports.getJobInternal, { jobId });
      if (currentJob?.status === "cancelled") {
        break;
      }

      try {
        let pageContent;

        if (job.sourceType === "notion") {
          pageContent = await ctx.runAction(internal.imports.getNotionPageInternal, {
            sourceId: job.sourceId,
            pageId,
          });
        } else {
          pageContent = await ctx.runAction(internal.imports.getConfluencePageInternal, {
            sourceId: job.sourceId,
            pageId,
          });
        }

        // Check for existing import
        const existingHistory = await ctx.runQuery(internal.imports.getImportHistory, {
          sourceId: job.sourceId,
          sourcePageId: pageId,
        });

        // Create or update document
        const docId = await ctx.runMutation(internal.documents.createInternal, {
          userId,
          topic: pageContent.title,
          content: pageContent.content,
          sources: [{
            title: pageContent.title,
            url: pageContent.url,
          }],
          projectId: job.projectId,
          visibility: "private",
        });

        documentIds.push(docId);

        // Record import history
        await ctx.runMutation(internal.imports.recordImportHistory, {
          userId,
          sourceId: job.sourceId,
          sourcePageId: pageId,
          documentId: docId,
          versionHash: pageContent.versionHash,
        });

        successfulItems++;
      } catch (error: any) {
        failedItems++;
        errors.push({
          pageId,
          pageTitle,
          error: error.message || "Unknown error",
        });
      }

      processedItems++;

      // Update progress
      await ctx.runMutation(internal.imports.updateJobProgress, {
        jobId,
        processedItems,
        successfulItems,
        failedItems,
        documentIds,
        errors,
      });
    }

    // Mark job as completed
    const finalStatus = failedItems === job.totalItems ? "failed" : "completed";
    await ctx.runMutation(internal.imports.updateJobProgress, {
      jobId,
      processedItems,
      successfulItems,
      failedItems,
      documentIds,
      errors,
      status: finalStatus,
    });

    // Update source sync status
    await ctx.runMutation(internal.imports.updateSourceSyncStatus, {
      sourceId: job.sourceId,
      status: failedItems === 0 ? "success" : failedItems === job.totalItems ? "failed" : "partial",
      error: failedItems > 0 ? `${failedItems} pages failed to import` : null,
    });

    return {
      status: finalStatus,
      processedItems,
      successfulItems,
      failedItems,
      documentIds,
      errors,
    };
  },
});

// Internal actions that don't check auth (called from startImport)
export const getNotionPageInternal = action({
  args: {
    sourceId: v.id("importSources"),
    pageId: v.string(),
  },
  handler: async (ctx, { sourceId, pageId }) => {
    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || !source.accessToken) {
      throw new Error("Notion source not configured");
    }

    // Get page metadata
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        "Authorization": `Bearer ${source.accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!pageResponse.ok) {
      const error = await pageResponse.json();
      throw new Error(error.message || "Failed to get Notion page");
    }

    const page = await pageResponse.json();

    // Get page blocks
    const blocks = await fetchAllNotionBlocks(source.accessToken, pageId);

    // Convert to markdown
    const markdown = convertNotionBlocksToMarkdown(blocks);

    return {
      id: page.id,
      title: getNotionTitle(page),
      content: markdown,
      url: page.url,
      versionHash: page.last_edited_time,
    };
  },
});

export const getConfluencePageInternal = action({
  args: {
    sourceId: v.id("importSources"),
    pageId: v.string(),
  },
  handler: async (ctx, { sourceId, pageId }) => {
    const source = await ctx.runQuery(internal.imports.getSourceInternal, { sourceId });
    if (!source || !source.baseUrl || !source.email || !source.apiToken) {
      throw new Error("Confluence source not configured");
    }

    const auth = Buffer.from(`${source.email}:${source.apiToken}`).toString("base64");

    const response = await fetch(
      `${source.baseUrl}/wiki/rest/api/content/${pageId}?expand=body.storage,version`,
      {
        headers: {
          "Authorization": `Basic ${auth}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Confluence page");
    }

    const page = await response.json();

    const markdown = convertConfluenceToMarkdown(page.body.storage.value, source.baseUrl);

    return {
      id: page.id,
      title: page.title,
      content: markdown,
      url: `${source.baseUrl}/wiki${page._links?.webui}`,
      versionHash: `${page.version.number}`,
    };
  },
});

// Internal query to get job
export const getJobInternal = internalQuery({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

// Internal mutation to update source sync status
export const updateSourceSyncStatus = internalMutation({
  args: {
    sourceId: v.id("importSources"),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("partial")),
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { sourceId, status, error }) => {
    await ctx.db.patch(sourceId, {
      lastSyncAt: Date.now(),
      lastSyncStatus: status,
      lastSyncError: error,
      updatedAt: Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function getNotionTitle(item: any): string {
  if (item.object === "page") {
    const titleProp = item.properties?.title || item.properties?.Name;
    if (titleProp?.title) {
      return titleProp.title.map((t: any) => t.plain_text).join("") || "Untitled";
    }
    // Check for other property types
    for (const [key, value] of Object.entries(item.properties || {})) {
      if ((value as any)?.title) {
        return (value as any).title.map((t: any) => t.plain_text).join("") || "Untitled";
      }
    }
  }
  if (item.object === "database") {
    if (item.title) {
      return item.title.map((t: any) => t.plain_text).join("") || "Untitled Database";
    }
  }
  return "Untitled";
}

async function fetchAllNotionBlocks(accessToken: string, pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!response.ok) {
      break;
    }

    const data = await response.json();
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  // Recursively fetch children for blocks that have them
  for (const block of blocks) {
    if (block.has_children) {
      block.children = await fetchAllNotionBlocks(accessToken, block.id);
    }
  }

  return blocks;
}

function convertNotionBlocksToMarkdown(blocks: any[], depth: number = 0): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const block of blocks) {
    const type = block.type;

    switch (type) {
      case "paragraph":
        lines.push(indent + renderRichText(block.paragraph?.rich_text) + "\n");
        break;

      case "heading_1":
        lines.push(indent + "# " + renderRichText(block.heading_1?.rich_text) + "\n");
        break;

      case "heading_2":
        lines.push(indent + "## " + renderRichText(block.heading_2?.rich_text) + "\n");
        break;

      case "heading_3":
        lines.push(indent + "### " + renderRichText(block.heading_3?.rich_text) + "\n");
        break;

      case "bulleted_list_item":
        lines.push(indent + "- " + renderRichText(block.bulleted_list_item?.rich_text));
        break;

      case "numbered_list_item":
        lines.push(indent + "1. " + renderRichText(block.numbered_list_item?.rich_text));
        break;

      case "to_do":
        const checked = block.to_do?.checked ? "[x]" : "[ ]";
        lines.push(indent + `- ${checked} ` + renderRichText(block.to_do?.rich_text));
        break;

      case "toggle":
        lines.push(indent + "<details>\n" + indent + "<summary>" + renderRichText(block.toggle?.rich_text) + "</summary>\n");
        if (block.children) {
          lines.push(convertNotionBlocksToMarkdown(block.children, depth + 1));
        }
        lines.push(indent + "</details>\n");
        break;

      case "code":
        const lang = block.code?.language || "";
        lines.push(indent + "```" + lang + "\n" + renderRichText(block.code?.rich_text) + "\n" + indent + "```\n");
        break;

      case "quote":
        lines.push(indent + "> " + renderRichText(block.quote?.rich_text) + "\n");
        break;

      case "callout":
        const emoji = block.callout?.icon?.emoji || "";
        lines.push(indent + `> ${emoji} ` + renderRichText(block.callout?.rich_text) + "\n");
        break;

      case "divider":
        lines.push(indent + "---\n");
        break;

      case "image":
        const imageUrl = block.image?.file?.url || block.image?.external?.url || "";
        const caption = renderRichText(block.image?.caption) || "image";
        lines.push(indent + `![${caption}](${imageUrl})\n`);
        break;

      case "bookmark":
        const bookmarkUrl = block.bookmark?.url || "";
        lines.push(indent + `[${bookmarkUrl}](${bookmarkUrl})\n`);
        break;

      case "link_preview":
        const linkUrl = block.link_preview?.url || "";
        lines.push(indent + `[${linkUrl}](${linkUrl})\n`);
        break;

      case "table":
        if (block.children) {
          lines.push(renderNotionTable(block.children, indent));
        }
        break;

      case "table_row":
        // Handled by parent table
        break;

      case "child_page":
        lines.push(indent + `**[${block.child_page?.title || "Untitled"}]**\n`);
        break;

      case "child_database":
        lines.push(indent + `**[Database: ${block.child_database?.title || "Untitled"}]**\n`);
        break;

      default:
        // Handle unknown block types gracefully
        if (block[type]?.rich_text) {
          lines.push(indent + renderRichText(block[type].rich_text) + "\n");
        }
    }

    // Process nested children (except for toggle which is handled above)
    if (block.children && type !== "toggle" && type !== "table") {
      lines.push(convertNotionBlocksToMarkdown(block.children, depth + 1));
    }
  }

  return lines.join("\n");
}

function renderRichText(richText: any[] | undefined): string {
  if (!richText) return "";

  return richText.map((text: any) => {
    let content = text.plain_text || "";

    if (text.annotations?.bold) content = `**${content}**`;
    if (text.annotations?.italic) content = `*${content}*`;
    if (text.annotations?.strikethrough) content = `~~${content}~~`;
    if (text.annotations?.code) content = `\`${content}\``;

    if (text.href) {
      content = `[${content}](${text.href})`;
    }

    return content;
  }).join("");
}

function renderNotionTable(rows: any[], indent: string): string {
  if (!rows || rows.length === 0) return "";

  const lines: string[] = [];

  rows.forEach((row, index) => {
    const cells = row.table_row?.cells || [];
    const rowContent = cells.map((cell: any) => renderRichText(cell)).join(" | ");
    lines.push(indent + "| " + rowContent + " |");

    // Add header separator after first row
    if (index === 0) {
      const separator = cells.map(() => "---").join(" | ");
      lines.push(indent + "| " + separator + " |");
    }
  });

  return lines.join("\n") + "\n";
}

function convertConfluenceToMarkdown(storageFormat: string, baseUrl: string): string {
  // Basic Confluence storage format to Markdown conversion
  let markdown = storageFormat;

  // Remove XML namespaces
  markdown = markdown.replace(/<ac:[^>]+>/g, "");
  markdown = markdown.replace(/<\/ac:[^>]+>/g, "");
  markdown = markdown.replace(/<ri:[^>]+\/>/g, "");

  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Italic
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Pre/Code blocks
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Lists
  markdown = markdown.replace(/<ul[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ul>/gi, "\n");
  markdown = markdown.replace(/<ol[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ol>/gi, "\n");
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, "> $1\n\n");

  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, "\n---\n\n");

  // Images - try to make them absolute URLs
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (match, src, alt) => {
    const absoluteSrc = src.startsWith("http") ? src : `${baseUrl}${src}`;
    return `![${alt || "image"}](${absoluteSrc})`;
  });
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, (match, src) => {
    const absoluteSrc = src.startsWith("http") ? src : `${baseUrl}${src}`;
    return `![image](${absoluteSrc})`;
  });

  // Tables - basic conversion
  markdown = markdown.replace(/<table[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/table>/gi, "\n");
  markdown = markdown.replace(/<thead[^>]*>/gi, "");
  markdown = markdown.replace(/<\/thead>/gi, "");
  markdown = markdown.replace(/<tbody[^>]*>/gi, "");
  markdown = markdown.replace(/<\/tbody>/gi, "");
  markdown = markdown.replace(/<tr[^>]*>(.*?)<\/tr>/gi, "| $1 |\n");
  markdown = markdown.replace(/<th[^>]*>(.*?)<\/th>/gi, " $1 |");
  markdown = markdown.replace(/<td[^>]*>(.*?)<\/td>/gi, " $1 |");

  // Clean up remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, " ");
  markdown = markdown.replace(/&amp;/g, "&");
  markdown = markdown.replace(/&lt;/g, "<");
  markdown = markdown.replace(/&gt;/g, ">");
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");

  // Clean up excessive whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();

  return markdown;
}

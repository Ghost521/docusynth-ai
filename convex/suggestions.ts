
import { action, internalAction, query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getUserId } from "./users";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SuggestionType = "context" | "trending" | "frequent" | "stale" | "related";

export interface DocumentSuggestion {
  documentId: Id<"documents">;
  topic: string;
  contentPreview: string;
  projectId?: Id<"projects">;
  createdAt: number;
  suggestionType: SuggestionType;
  reason: string;
  score: number;
  tags?: string[];
}

export interface SuggestionContext {
  currentDocumentId?: Id<"documents">;
  clipboardText?: string;
  recentSearchQuery?: string;
  projectId?: Id<"projects">;
}

// ═══════════════════════════════════════════════════════════════
// View Tracking
// ═══════════════════════════════════════════════════════════════

/**
 * Record a document view for usage tracking.
 * This data is used for "frequently accessed" and "others also viewed" suggestions.
 */
export const recordDocumentView = mutation({
  args: {
    documentId: v.id("documents"),
    source: v.union(
      v.literal("search"),
      v.literal("navigation"),
      v.literal("suggestion"),
      v.literal("direct"),
      v.literal("related")
    ),
    referringDocumentId: v.optional(v.id("documents")),
    searchQuery: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get document to check workspace
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) return null;

    return await ctx.db.insert("documentViews", {
      documentId: args.documentId,
      userId,
      workspaceId: doc.workspaceId,
      timestamp: Date.now(),
      duration: args.duration,
      source: args.source,
      referringDocumentId: args.referringDocumentId,
      searchQuery: args.searchQuery,
    });
  },
});

/**
 * Update view duration (called when user navigates away).
 */
export const updateViewDuration = mutation({
  args: {
    viewId: v.id("documentViews"),
    duration: v.number(),
  },
  handler: async (ctx, { viewId, duration }) => {
    const userId = await getUserId(ctx);
    const view = await ctx.db.get(viewId);

    if (view && view.userId === userId) {
      await ctx.db.patch(viewId, { duration });
    }
  },
});

/**
 * Get user's view history.
 */
export const getViewHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getUserId(ctx);

    const views = await ctx.db
      .query("documentViews")
      .withIndex("byUserAndTimestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Enrich with document data
    const enrichedViews = await Promise.all(
      views.map(async (view) => {
        const doc = await ctx.db.get(view.documentId);
        return {
          ...view,
          document: doc ? {
            _id: doc._id,
            topic: doc.topic,
            contentPreview: doc.content.substring(0, 200),
          } : null,
        };
      })
    );

    return enrichedViews.filter((v) => v.document !== null);
  },
});

// ═══════════════════════════════════════════════════════════════
// Frequently Accessed Documents
// ═══════════════════════════════════════════════════════════════

/**
 * Get frequently accessed documents.
 */
export const getFrequentDocuments = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10, daysBack = 30 }) => {
    const userId = await getUserId(ctx);
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Get all views in time range
    const views = await ctx.db
      .query("documentViews")
      .withIndex("byUserAndTimestamp", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .collect();

    // Count views per document
    const viewCounts = new Map<string, { count: number; totalDuration: number; lastViewed: number }>();

    for (const view of views) {
      const docId = view.documentId;
      const existing = viewCounts.get(docId) || { count: 0, totalDuration: 0, lastViewed: 0 };
      viewCounts.set(docId, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + (view.duration || 0),
        lastViewed: Math.max(existing.lastViewed, view.timestamp),
      });
    }

    // Sort by view count and get top documents
    const sorted = Array.from(viewCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);

    // Enrich with document data
    const results: DocumentSuggestion[] = [];

    for (const [docId, stats] of sorted) {
      const doc = await ctx.db.get(docId as Id<"documents">);
      if (!doc) continue;

      // Get tags
      const tags = await ctx.db
        .query("documentTags")
        .withIndex("byDocument", (q) => q.eq("documentId", doc._id))
        .collect();

      results.push({
        documentId: doc._id,
        topic: doc.topic,
        contentPreview: doc.content.substring(0, 200),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        suggestionType: "frequent",
        reason: `Viewed ${stats.count} times`,
        score: stats.count / (sorted[0]?.[1].count || 1), // Normalize to 0-1
        tags: tags.map((t) => t.tag),
      });
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════════════
// Trending Documents (Recently Updated by Team)
// ═══════════════════════════════════════════════════════════════

/**
 * Get trending documents in workspace.
 */
export const getTrendingInWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit = 10 }) => {
    const userId = await getUserId(ctx);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get recent views from all users in workspace
    const views = await ctx.db
      .query("documentViews")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.gte(q.field("timestamp"), oneDayAgo))
      .collect();

    // Count unique viewers per document
    const viewerCounts = new Map<string, Set<string>>();

    for (const view of views) {
      const docId = view.documentId;
      const viewers = viewerCounts.get(docId) || new Set();
      viewers.add(view.userId);
      viewerCounts.set(docId, viewers);
    }

    // Sort by viewer count
    const sorted = Array.from(viewerCounts.entries())
      .map(([docId, viewers]) => ({ docId, viewerCount: viewers.size }))
      .sort((a, b) => b.viewerCount - a.viewerCount)
      .slice(0, limit);

    // Enrich with document data
    const results: DocumentSuggestion[] = [];

    for (const { docId, viewerCount } of sorted) {
      const doc = await ctx.db.get(docId as Id<"documents">);
      if (!doc) continue;

      results.push({
        documentId: doc._id,
        topic: doc.topic,
        contentPreview: doc.content.substring(0, 200),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        suggestionType: "trending",
        reason: `${viewerCount} team member${viewerCount > 1 ? "s" : ""} viewed this today`,
        score: viewerCount / (sorted[0]?.viewerCount || 1),
      });
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════════════
// Staleness Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate staleness score for a document.
 * Higher score = more stale.
 */
export const getStalenessScore = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      return { score: 0, reason: "Document not found" };
    }

    const now = Date.now();
    const ageInDays = (now - doc.createdAt) / (1000 * 60 * 60 * 24);

    // Get last version
    const versions = await ctx.db
      .query("docVersions")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .order("desc")
      .take(1);

    const lastUpdateTime = versions[0]?.createdAt || doc.createdAt;
    const daysSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);

    // Get recent views
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recentViews = await ctx.db
      .query("documentViews")
      .withIndex("byDocumentAndUser", (q) => q.eq("documentId", documentId).eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), thirtyDaysAgo))
      .collect();

    // Calculate staleness factors
    let stalenessScore = 0;
    const reasons: string[] = [];

    // Age factor
    if (daysSinceUpdate > 90) {
      stalenessScore += 0.3;
      reasons.push(`Not updated in ${Math.floor(daysSinceUpdate)} days`);
    } else if (daysSinceUpdate > 30) {
      stalenessScore += 0.2;
      reasons.push(`Last update ${Math.floor(daysSinceUpdate)} days ago`);
    }

    // View frequency factor
    if (recentViews.length === 0 && ageInDays > 7) {
      stalenessScore += 0.3;
      reasons.push("Not viewed recently");
    }

    // Source age - check if sources might have changed
    if (doc.sources.length > 0) {
      const hasGitHubSources = doc.sources.some(s => s.url.includes("github.com"));
      const hasDocsSources = doc.sources.some(s =>
        s.url.includes("/docs/") || s.url.includes("docs.") || s.url.includes("documentation")
      );

      if ((hasGitHubSources || hasDocsSources) && daysSinceUpdate > 30) {
        stalenessScore += 0.2;
        reasons.push("Source documentation may have changed");
      }
    }

    return {
      score: Math.min(stalenessScore, 1),
      daysSinceUpdate: Math.floor(daysSinceUpdate),
      reasons,
      shouldUpdate: stalenessScore > 0.5,
    };
  },
});

/**
 * Get stale documents that might need updates.
 */
export const getStaleDocuments = query({
  args: {
    limit: v.optional(v.number()),
    minStaleness: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10, minStaleness = 0.3 }) => {
    const userId = await getUserId(ctx);

    // Get all user documents
    const docs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const results: (DocumentSuggestion & { staleness: number; daysSinceUpdate: number })[] = [];

    for (const doc of docs) {
      // Get last version
      const versions = await ctx.db
        .query("docVersions")
        .withIndex("byDocument", (q) => q.eq("documentId", doc._id))
        .order("desc")
        .take(1);

      const lastUpdateTime = versions[0]?.createdAt || doc.createdAt;
      const daysSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);

      // Simple staleness calculation
      let staleness = 0;
      const reasons: string[] = [];

      if (daysSinceUpdate > 90) {
        staleness = 0.8;
        reasons.push(`Not updated in ${Math.floor(daysSinceUpdate)} days`);
      } else if (daysSinceUpdate > 60) {
        staleness = 0.6;
        reasons.push(`Last update ${Math.floor(daysSinceUpdate)} days ago`);
      } else if (daysSinceUpdate > 30) {
        staleness = 0.4;
        reasons.push(`Consider reviewing - ${Math.floor(daysSinceUpdate)} days old`);
      }

      if (staleness >= minStaleness) {
        results.push({
          documentId: doc._id,
          topic: doc.topic,
          contentPreview: doc.content.substring(0, 200),
          projectId: doc.projectId,
          createdAt: doc.createdAt,
          suggestionType: "stale",
          reason: reasons.join(", "),
          score: staleness,
          staleness,
          daysSinceUpdate: Math.floor(daysSinceUpdate),
        });
      }
    }

    // Sort by staleness and return top results
    return results
      .sort((a, b) => b.staleness - a.staleness)
      .slice(0, limit);
  },
});

// ═══════════════════════════════════════════════════════════════
// Topic Tags
// ═══════════════════════════════════════════════════════════════

/**
 * Generate topic tags for a document using AI.
 */
export const generateTopicTags = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get the document
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });

    if (!doc) {
      throw new Error("Document not found");
    }

    // Extract tags from content
    const tags = extractTagsFromContent(doc.topic, doc.content);

    // Save tags to database
    await ctx.runMutation(internal.suggestions.saveTagsInternal, {
      documentId,
      userId,
      tags,
    });

    return tags;
  },
});

/**
 * Extract tags from document content.
 * Uses a combination of keyword extraction and pattern matching.
 */
function extractTagsFromContent(topic: string, content: string): Array<{ tag: string; confidence: number }> {
  const tags = new Map<string, number>();
  const text = `${topic} ${content}`.toLowerCase();

  // Technology patterns
  const techPatterns = [
    { pattern: /\breact\b/gi, tag: "React", confidence: 0.9 },
    { pattern: /\btypescript\b|\bts\b/gi, tag: "TypeScript", confidence: 0.9 },
    { pattern: /\bjavascript\b|\bjs\b/gi, tag: "JavaScript", confidence: 0.9 },
    { pattern: /\bpython\b/gi, tag: "Python", confidence: 0.9 },
    { pattern: /\bnode\.?js\b/gi, tag: "Node.js", confidence: 0.9 },
    { pattern: /\bnext\.?js\b/gi, tag: "Next.js", confidence: 0.9 },
    { pattern: /\bvue\b/gi, tag: "Vue", confidence: 0.9 },
    { pattern: /\bangular\b/gi, tag: "Angular", confidence: 0.9 },
    { pattern: /\bsvelte\b/gi, tag: "Svelte", confidence: 0.9 },
    { pattern: /\bdocker\b/gi, tag: "Docker", confidence: 0.9 },
    { pattern: /\bkubernetes\b|\bk8s\b/gi, tag: "Kubernetes", confidence: 0.9 },
    { pattern: /\baws\b/gi, tag: "AWS", confidence: 0.9 },
    { pattern: /\bgcp\b|google cloud/gi, tag: "GCP", confidence: 0.9 },
    { pattern: /\bazure\b/gi, tag: "Azure", confidence: 0.9 },
    { pattern: /\bgraphql\b/gi, tag: "GraphQL", confidence: 0.9 },
    { pattern: /\brest api\b|\brestful\b/gi, tag: "REST API", confidence: 0.9 },
    { pattern: /\bmongodb\b/gi, tag: "MongoDB", confidence: 0.9 },
    { pattern: /\bpostgres(ql)?\b/gi, tag: "PostgreSQL", confidence: 0.9 },
    { pattern: /\bredis\b/gi, tag: "Redis", confidence: 0.9 },
    { pattern: /\bgit\b(?!hub)/gi, tag: "Git", confidence: 0.8 },
    { pattern: /\bgithub\b/gi, tag: "GitHub", confidence: 0.9 },
    { pattern: /\btailwind\b/gi, tag: "Tailwind CSS", confidence: 0.9 },
    { pattern: /\bwebpack\b/gi, tag: "Webpack", confidence: 0.9 },
    { pattern: /\bvite\b/gi, tag: "Vite", confidence: 0.9 },
    { pattern: /\bjest\b/gi, tag: "Jest", confidence: 0.9 },
    { pattern: /\bmocha\b/gi, tag: "Mocha", confidence: 0.9 },
    { pattern: /\bcypress\b/gi, tag: "Cypress", confidence: 0.9 },
    { pattern: /\bplaywright\b/gi, tag: "Playwright", confidence: 0.9 },
  ];

  // Topic patterns
  const topicPatterns = [
    { pattern: /\bapi\b.*documentation|documentation.*\bapi\b/gi, tag: "API Documentation", confidence: 0.85 },
    { pattern: /\bauthentication\b|\bauth\b|\blogin\b/gi, tag: "Authentication", confidence: 0.8 },
    { pattern: /\bdatabase\b|\bdb\b/gi, tag: "Database", confidence: 0.8 },
    { pattern: /\btesting\b|\bunit test\b|\btest\b/gi, tag: "Testing", confidence: 0.8 },
    { pattern: /\bdeployment\b|\bdeploy\b|\bci\/cd\b/gi, tag: "Deployment", confidence: 0.8 },
    { pattern: /\bsecurity\b|\bvulnerability\b/gi, tag: "Security", confidence: 0.8 },
    { pattern: /\bperformance\b|\boptimization\b/gi, tag: "Performance", confidence: 0.8 },
    { pattern: /\bmonitoring\b|\blogging\b|\bobservability\b/gi, tag: "Monitoring", confidence: 0.8 },
    { pattern: /\bmicroservices?\b/gi, tag: "Microservices", confidence: 0.85 },
    { pattern: /\bfrontend\b|\bfront-end\b/gi, tag: "Frontend", confidence: 0.8 },
    { pattern: /\bbackend\b|\bback-end\b/gi, tag: "Backend", confidence: 0.8 },
    { pattern: /\bfull.?stack\b/gi, tag: "Full Stack", confidence: 0.8 },
    { pattern: /\bmachine learning\b|\bml\b|\bai\b/gi, tag: "Machine Learning", confidence: 0.85 },
    { pattern: /\bdata.?science\b/gi, tag: "Data Science", confidence: 0.85 },
    { pattern: /\bdevops\b/gi, tag: "DevOps", confidence: 0.85 },
    { pattern: /\bcloud\b/gi, tag: "Cloud", confidence: 0.7 },
  ];

  // Apply patterns
  for (const { pattern, tag, confidence } of [...techPatterns, ...topicPatterns]) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Boost confidence based on number of mentions
      const boostedConfidence = Math.min(confidence + (matches.length - 1) * 0.05, 0.99);
      const existing = tags.get(tag) || 0;
      tags.set(tag, Math.max(existing, boostedConfidence));
    }
  }

  // Convert to array and sort by confidence
  return Array.from(tags.entries())
    .map(([tag, confidence]) => ({ tag, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Max 10 tags per document
}

/**
 * Save generated tags to database.
 */
export const saveTagsInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
    tags: v.array(v.object({
      tag: v.string(),
      confidence: v.number(),
    })),
  },
  handler: async (ctx, { documentId, userId, tags }) => {
    // Delete existing AI-generated tags
    const existingTags = await ctx.db
      .query("documentTags")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .filter((q) => q.eq(q.field("source"), "extracted"))
      .collect();

    for (const tag of existingTags) {
      await ctx.db.delete(tag._id);
    }

    // Insert new tags
    const now = Date.now();
    for (const { tag, confidence } of tags) {
      await ctx.db.insert("documentTags", {
        documentId,
        userId,
        tag,
        confidence,
        source: "extracted",
        generatedAt: now,
      });
    }
  },
});

/**
 * Get tags for a document.
 */
export const getDocumentTags = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    return await ctx.db
      .query("documentTags")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .collect();
  },
});

/**
 * Get documents by tag.
 */
export const getDocumentsByTag = query({
  args: {
    tag: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { tag, limit = 20 }) => {
    const userId = await getUserId(ctx);

    const tagRecords = await ctx.db
      .query("documentTags")
      .withIndex("byUserAndTag", (q) => q.eq("userId", userId).eq("tag", tag))
      .collect();

    // Get unique document IDs
    const docIdSet = new Set<Id<"documents">>();
    for (const t of tagRecords) {
      docIdSet.add(t.documentId);
    }
    const docIds = Array.from(docIdSet);

    // Fetch documents
    const results: DocumentSuggestion[] = [];

    for (const docId of docIds.slice(0, limit)) {
      const doc = await ctx.db.get(docId);
      if (!doc) continue;

      const docTags = tagRecords
        .filter((t) => t.documentId === docId)
        .map((t) => t.tag);

      results.push({
        documentId: doc._id,
        topic: doc.topic,
        contentPreview: doc.content.substring(0, 200),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        suggestionType: "related",
        reason: `Tagged with "${tag}"`,
        score: 0.8,
        tags: docTags,
      });
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════════════
// Topic Clusters
// ═══════════════════════════════════════════════════════════════

/**
 * Get all topic clusters for user.
 */
export const getTopicClusters = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    if (workspaceId) {
      return await ctx.db
        .query("topicClusters")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    }

    return await ctx.db
      .query("topicClusters")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .collect();
  },
});

/**
 * Generate topic clusters from document tags.
 */
export const generateTopicClusters = action({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get all tags for user
    const allTags = await ctx.runQuery(internal.suggestions.getAllUserTagsInternal, {
      userId,
    });

    // Group documents by their primary tags
    const tagGroups = new Map<string, Set<string>>();

    for (const tag of allTags) {
      const tagName = tag.tag;
      const docId = tag.documentId as string;

      const existing = tagGroups.get(tagName) || new Set<string>();
      existing.add(docId);
      tagGroups.set(tagName, existing);
    }

    // Create clusters for tags with multiple documents
    const clusters: Array<{
      name: string;
      documentIds: string[];
      primaryTags: string[];
      documentCount: number;
    }> = [];

    const tagGroupEntries = Array.from(tagGroups.entries());
    for (const [tagName, docIds] of tagGroupEntries) {
      if (docIds.size >= 2) {
        clusters.push({
          name: tagName,
          documentIds: Array.from(docIds),
          primaryTags: [tagName],
          documentCount: docIds.size,
        });
      }
    }

    // Save clusters
    await ctx.runMutation(internal.suggestions.saveClustersInternal, {
      userId,
      clusters,
    });

    return { clusterCount: clusters.length };
  },
});

export const getAllUserTagsInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("documentTags")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const saveClustersInternal = internalMutation({
  args: {
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    clusters: v.array(v.object({
      name: v.string(),
      documentIds: v.array(v.string()),
      primaryTags: v.array(v.string()),
      documentCount: v.number(),
    })),
  },
  handler: async (ctx, { userId, workspaceId, clusters }) => {
    // Delete existing auto-generated clusters
    const existingClusters = await ctx.db
      .query("topicClusters")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isAutoGenerated"), true))
      .collect();

    for (const cluster of existingClusters) {
      await ctx.db.delete(cluster._id);
    }

    // Insert new clusters
    const now = Date.now();
    for (const cluster of clusters) {
      await ctx.db.insert("topicClusters", {
        userId,
        workspaceId,
        name: cluster.name,
        documentIds: cluster.documentIds as Id<"documents">[],
        primaryTags: cluster.primaryTags,
        documentCount: cluster.documentCount,
        averageRelevance: 0.8, // Placeholder
        isAutoGenerated: true,
        lastUpdated: now,
        createdAt: now,
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Main Suggestions API
// ═══════════════════════════════════════════════════════════════

/**
 * Get context-aware suggestions based on current state.
 */
export const getSuggestionsForContext = query({
  args: {
    currentDocumentId: v.optional(v.id("documents")),
    recentSearchQuery: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const { currentDocumentId, recentSearchQuery, projectId, limit = 5 } = args;

    const suggestions: DocumentSuggestion[] = [];

    // 1. If viewing a document, get related documents
    if (currentDocumentId) {
      const currentDoc = await ctx.db.get(currentDocumentId);
      if (currentDoc) {
        // Get documents with overlapping tags
        const currentTags = await ctx.db
          .query("documentTags")
          .withIndex("byDocument", (q) => q.eq("documentId", currentDocumentId))
          .collect();

        if (currentTags.length > 0) {
          const tagNames = currentTags.map((t) => t.tag);

          // Find documents with same tags
          const relatedTagDocs = new Map<string, number>();

          for (const tagName of tagNames) {
            const docsWithTag = await ctx.db
              .query("documentTags")
              .withIndex("byUserAndTag", (q) => q.eq("userId", userId).eq("tag", tagName))
              .collect();

            for (const tagDoc of docsWithTag) {
              if (tagDoc.documentId !== currentDocumentId) {
                const count = relatedTagDocs.get(tagDoc.documentId) || 0;
                relatedTagDocs.set(tagDoc.documentId, count + 1);
              }
            }
          }

          // Get top related documents
          const sortedRelated = Array.from(relatedTagDocs.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          for (const [docId, tagOverlap] of sortedRelated) {
            const doc = await ctx.db.get(docId as Id<"documents">);
            if (!doc) continue;

            suggestions.push({
              documentId: doc._id,
              topic: doc.topic,
              contentPreview: doc.content.substring(0, 200),
              projectId: doc.projectId,
              createdAt: doc.createdAt,
              suggestionType: "context",
              reason: `${tagOverlap} shared topic${tagOverlap > 1 ? "s" : ""}`,
              score: tagOverlap / tagNames.length,
            });
          }
        }
      }
    }

    // 2. Get frequently accessed documents
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentViews = await ctx.db
      .query("documentViews")
      .withIndex("byUserAndTimestamp", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), thirtyDaysAgo))
      .collect();

    const viewCounts = new Map<string, number>();
    for (const view of recentViews) {
      if (view.documentId !== currentDocumentId) {
        viewCounts.set(view.documentId, (viewCounts.get(view.documentId) || 0) + 1);
      }
    }

    const topFrequent = Array.from(viewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [docId, count] of topFrequent) {
      // Don't duplicate
      if (suggestions.some((s) => s.documentId === docId)) continue;

      const doc = await ctx.db.get(docId as Id<"documents">);
      if (!doc) continue;

      suggestions.push({
        documentId: doc._id,
        topic: doc.topic,
        contentPreview: doc.content.substring(0, 200),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        suggestionType: "frequent",
        reason: `Viewed ${count} times recently`,
        score: 0.7,
      });
    }

    // 3. Check for stale documents
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    for (const doc of allDocs) {
      if (suggestions.length >= limit) break;
      if (suggestions.some((s) => s.documentId === doc._id)) continue;
      if (doc._id === currentDocumentId) continue;

      const daysSinceCreation = (now - doc.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 60) {
        suggestions.push({
          documentId: doc._id,
          topic: doc.topic,
          contentPreview: doc.content.substring(0, 200),
          projectId: doc.projectId,
          createdAt: doc.createdAt,
          suggestionType: "stale",
          reason: `Created ${Math.floor(daysSinceCreation)} days ago - review for updates?`,
          score: 0.5,
        });
      }
    }

    return suggestions.slice(0, limit);
  },
});

// ═══════════════════════════════════════════════════════════════
// Feedback & Learning
// ═══════════════════════════════════════════════════════════════

/**
 * Record feedback on a suggestion.
 */
export const recordSuggestionFeedback = mutation({
  args: {
    documentId: v.id("documents"),
    suggestionType: v.union(
      v.literal("context"),
      v.literal("trending"),
      v.literal("frequent"),
      v.literal("stale"),
      v.literal("related")
    ),
    action: v.union(
      v.literal("clicked"),
      v.literal("dismissed"),
      v.literal("snoozed"),
      v.literal("helpful"),
      v.literal("not_helpful")
    ),
    contextDocumentId: v.optional(v.id("documents")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("suggestionFeedback", {
      userId,
      documentId: args.documentId,
      suggestionType: args.suggestionType,
      action: args.action,
      timestamp: Date.now(),
      contextDocumentId: args.contextDocumentId,
      reason: args.reason,
    });
  },
});

/**
 * Get "others who viewed X also viewed Y" suggestions.
 */
export const getCoViewedDocuments = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, limit = 5 }) => {
    const userId = await getUserId(ctx);

    // Get views of the current document
    const currentDocViews = await ctx.db
      .query("documentViews")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .collect();

    if (currentDocViews.length === 0) {
      return [];
    }

    // For each viewer, get what else they viewed
    const coViewedCounts = new Map<string, number>();
    const oneHour = 60 * 60 * 1000;

    for (const view of currentDocViews) {
      // Get views around the same time (within 1 hour)
      const nearbyViews = await ctx.db
        .query("documentViews")
        .withIndex("byUserAndTimestamp", (q) => q.eq("userId", view.userId))
        .filter((q) =>
          q.and(
            q.gte(q.field("timestamp"), view.timestamp - oneHour),
            q.lte(q.field("timestamp"), view.timestamp + oneHour),
            q.neq(q.field("documentId"), documentId)
          )
        )
        .collect();

      for (const nearbyView of nearbyViews) {
        const count = coViewedCounts.get(nearbyView.documentId) || 0;
        coViewedCounts.set(nearbyView.documentId, count + 1);
      }
    }

    // Sort by count and get top co-viewed documents
    const sorted = Array.from(coViewedCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const results: DocumentSuggestion[] = [];

    for (const [docId, count] of sorted) {
      const doc = await ctx.db.get(docId as Id<"documents">);
      if (!doc || doc.userId !== userId) continue;

      results.push({
        documentId: doc._id,
        topic: doc.topic,
        contentPreview: doc.content.substring(0, 200),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        suggestionType: "related",
        reason: `Others who viewed this also viewed`,
        score: count / currentDocViews.length,
      });
    }

    return results;
  },
});

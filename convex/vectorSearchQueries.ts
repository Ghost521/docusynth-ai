// Vector search queries - separate file without Node.js dependencies
import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserId } from "./users";

// Search result type
interface SemanticSearchResult {
  documentId: Id<"documents">;
  topic: string;
  content: string;
  contentPreview: string;
  projectId?: Id<"projects">;
  visibility: "public" | "private" | "workspace";
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
  searchType: "semantic" | "keyword" | "hybrid";
}

/**
 * Extract a snippet around matching text.
 */
function extractMatchSnippet(text: string, query: string, maxLength: number): string {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();

  let matchPosition = -1;
  for (const word of queryWords) {
    const pos = textLower.indexOf(word);
    if (pos !== -1 && (matchPosition === -1 || pos < matchPosition)) {
      matchPosition = pos;
    }
  }

  if (matchPosition === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, matchPosition - 50);
  const end = Math.min(text.length, matchPosition + maxLength - 50);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

// ═══════════════════════════════════════════════════════════════
// Keyword Search (Internal Query)
// ═══════════════════════════════════════════════════════════════

export const keywordSearchInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, query: searchQuery, limit = 20 }) => {
    if (!searchQuery.trim()) {
      return [];
    }

    // Use existing full-text search
    const results = await ctx.db
      .query("documentSearchIndex")
      .withSearchIndex("search_content", (q) =>
        q.search("searchableText", searchQuery).eq("userId", userId)
      )
      .take(limit);

    const enrichedResults: SemanticSearchResult[] = [];

    for (const result of results) {
      const doc = await ctx.db.get(result.documentId);
      if (!doc) continue;

      // Calculate simple keyword relevance score
      const queryWords = searchQuery.toLowerCase().split(/\s+/);
      const contentLower = result.searchableText.toLowerCase();
      const matchCount = queryWords.filter((word) => contentLower.includes(word)).length;
      const relevanceScore = matchCount / queryWords.length;

      enrichedResults.push({
        documentId: doc._id,
        topic: doc.topic,
        content: doc.content,
        contentPreview: result.contentPreview,
        projectId: doc.projectId,
        visibility: doc.visibility,
        sources: doc.sources,
        createdAt: doc.createdAt,
        relevanceScore,
        matchSnippet: extractMatchSnippet(result.searchableText, searchQuery, 150),
        searchType: "keyword",
      });
    }

    return enrichedResults;
  },
});

// ═══════════════════════════════════════════════════════════════
// Embedding Status Query
// ═══════════════════════════════════════════════════════════════

/**
 * Get embedding status for a document.
 * Used to show "Indexing..." status in UI.
 */
export const getEmbeddingStatus = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);

    const embedding = await ctx.db
      .query("documentEmbeddings")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    if (!embedding) {
      // Check if queued
      const queued = await ctx.db
        .query("embeddingQueue")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .unique();

      if (queued) {
        return {
          status: "pending" as const,
          message: "Waiting to be indexed...",
        };
      }

      return {
        status: "not_indexed" as const,
        message: "Not yet indexed",
      };
    }

    if (embedding.status === "completed") {
      return {
        status: "completed" as const,
        message: `Indexed (${embedding.chunkCount} chunks)`,
        chunkCount: embedding.chunkCount,
      };
    }

    if (embedding.status === "failed") {
      return {
        status: "failed" as const,
        message: embedding.error || "Indexing failed",
        error: embedding.error,
      };
    }

    return {
      status: "pending" as const,
      message: "Indexing in progress...",
    };
  },
});

/**
 * Get embedding statistics for the user.
 */
export const getEmbeddingStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const embeddings = await ctx.db
      .query("documentEmbeddings")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const completed = embeddings.filter((e) => e.status === "completed");
    const failed = embeddings.filter((e) => e.status === "failed");
    const pending = embeddings.filter((e) => e.status === "pending");

    const totalChunks = completed.reduce((sum, e) => sum + e.chunkCount, 0);

    const queueItems = await ctx.db
      .query("embeddingQueue")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    return {
      totalDocuments: embeddings.length,
      indexed: completed.length,
      failed: failed.length,
      pending: pending.length,
      queued: queueItems.length,
      totalChunks,
    };
  },
});

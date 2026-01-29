"use node";

import { action, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { v } from "convex/values";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { Id } from "./_generated/dataModel";
import { EMBEDDING_CONFIG } from "./embeddings";

// ═══════════════════════════════════════════════════════════════
// RAG Component Configuration (same as embeddings.ts)
// ═══════════════════════════════════════════════════════════════

type EmbeddingFilters = {
  projectId: string;
  userId: string;
  visibility: string;
  sourceType: string;
};

const rag = new RAG<EmbeddingFilters>(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["projectId", "userId", "visibility", "sourceType"],
});

// ═══════════════════════════════════════════════════════════════
// Search Result Types
// ═══════════════════════════════════════════════════════════════

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

interface HybridSearchOptions {
  query: string;
  limit?: number;
  projectId?: Id<"projects">;
  visibility?: "public" | "private" | "workspace";
  sourceType?: string;
  minScore?: number;
  semanticWeight?: number; // 0-1, how much to weight semantic vs keyword
}

// ═══════════════════════════════════════════════════════════════
// Semantic Search Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Perform semantic search using vector similarity.
 * Finds documents by meaning, not just keywords.
 */
export const semanticSearch = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("workspace"))),
    sourceType: v.optional(v.string()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const {
      query: searchQuery,
      limit = EMBEDDING_CONFIG.DEFAULT_LIMIT,
      projectId,
      visibility,
      sourceType,
      minScore = EMBEDDING_CONFIG.MIN_SIMILARITY,
    } = args;

    if (!searchQuery.trim()) {
      return [];
    }

    // Build filters
    const filters: Array<{ name: keyof EmbeddingFilters; value: string }> = [];

    if (projectId) {
      filters.push({ name: "projectId", value: projectId });
    }
    if (visibility) {
      filters.push({ name: "visibility", value: visibility });
    }
    if (sourceType) {
      filters.push({ name: "sourceType", value: sourceType });
    }

    try {
      // Perform semantic search using RAG
      const { results, entries } = await rag.search(ctx, {
        namespace: userId,
        query: searchQuery,
        limit,
        vectorScoreThreshold: minScore,
        filters: filters.length > 0 ? filters : undefined,
      });

      // Get full document details for each result
      const enrichedResults: SemanticSearchResult[] = [];

      for (const result of results) {
        const metadata = result.metadata as { documentId?: string } | undefined;
        if (!metadata?.documentId) continue;

        const doc = await ctx.runQuery(internal.documents.getInternal, {
          documentId: metadata.documentId as Id<"documents">,
          userId,
        });

        if (!doc) continue;

        // Extract snippet from matching chunk
        const matchSnippet = result.content
          .map((c) => c.text)
          .join(" ")
          .substring(0, 200);

        enrichedResults.push({
          documentId: doc._id,
          topic: doc.topic,
          content: doc.content,
          contentPreview: doc.content.substring(0, 500),
          projectId: doc.projectId,
          visibility: doc.visibility,
          sources: doc.sources,
          createdAt: doc.createdAt,
          relevanceScore: result.score,
          matchSnippet: matchSnippet + (matchSnippet.length >= 200 ? "..." : ""),
          searchType: "semantic",
        });
      }

      // Deduplicate by document ID (keep highest score)
      const seen = new Map<string, SemanticSearchResult>();
      for (const result of enrichedResults) {
        const existing = seen.get(result.documentId);
        if (!existing || result.relevanceScore > existing.relevanceScore) {
          seen.set(result.documentId, result);
        }
      }

      return Array.from(seen.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error("Semantic search error:", error);
      // Fall back to keyword search if semantic search fails
      return [];
    }
  },
});

/**
 * Hybrid search combining semantic and keyword search.
 * Provides the best of both worlds.
 */
export const hybridSearch = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("workspace"))),
    sourceType: v.optional(v.string()),
    minScore: v.optional(v.number()),
    semanticWeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const {
      query: searchQuery,
      limit = EMBEDDING_CONFIG.DEFAULT_LIMIT,
      projectId,
      visibility,
      sourceType,
      minScore = 0.3,
      semanticWeight = 0.6,
    } = args;

    if (!searchQuery.trim()) {
      return [];
    }

    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
        userId,
        query: searchQuery,
        limit: limit * 2, // Get more results to merge
        projectId,
        visibility,
        sourceType,
        minScore,
      }),
      ctx.runQuery(internal.vectorSearch.keywordSearchInternal, {
        userId,
        query: searchQuery,
        limit: limit * 2,
      }),
    ]);

    // Merge and score results
    const scoreMap = new Map<string, { result: SemanticSearchResult; combinedScore: number }>();

    // Add semantic results
    for (const result of semanticResults) {
      const semanticScore = result.relevanceScore * semanticWeight;
      scoreMap.set(result.documentId, {
        result: { ...result, searchType: "hybrid" },
        combinedScore: semanticScore,
      });
    }

    // Add/merge keyword results
    for (const result of keywordResults) {
      const keywordScore = result.relevanceScore * (1 - semanticWeight);
      const existing = scoreMap.get(result.documentId);

      if (existing) {
        // Boost score for appearing in both
        existing.combinedScore += keywordScore;
        existing.result.searchType = "hybrid";
      } else {
        scoreMap.set(result.documentId, {
          result: { ...result, searchType: "keyword" },
          combinedScore: keywordScore,
        });
      }
    }

    // Sort by combined score and return top results
    const merged = Array.from(scoreMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit)
      .map((entry) => ({
        ...entry.result,
        relevanceScore: entry.combinedScore,
      }));

    return merged;
  },
});

/**
 * Find documents similar to a given document.
 * "More like this" functionality.
 */
export const findSimilarDocuments = action({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    excludeSameProject: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const {
      documentId,
      limit = 5,
      excludeSameProject = false,
    } = args;

    // Get the source document
    const sourceDoc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });

    if (!sourceDoc) {
      throw new Error("Document not found");
    }

    // Create a search query from the document's topic and key content
    // Use topic + first paragraph for context
    const firstParagraph = sourceDoc.content.split("\n\n")[0] || "";
    const searchQuery = `${sourceDoc.topic} ${firstParagraph}`.substring(0, 500);

    // Search for similar documents
    const results = await ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
      userId,
      query: searchQuery,
      limit: limit + 1, // Get extra to exclude self
      minScore: 0.4,
    }) as SemanticSearchResult[];

    // Filter out the source document and optionally same-project docs
    return results.filter((result) => {
      if (result.documentId === documentId) return false;
      if (excludeSameProject && result.projectId === sourceDoc.projectId) return false;
      return true;
    }).slice(0, limit);
  },
});

/**
 * Get personalized document recommendations.
 * Based on user's recent activity and document history.
 */
export const getRecommendations = action({
  args: {
    contextDocumentId: v.optional(v.id("documents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const { contextDocumentId, limit = 5 } = args;

    // Build context from recent searches and current document
    const recentSearches = await ctx.runQuery(internal.recentSearches.getRecent, {
      userId,
      limit: 5,
    });

    let contextQuery = recentSearches.map((s: { query: string }) => s.query).join(" ");

    // Add context from current document if provided
    if (contextDocumentId) {
      const contextDoc = await ctx.runQuery(internal.documents.getInternal, {
        documentId: contextDocumentId,
        userId,
      });

      if (contextDoc) {
        contextQuery = `${contextDoc.topic} ${contextQuery}`;
      }
    }

    if (!contextQuery.trim()) {
      // If no context, return most recent documents
      return [];
    }

    // Search for relevant documents
    const results = await ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
      userId,
      query: contextQuery.substring(0, 500),
      limit: limit + 1,
      minScore: 0.3,
    }) as SemanticSearchResult[];

    // Filter out the context document
    return results.filter((r) => r.documentId !== contextDocumentId).slice(0, limit);
  },
});

// ═══════════════════════════════════════════════════════════════
// Internal Search Functions
// ═══════════════════════════════════════════════════════════════

export const semanticSearchInternal = internalAction({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("workspace"))),
    sourceType: v.optional(v.string()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      userId,
      query: searchQuery,
      limit = EMBEDDING_CONFIG.DEFAULT_LIMIT,
      projectId,
      visibility,
      sourceType,
      minScore = EMBEDDING_CONFIG.MIN_SIMILARITY,
    } = args;

    // Build filters
    const filters: Array<{ name: keyof EmbeddingFilters; value: string }> = [];

    if (projectId) {
      filters.push({ name: "projectId", value: projectId });
    }
    if (visibility) {
      filters.push({ name: "visibility", value: visibility });
    }
    if (sourceType) {
      filters.push({ name: "sourceType", value: sourceType });
    }

    try {
      const { results } = await rag.search(ctx, {
        namespace: userId,
        query: searchQuery,
        limit,
        vectorScoreThreshold: minScore,
        filters: filters.length > 0 ? filters : undefined,
      });

      const enrichedResults: SemanticSearchResult[] = [];

      for (const result of results) {
        const metadata = result.metadata as { documentId?: string } | undefined;
        if (!metadata?.documentId) continue;

        const doc = await ctx.runQuery(internal.documents.getInternal, {
          documentId: metadata.documentId as Id<"documents">,
          userId,
        });

        if (!doc) continue;

        const matchSnippet = result.content
          .map((c) => c.text)
          .join(" ")
          .substring(0, 200);

        enrichedResults.push({
          documentId: doc._id,
          topic: doc.topic,
          content: doc.content,
          contentPreview: doc.content.substring(0, 500),
          projectId: doc.projectId,
          visibility: doc.visibility,
          sources: doc.sources,
          createdAt: doc.createdAt,
          relevanceScore: result.score,
          matchSnippet: matchSnippet + (matchSnippet.length >= 200 ? "..." : ""),
          searchType: "semantic",
        });
      }

      // Deduplicate
      const seen = new Map<string, SemanticSearchResult>();
      for (const result of enrichedResults) {
        const existing = seen.get(result.documentId);
        if (!existing || result.relevanceScore > existing.relevanceScore) {
          seen.set(result.documentId, result);
        }
      }

      return Array.from(seen.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error("Semantic search error:", error);
      return [];
    }
  },
});

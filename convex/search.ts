import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

// Search documents using full-text search
export const searchDocuments = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query: searchQuery, limit = 20 }) => {
    const userId = await getUserId(ctx);

    if (!searchQuery.trim()) {
      return [];
    }

    // Use Convex's built-in search
    const results = await ctx.db
      .query("documentSearchIndex")
      .withSearchIndex("search_content", (q) =>
        q.search("searchableText", searchQuery).eq("userId", userId)
      )
      .take(limit);

    // Get full document details for each result
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const doc = await ctx.db.get(result.documentId);
        if (!doc) return null;

        // Calculate a simple relevance score based on matches
        const queryWords = searchQuery.toLowerCase().split(/\s+/);
        const contentLower = result.searchableText.toLowerCase();
        const matchCount = queryWords.filter((word) =>
          contentLower.includes(word)
        ).length;

        return {
          _id: doc._id,
          topic: doc.topic,
          content: doc.content,
          contentPreview: result.contentPreview,
          projectId: doc.projectId,
          visibility: doc.visibility,
          sources: doc.sources,
          createdAt: doc.createdAt,
          relevanceScore: matchCount / queryWords.length,
          // Highlight matching snippets
          matchSnippet: extractMatchSnippet(
            result.searchableText,
            searchQuery,
            150
          ),
        };
      })
    );

    return enrichedResults
      .filter((r) => r !== null)
      .sort((a, b) => (b?.relevanceScore || 0) - (a?.relevanceScore || 0));
  },
});

// Helper to extract a snippet around matching text
function extractMatchSnippet(
  text: string,
  query: string,
  maxLength: number
): string {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();

  // Find the first matching word position
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

  // Extract snippet around the match
  const start = Math.max(0, matchPosition - 50);
  const end = Math.min(text.length, matchPosition + maxLength - 50);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

// Index a document for search (called when document is created/updated)
export const indexDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
    topic: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { documentId, userId, topic, content }) => {
    // Check if index entry already exists
    const existing = await ctx.db
      .query("documentSearchIndex")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    const searchableText = `${topic} ${content}`.toLowerCase();
    const contentPreview = content.substring(0, 500);

    if (existing) {
      // Update existing index
      await ctx.db.patch(existing._id, {
        topic,
        contentPreview,
        searchableText,
      });
    } else {
      // Create new index entry
      await ctx.db.insert("documentSearchIndex", {
        userId,
        documentId,
        topic,
        contentPreview,
        searchableText,
        createdAt: Date.now(),
      });
    }
  },
});

// Remove document from search index (called when document is deleted)
export const removeFromIndex = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, { documentId }) => {
    const existing = await ctx.db
      .query("documentSearchIndex")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get recent searches for autocomplete
export const getSearchSuggestions = query({
  args: {
    prefix: v.string(),
  },
  handler: async (ctx, { prefix }) => {
    const userId = await getUserId(ctx);

    if (!prefix.trim()) {
      return [];
    }

    // Get recent searches that match the prefix
    const recentSearches = await ctx.db
      .query("recentSearches")
      .withIndex("byUserAndCreatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const prefixLower = prefix.toLowerCase();
    const matchingSearches = recentSearches
      .filter((s) => s.query.toLowerCase().includes(prefixLower))
      .slice(0, 5)
      .map((s) => s.query);

    // Also get document topics that match
    const matchingDocs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .take(100);

    const matchingTopics = matchingDocs
      .filter((d) => d.topic.toLowerCase().includes(prefixLower))
      .slice(0, 5)
      .map((d) => d.topic);

    // Combine and deduplicate
    const suggestions = [...new Set([...matchingSearches, ...matchingTopics])];
    return suggestions.slice(0, 8);
  },
});

// Rebuild search index for all documents (admin/migration use)
export const rebuildSearchIndex = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Get all user's documents
    const documents = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Clear existing index entries for this user
    const existingIndexes = await ctx.db
      .query("documentSearchIndex")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    for (const index of existingIndexes) {
      await ctx.db.delete(index._id);
    }

    // Rebuild index for each document
    for (const doc of documents) {
      const searchableText = `${doc.topic} ${doc.content}`.toLowerCase();
      const contentPreview = doc.content.substring(0, 500);

      await ctx.db.insert("documentSearchIndex", {
        userId,
        documentId: doc._id,
        topic: doc.topic,
        contentPreview,
        searchableText,
        createdAt: doc.createdAt,
      });
    }

    return { indexed: documents.length };
  },
});

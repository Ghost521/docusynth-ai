"use node";

import { action, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { v } from "convex/values";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { Id } from "./_generated/dataModel";

// Re-export from queries file for backward compatibility
export { EMBEDDING_CONFIG } from "./embeddingsQueries";
import { EMBEDDING_CONFIG } from "./embeddingsQueries";

// ═══════════════════════════════════════════════════════════════
// RAG Component Configuration
// ═══════════════════════════════════════════════════════════════

// Filter types for type-safe filtering
type EmbeddingFilters = {
  projectId: string;
  userId: string;
  visibility: string;
  sourceType: string;
};

// Initialize RAG component with OpenAI embeddings
// text-embedding-3-small provides 1536 dimensions at lower cost
const rag = new RAG<EmbeddingFilters>(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["projectId", "userId", "visibility", "sourceType"],
});

// ═══════════════════════════════════════════════════════════════
// Text Chunking Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Split text into overlapping chunks for better embedding quality.
 * Uses semantic boundaries (paragraphs, sentences) when possible.
 */
function chunkText(text: string, chunkSize: number = EMBEDDING_CONFIG.CHUNK_SIZE, overlap: number = EMBEDDING_CONFIG.CHUNK_OVERLAP): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Clean up the text
  const cleanedText = text.replace(/\r\n/g, '\n').trim();

  // If text is short enough, return as single chunk
  const words = cleanedText.split(/\s+/);
  if (words.length <= chunkSize) {
    return [cleanedText];
  }

  // Split by paragraphs first
  const paragraphs = cleanedText.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(/\s+/).filter(w => w.length > 0);

    // If adding this paragraph would exceed chunk size
    if (currentWordCount + paragraphWords.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join('\n\n'));

      // Start new chunk with overlap from end of previous
      const overlapWords = currentChunk.join(' ').split(/\s+/).slice(-overlap);
      currentChunk = [overlapWords.join(' ')];
      currentWordCount = overlapWords.length;
    }

    // If single paragraph is too long, split it
    if (paragraphWords.length > chunkSize) {
      // First, add what we have
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [];
        currentWordCount = 0;
      }

      // Split the long paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk: string[] = [];
      let sentenceWordCount = 0;

      for (const sentence of sentences) {
        const sentenceWords = sentence.split(/\s+/).length;
        if (sentenceWordCount + sentenceWords > chunkSize && sentenceChunk.length > 0) {
          chunks.push(sentenceChunk.join(' '));
          // Overlap from previous
          const overlapText = sentenceChunk.slice(-2).join(' ').split(/\s+/).slice(-overlap);
          sentenceChunk = [overlapText.join(' ')];
          sentenceWordCount = overlapText.length;
        }
        sentenceChunk.push(sentence);
        sentenceWordCount += sentenceWords;
      }

      if (sentenceChunk.length > 0) {
        currentChunk = [sentenceChunk.join(' ')];
        currentWordCount = sentenceWordCount;
      }
    } else {
      currentChunk.push(paragraph);
      currentWordCount += paragraphWords.length;
    }
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

// ═══════════════════════════════════════════════════════════════
// Core Embedding Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Generate and store embeddings for a document.
 * Called when a document is created or updated.
 */
export const generateDocumentEmbedding = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, { documentId, userId }) => {
    // Get the document
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });

    if (!doc) {
      throw new Error("Document not found");
    }

    // Create searchable text combining topic and content
    const fullText = `${doc.topic}\n\n${doc.content}`;

    // Chunk the content
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      console.log(`No content to embed for document ${documentId}`);
      return { success: false, reason: "No content to embed" };
    }

    // Build filter values for searching
    const filterValues: Array<{ name: keyof EmbeddingFilters; value: string }> = [
      { name: "userId", value: userId },
      { name: "visibility", value: doc.visibility },
    ];

    if (doc.projectId) {
      filterValues.push({ name: "projectId", value: doc.projectId });
    }

    // Determine source type from content
    const sourceType = inferSourceType(doc.content, doc.sources);
    filterValues.push({ name: "sourceType", value: sourceType });

    try {
      // Add to RAG with document ID as key for easy replacement
      const result = await rag.add(ctx, {
        namespace: userId,
        key: documentId,
        chunks,
        title: doc.topic,
        filterValues,
        metadata: {
          documentId,
          projectId: doc.projectId,
          createdAt: doc.createdAt,
          sourceCount: doc.sources.length,
        },
        importance: calculateImportance(doc),
      });

      // Record embedding in our tracking table
      await ctx.runMutation(internal.embeddingsQueries.recordEmbeddingInternal, {
        documentId,
        userId,
        status: "completed",
        chunkCount: chunks.length,
        entryId: result.entryId,
      });

      return {
        success: true,
        entryId: result.entryId,
        chunkCount: chunks.length,
        tokensUsed: (result as any).usage?.tokens,
      };
    } catch (error) {
      // Record failure
      await ctx.runMutation(internal.embeddingsQueries.recordEmbeddingInternal, {
        documentId,
        userId,
        status: "failed",
        chunkCount: 0,
        error: String(error),
      });

      throw error;
    }
  },
});

/**
 * Delete embeddings for a document.
 * Called when a document is deleted.
 */
export const deleteDocumentEmbedding = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, { documentId, userId }) => {
    try {
      // Get the entry info
      const embeddingRecord = await ctx.runQuery(internal.embeddingsQueries.getEmbeddingRecordInternal, {
        documentId,
      });

      if (embeddingRecord?.entryId) {
        // Delete from RAG
        await rag.delete(ctx, { entryId: embeddingRecord.entryId });
      }

      // Remove our tracking record
      await ctx.runMutation(internal.embeddingsQueries.deleteEmbeddingRecordInternal, {
        documentId,
      });

      return { success: true };
    } catch (error) {
      console.error(`Failed to delete embedding for ${documentId}:`, error);
      return { success: false, error: String(error) };
    }
  },
});

// Note: queueDocumentForEmbedding is in embeddingsQueries.ts

/**
 * Process pending embedding queue items.
 * Called by cron job.
 */
export const processEmbeddingQueue = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { batchSize = 5 }) => {
    // Get pending items ordered by priority and creation time
    const pendingItems = await ctx.runQuery(internal.embeddingsQueries.getPendingQueueItemsInternal, {
      limit: batchSize,
    });

    if (pendingItems.length === 0) {
      return { processed: 0, message: "No pending items" };
    }

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await ctx.runMutation(internal.embeddingsQueries.updateQueueItemStatusInternal, {
          id: item._id,
          status: "processing",
        });

        // Generate embedding
        await ctx.runAction(internal.embeddings.generateDocumentEmbedding, {
          documentId: item.documentId,
          userId: item.userId,
        });

        // Remove from queue
        await ctx.runMutation(internal.embeddingsQueries.removeQueueItemInternal, {
          id: item._id,
        });

        processed++;
      } catch (error) {
        console.error(`Failed to process embedding for ${item.documentId}:`, error);

        // Update with failure
        await ctx.runMutation(internal.embeddingsQueries.updateQueueItemStatusInternal, {
          id: item._id,
          status: "failed",
          error: String(error),
          incrementAttempts: true,
        });

        failed++;
      }
    }

    return { processed, failed, total: pendingItems.length };
  },
});

/**
 * Regenerate embeddings for all user documents.
 * Useful for re-indexing after model changes.
 */
export const regenerateAllEmbeddings = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get all user documents
    const documents = await ctx.runQuery(internal.embeddingsQueries.getAllUserDocumentsInternal, {
      userId,
    });

    // Queue all for re-embedding
    let queued = 0;
    for (const doc of documents) {
      await ctx.runMutation(internal.embeddingsQueries.queueDocumentForEmbedding, {
        documentId: doc._id,
        userId,
        priority: "low",
      });
      queued++;
    }

    return { queued, message: `Queued ${queued} documents for re-embedding` };
  },
});

// Note: Query and mutation helpers are in embeddingsQueries.ts

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Infer the source type from document content and sources.
 */
function inferSourceType(content: string, sources: Array<{ title: string; url: string }>): string {
  // Check sources for hints
  for (const source of sources) {
    const url = source.url.toLowerCase();
    if (url.includes("github.com")) return "github";
    if (url.includes("gitlab.com")) return "gitlab";
    if (url.includes("npmjs.com") || url.includes("pypi.org")) return "package";
    if (url.includes("docs.") || url.includes("/docs/")) return "documentation";
    if (url.includes("api.") || url.includes("/api/")) return "api";
  }

  // Check content for hints
  const contentLower = content.toLowerCase();
  if (contentLower.includes("installation") && contentLower.includes("npm install")) return "package";
  if (contentLower.includes("api reference") || contentLower.includes("endpoint")) return "api";
  if (contentLower.includes("getting started") || contentLower.includes("quick start")) return "documentation";
  if (contentLower.includes("repository") || contentLower.includes("clone")) return "github";

  return "general";
}

/**
 * Calculate document importance for search ranking.
 * Higher values (0-1) indicate more important documents.
 */
function calculateImportance(doc: { content: string; sources: Array<{ title: string; url: string }>; createdAt: number }): number {
  let importance = 0.5; // Base importance

  // More sources = more comprehensive
  if (doc.sources.length > 5) importance += 0.1;
  if (doc.sources.length > 10) importance += 0.1;

  // Longer content = more detailed
  const wordCount = doc.content.split(/\s+/).length;
  if (wordCount > 2000) importance += 0.1;
  if (wordCount > 5000) importance += 0.1;

  // Recent documents slightly preferred
  const ageInDays = (Date.now() - doc.createdAt) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) importance += 0.05;
  if (ageInDays < 30) importance += 0.03;

  return Math.min(importance, 1.0);
}

// Export the RAG instance for use in vectorSearch
export { rag };

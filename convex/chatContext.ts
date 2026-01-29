"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ===============================================================
// Constants
// ===============================================================

const MAX_CONTEXT_TOKENS = 100000;
const DEFAULT_CHUNK_LIMIT = 10;
const DEFAULT_MIN_SCORE = 0.4;

// Token estimation (1 token ≈ 4 characters for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ===============================================================
// Context Types
// ===============================================================

interface RetrievedChunk {
  documentId: Id<"documents">;
  documentTitle: string;
  content: string;
  snippet: string;
  relevanceScore: number;
  sourceType: string;
}

interface BuiltContext {
  contextText: string;
  sources: Array<{
    documentId: Id<"documents">;
    documentTitle: string;
    snippet: string;
    relevanceScore: number;
  }>;
  tokenEstimate: number;
  truncated: boolean;
}

// ===============================================================
// RAG Context Retrieval
// ===============================================================

/**
 * Get relevant context for a chat query using semantic search.
 * This is the core RAG retrieval function.
 */
export const getRelevantContext = internalAction({
  args: {
    userId: v.string(),
    query: v.string(),
    documentIds: v.optional(v.array(v.id("documents"))),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      userId,
      query,
      documentIds,
      projectId,
      limit = DEFAULT_CHUNK_LIMIT,
      minScore = DEFAULT_MIN_SCORE,
    } = args;

    const retrievedChunks: RetrievedChunk[] = [];

    // If specific documents are provided, use them directly
    if (documentIds && documentIds.length > 0) {
      for (const docId of documentIds) {
        const doc = await ctx.runQuery(internal.documents.getInternal, {
          documentId: docId,
          userId,
        });

        if (doc) {
          retrievedChunks.push({
            documentId: doc._id,
            documentTitle: doc.topic,
            content: doc.content,
            snippet: doc.content.substring(0, 200) + "...",
            relevanceScore: 1.0, // Direct inclusion gets max score
            sourceType: "direct",
          });
        }
      }
    }

    // If project ID is provided, get project documents
    if (projectId) {
      const projectDocs = await ctx.runQuery(internal.documents.listByProjectInternal, {
        userId,
        projectId,
      });

      for (const doc of projectDocs) {
        // Don't duplicate if already included
        if (!retrievedChunks.some(c => c.documentId === doc._id)) {
          retrievedChunks.push({
            documentId: doc._id,
            documentTitle: doc.topic,
            content: doc.content,
            snippet: doc.content.substring(0, 200) + "...",
            relevanceScore: 0.9, // Project docs get high score
            sourceType: "project",
          });
        }
      }
    }

    // Use semantic search for additional context
    try {
      const searchResults = await ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
        userId,
        query,
        limit,
        projectId,
        minScore,
      });

      for (const result of searchResults) {
        // Don't duplicate
        if (!retrievedChunks.some(c => c.documentId === result.documentId)) {
          retrievedChunks.push({
            documentId: result.documentId,
            documentTitle: result.topic,
            content: result.content,
            snippet: result.matchSnippet,
            relevanceScore: result.relevanceScore,
            sourceType: "semantic",
          });
        }
      }
    } catch (error) {
      console.error("Semantic search error in getRelevantContext:", error);
      // Continue with what we have
    }

    // Sort by relevance and limit
    return retrievedChunks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  },
});

/**
 * Build a prompt with context from retrieved documents.
 * Handles token limits and formatting.
 */
export const buildPromptWithContext = internalAction({
  args: {
    userId: v.string(),
    query: v.string(),
    chunks: v.array(v.object({
      documentId: v.id("documents"),
      documentTitle: v.string(),
      content: v.string(),
      snippet: v.string(),
      relevanceScore: v.number(),
      sourceType: v.string(),
    })),
    conversationHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }))),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      query,
      chunks,
      conversationHistory = [],
      maxTokens = MAX_CONTEXT_TOKENS,
    } = args;

    // Reserve tokens for query and response
    const queryTokens = estimateTokens(query);
    const responseBuffer = 4096; // Reserve for response
    const historyTokens = conversationHistory.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );

    const availableForContext = maxTokens - queryTokens - responseBuffer - historyTokens;

    // Build context, respecting token limits
    const includedChunks: typeof chunks = [];
    let currentTokens = 0;
    let truncated = false;

    for (const chunk of chunks) {
      const chunkTokens = estimateTokens(chunk.content);

      if (currentTokens + chunkTokens <= availableForContext) {
        includedChunks.push(chunk);
        currentTokens += chunkTokens;
      } else if (currentTokens + 500 <= availableForContext) {
        // Include truncated version
        const availableChars = (availableForContext - currentTokens) * 4 * 0.9;
        includedChunks.push({
          ...chunk,
          content: chunk.content.substring(0, availableChars) + "\n\n[Content truncated...]",
        });
        truncated = true;
        break;
      } else {
        truncated = true;
        break;
      }
    }

    // Format context text
    let contextText = "";
    if (includedChunks.length > 0) {
      contextText = "## Relevant Documentation\n\n";
      contextText += includedChunks
        .map((chunk, i) => {
          return `### [Source ${i + 1}] ${chunk.documentTitle}\n\n${chunk.content}`;
        })
        .join("\n\n---\n\n");
      contextText += "\n\n---\n\n";
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      contextText += "## Conversation History\n\n";
      contextText += conversationHistory
        .map(msg => `**${msg.role === "user" ? "User" : "Assistant"}:** ${msg.content}`)
        .join("\n\n");
      contextText += "\n\n---\n\n";
    }

    // Add the current query
    contextText += `## Current Question\n\n${query}`;

    // Build sources for citations
    const sources = includedChunks.map(chunk => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      snippet: chunk.snippet,
      relevanceScore: chunk.relevanceScore,
    }));

    return {
      contextText,
      sources,
      tokenEstimate: currentTokens + queryTokens + historyTokens,
      truncated,
    } as BuiltContext;
  },
});

/**
 * Estimate tokens for a given text.
 * Exposed as an action for client use.
 */
export const estimateTokensAction = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, { text }) => {
    return {
      tokens: estimateTokens(text),
      characters: text.length,
    };
  },
});

/**
 * Truncate context to fit within a token limit.
 */
export const truncateContext = internalAction({
  args: {
    context: v.string(),
    maxTokens: v.number(),
  },
  handler: async (ctx, { context, maxTokens }) => {
    const currentTokens = estimateTokens(context);

    if (currentTokens <= maxTokens) {
      return { text: context, truncated: false, originalTokens: currentTokens };
    }

    // Calculate how much to keep
    const ratio = maxTokens / currentTokens;
    const targetChars = Math.floor(context.length * ratio * 0.95); // 5% buffer

    // Try to truncate at a paragraph boundary
    let truncatedText = context.substring(0, targetChars);
    const lastParagraphBreak = truncatedText.lastIndexOf("\n\n");

    if (lastParagraphBreak > targetChars * 0.7) {
      truncatedText = truncatedText.substring(0, lastParagraphBreak);
    }

    truncatedText += "\n\n[Context truncated to fit token limit...]";

    return {
      text: truncatedText,
      truncated: true,
      originalTokens: currentTokens,
      newTokens: estimateTokens(truncatedText),
    };
  },
});

// Note: getContextWindowStats is in chatContextQueries.ts

/**
 * Find the most relevant document chunks for a specific question.
 * Used for precise context retrieval in Q&A.
 */
export const findRelevantChunks = internalAction({
  args: {
    userId: v.string(),
    question: v.string(),
    documentIds: v.array(v.id("documents")),
    maxChunks: v.optional(v.number()),
  },
  handler: async (ctx, { userId, question, documentIds, maxChunks = 5 }) => {
    // Use semantic search scoped to specific documents
    const results = await ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
      userId,
      query: question,
      limit: maxChunks * 2, // Get extra for filtering
      minScore: 0.3,
    });

    // Filter to only requested documents
    const filteredResults = results.filter((r: any) =>
      documentIds.some(id => id === r.documentId)
    );

    return filteredResults.slice(0, maxChunks).map((r: any) => ({
      documentId: r.documentId,
      documentTitle: r.topic,
      matchSnippet: r.matchSnippet,
      relevanceScore: r.relevanceScore,
      contentPreview: r.contentPreview,
    }));
  },
});

/**
 * Summarize a conversation for context compression.
 * Used when conversation gets too long.
 */
export const summarizeConversation = internalAction({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.string(),
    maxMessages: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, userId, maxMessages = 10 }) => {
    // Get conversation messages
    const messages = await ctx.runQuery(internal.chatConversations.getConversationContextInternal, {
      conversationId,
      userId,
    });

    if (!messages || !messages.messages || messages.messages.length <= maxMessages) {
      return null; // No summarization needed
    }

    // Get messages to summarize (all except last maxMessages)
    const toSummarize = messages.messages.slice(0, -maxMessages);

    // Build summary prompt
    const conversationText = toSummarize
      .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Get user settings for AI
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Generate summary using AI
    const { generateContent, selectProvider, AIProviderConfig, GenerationRequest } = await import("./aiProvider");

    const { provider, model } = selectProvider(userSettings, undefined, false);

    // Get API key
    let apiKey: string;
    switch (provider) {
      case "gemini":
        apiKey = process.env.GEMINI_API_KEY || "";
        break;
      case "claude":
        apiKey = userSettings?.claudeApiKey || process.env.CLAUDE_API_KEY || "";
        break;
      case "openai":
        apiKey = userSettings?.openAiApiKey || process.env.OPENAI_API_KEY || "";
        break;
      default:
        apiKey = process.env.GEMINI_API_KEY || "";
    }

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.3,
    };

    const request: GenerationRequest = {
      prompt: `Summarize the following conversation between a user and an AI assistant. Focus on key questions asked, answers provided, and any decisions or conclusions reached. Keep the summary concise but complete.

Conversation:
${conversationText}

Summary:`,
      systemInstruction: "You are a conversation summarizer. Create concise, accurate summaries that preserve key information.",
    };

    try {
      const response = await generateContent(config, request);
      return {
        summary: response.text,
        summarizedMessageCount: toSummarize.length,
        remainingMessageCount: maxMessages,
      };
    } catch (error) {
      console.error("Failed to summarize conversation:", error);
      return null;
    }
  },
});

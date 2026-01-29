// Chat context queries - separate file without Node.js dependencies
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ===============================================================
// Constants
// ===============================================================

const MAX_CONTEXT_TOKENS = 100000;

// Token estimation (1 token ≈ 4 characters for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get context window statistics for a conversation.
 */
export const getContextWindowStats = internalQuery({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;

    // Get all messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    // Get document content sizes
    const documentSizes = await Promise.all(
      conversation.documentIds.map(async (docId) => {
        const doc = await ctx.db.get(docId);
        return doc ? { id: docId, topic: doc.topic, tokens: estimateTokens(doc.content) } : null;
      })
    );

    const validDocs = documentSizes.filter(Boolean) as Array<{ id: Id<"documents">; topic: string; tokens: number }>;

    const totalDocTokens = validDocs.reduce((sum, doc) => sum + doc.tokens, 0);
    const totalMessageTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const totalTokens = totalDocTokens + totalMessageTokens;

    return {
      documents: validDocs,
      messageCount: messages.length,
      tokenBreakdown: {
        documents: totalDocTokens,
        messages: totalMessageTokens,
        total: totalTokens,
      },
      contextLimit: MAX_CONTEXT_TOKENS,
      utilizationPercent: Math.round((totalTokens / MAX_CONTEXT_TOKENS) * 100),
      remainingTokens: Math.max(0, MAX_CONTEXT_TOKENS - totalTokens),
      canAddMore: totalTokens < MAX_CONTEXT_TOKENS * 0.8,
    };
  },
});

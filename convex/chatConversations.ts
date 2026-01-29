
import { action, mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserId } from "./users";
import {
  generateContent,
  selectProvider,
  AIProviderConfig,
  GenerationRequest,
  AIProvider,
} from "./aiProvider";

// ===============================================================
// Constants
// ===============================================================

const MAX_CONTEXT_TOKENS = 100000; // Approximate token limit for context
const MAX_MESSAGES_IN_CONTEXT = 20; // Limit conversation history
const SUGGESTION_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// ===============================================================
// Helper Functions
// ===============================================================

function getProviderApiKey(provider: AIProvider, userSettings?: any): string {
  switch (provider) {
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY not configured");
      return key;
    }
    case "claude": {
      const key = userSettings?.claudeApiKey || process.env.CLAUDE_API_KEY;
      if (!key) throw new Error("Claude API key not configured. Add it in Settings > Cloud APIs.");
      return key;
    }
    case "openai": {
      const key = userSettings?.openAiApiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OpenAI API key not configured. Add it in Settings > Cloud APIs.");
      return key;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Estimate tokens from text (rough approximation: 1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text to fit within token limit
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) return text;

  const ratio = maxTokens / estimatedTokens;
  const targetLength = Math.floor(text.length * ratio * 0.95); // 5% buffer
  return text.substring(0, targetLength) + "\n\n[Content truncated to fit context window...]";
}

// ===============================================================
// Chat System Instructions
// ===============================================================

const CHAT_SYSTEM_INSTRUCTION = `You are an AI assistant for DocuSynth, a documentation synthesis platform. Your role is to help users understand, navigate, and work with their documentation.

## Core Capabilities
1. **Document Q&A**: Answer questions based on the provided documentation context
2. **Code Explanation**: Explain code snippets, patterns, and architectural decisions
3. **Cross-Reference**: Connect related concepts across multiple documents
4. **Best Practices**: Suggest improvements and highlight important patterns
5. **Source Citations**: Always cite specific documents when referencing information

## Response Guidelines
- **Be concise and direct** - developers prefer clarity over verbosity
- **Use code blocks** with proper syntax highlighting for code examples
- **Cite sources** using [Document: "Title"] format when referencing specific docs
- **Acknowledge uncertainty** - if information isn't in the provided context, say so
- **Use markdown formatting** for readability
- **Focus on practical, actionable answers**

## Citation Format
When citing information from documents, use this format:
[Source: "Document Title"]

Example: "React components should use functional syntax [Source: "React Best Practices Guide"]"

## Knowledge Base Mode
When searching across all documents, prioritize:
1. Most relevant semantic matches
2. Recently updated documents
3. Documents with higher importance scores`;

const SUGGESTION_SYSTEM_INSTRUCTION = `You are a helpful assistant that generates relevant follow-up questions for documentation. Generate exactly 4 concise, practical questions that a developer might want to ask based on the context provided. Return only the questions as a JSON array of strings.

Example output: ["How do I configure authentication?", "What are the rate limits?", "Can you show me a TypeScript example?", "What are common error codes?"]`;

// ===============================================================
// Conversation Queries
// ===============================================================

export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { limit = 50, includeArchived = false, projectId }) => {
    const userId = await getUserId(ctx);

    let conversations;

    if (projectId) {
      conversations = await ctx.db
        .query("chatConversations")
        .withIndex("byProject", (q) => q.eq("projectId", projectId))
        .order("desc")
        .take(limit);

      // Filter by user
      conversations = conversations.filter(c => c.userId === userId);
    } else {
      conversations = await ctx.db
        .query("chatConversations")
        .withIndex("byUserAndUpdated", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }

    // Filter archived if needed
    if (!includeArchived) {
      conversations = conversations.filter(c => !c.isArchived);
    }

    // Sort pinned to top
    return conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    // Get messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversationAndCreated", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();

    // Get document details for context
    const documentDetails = await Promise.all(
      conversation.documentIds.map(async (docId) => {
        const doc = await ctx.db.get(docId);
        return doc ? { id: docId, topic: doc.topic } : null;
      })
    );

    return {
      ...conversation,
      messages,
      documents: documentDetails.filter(Boolean),
    };
  },
});

export const getMessages = query({
  args: {
    conversationId: v.id("chatConversations"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()), // For pagination
  },
  handler: async (ctx, { conversationId, limit = 50, before }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return [];
    }

    let messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversationAndCreated", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(limit + 1);

    // Filter by timestamp if pagination
    if (before) {
      messages = messages.filter(m => m.createdAt < before);
    }

    // Return in chronological order
    return messages.slice(0, limit).reverse();
  },
});

// ===============================================================
// Conversation Mutations
// ===============================================================

export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    documentIds: v.optional(v.array(v.id("documents"))),
    projectId: v.optional(v.id("projects")),
    type: v.optional(v.union(
      v.literal("document"),
      v.literal("project"),
      v.literal("knowledge_base"),
      v.literal("general")
    )),
  },
  handler: async (ctx, { title, documentIds = [], projectId, type = "general" }) => {
    const userId = await getUserId(ctx);
    const now = Date.now();

    // Determine title if not provided
    let conversationTitle = title;
    if (!conversationTitle) {
      if (type === "document" && documentIds.length > 0) {
        const doc = await ctx.db.get(documentIds[0]);
        conversationTitle = doc ? `Chat: ${doc.topic}` : "Document Chat";
      } else if (type === "project" && projectId) {
        const project = await ctx.db.get(projectId);
        conversationTitle = project ? `Chat: ${project.name}` : "Project Chat";
      } else if (type === "knowledge_base") {
        conversationTitle = "Knowledge Base Chat";
      } else {
        conversationTitle = "New Chat";
      }
    }

    const conversationId = await ctx.db.insert("chatConversations", {
      userId,
      title: conversationTitle,
      documentIds,
      projectId,
      type,
      messageCount: 0,
      lastMessageAt: now,
      isArchived: false,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

export const updateConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    title: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { conversationId, title, isPinned, isArchived }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (title !== undefined) updates.title = title;
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    await ctx.db.patch(conversationId, updates);
  },
});

export const deleteConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Delete all messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete conversation
    await ctx.db.delete(conversationId);
  },
});

export const addDocumentToContext = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { conversationId, documentId }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Check document exists and belongs to user
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    // Add if not already in context
    if (!conversation.documentIds.includes(documentId)) {
      await ctx.db.patch(conversationId, {
        documentIds: [...conversation.documentIds, documentId],
        updatedAt: Date.now(),
      });
    }
  },
});

export const removeDocumentFromContext = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { conversationId, documentId }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(conversationId, {
      documentIds: conversation.documentIds.filter(id => id !== documentId),
      updatedAt: Date.now(),
    });
  },
});

// ===============================================================
// Message Mutations
// ===============================================================

export const rateMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    rating: v.union(v.literal("up"), v.literal("down"), v.null()),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, rating, feedback }) => {
    const userId = await getUserId(ctx);

    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) {
      throw new Error("Message not found");
    }

    await ctx.db.patch(messageId, {
      rating: rating ?? undefined,
      ratingFeedback: feedback,
    });
  },
});

// ===============================================================
// Internal Functions
// ===============================================================

export const addMessageInternal = internalMutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    sources: v.optional(v.array(v.object({
      documentId: v.id("documents"),
      documentTitle: v.string(),
      snippet: v.string(),
      relevanceScore: v.number(),
    }))),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    isRegenerated: v.optional(v.boolean()),
    regeneratedFrom: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      sources: args.sources,
      provider: args.provider,
      model: args.model,
      tokensUsed: args.tokensUsed,
      isRegenerated: args.isRegenerated ?? false,
      regeneratedFrom: args.regeneratedFrom,
      createdAt: now,
    });

    // Update conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation) {
      await ctx.db.patch(args.conversationId, {
        messageCount: conversation.messageCount + 1,
        lastMessageAt: now,
        updatedAt: now,
      });
    }

    return messageId;
  },
});

export const getConversationContextInternal = internalQuery({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.string(),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    // Get recent messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversationAndCreated", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(MAX_MESSAGES_IN_CONTEXT);

    // Get document content
    const documents = await Promise.all(
      conversation.documentIds.map(async (docId) => {
        const doc = await ctx.db.get(docId);
        return doc;
      })
    );

    return {
      conversation,
      messages: messages.reverse(),
      documents: documents.filter(Boolean),
    };
  },
});

// ===============================================================
// Chat Actions (AI Interactions)
// ===============================================================

export const sendMessage = action({
  args: {
    conversationId: v.id("chatConversations"),
    message: v.string(),
    useSemanticSearch: v.optional(v.boolean()),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { conversationId, message, useSemanticSearch = true, preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get conversation context
    const context = await ctx.runQuery(internal.chatConversations.getConversationContextInternal, {
      conversationId,
      userId,
    });

    if (!context) {
      throw new Error("Conversation not found");
    }

    // Save user message
    await ctx.runMutation(internal.chatConversations.addMessageInternal, {
      conversationId,
      userId,
      role: "user",
      content: message,
    });

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Build context for AI
    let documentContext = "";
    let sources: Array<{
      documentId: Id<"documents">;
      documentTitle: string;
      snippet: string;
      relevanceScore: number;
    }> = [];

    // If knowledge_base type, use semantic search
    if (context.conversation.type === "knowledge_base" && useSemanticSearch) {
      try {
        const searchResults = await ctx.runAction(internal.vectorSearch.semanticSearchInternal, {
          userId,
          query: message,
          limit: 5,
          minScore: 0.4,
        });

        if (searchResults && searchResults.length > 0) {
          documentContext = searchResults
            .map((result: any, i: number) => {
              sources.push({
                documentId: result.documentId,
                documentTitle: result.topic,
                snippet: result.matchSnippet,
                relevanceScore: result.relevanceScore,
              });
              return `## [Document ${i + 1}] ${result.topic}\n\n${truncateToTokenLimit(result.content, 3000)}`;
            })
            .join("\n\n---\n\n");
        }
      } catch (error) {
        console.error("Semantic search failed:", error);
      }
    } else if (context.documents.length > 0) {
      // Use provided documents as context
      const tokensPerDoc = Math.floor((MAX_CONTEXT_TOKENS * 0.6) / context.documents.length);

      documentContext = context.documents
        .map((doc: any, i: number) => {
          sources.push({
            documentId: doc._id,
            documentTitle: doc.topic,
            snippet: doc.content.substring(0, 200) + "...",
            relevanceScore: 1.0,
          });
          return `## [Document ${i + 1}] ${doc.topic}\n\n${truncateToTokenLimit(doc.content, tokensPerDoc)}`;
        })
        .join("\n\n---\n\n");
    }

    // Build conversation history
    const conversationHistory = context.messages
      .slice(-MAX_MESSAGES_IN_CONTEXT)
      .map((msg: any) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    // Build the prompt
    const prompt = `${documentContext ? `## Available Documentation\n\n${documentContext}\n\n---\n\n` : ""}## Conversation History\n\n${conversationHistory}\n\nUser: ${message}\n\nAssistant:`;

    // Select provider
    const { provider, model } = selectProvider(
      userSettings,
      preferredProvider,
      false
    );
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.5,
      maxTokens: 4096,
    };

    const request: GenerationRequest = {
      prompt,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      useSearch: false,
      responseFormat: "text",
    };

    // Generate response
    const response = await generateContent(config, request);

    // Save assistant message
    const assistantMessageId = await ctx.runMutation(internal.chatConversations.addMessageInternal, {
      conversationId,
      userId,
      role: "assistant",
      content: response.text,
      sources: sources.length > 0 ? sources : undefined,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });

    // Track analytics
    await ctx.runMutation(internal.analytics.trackEventInternal, {
      userId,
      eventType: "chat_message",
      eventData: {
        conversationId,
        type: context.conversation.type,
        documentCount: context.documents.length,
        usedSemanticSearch: useSemanticSearch && context.conversation.type === "knowledge_base",
      },
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });

    return {
      messageId: assistantMessageId,
      content: response.text,
      sources,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    };
  },
});

export const regenerateResponse = action({
  args: {
    messageId: v.id("chatMessages"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { messageId, preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get the message to regenerate
    const message = await ctx.runQuery(internal.chatConversations.getMessageInternal, {
      messageId,
      userId,
    });

    if (!message || message.role !== "assistant") {
      throw new Error("Cannot regenerate this message");
    }

    // Get the user message before this one
    const previousMessages = await ctx.runQuery(internal.chatConversations.getMessagesBeforeInternal, {
      conversationId: message.conversationId,
      beforeTimestamp: message.createdAt,
      limit: 1,
    });

    const userMessage = previousMessages.find((m: any) => m.role === "user");
    if (!userMessage) {
      throw new Error("Could not find the user message to regenerate from");
    }

    // Send new message (this will add a new assistant response)
    const result = await ctx.runAction(internal.chatConversations.sendMessage as any, {
      conversationId: message.conversationId,
      message: userMessage.content,
      useSemanticSearch: true,
      preferredProvider,
    });

    // Mark the new message as regenerated
    await ctx.runMutation(internal.chatConversations.markAsRegeneratedInternal, {
      messageId: result.messageId,
      regeneratedFrom: messageId,
    });

    return result;
  },
});

export const getSuggestedQuestions = action({
  args: {
    conversationId: v.optional(v.id("chatConversations")),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { conversationId, documentId, projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check cache first
    const cached = await ctx.runQuery(internal.chatConversations.getCachedSuggestionsInternal, {
      documentId,
      projectId,
    });

    if (cached && cached.expiresAt > Date.now()) {
      return cached.suggestions;
    }

    // Build context for suggestions
    let contextText = "";

    if (documentId) {
      const doc = await ctx.runQuery(internal.documents.getInternal, {
        documentId,
        userId,
      });
      if (doc) {
        contextText = `Document Title: ${doc.topic}\n\nContent Preview:\n${doc.content.substring(0, 2000)}`;
      }
    } else if (projectId) {
      const docs = await ctx.runQuery(internal.documents.listByProjectInternal, {
        userId,
        projectId,
      });
      if (docs.length > 0) {
        contextText = `Project Documents:\n${docs.map((d: any) => `- ${d.topic}`).join("\n")}`;
      }
    }

    if (!contextText) {
      return [
        "What topics would you like to explore?",
        "Can you help me understand a concept?",
        "What are the best practices for this?",
        "Show me an example of how to use this",
      ];
    }

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Generate suggestions
    const { provider, model } = selectProvider(userSettings, undefined, false);
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.7,
    };

    const request: GenerationRequest = {
      prompt: `Based on this context, generate 4 useful questions a developer might ask:\n\n${contextText}`,
      systemInstruction: SUGGESTION_SYSTEM_INSTRUCTION,
      responseFormat: "json",
    };

    try {
      const response = await generateContent(config, request);
      const suggestions = JSON.parse(response.text);

      // Cache the suggestions
      await ctx.runMutation(internal.chatConversations.cacheSuggestionsInternal, {
        userId,
        documentId,
        projectId,
        suggestions,
      });

      return suggestions;
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      return [
        "What are the key features?",
        "How do I get started?",
        "What are the best practices?",
        "Can you show me an example?",
      ];
    }
  },
});

export const exportConversation = action({
  args: {
    conversationId: v.id("chatConversations"),
    format: v.union(v.literal("markdown"), v.literal("json"), v.literal("text")),
  },
  handler: async (ctx, { conversationId, format }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const context = await ctx.runQuery(internal.chatConversations.getConversationContextInternal, {
      conversationId,
      userId,
    });

    if (!context) {
      throw new Error("Conversation not found");
    }

    const { conversation, messages } = context;

    if (format === "json") {
      return JSON.stringify({
        title: conversation.title,
        type: conversation.type,
        createdAt: new Date(conversation.createdAt).toISOString(),
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
          timestamp: new Date(m.createdAt).toISOString(),
        })),
      }, null, 2);
    }

    if (format === "markdown") {
      let md = `# ${conversation.title}\n\n`;
      md += `*Created: ${new Date(conversation.createdAt).toLocaleString()}*\n\n`;
      md += `---\n\n`;

      for (const message of messages) {
        const label = message.role === "user" ? "**You**" : "**Assistant**";
        md += `${label}:\n\n${message.content}\n\n`;

        if (message.sources && message.sources.length > 0) {
          md += `*Sources: ${message.sources.map((s: any) => s.documentTitle).join(", ")}*\n\n`;
        }

        md += `---\n\n`;
      }

      return md;
    }

    // Plain text
    let text = `${conversation.title}\n`;
    text += `${"=".repeat(conversation.title.length)}\n\n`;

    for (const message of messages) {
      const label = message.role === "user" ? "You" : "Assistant";
      text += `[${label}]:\n${message.content}\n\n`;
    }

    return text;
  },
});

// ===============================================================
// Additional Internal Helpers
// ===============================================================

export const getMessageInternal = internalQuery({
  args: {
    messageId: v.id("chatMessages"),
    userId: v.string(),
  },
  handler: async (ctx, { messageId, userId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) return null;
    return message;
  },
});

export const getMessagesBeforeInternal = internalQuery({
  args: {
    conversationId: v.id("chatConversations"),
    beforeTimestamp: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, { conversationId, beforeTimestamp, limit }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversationAndCreated", (q) => q.eq("conversationId", conversationId))
      .filter((q) => q.lt(q.field("createdAt"), beforeTimestamp))
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});

export const markAsRegeneratedInternal = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    regeneratedFrom: v.id("chatMessages"),
  },
  handler: async (ctx, { messageId, regeneratedFrom }) => {
    await ctx.db.patch(messageId, {
      isRegenerated: true,
      regeneratedFrom,
    });
  },
});

export const getCachedSuggestionsInternal = internalQuery({
  args: {
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { documentId, projectId }) => {
    if (documentId) {
      return await ctx.db
        .query("chatSuggestions")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .first();
    }
    if (projectId) {
      return await ctx.db
        .query("chatSuggestions")
        .withIndex("byProject", (q) => q.eq("projectId", projectId))
        .first();
    }
    return null;
  },
});

export const cacheSuggestionsInternal = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
    suggestions: v.array(v.string()),
  },
  handler: async (ctx, { userId, documentId, projectId, suggestions }) => {
    const now = Date.now();

    // Delete old cache
    if (documentId) {
      const existing = await ctx.db
        .query("chatSuggestions")
        .withIndex("byDocument", (q) => q.eq("documentId", documentId))
        .first();
      if (existing) await ctx.db.delete(existing._id);
    }
    if (projectId) {
      const existing = await ctx.db
        .query("chatSuggestions")
        .withIndex("byProject", (q) => q.eq("projectId", projectId))
        .first();
      if (existing) await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("chatSuggestions", {
      userId,
      documentId,
      projectId,
      suggestions,
      expiresAt: now + SUGGESTION_CACHE_TTL,
      createdAt: now,
    });
  },
});

// Get context stats for a conversation
export const getContextStats = query({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const userId = await getUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    // Calculate token estimates
    const documents = await Promise.all(
      conversation.documentIds.map(async (docId) => {
        const doc = await ctx.db.get(docId);
        return doc;
      })
    );

    const documentTokens = documents
      .filter(Boolean)
      .reduce((sum, doc) => sum + estimateTokens(doc!.content), 0);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    const messageTokens = messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );

    return {
      documentCount: conversation.documentIds.length,
      messageCount: messages.length,
      estimatedTokens: {
        documents: documentTokens,
        messages: messageTokens,
        total: documentTokens + messageTokens,
      },
      maxTokens: MAX_CONTEXT_TOKENS,
      utilizationPercent: Math.round(
        ((documentTokens + messageTokens) / MAX_CONTEXT_TOKENS) * 100
      ),
    };
  },
});

"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  generateContent,
  selectProvider,
  AIProviderConfig,
  GenerationRequest,
  AIProvider,
} from "./aiProvider";

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

const CHAT_SYSTEM_INSTRUCTION = `You are a helpful AI assistant for DocuSynth, a documentation synthesis platform. You help users understand and work with their generated documentation.

Your capabilities:
1. Answer questions about the documentation content provided
2. Explain code snippets and concepts
3. Suggest improvements or additions
4. Help users find specific information
5. Clarify technical concepts

Guidelines:
- Be concise and direct
- Use code blocks for code examples
- Reference specific sections when relevant
- If you don't know something, say so
- Focus on being helpful for developers

Format your responses in Markdown for readability.`;

// Chat with AI about a document
export const chatWithDocument = action({
  args: {
    documentId: v.id("documents"),
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
    preferredProvider: v.optional(
      v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))
    ),
  },
  handler: async (ctx, { documentId, message, conversationHistory = [], preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get the document
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });
    if (!doc) throw new Error("Document not found");

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Build the prompt with document context
    const contextPrompt = `You have access to the following documentation:

---
# ${doc.topic}

${doc.content.substring(0, 30000)}
---

Previous conversation:
${conversationHistory
  .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
  .join("\n\n")}

User's question: ${message}

Please answer based on the documentation above. If the answer isn't in the documentation, say so.`;

    // Select provider - chat doesn't require search
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
    };

    const request: GenerationRequest = {
      prompt: contextPrompt,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      useSearch: false,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    // Track analytics
    await ctx.runMutation(internal.analytics.trackEventInternal, {
      userId,
      eventType: "chat_message",
      eventData: { documentId, messageLength: message.length },
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });

    return {
      response: response.text,
      provider: response.provider,
      model: response.model,
    };
  },
});

// Chat about a general topic (without specific document context)
export const generalChat = action({
  args: {
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
    preferredProvider: v.optional(
      v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))
    ),
    useSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, { message, conversationHistory = [], preferredProvider, useSearch = false }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Build the prompt
    const contextPrompt = `${
      conversationHistory.length > 0
        ? `Previous conversation:
${conversationHistory
  .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
  .join("\n\n")}

`
        : ""
    }User's question: ${message}`;

    // Select provider
    const { provider, model } = selectProvider(
      userSettings,
      preferredProvider,
      useSearch
    );
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.7,
    };

    const request: GenerationRequest = {
      prompt: contextPrompt,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      useSearch,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    return {
      response: response.text,
      sources: response.sources,
      provider: response.provider,
      model: response.model,
    };
  },
});

// Ask a question about multiple documents in a project
export const chatWithProject = action({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
    preferredProvider: v.optional(
      v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))
    ),
  },
  handler: async (ctx, { projectId, message, conversationHistory = [], preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get the project
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId,
      userId,
    });
    if (!project) throw new Error("Project not found");

    // Get all documents in the project
    const docs = await ctx.runQuery(internal.documents.listByProjectInternal, {
      userId,
      projectId,
    });

    if (docs.length === 0) {
      throw new Error("No documents in this project");
    }

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Build context from all documents (limited to avoid token limits)
    const docsContext = docs
      .map((doc: any, i: number) => {
        // Limit each doc to ~5000 chars to stay under token limits
        const contentPreview = doc.content.substring(0, 5000);
        return `## Document ${i + 1}: ${doc.topic}\n\n${contentPreview}${
          doc.content.length > 5000 ? "\n\n[Content truncated...]" : ""
        }`;
      })
      .join("\n\n---\n\n");

    const contextPrompt = `You have access to the following project documentation for "${project.name}":

---
${docsContext}
---

Previous conversation:
${conversationHistory
  .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
  .join("\n\n")}

User's question: ${message}

Please answer based on the documentation above. Reference specific documents when relevant.`;

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
    };

    const request: GenerationRequest = {
      prompt: contextPrompt,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      useSearch: false,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    // Track analytics
    await ctx.runMutation(internal.analytics.trackEventInternal, {
      userId,
      eventType: "project_chat",
      eventData: { projectId, documentCount: docs.length },
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });

    return {
      response: response.text,
      provider: response.provider,
      model: response.model,
      documentCount: docs.length,
    };
  },
});

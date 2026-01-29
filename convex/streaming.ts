
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  selectProvider,
  DOCUMENTATION_SYSTEM_INSTRUCTION,
  AIProvider,
  PROVIDER_MODELS,
} from "./aiProvider";

// Streaming session status
export type StreamingStatus = "pending" | "streaming" | "completed" | "error";

// Create a new streaming session
export const createSession = internalMutation({
  args: {
    userId: v.string(),
    topic: v.string(),
    mode: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("streamingSessions", {
      userId: args.userId,
      topic: args.topic,
      mode: args.mode,
      projectId: args.projectId,
      content: "",
      status: "pending" as StreamingStatus,
      provider: null,
      model: null,
      tokensUsed: null,
      sources: [],
      error: null,
      startedAt: Date.now(),
      completedAt: null,
    });
    return sessionId;
  },
});

// Update streaming session content (append chunk)
export const appendContent = internalMutation({
  args: {
    sessionId: v.id("streamingSessions"),
    chunk: v.string(),
  },
  handler: async (ctx, { sessionId, chunk }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    await ctx.db.patch(sessionId, {
      content: session.content + chunk,
      status: "streaming" as StreamingStatus,
    });
  },
});

// Complete streaming session
export const completeSession = internalMutation({
  args: {
    sessionId: v.id("streamingSessions"),
    sources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "completed" as StreamingStatus,
      sources: args.sources || [],
      provider: args.provider || null,
      model: args.model || null,
      tokensUsed: args.tokensUsed || null,
      completedAt: Date.now(),
    });
  },
});

// Mark session as error
export const errorSession = internalMutation({
  args: {
    sessionId: v.id("streamingSessions"),
    error: v.string(),
  },
  handler: async (ctx, { sessionId, error }) => {
    await ctx.db.patch(sessionId, {
      status: "error" as StreamingStatus,
      error,
      completedAt: Date.now(),
    });
  },
});

// Get streaming session (reactive query for real-time updates)
export const getSession = query({
  args: {
    sessionId: v.id("streamingSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    // Verify user access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      return null;
    }

    return {
      id: session._id,
      topic: session.topic,
      content: session.content,
      status: session.status,
      provider: session.provider,
      model: session.model,
      sources: session.sources,
      error: session.error,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  },
});

// Get provider API key
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

// Internal action to perform streaming generation
export const performStreamingGeneration = internalAction({
  args: {
    sessionId: v.id("streamingSessions"),
    userId: v.string(),
    topic: v.string(),
    mode: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId, topic, mode, preferredProvider } = args;

    try {
      // Get user settings
      const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
        userId,
      });

      // Build prompt based on mode
      let prompt = "";
      if (mode === "github") {
        prompt = `
          Perform a deep structural analysis of the GitHub repository: ${topic}.

          Tasks:
          1. Use Google Search to find the repository's file structure. Specifically look for:
             - Content of README.md
             - package.json (or equivalent dependency file)
             - Key files in /src, /lib, or /app
             - Documentation in /docs
          2. Identify the core technology stack and primary purpose.
          3. Extract key architectural patterns and entry points (e.g., where the main logic starts).
          4. Synthesize an "LLM Context File" specifically for this repo.

          Focus on:
          - How to set up and run the project.
          - Core API or Library patterns found in the source.
          - Directory structure explanation for LLM reasoning.
          - Security considerations specific to this codebase's stack.
        `;
      } else if (mode === "crawl") {
        prompt = `
          Generate an "LLM Context File" by analyzing the documentation located at: ${topic}.

          Requirements:
          - Use Google Search to access and read the specific content from ${topic} and its sub-pages if accessible.
          - Focus strictly on the framework/library described at that URL.
          - Create a dense Markdown reference for an LLM.
          - Include specific security best practices.
          - Include the specific version mentioned in the docs if available.
          - Provide clean, copy-pasteable code snippets derived from these docs.
        `;
      } else {
        prompt = `
          Generate an "LLM Context File" for: ${topic}.

          Requirements:
          - Search for the absolute latest version documentation using Google Search.
          - Identify any recent major updates.
          - Focus on architectural patterns that help LLMs suggest whole-file structures.
          - Provide clean, copy-pasteable code snippets.
          - Include direct links to official docs in the "References" section at the bottom.
        `;
      }

      // Select provider - documentation generation always benefits from search
      const { provider, model } = selectProvider(userSettings, preferredProvider, true);
      const apiKey = getProviderApiKey(provider, userSettings);

      // Use streaming based on provider
      let fullContent = "";
      let sources: Array<{ title: string; url: string }> = [];
      let tokensUsed = 0;

      if (provider === "gemini") {
        // Gemini streaming
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction: DOCUMENTATION_SYSTEM_INSTRUCTION,
            temperature: 0.3,
            tools: [{ googleSearch: {} }],
          },
        });

        // Process stream and collect chunks for final metadata
        let lastChunk: any = null;
        for await (const chunk of stream) {
          lastChunk = chunk;
          const text = chunk.text;
          if (text) {
            fullContent += text;
            await ctx.runMutation(internal.streaming.appendContent, {
              sessionId,
              chunk: text,
            });
          }
        }

        // Extract sources from the last chunk's grounding metadata
        const groundingChunks = lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          sources = groundingChunks
            .map((chunk: any) => {
              if (chunk.web) {
                return { title: chunk.web.title || "Web Source", url: chunk.web.uri };
              }
              return null;
            })
            .filter((s: any) => s !== null);

          // Deduplicate sources
          sources = Array.from(
            new Map(sources.map((item) => [item.url, item])).values()
          );
        }

      } else if (provider === "claude") {
        // Claude streaming
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });

        const stream = client.messages.stream({
          model,
          max_tokens: 8192,
          system: DOCUMENTATION_SYSTEM_INSTRUCTION,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            fullContent += text;
            await ctx.runMutation(internal.streaming.appendContent, {
              sessionId,
              chunk: text,
            });
          }
        }

        const finalMessage = await stream.finalMessage();
        tokensUsed = (finalMessage.usage?.input_tokens || 0) + (finalMessage.usage?.output_tokens || 0);

      } else if (provider === "openai") {
        // OpenAI streaming
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey });

        const stream = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: DOCUMENTATION_SYSTEM_INSTRUCTION },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            fullContent += text;
            await ctx.runMutation(internal.streaming.appendContent, {
              sessionId,
              chunk: text,
            });
          }
        }
      }

      // Complete the session
      await ctx.runMutation(internal.streaming.completeSession, {
        sessionId,
        sources,
        provider,
        model,
        tokensUsed: tokensUsed || undefined,
      });

      return { success: true, content: fullContent, sources, provider, model };

    } catch (error: any) {
      await ctx.runMutation(internal.streaming.errorSession, {
        sessionId,
        error: error.message || "Generation failed",
      });
      throw error;
    }
  },
});

// Start streaming document generation
export const startStreamingGeneration = action({
  args: {
    topic: v.string(),
    mode: v.union(v.literal("search"), v.literal("crawl"), v.literal("github")),
    projectId: v.optional(v.id("projects")),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check rate limit
    const rateCheck = await ctx.runQuery(internal.rateLimit.check, { userId });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before making more requests.");
    }

    // Create streaming session
    const sessionId = await ctx.runMutation(internal.streaming.createSession, {
      userId,
      topic: args.topic,
      mode: args.mode,
      projectId: args.projectId,
    });

    // Start the streaming generation in background
    ctx.scheduler.runAfter(0, internal.streaming.performStreamingGeneration, {
      sessionId,
      userId,
      topic: args.topic,
      mode: args.mode,
      preferredProvider: args.preferredProvider,
    });

    // Record rate limit usage
    await ctx.runMutation(internal.rateLimit.record, { userId });

    // Record recent search
    await ctx.runMutation(internal.recentSearches.addInternal, {
      userId,
      query: args.topic,
    });

    return { sessionId };
  },
});

// Save completed streaming session as a document
export const saveStreamingSession = action({
  args: {
    sessionId: v.id("streamingSessions"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { sessionId, projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const session = await ctx.runQuery(internal.streaming.getSessionInternal, {
      sessionId,
      userId,
    });

    if (!session) throw new Error("Session not found");
    if (session.status !== "completed") throw new Error("Session not completed");

    // Create document from session
    const documentId = await ctx.runMutation(internal.documents.createInternal, {
      userId,
      topic: session.topic,
      content: session.content,
      sources: session.sources || [],
      projectId: projectId || session.projectId,
      visibility: "private",
    });

    // Track analytics
    await ctx.runMutation(internal.analytics.trackEventInternal, {
      userId,
      eventType: "document_generated",
      eventData: { topic: session.topic, mode: session.mode, streaming: true },
      provider: session.provider || undefined,
      model: session.model || undefined,
      tokensUsed: session.tokensUsed || undefined,
    });

    return { documentId };
  },
});

// Internal query to get session without auth check (for internal use)
export const getSessionInternal = internalQuery({
  args: {
    sessionId: v.id("streamingSessions"),
    userId: v.string(),
  },
  handler: async (ctx, { sessionId, userId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return null;

    return {
      id: session._id,
      topic: session.topic,
      mode: session.mode,
      projectId: session.projectId,
      content: session.content,
      status: session.status,
      provider: session.provider,
      model: session.model,
      sources: session.sources,
      error: session.error,
      tokensUsed: session.tokensUsed,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  },
});

// Run generation (internal action for API use)
export const runGeneration = internalAction({
  args: {
    sessionId: v.id("streamingSessions"),
    provider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { sessionId, provider }) => {
    // Get session to retrieve topic, mode, and userId
    const session = await ctx.runQuery(internal.streaming.getSessionByIdInternal, { sessionId });
    if (!session) throw new Error("Session not found");

    // Run the actual streaming generation
    await ctx.runAction(internal.streaming.performStreamingGeneration, {
      sessionId,
      userId: session.userId,
      topic: session.topic,
      mode: session.mode,
      preferredProvider: provider,
    });
  },
});

// Get session by ID without user check (for internal use only)
export const getSessionByIdInternal = internalQuery({
  args: {
    sessionId: v.id("streamingSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    return session;
  },
});

// Clean up old streaming sessions (older than 24 hours)
export const cleanupOldSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const oldSessions = await ctx.db
      .query("streamingSessions")
      .filter((q) => q.lt(q.field("startedAt"), cutoff))
      .collect();

    for (const session of oldSessions) {
      await ctx.db.delete(session._id);
    }

    return { deleted: oldSessions.length };
  },
});

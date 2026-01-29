"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI, Type } from "@google/genai";
import {
  generateContent,
  selectProvider,
  DOCUMENTATION_SYSTEM_INSTRUCTION,
  AIProviderConfig,
  GenerationRequest,
  AIProvider,
} from "./aiProvider";

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured in Convex environment");
  return key;
}

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

export const generateDocumentation = action({
  args: {
    topic: v.string(),
    mode: v.union(v.literal("search"), v.literal("crawl"), v.literal("github")),
    projectId: v.optional(v.id("projects")),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { topic, mode, projectId, preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check rate limit
    const rateCheck = await ctx.runQuery(internal.rateLimit.check, { userId });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before making more requests.");
    }

    // Get user settings for provider selection
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Build the prompt based on mode
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

    // Select provider - search modes require Gemini for grounding
    const requiresSearch = true; // Documentation generation always benefits from search
    const { provider, model } = selectProvider(userSettings, preferredProvider, requiresSearch);

    // Get API key for selected provider
    const apiKey = getProviderApiKey(provider, userSettings);

    // Create config and request
    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.3,
    };

    const request: GenerationRequest = {
      prompt,
      systemInstruction: DOCUMENTATION_SYSTEM_INSTRUCTION,
      useSearch: true,
      responseFormat: "text",
    };

    // Generate content using the selected provider
    const response = await generateContent(config, request);

    // Record rate limit usage
    await ctx.runMutation(internal.rateLimit.record, { userId });

    // Record recent search
    await ctx.runMutation(internal.recentSearches.addInternal, {
      userId,
      query: topic,
    });

    // Create document
    const documentId = await ctx.runMutation(internal.documents.createInternal, {
      userId,
      topic,
      content: response.text,
      sources: response.sources || [],
      projectId,
      visibility: "private",
    });

    return {
      documentId,
      topic,
      content: response.text,
      sources: response.sources || [],
      provider: response.provider,
      model: response.model,
    };
  },
});

export const discoverLinks = action({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),
    depth: v.optional(v.number()),
    excludePatterns: v.optional(v.string()),
  },
  handler: async (ctx, { url, maxPages, depth, excludePatterns }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const apiKey = getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.0-flash";

    const maxPagesVal = maxPages || 20;
    const depthVal = depth || 1;
    const excludePatternsVal =
      excludePatterns || "login, signup, auth, pricing, terms, privacy";

    const isGitHub = url.toLowerCase().includes("github.com");

    let prompt = "";

    if (isGitHub) {
      prompt = `
        I need to analyze the GitHub repository at: ${url}

        Task: Find the most important files and directories to include in a developer documentation context.

        Instructions:
        1. Search for the repository file structure using Google Search.
        2. Identify key documentation files (specifically README.md, CONTRIBUTING.md, and Markdown files in docs/).
        3. Identify core source code entry points (e.g. src/index.ts, lib/main.js, main.go, Cargo.toml).
        4. Return a list of up to ${maxPagesVal} absolute URLs to these specific files (blob view) or directories (tree view).

        Exclude:
        - Issues, Pull Requests, Actions, Projects tabs
        - Links matching these patterns: ${excludePatternsVal}
      `;
    } else {
      prompt = `
        I need to crawl the documentation website starting at: ${url}

        Task: Create a curated list of the most important documentation pages for a developer to read.

        Instructions:
        1. Search for the "Table of Contents", "Sidebar navigation", or "Sitemap" of this specific site.
        2. Extract links to the core sections, prioritizing:
           - Getting Started / Installation
           - Core Concepts / Architecture
           - API Reference / SDKs
           - Guides / Tutorials
        3. Ensure the links are distinct and cover the breadth of the documentation.
        4. Return up to ${maxPagesVal} absolute URLs.

        Context: The user is interested in links up to ${depthVal} levels deep relative to the root.

        Exclude:
        - Login, Signup, Pricing, Marketing pages
        - Social media links (Twitter, Discord, etc.)
        - Links matching these patterns: ${excludePatternsVal}
      `;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "The descriptive title of the page or file",
                  },
                  url: {
                    type: Type.STRING,
                    description: "The absolute URL",
                  },
                },
              },
            },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return { links: [] };

    const data = JSON.parse(jsonText);
    return { links: data.links || [] };
  },
});

export const generateMCPServer = action({
  args: {
    projectId: v.id("projects"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { projectId, preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    // Get project and its documents
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId,
      userId,
    });
    if (!project) throw new Error("Project not found");

    const docs = await ctx.runQuery(internal.documents.listByProjectInternal, {
      userId,
      projectId,
    });

    const docsContext = docs
      .map(
        (d: any) =>
          `Topic: ${d.topic}\nContent: ${d.content.substring(0, 1000)}...`
      )
      .join("\n\n");

    const prompt = `
      Create a Model Context Protocol (MCP) server implementation in TypeScript for a project named "${project.name}".

      The server should:
      1. Use the @modelcontextprotocol/sdk.
      2. Expose the following documentation topics as Resources (using doc://topic-name URI scheme).
      3. Implement a search_docs Tool that allows the LLM to find relevant parts of the provided documentation.
      4. Be a single standalone TypeScript file (index.ts) that can be run with npx or ts-node.

      Documentation Context for the Server:
      ${docsContext}

      Requirements:
      - Include all necessary imports from @modelcontextprotocol/sdk/server/index.js etc.
      - Implement listResources, readResource, listTools, and callTool handlers.
      - Include comments explaining how to install dependencies (npm install @modelcontextprotocol/sdk).
      - Ensure the search_docs tool is robust.
      - Use the StdioServerTransport for standard input/output communication.
    `;

    const systemInstruction = "You are a lead software architect specializing in the Model Context Protocol (MCP). Output only the valid, production-ready TypeScript code for the server. Do not include markdown blocks if possible, just the code.";

    // MCP generation doesn't require search - can use any provider
    const { provider, model } = selectProvider(userSettings, preferredProvider || "claude", false);
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.2,
    };

    const request: GenerationRequest = {
      prompt,
      systemInstruction,
      useSearch: false,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    return {
      code: response.text || "// Failed to generate server code",
      provider: response.provider,
      model: response.model,
    };
  },
});

export const summarizeContent = action({
  args: {
    documentId: v.id("documents"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  },
  handler: async (ctx, { documentId, preferredProvider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });
    if (!doc) throw new Error("Document not found");

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    const prompt = `
      Summarize the following documentation content into a high-level executive summary.

      Structure:
      1. **Core Purpose**: What is this library/tool?
      2. **Key Features**: Bullet points of main capabilities.
      3. **Use Cases**: When to use it.

      Keep it concise (under 300 words).

      Content:
      ${doc.content.substring(0, 50000)}
    `;

    // Summarization doesn't require search
    const { provider, model } = selectProvider(userSettings, preferredProvider, false);
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.3,
    };

    const request: GenerationRequest = {
      prompt,
      systemInstruction: "You are a technical writer who creates clear, concise summaries.",
      useSearch: false,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    return {
      summary: response.text || "No summary generated.",
      provider: response.provider,
      model: response.model,
    };
  },
});

// Internal action used by crawl task processing
export const generateForCrawlTask = internalAction({
  args: {
    url: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { url, userId }) => {
    // Check rate limit
    const rateCheck = await ctx.runQuery(internal.rateLimit.check, { userId });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded");
    }

    // Get user settings
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId,
    });

    const prompt = `
      Generate an "LLM Context File" by analyzing the documentation located at: ${url}.

      Requirements:
      - Use Google Search to access and read the specific content from ${url} and its sub-pages if accessible.
      - Focus strictly on the framework/library described at that URL.
      - Create a dense Markdown reference for an LLM.
      - Include specific security best practices.
      - Include the specific version mentioned in the docs if available.
      - Provide clean, copy-pasteable code snippets derived from these docs.
    `;

    // Crawl tasks always use Gemini for search grounding
    const { provider, model } = selectProvider(userSettings, "gemini", true);
    const apiKey = getProviderApiKey(provider, userSettings);

    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.3,
    };

    const request: GenerationRequest = {
      prompt,
      systemInstruction: DOCUMENTATION_SYSTEM_INSTRUCTION,
      useSearch: true,
      responseFormat: "text",
    };

    const response = await generateContent(config, request);

    // Record rate limit usage
    await ctx.runMutation(internal.rateLimit.record, { userId });

    return {
      content: response.text,
      sources: response.sources || [],
      provider: response.provider,
      model: response.model,
    };
  },
});

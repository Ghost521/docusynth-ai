"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";

export type AIProvider = "gemini" | "claude" | "openai";

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationRequest {
  prompt: string;
  systemInstruction: string;
  useSearch?: boolean;
  responseFormat?: "text" | "json";
  jsonSchema?: object;
}

export interface GenerationResponse {
  text: string;
  sources?: Array<{ title: string; url: string }>;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
}

// Default system instruction for documentation generation
export const DOCUMENTATION_SYSTEM_INSTRUCTION = `
You are a Senior Developer Experience Engineer specializing in creating "LLM Context Files" (like .cursorrules or Claude Project Knowledge).

Your goal is to create a comprehensive, dense, and up-to-date markdown reference for the requested library, framework, or tool.
This output is intended to be pasted into another LLM (like Claude, Cursor, Ollama, Tabnine, or Amazon Q) to teach it how to code using the LATEST version of the technology.

Structure the output strictly as Markdown, but utilize XML-like tags for key sections to optimize for Claude's long-context reasoning:
1. Title & Version (Latest)
2. <breaking_changes>: Critical for avoiding hallucinations of old APIs.
3. <concepts_architecture>: Optimized for whole-project context.
4. <directory_structure>: (Specifically for GitHub mode) Explain the folder hierarchy.
5. <best_practices>: Code heavy, emphasize security and modern patterns.
6. <common_pitfalls>: Known issues or anti-patterns.
7. <api_reference>: Dense summary of frequent methods.
8. <amazon_q_optimization>: Specific style guide for CodeWhisperer.
9. <claude_project_context>: A summary block optimized for Claude Projects.

Style Guide:
- Use concise technical language.
- Prioritize code examples over prose.
- Specify types clearly (TypeScript preferred).
- Mark deprecated features clearly.
`;

// Provider-specific model configurations
export const PROVIDER_MODELS = {
  gemini: {
    default: "gemini-2.0-flash",
    pro: "gemini-2.5-pro-preview-05-06",
    flash: "gemini-2.0-flash",
  },
  claude: {
    default: "claude-sonnet-4-20250514",
    opus: "claude-opus-4-20250514",
    sonnet: "claude-sonnet-4-20250514",
    haiku: "claude-3-5-haiku-20241022",
  },
  openai: {
    default: "gpt-4o",
    turbo: "gpt-4-turbo",
    mini: "gpt-4o-mini",
  },
} as const;

// Get API key for a provider (synchronous version using raw settings)
// For encrypted secrets, callers should use ctx.runQuery(internal.encryption.getApiKey, ...)
function getProviderApiKey(provider: AIProvider, userSettings?: any): string {
  switch (provider) {
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY not configured");
      return key;
    }
    case "claude": {
      // userSettings may contain either encrypted or plaintext values
      // For encrypted values, this will fail - use encryption.getApiKey instead
      const key = userSettings?.claudeApiKey || process.env.CLAUDE_API_KEY;
      if (!key) throw new Error("Claude API key not configured. Add it in Settings > Cloud APIs.");
      return key;
    }
    case "openai": {
      // userSettings may contain either encrypted or plaintext values
      // For encrypted values, this will fail - use encryption.getApiKey instead
      const key = userSettings?.openAiApiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OpenAI API key not configured. Add it in Settings > Cloud APIs.");
      return key;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Async helper to get API key with decryption support
async function getProviderApiKeyAsync(
  ctx: any,
  provider: AIProvider,
  userId: string
): Promise<string> {
  const key = await ctx.runAction(internal.encryption.getApiKey, {
    userId,
    provider,
  });

  if (!key) {
    throw new Error(`${provider} API key not configured. Add it in Settings > Cloud APIs.`);
  }

  return key;
}

// Generate content using Gemini
async function generateWithGemini(
  config: AIProviderConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  const { GoogleGenAI, Type } = await import("@google/genai");

  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const genConfig: any = {
    systemInstruction: request.systemInstruction,
    temperature: config.temperature ?? 0.3,
  };

  if (request.useSearch) {
    genConfig.tools = [{ googleSearch: {} }];
  }

  if (request.responseFormat === "json" && request.jsonSchema) {
    genConfig.responseMimeType = "application/json";
    genConfig.responseSchema = request.jsonSchema;
  }

  const response = await ai.models.generateContent({
    model: config.model,
    contents: request.prompt,
    config: genConfig,
  });

  const text = response.text;
  if (!text) throw new Error("No content generated from Gemini");

  // Extract sources from grounding metadata
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => {
      if (chunk.web) {
        return { title: chunk.web.title || "Web Source", url: chunk.web.uri };
      }
      return null;
    })
    .filter((s: any) => s !== null) || [];

  const uniqueSources = Array.from(
    new Map(sources.map((item: any) => [item.url, item])).values()
  ) as Array<{ title: string; url: string }>;

  return {
    text,
    sources: uniqueSources,
    provider: "gemini",
    model: config.model,
  };
}

// Generate content using Claude
async function generateWithClaude(
  config: AIProviderConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({ apiKey: config.apiKey });

  const messages: any[] = [
    { role: "user", content: request.prompt }
  ];

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens ?? 8192,
    system: request.systemInstruction,
    messages,
  });

  const textContent = response.content.find((c: any) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  return {
    text: textContent.text,
    sources: [], // Claude doesn't have built-in search grounding
    provider: "claude",
    model: config.model,
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
  };
}

// Generate content using OpenAI
async function generateWithOpenAI(
  config: AIProviderConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  const OpenAI = (await import("openai")).default;

  const client = new OpenAI({ apiKey: config.apiKey });

  const messages: any[] = [
    { role: "system", content: request.systemInstruction },
    { role: "user", content: request.prompt }
  ];

  const completionConfig: any = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.3,
    max_tokens: config.maxTokens ?? 8192,
  };

  if (request.responseFormat === "json") {
    completionConfig.response_format = { type: "json_object" };
  }

  const response = await client.chat.completions.create(completionConfig);

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No content generated from OpenAI");

  return {
    text,
    sources: [], // OpenAI doesn't have built-in search grounding
    provider: "openai",
    model: config.model,
    tokensUsed: response.usage?.total_tokens,
  };
}

// Main generation function with provider routing
export async function generateContent(
  config: AIProviderConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  switch (config.provider) {
    case "gemini":
      return generateWithGemini(config, request);
    case "claude":
      return generateWithClaude(config, request);
    case "openai":
      return generateWithOpenAI(config, request);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// Determine the best available provider based on user settings and task
export function selectProvider(
  userSettings: any,
  preferredProvider?: AIProvider,
  requiresSearch?: boolean
): { provider: AIProvider; model: string } {
  // If search is required, Gemini is the only option with built-in grounding
  if (requiresSearch) {
    return {
      provider: "gemini",
      model: userSettings?.geminiModelPreference || PROVIDER_MODELS.gemini.default,
    };
  }

  // Use preferred provider if specified and available
  if (preferredProvider) {
    switch (preferredProvider) {
      case "claude":
        if (userSettings?.claudeApiKey || process.env.CLAUDE_API_KEY) {
          return {
            provider: "claude",
            model: userSettings?.claudeModelPreference || PROVIDER_MODELS.claude.default,
          };
        }
        break;
      case "openai":
        if (userSettings?.openAiApiKey || process.env.OPENAI_API_KEY) {
          return {
            provider: "openai",
            model: userSettings?.openAiModelPreference || PROVIDER_MODELS.openai.default,
          };
        }
        break;
      case "gemini":
        return {
          provider: "gemini",
          model: userSettings?.geminiModelPreference || PROVIDER_MODELS.gemini.default,
        };
    }
  }

  // Default fallback chain: Gemini (always available) -> Claude -> OpenAI
  return {
    provider: "gemini",
    model: userSettings?.geminiModelPreference || PROVIDER_MODELS.gemini.default,
  };
}

// Action to generate documentation with automatic provider selection
export const generateWithProvider = internalAction({
  args: {
    prompt: v.string(),
    systemInstruction: v.optional(v.string()),
    userId: v.string(),
    useSearch: v.optional(v.boolean()),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
    responseFormat: v.optional(v.union(v.literal("text"), v.literal("json"))),
    jsonSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get user settings for API keys and preferences
    const userSettings = await ctx.runQuery(internal.userSettings.getInternal, {
      userId: args.userId,
    });

    // Select provider
    const { provider, model } = selectProvider(
      userSettings,
      args.preferredProvider,
      args.useSearch
    );

    // Get API key using encrypted secrets service
    const apiKey = await getProviderApiKeyAsync(ctx, provider, args.userId);

    // Create config
    const config: AIProviderConfig = {
      provider,
      model,
      apiKey,
      temperature: 0.3,
    };

    // Create request
    const request: GenerationRequest = {
      prompt: args.prompt,
      systemInstruction: args.systemInstruction || DOCUMENTATION_SYSTEM_INSTRUCTION,
      useSearch: args.useSearch,
      responseFormat: args.responseFormat,
      jsonSchema: args.jsonSchema,
    };

    // Generate content
    const response = await generateContent(config, request);

    return response;
  },
});

// Action to list available providers for a user
export const getAvailableProviders = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check which providers have API keys available (using encrypted secrets)
    const [geminiKey, claudeKey, openaiKey] = await Promise.all([
      ctx.runAction(internal.encryption.getApiKey, { userId, provider: "gemini" }),
      ctx.runAction(internal.encryption.getApiKey, { userId, provider: "claude" }),
      ctx.runAction(internal.encryption.getApiKey, { userId, provider: "openai" }),
    ]);

    const providers: Array<{
      provider: AIProvider;
      available: boolean;
      models: string[];
      hasSearch: boolean;
    }> = [
      {
        provider: "gemini",
        available: !!geminiKey,
        models: Object.values(PROVIDER_MODELS.gemini),
        hasSearch: true,
      },
      {
        provider: "claude",
        available: !!claudeKey,
        models: Object.values(PROVIDER_MODELS.claude),
        hasSearch: false,
      },
      {
        provider: "openai",
        available: !!openaiKey,
        models: Object.values(PROVIDER_MODELS.openai),
        hasSearch: false,
      },
    ];

    return providers;
  },
});

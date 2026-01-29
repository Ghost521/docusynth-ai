"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as crypto from "crypto";

import type { SlackMessage, DiscordMessage } from "./botTypes";
import { BOT_COMMANDS } from "./botTypes";

// Re-export types from botTypes for backward compatibility
export type {
  BotPlatform,
  SlackMessage,
  SlackBlock,
  DiscordEmbed,
  DiscordMessage,
} from "./botTypes";

export { BOT_COMMANDS } from "./botTypes";

// Note: Queries and mutations are in botsQueries.ts
// Import directly from there for query/mutation usage
// This file only contains Node.js actions for signature verification

// ===================
// Slack Signature Verification
// ===================

export function verifySlackSignature(
  signingSecret: string,
  requestSignature: string,
  timestamp: string,
  body: string
): boolean {
  // Prevent replay attacks (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(requestSignature)
  );
}

// ===================
// Discord Signature Verification
// ===================

export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    const message = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(publicKey, "hex");

    return crypto.verify(null, message, { key, format: "der", type: "spki" }, sig);
  } catch {
    // Fallback: use tweetnacl-style verification
    // This matches Discord's Ed25519 signature scheme
    return verifyEd25519Signature(publicKey, signature, timestamp + body);
  }
}

// Ed25519 signature verification helper
function verifyEd25519Signature(
  publicKey: string,
  signature: string,
  message: string
): boolean {
  try {
    const keyBuffer = Buffer.from(publicKey, "hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const msgBuffer = Buffer.from(message);

    // Node.js 16+ has native Ed25519 support
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"), // Ed25519 OID prefix
        keyBuffer,
      ]),
      format: "der",
      type: "spki",
    });

    return crypto.verify(null, msgBuffer, keyObject, sigBuffer);
  } catch {
    return false;
  }
}

// ===================
// Internal Signature Verification Actions
// (Called from http.ts which can't use Node.js crypto directly)
// ===================

export const verifySlackSignatureAction = internalAction({
  args: {
    signingSecret: v.string(),
    requestSignature: v.string(),
    timestamp: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, { signingSecret, requestSignature, timestamp, body }) => {
    return verifySlackSignature(signingSecret, requestSignature, timestamp, body);
  },
});

export const verifyDiscordSignatureAction = internalAction({
  args: {
    publicKey: v.string(),
    signature: v.string(),
    timestamp: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, { publicKey, signature, timestamp, body }) => {
    return verifyDiscordSignature(publicKey, signature, timestamp, body);
  },
});

// ===================
// Slack Message Formatting
// ===================

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
    action_id?: string;
    value?: string;
  }>;
  accessory?: {
    type: string;
    text: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    action_id: string;
    value?: string;
  };
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

export function formatSlackMessage(
  title: string,
  content: string,
  options: {
    url?: string;
    footer?: string;
    fields?: Array<{ label: string; value: string }>;
    actions?: Array<{ text: string; url: string }>;
    color?: "good" | "warning" | "danger";
  } = {}
): SlackMessage {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: truncate(title, 150),
      emoji: true,
    },
  });

  // Main content
  if (content) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncate(content, 3000),
      },
    });
  }

  // Fields (like metadata)
  if (options.fields && options.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: options.fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.label}:*\n${f.value}`,
      })),
    });
  }

  // Action buttons
  if (options.actions && options.actions.length > 0) {
    blocks.push({
      type: "actions",
      elements: options.actions.map((a, i) => ({
        type: "button",
        text: {
          type: "plain_text",
          text: a.text,
          emoji: true,
        },
        url: a.url,
        action_id: `action_${i}`,
      })),
    });
  }

  // Divider before footer
  if (options.footer) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: options.footer,
        },
      ],
    });
  }

  return {
    blocks,
    text: `${title}\n${content}`, // Fallback for notifications
  };
}

export function formatSlackDocumentList(
  documents: Array<{
    _id: string;
    topic: string;
    createdAt: number;
    contentPreview?: string;
  }>,
  baseUrl: string
): SlackMessage {
  if (documents.length === 0) {
    return formatSlackMessage(
      "No Documents Found",
      "You don't have any documents yet. Use `/docusynth generate <topic>` to create one!",
      { footer: "DocuSynth AI" }
    );
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Your Recent Documents (${documents.length})`,
        emoji: true,
      },
    },
  ];

  for (const doc of documents.slice(0, 10)) {
    const date = new Date(doc.createdAt).toLocaleDateString();
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${baseUrl}/documents/${doc._id}|${doc.topic}>*\nCreated: ${date}`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Share",
          emoji: true,
        },
        action_id: `share_${doc._id}`,
        value: doc._id,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "_Use `/docusynth share <doc-id>` to share a document in this channel_",
      },
    ],
  });

  return {
    blocks,
    text: `Found ${documents.length} documents`,
  };
}

export function formatSlackSearchResults(
  query: string,
  results: Array<{
    _id: string;
    topic: string;
    matchSnippet?: string;
    relevanceScore?: number;
  }>,
  baseUrl: string
): SlackMessage {
  if (results.length === 0) {
    return formatSlackMessage(
      `No Results for "${query}"`,
      "Try different keywords or generate new documentation with `/docusynth generate <topic>`",
      { footer: "DocuSynth AI" }
    );
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Search Results for "${truncate(query, 50)}"`,
        emoji: true,
      },
    },
  ];

  for (const result of results.slice(0, 5)) {
    const snippet = result.matchSnippet || "No preview available";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${baseUrl}/documents/${result._id}|${result.topic}>*\n${truncate(snippet, 200)}`,
      },
    });
  }

  if (results.length > 5) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_${results.length - 5} more results not shown_`,
        },
      ],
    });
  }

  return {
    blocks,
    text: `Found ${results.length} results for "${query}"`,
  };
}

export function formatSlackError(message: string): SlackMessage {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:warning: *Error:* ${message}`,
        },
      },
    ],
    text: `Error: ${message}`,
  };
}

export function formatSlackHelp(): SlackMessage {
  const commands = Object.values(BOT_COMMANDS);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "DocuSynth Commands",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Generate token-optimized documentation context for LLMs directly from Slack!",
      },
    },
    { type: "divider" },
  ];

  for (const cmd of commands) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${cmd.usage}*\n${cmd.description}`,
      },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Powered by DocuSynth AI | <https://docusynth.ai|Visit Dashboard>_",
        },
      ],
    }
  );

  return {
    blocks,
    text: "DocuSynth Commands - Use /docusynth help for available commands",
  };
}

// ===================
// Discord Message Formatting
// ===================

const DISCORD_COLORS = {
  primary: 0x5865f2, // Discord blurple
  success: 0x57f287, // Green
  warning: 0xfee75c, // Yellow
  danger: 0xed4245, // Red
  info: 0x5865f2, // Blue
};

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp?: string;
  url?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  thumbnail?: {
    url: string;
  };
}

export function formatDiscordMessage(
  title: string,
  description: string,
  options: {
    url?: string;
    color?: keyof typeof DISCORD_COLORS;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: string;
    thumbnail?: string;
  } = {}
): DiscordMessage {
  const embed: DiscordEmbed = {
    title: truncate(title, 256),
    description: truncate(description, 4096),
    color: DISCORD_COLORS[options.color || "primary"],
    timestamp: new Date().toISOString(),
  };

  if (options.url) {
    embed.url = options.url;
  }

  if (options.fields && options.fields.length > 0) {
    embed.fields = options.fields.slice(0, 25).map((f) => ({
      name: truncate(f.name, 256),
      value: truncate(f.value, 1024),
      inline: f.inline,
    }));
  }

  if (options.footer) {
    embed.footer = { text: truncate(options.footer, 2048) };
  }

  if (options.thumbnail) {
    embed.thumbnail = { url: options.thumbnail };
  }

  return { embeds: [embed] };
}

export function formatDiscordDocumentList(
  documents: Array<{
    _id: string;
    topic: string;
    createdAt: number;
    contentPreview?: string;
  }>,
  baseUrl: string
): DiscordMessage {
  if (documents.length === 0) {
    return formatDiscordMessage(
      "No Documents Found",
      "You don't have any documents yet. Use `/docusynth generate <topic>` to create one!",
      { color: "warning", footer: "DocuSynth AI" }
    );
  }

  const fields = documents.slice(0, 10).map((doc) => ({
    name: doc.topic,
    value: `[View Document](${baseUrl}/documents/${doc._id})\nCreated: <t:${Math.floor(doc.createdAt / 1000)}:R>`,
    inline: true,
  }));

  return formatDiscordMessage(
    `Your Recent Documents (${documents.length})`,
    "Use `/docusynth share <doc-id>` to share a document in this channel",
    {
      color: "primary",
      fields,
      footer: "DocuSynth AI",
    }
  );
}

export function formatDiscordSearchResults(
  query: string,
  results: Array<{
    _id: string;
    topic: string;
    matchSnippet?: string;
    relevanceScore?: number;
  }>,
  baseUrl: string
): DiscordMessage {
  if (results.length === 0) {
    return formatDiscordMessage(
      `No Results for "${query}"`,
      "Try different keywords or generate new documentation with `/docusynth generate <topic>`",
      { color: "warning", footer: "DocuSynth AI" }
    );
  }

  const fields = results.slice(0, 5).map((result) => ({
    name: result.topic,
    value: `${truncate(result.matchSnippet || "No preview", 200)}\n[View](${baseUrl}/documents/${result._id})`,
    inline: false,
  }));

  const description =
    results.length > 5
      ? `Showing top 5 of ${results.length} results`
      : `Found ${results.length} result${results.length > 1 ? "s" : ""}`;

  return formatDiscordMessage(`Search Results: "${truncate(query, 50)}"`, description, {
    color: "success",
    fields,
    footer: "DocuSynth AI",
  });
}

export function formatDiscordError(message: string): DiscordMessage {
  return formatDiscordMessage("Error", message, {
    color: "danger",
    footer: "DocuSynth AI",
  });
}

export function formatDiscordHelp(): DiscordMessage {
  const commands = Object.values(BOT_COMMANDS);

  const fields = commands.map((cmd) => ({
    name: cmd.usage,
    value: cmd.description,
    inline: false,
  }));

  return formatDiscordMessage(
    "DocuSynth Commands",
    "Generate token-optimized documentation context for LLMs directly from Discord!",
    {
      color: "primary",
      fields,
      footer: "Powered by DocuSynth AI | Visit docusynth.ai",
    }
  );
}

export function formatDiscordGenerating(topic: string): DiscordMessage {
  return formatDiscordMessage(
    "Generating Documentation...",
    `Creating documentation for: **${topic}**\n\nThis may take a moment. You'll receive a follow-up message when complete.`,
    {
      color: "info",
      footer: "DocuSynth AI - Generation in progress",
    }
  );
}

// ===================
// Internal Actions for Bot Commands
// ===================

// Handle bot command (internal action)
export const handleBotCommand = internalAction({
  args: {
    platform: v.union(v.literal("slack"), v.literal("discord")),
    command: v.string(),
    args: v.string(),
    teamId: v.optional(v.string()),
    guildId: v.optional(v.string()),
    channelId: v.string(),
    platformUserId: v.string(),
    platformUserName: v.optional(v.string()),
  },
  handler: async (ctx, params) => {
    const startTime = Date.now();
    const baseUrl = process.env.APP_URL || "https://docusynth.ai";

    // Get bot configuration
    const botConfig = await ctx.runQuery(internal.botsQueries.getBotConfig, {
      platform: params.platform,
      teamId: params.teamId,
      guildId: params.guildId,
    });

    if (!botConfig) {
      return params.platform === "slack"
        ? formatSlackError("Bot not configured for this workspace")
        : formatDiscordError("Bot not configured for this server");
    }

    // Check if command is enabled
    if (!botConfig.enabledCommands.includes(params.command)) {
      return params.platform === "slack"
        ? formatSlackError(`Command '${params.command}' is not enabled`)
        : formatDiscordError(`Command '${params.command}' is not enabled`);
    }

    // Get linked user
    const linkedUser = await ctx.runQuery(internal.botsQueries.getLinkedUser, {
      platform: params.platform,
      platformUserId: params.platformUserId,
      teamId: params.teamId,
    });

    // Log the command
    const logId = await ctx.runMutation(internal.botsQueries.logBotCommand, {
      botConfigId: botConfig._id,
      userId: linkedUser?.userId || "anonymous",
      platform: params.platform,
      command: params.command,
      args: params.args,
      channelId: params.channelId,
      platformUserId: params.platformUserId,
      platformUserName: params.platformUserName,
    });

    // Update bot activity
    await ctx.runMutation(internal.botsQueries.updateBotActivity, {
      botConfigId: botConfig._id,
    });

    try {
      let response: SlackMessage | DiscordMessage;

      switch (params.command) {
        case "help": {
          response = params.platform === "slack" ? formatSlackHelp() : formatDiscordHelp();
          break;
        }

        case "link": {
          if (linkedUser) {
            response =
              params.platform === "slack"
                ? formatSlackMessage(
                    "Already Linked",
                    "Your account is already linked to DocuSynth. You can use all commands!",
                    { footer: "DocuSynth AI" }
                  )
                : formatDiscordMessage(
                    "Already Linked",
                    "Your account is already linked to DocuSynth. You can use all commands!",
                    { color: "success", footer: "DocuSynth AI" }
                  );
          } else {
            const linkUrl = `${baseUrl}/link-bot?platform=${params.platform}&user=${params.platformUserId}&team=${params.teamId || params.guildId}`;
            response =
              params.platform === "slack"
                ? formatSlackMessage(
                    "Link Your Account",
                    "Click the button below to link your DocuSynth account.",
                    {
                      actions: [{ text: "Link Account", url: linkUrl }],
                      footer: "DocuSynth AI",
                    }
                  )
                : formatDiscordMessage(
                    "Link Your Account",
                    `[Click here to link your DocuSynth account](${linkUrl})`,
                    { color: "primary", footer: "DocuSynth AI" }
                  );
          }
          break;
        }

        case "search": {
          if (!linkedUser) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please link your account first with `/docusynth link`")
                : formatDiscordError("Please link your account first with `/docusynth link`");
            break;
          }

          if (!params.args.trim()) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please provide a search query: `/docusynth search <query>`")
                : formatDiscordError("Please provide a search query: `/docusynth search <query>`");
            break;
          }

          const searchResults = await ctx.runQuery(internal.botsQueries.searchForBot, {
            userId: linkedUser.userId,
            query: params.args,
          });

          response =
            params.platform === "slack"
              ? formatSlackSearchResults(params.args, searchResults as any, baseUrl)
              : formatDiscordSearchResults(params.args, searchResults as any, baseUrl);
          break;
        }

        case "list": {
          if (!linkedUser) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please link your account first with `/docusynth link`")
                : formatDiscordError("Please link your account first with `/docusynth link`");
            break;
          }

          const documents = await ctx.runQuery(internal.botsQueries.listRecentForBot, {
            userId: linkedUser.userId,
          });

          response =
            params.platform === "slack"
              ? formatSlackDocumentList(documents as any, baseUrl)
              : formatDiscordDocumentList(documents as any, baseUrl);
          break;
        }

        case "share": {
          if (!linkedUser) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please link your account first with `/docusynth link`")
                : formatDiscordError("Please link your account first with `/docusynth link`");
            break;
          }

          if (!params.args.trim()) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please provide a document ID: `/docusynth share <doc-id>`")
                : formatDiscordError("Please provide a document ID: `/docusynth share <doc-id>`");
            break;
          }

          const doc = await ctx.runQuery(internal.botsQueries.getDocumentForShare, {
            userId: linkedUser.userId,
            documentId: params.args.trim(),
          });

          if (!doc) {
            response =
              params.platform === "slack"
                ? formatSlackError("Document not found or you don't have access to it")
                : formatDiscordError("Document not found or you don't have access to it");
            break;
          }

          // Format document for sharing
          const preview = doc.content.substring(0, 500);
          const sourceCount = doc.sources?.length || 0;

          response =
            params.platform === "slack"
              ? formatSlackMessage(doc.topic, preview + (doc.content.length > 500 ? "..." : ""), {
                  url: `${baseUrl}/documents/${doc._id}`,
                  fields: [
                    { label: "Sources", value: `${sourceCount} reference${sourceCount !== 1 ? "s" : ""}` },
                    { label: "Created", value: new Date(doc.createdAt).toLocaleDateString() },
                  ],
                  actions: [{ text: "View Full Document", url: `${baseUrl}/documents/${doc._id}` }],
                  footer: `Shared by ${params.platformUserName || "a team member"} via DocuSynth`,
                })
              : formatDiscordMessage(doc.topic, preview + (doc.content.length > 500 ? "..." : ""), {
                  url: `${baseUrl}/documents/${doc._id}`,
                  color: "primary",
                  fields: [
                    { name: "Sources", value: `${sourceCount} reference${sourceCount !== 1 ? "s" : ""}`, inline: true },
                    {
                      name: "Created",
                      value: `<t:${Math.floor(doc.createdAt / 1000)}:R>`,
                      inline: true,
                    },
                  ],
                  footer: `Shared by ${params.platformUserName || "a team member"} via DocuSynth`,
                });
          break;
        }

        case "generate": {
          if (!linkedUser) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please link your account first with `/docusynth link`")
                : formatDiscordError("Please link your account first with `/docusynth link`");
            break;
          }

          if (!params.args.trim()) {
            response =
              params.platform === "slack"
                ? formatSlackError("Please provide a topic: `/docusynth generate <topic>`")
                : formatDiscordError("Please provide a topic: `/docusynth generate <topic>`");
            break;
          }

          // Start generation in background
          const sessionId = await ctx.runMutation(internal.streaming.createSession, {
            userId: linkedUser.userId,
            topic: params.args,
            mode: "search",
            projectId: undefined,
          });

          // Schedule the generation
          await ctx.scheduler.runAfter(0, internal.streaming.performStreamingGeneration, {
            sessionId,
            userId: linkedUser.userId,
            topic: params.args,
            mode: "search",
          });

          // Return immediate acknowledgment
          response =
            params.platform === "slack"
              ? formatSlackMessage(
                  "Generating Documentation...",
                  `Creating documentation for: *${params.args}*\n\nThis may take a moment. Use \`/docusynth list\` to see your documents when ready.`,
                  { footer: "DocuSynth AI - Generation started" }
                )
              : formatDiscordGenerating(params.args);
          break;
        }

        default: {
          response =
            params.platform === "slack"
              ? formatSlackError(`Unknown command: ${params.command}. Use /docusynth help to see available commands.`)
              : formatDiscordError(`Unknown command: ${params.command}. Use /docusynth help to see available commands.`);
        }
      }

      // Update log with success
      await ctx.runMutation(internal.botsQueries.updateBotCommandLog, {
        logId,
        status: "success",
        responseTimeMs: Date.now() - startTime,
      });

      return response;
    } catch (error: any) {
      // Update log with error
      await ctx.runMutation(internal.botsQueries.updateBotCommandLog, {
        logId,
        status: "failed",
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });

      return params.platform === "slack"
        ? formatSlackError(`An error occurred: ${error.message}`)
        : formatDiscordError(`An error occurred: ${error.message}`);
    }
  },
});

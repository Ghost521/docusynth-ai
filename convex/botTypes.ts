// Bot types and simple formatters - no Node.js dependencies
// These can be imported by http.ts without "use node"

// ===================
// Types
// ===================

export type BotPlatform = "slack" | "discord";

export interface SlackMessage {
  blocks: SlackBlock[];
  text: string; // Fallback text
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: any[];
  accessory?: any;
  fields?: any[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: any[];
}

// Available bot commands
export const BOT_COMMANDS = {
  search: {
    name: "search",
    description: "Search documents by keyword",
    usage: "/docusynth search <query>",
  },
  generate: {
    name: "generate",
    description: "Generate new documentation",
    usage: "/docusynth generate <topic>",
  },
  list: {
    name: "list",
    description: "List recent documents",
    usage: "/docusynth list",
  },
  share: {
    name: "share",
    description: "Share a document in the channel",
    usage: "/docusynth share <doc-id>",
  },
  help: {
    name: "help",
    description: "Show available commands",
    usage: "/docusynth help",
  },
  link: {
    name: "link",
    description: "Link your DocuSynth account",
    usage: "/docusynth link",
  },
} as const;

// ===================
// Simple Formatters (no crypto needed)
// ===================

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

export function formatDiscordError(message: string): DiscordMessage {
  return {
    embeds: [
      {
        title: "Error",
        description: message,
        color: 0xff4444,
        footer: { text: "DocuSynth AI" },
      },
    ],
  };
}

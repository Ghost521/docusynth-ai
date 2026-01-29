/**
 * Shared response templates for Slack and Discord bots
 *
 * This file contains reusable response templates and formatting utilities
 * that can be used across both Slack and Discord integrations.
 */

// ===================
// Response Templates
// ===================

export const RESPONSE_TEMPLATES = {
  // Welcome messages
  WELCOME: {
    title: "Welcome to DocuSynth!",
    description: "I help you generate token-optimized documentation context for LLMs.",
    features: [
      "Search your existing documentation",
      "Generate new docs from any topic",
      "Import from GitHub repositories",
      "Share docs directly in chat",
    ],
  },

  // Error messages
  ERRORS: {
    NOT_LINKED: {
      title: "Account Not Linked",
      description: "Please link your DocuSynth account first to use this command.",
      action: "Use `/docusynth link` to connect your account.",
    },
    NOT_FOUND: {
      title: "Document Not Found",
      description: "The requested document could not be found.",
      action: "Use `/docusynth list` to see your available documents.",
    },
    NO_PERMISSION: {
      title: "Permission Denied",
      description: "You don't have permission to access this document.",
      action: "Contact the document owner or check visibility settings.",
    },
    RATE_LIMITED: {
      title: "Rate Limited",
      description: "You've made too many requests. Please wait a moment.",
      action: "Wait a few minutes and try again.",
    },
    GENERATION_FAILED: {
      title: "Generation Failed",
      description: "Unable to generate documentation at this time.",
      action: "Try again later or contact support if the issue persists.",
    },
    INVALID_COMMAND: {
      title: "Invalid Command",
      description: "The command or arguments provided are not valid.",
      action: "Use `/docusynth help` to see available commands.",
    },
    SERVER_ERROR: {
      title: "Server Error",
      description: "An unexpected error occurred.",
      action: "Please try again later. If the issue persists, contact support.",
    },
  },

  // Success messages
  SUCCESS: {
    LINKED: {
      title: "Account Linked!",
      description: "Your account has been successfully linked to DocuSynth.",
      action: "You can now use all DocuSynth commands.",
    },
    GENERATION_STARTED: {
      title: "Generating Documentation...",
      description: "Your documentation is being generated.",
      action: "This may take a moment. You'll be notified when it's ready.",
    },
    DOCUMENT_SHARED: {
      title: "Document Shared",
      description: "The document has been shared in this channel.",
    },
  },

  // Help content
  HELP: {
    title: "DocuSynth Commands",
    description: "Generate token-optimized documentation context for LLMs",
    commands: [
      {
        name: "search",
        usage: "/docusynth search <query>",
        description: "Search your documents by keyword or topic",
        example: "/docusynth search react authentication",
      },
      {
        name: "generate",
        usage: "/docusynth generate <topic>",
        description: "Generate new documentation for any topic",
        example: "/docusynth generate Next.js 14 server components",
      },
      {
        name: "list",
        usage: "/docusynth list",
        description: "Show your most recent documents",
        example: "/docusynth list",
      },
      {
        name: "share",
        usage: "/docusynth share <doc-id>",
        description: "Share a document in the current channel",
        example: "/docusynth share abc123xyz",
      },
      {
        name: "link",
        usage: "/docusynth link",
        description: "Link your chat account to DocuSynth",
        example: "/docusynth link",
      },
      {
        name: "help",
        usage: "/docusynth help",
        description: "Show this help message",
        example: "/docusynth help",
      },
    ],
  },
} as const;

// ===================
// Formatting Utilities
// ===================

/**
 * Truncates text to a maximum length, adding ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Formats a timestamp as a relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Formats a document for display
 */
export function formatDocumentSummary(doc: {
  _id: string;
  topic: string;
  content: string;
  sources?: Array<{ title: string; url: string }>;
  createdAt: number;
}): {
  title: string;
  preview: string;
  sourceCount: number;
  createdAt: string;
} {
  return {
    title: doc.topic,
    preview: truncateText(doc.content, 300),
    sourceCount: doc.sources?.length || 0,
    createdAt: formatRelativeTime(doc.createdAt),
  };
}

/**
 * Formats search results for display
 */
export function formatSearchResults(
  query: string,
  results: Array<{
    _id: string;
    topic: string;
    matchSnippet?: string;
    relevanceScore?: number;
  }>
): {
  title: string;
  count: number;
  items: Array<{
    id: string;
    topic: string;
    snippet: string;
    score?: number;
  }>;
} {
  return {
    title: `Search Results for "${truncateText(query, 50)}"`,
    count: results.length,
    items: results.map((r) => ({
      id: r._id,
      topic: r.topic,
      snippet: truncateText(r.matchSnippet || "No preview available", 200),
      score: r.relevanceScore,
    })),
  };
}

// ===================
// Color Schemes
// ===================

export const COLORS = {
  // Primary brand colors
  primary: {
    hex: "#6366f1",
    slack: "good",
    discord: 0x6366f1,
  },
  // Success
  success: {
    hex: "#22c55e",
    slack: "good",
    discord: 0x22c55e,
  },
  // Warning
  warning: {
    hex: "#f59e0b",
    slack: "warning",
    discord: 0xf59e0b,
  },
  // Error
  error: {
    hex: "#ef4444",
    slack: "danger",
    discord: 0xef4444,
  },
  // Info
  info: {
    hex: "#3b82f6",
    slack: "good",
    discord: 0x3b82f6,
  },
} as const;

// ===================
// Platform Detection
// ===================

export type Platform = "slack" | "discord";

export function isPlatformSlack(platform: string): platform is "slack" {
  return platform === "slack";
}

export function isPlatformDiscord(platform: string): platform is "discord" {
  return platform === "discord";
}

// ===================
// Validation Utilities
// ===================

/**
 * Validates a document ID format
 */
export function isValidDocumentId(id: string): boolean {
  // Convex IDs are alphanumeric strings
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
}

/**
 * Validates a search query
 */
export function isValidSearchQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length >= 2 && trimmed.length <= 500;
}

/**
 * Validates a generation topic
 */
export function isValidGenerationTopic(topic: string): boolean {
  const trimmed = topic.trim();
  return trimmed.length >= 3 && trimmed.length <= 1000;
}

// ===================
// Rate Limiting Helpers
// ===================

export const RATE_LIMITS = {
  // Commands per minute per user
  COMMANDS_PER_MINUTE: 10,
  // Generation requests per hour per user
  GENERATIONS_PER_HOUR: 20,
  // Search requests per minute per user
  SEARCHES_PER_MINUTE: 30,
} as const;

/**
 * Creates a rate limit key for a user and action
 */
export function createRateLimitKey(
  platform: Platform,
  userId: string,
  action: string
): string {
  return `${platform}:${userId}:${action}`;
}

// ===================
// Markdown Utilities
// ===================

/**
 * Escapes markdown special characters
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[*_`~|]/g, "\\$&");
}

/**
 * Converts markdown to plain text
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, "") // Headers
    .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
    .replace(/\*(.+?)\*/g, "$1") // Italic
    .replace(/`(.+?)`/g, "$1") // Code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
    .replace(/^\s*[-*+]\s/gm, "") // List items
    .replace(/^\s*\d+\.\s/gm, "") // Numbered lists
    .replace(/>\s/g, ""); // Blockquotes
}

// ===================
// URL Utilities
// ===================

/**
 * Creates a document URL
 */
export function createDocumentUrl(baseUrl: string, documentId: string): string {
  return `${baseUrl}/documents/${documentId}`;
}

/**
 * Creates a link URL for account linking
 */
export function createLinkUrl(
  baseUrl: string,
  platform: Platform,
  userId: string,
  teamOrGuildId: string
): string {
  const params = new URLSearchParams({
    platform,
    user: userId,
    team: teamOrGuildId,
  });
  return `${baseUrl}/link-bot?${params.toString()}`;
}

// ===================
// Export Types
// ===================

export type ResponseTemplate = typeof RESPONSE_TEMPLATES;
export type ErrorKey = keyof typeof RESPONSE_TEMPLATES.ERRORS;
export type SuccessKey = keyof typeof RESPONSE_TEMPLATES.SUCCESS;
export type ColorKey = keyof typeof COLORS;

/**
 * Client-side chat utilities and helpers for the AI Chat Interface
 */

import { Id } from "../convex/_generated/dataModel";

// ===============================================================
// Types
// ===============================================================

export interface ChatExportData {
  title: string;
  type: string;
  createdAt: string;
  messages: Array<{
    role: string;
    content: string;
    sources?: Array<{
      documentTitle: string;
      snippet: string;
      relevanceScore: number;
    }>;
    timestamp: string;
  }>;
}

// ===============================================================
// Token Estimation
// ===============================================================

/**
 * Estimate the number of tokens in a text.
 * Uses the rough approximation of 1 token ≈ 4 characters for English.
 * This is a client-side estimation - the actual tokenization on the server
 * may differ slightly depending on the model used.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Format a token count for display.
 * Examples: "1,234", "12.3K", "1.2M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

/**
 * Get context window utilization percentage.
 */
export function getContextUtilization(usedTokens: number, maxTokens: number): number {
  if (maxTokens <= 0) return 0;
  return Math.min(100, Math.round((usedTokens / maxTokens) * 100));
}

// ===============================================================
// Message Formatting
// ===============================================================

/**
 * Format a timestamp for chat display.
 * Shows time for today, day name for this week, or date for older.
 */
export function formatChatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

/**
 * Format a full timestamp for tooltips.
 */
export function formatFullTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ===============================================================
// Content Processing
// ===============================================================

/**
 * Extract a snippet from text around a keyword match.
 */
export function extractSnippet(
  text: string,
  keyword: string,
  maxLength: number = 200
): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const position = lowerText.indexOf(lowerKeyword);

  if (position === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, position - 50);
  const end = Math.min(text.length, position + maxLength - 50);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Truncate text to a maximum length, respecting word boundaries.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

// ===============================================================
// Source Citation Helpers
// ===============================================================

/**
 * Get relevance indicator color and label for a score.
 */
export function getRelevanceIndicator(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 0.8) {
    return { label: "High", color: "text-green-500", bgColor: "bg-green-500" };
  }
  if (score >= 0.5) {
    return { label: "Medium", color: "text-amber-500", bgColor: "bg-amber-500" };
  }
  return { label: "Low", color: "text-red-500", bgColor: "bg-red-500" };
}

/**
 * Format relevance score as percentage.
 */
export function formatRelevanceScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// ===============================================================
// Export Utilities
// ===============================================================

/**
 * Generate a filename for chat export.
 */
export function generateExportFilename(
  title: string,
  format: "markdown" | "json" | "text"
): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const timestamp = new Date().toISOString().split("T")[0];
  const extension = format === "markdown" ? "md" : format;

  return `chat-${sanitized}-${timestamp}.${extension}`;
}

/**
 * Download content as a file.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ===============================================================
// Keyboard Shortcuts
// ===============================================================

/**
 * Chat keyboard shortcuts configuration.
 */
export const CHAT_SHORTCUTS = {
  send: { key: "Enter", description: "Send message" },
  newLine: { key: "Shift+Enter", description: "New line" },
  newChat: { key: "Ctrl+N", description: "New conversation" },
  clearChat: { key: "Ctrl+L", description: "Clear chat" },
  toggleSidebar: { key: "Ctrl+B", description: "Toggle sidebar" },
  toggleContext: { key: "Ctrl+I", description: "Toggle context panel" },
  focusInput: { key: "/", description: "Focus chat input" },
} as const;

// ===============================================================
// Local Storage Keys
// ===============================================================

export const CHAT_STORAGE_KEYS = {
  sidebarCollapsed: "docu_synth_chat_sidebar_collapsed",
  contextPanelCollapsed: "docu_synth_chat_context_collapsed",
  lastConversationId: "docu_synth_chat_last_conversation",
  preferredProvider: "docu_synth_chat_preferred_provider",
} as const;

/**
 * Save a chat preference to localStorage.
 */
export function saveChatPreference(key: keyof typeof CHAT_STORAGE_KEYS, value: string): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEYS[key], value);
  } catch (e) {
    console.error("Failed to save chat preference:", e);
  }
}

/**
 * Load a chat preference from localStorage.
 */
export function loadChatPreference(key: keyof typeof CHAT_STORAGE_KEYS): string | null {
  try {
    return localStorage.getItem(CHAT_STORAGE_KEYS[key]);
  } catch (e) {
    console.error("Failed to load chat preference:", e);
    return null;
  }
}

// ===============================================================
// Suggested Questions Generation
// ===============================================================

/**
 * Default suggested questions by chat type.
 */
export function getDefaultSuggestions(
  chatType: "document" | "project" | "knowledge_base" | "general"
): string[] {
  switch (chatType) {
    case "document":
      return [
        "What are the key features?",
        "Show me a code example",
        "What are the best practices?",
        "Explain the main concepts",
      ];
    case "project":
      return [
        "Summarize this project",
        "How do these docs relate?",
        "What patterns are used?",
        "What topics are covered?",
      ];
    case "knowledge_base":
      return [
        "Find documents about...",
        "Compare concepts across docs",
        "What topics can I explore?",
        "Show me related documents",
      ];
    default:
      return [
        "What can you help me with?",
        "Search for information about...",
        "Explain a concept",
        "Generate documentation for...",
      ];
  }
}

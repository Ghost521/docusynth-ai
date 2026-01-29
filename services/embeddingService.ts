/**
 * Client-side embedding utilities for DocuSynth AI
 * Provides constants and helper functions for semantic search
 */

// ═══════════════════════════════════════════════════════════════
// Embedding Configuration Constants
// ═══════════════════════════════════════════════════════════════

export const EMBEDDING_CONFIG = {
  // OpenAI text-embedding-3-small dimensions
  DIMENSION: 1536,
  // Max tokens per chunk (leaving room for overlap)
  CHUNK_SIZE: 500,
  // Overlap between chunks for context continuity
  CHUNK_OVERLAP: 50,
  // Minimum similarity score for search results (0-1)
  MIN_SIMILARITY: 0.5,
  // Default number of results
  DEFAULT_LIMIT: 10,
  // Model identifier
  MODEL: "text-embedding-3-small",
} as const;

// ═══════════════════════════════════════════════════════════════
// Search Mode Types
// ═══════════════════════════════════════════════════════════════

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SearchOptions {
  mode: SearchMode;
  limit?: number;
  projectId?: string;
  visibility?: "public" | "private" | "workspace";
  sourceType?: string;
  minScore?: number;
  semanticWeight?: number; // For hybrid search: 0-1
}

export interface SearchResult {
  documentId: string;
  topic: string;
  content: string;
  contentPreview: string;
  projectId?: string;
  visibility: "public" | "private" | "workspace";
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
  searchType: SearchMode;
}

// ═══════════════════════════════════════════════════════════════
// Similarity Calculation Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 is identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Euclidean distance between two vectors.
 * Lower values indicate more similarity.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }

  return Math.sqrt(sum);
}

/**
 * Convert Euclidean distance to a similarity score (0-1).
 */
export function euclideanToSimilarity(distance: number): number {
  return 1 / (1 + distance);
}

// ═══════════════════════════════════════════════════════════════
// Query Preprocessing
// ═══════════════════════════════════════════════════════════════

/**
 * Preprocess a search query for better results.
 * - Removes extra whitespace
 * - Normalizes case for keyword matching
 * - Expands common abbreviations
 */
export function preprocessQuery(query: string): string {
  let processed = query.trim();

  // Normalize whitespace
  processed = processed.replace(/\s+/g, " ");

  // Common tech abbreviations to expand for better semantic understanding
  const abbreviations: Record<string, string> = {
    "js": "JavaScript",
    "ts": "TypeScript",
    "py": "Python",
    "api": "API application programming interface",
    "ui": "user interface",
    "ux": "user experience",
    "db": "database",
    "sql": "SQL structured query language",
    "nosql": "NoSQL non-relational database",
    "auth": "authentication authorization",
    "deps": "dependencies",
    "env": "environment",
    "config": "configuration",
    "docs": "documentation",
    "repo": "repository",
  };

  // Add abbreviation expansions for better semantic matching
  // (while keeping the original term)
  const words = processed.toLowerCase().split(/\s+/);
  const expansions: string[] = [];

  for (const word of words) {
    if (abbreviations[word] && !processed.toLowerCase().includes(abbreviations[word].toLowerCase())) {
      expansions.push(abbreviations[word]);
    }
  }

  if (expansions.length > 0) {
    processed = `${processed} ${expansions.join(" ")}`;
  }

  return processed;
}

/**
 * Extract key terms from a query for highlighting.
 */
export function extractKeyTerms(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "this",
    "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "what", "which", "who", "whom", "how", "when", "where", "why",
  ]);

  const words = query.toLowerCase().split(/\s+/);
  return words.filter(word => word.length > 1 && !stopWords.has(word));
}

// ═══════════════════════════════════════════════════════════════
// Result Processing
// ═══════════════════════════════════════════════════════════════

/**
 * Highlight matching terms in text.
 */
export function highlightMatches(text: string, terms: string[]): string {
  let result = text;

  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    result = result.replace(regex, "**$1**");
  }

  return result;
}

/**
 * Extract a snippet around the first matching term.
 */
export function extractSnippet(
  text: string,
  terms: string[],
  maxLength: number = 200
): string {
  const textLower = text.toLowerCase();

  // Find the first matching term position
  let matchPosition = -1;
  for (const term of terms) {
    const pos = textLower.indexOf(term.toLowerCase());
    if (pos !== -1 && (matchPosition === -1 || pos < matchPosition)) {
      matchPosition = pos;
    }
  }

  if (matchPosition === -1) {
    // No match found, return the beginning
    return text.substring(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  // Extract snippet centered around the match
  const halfLength = Math.floor(maxLength / 2);
  const start = Math.max(0, matchPosition - halfLength);
  const end = Math.min(text.length, matchPosition + halfLength);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Score result relevance based on multiple factors.
 */
export function calculateRelevanceScore(
  result: {
    vectorScore?: number;
    keywordScore?: number;
    recency?: number; // 0-1, where 1 is most recent
    popularity?: number; // 0-1, based on views/usage
  },
  weights: {
    vector?: number;
    keyword?: number;
    recency?: number;
    popularity?: number;
  } = {}
): number {
  const {
    vector = 0.5,
    keyword = 0.3,
    recency = 0.1,
    popularity = 0.1,
  } = weights;

  let score = 0;
  let totalWeight = 0;

  if (result.vectorScore !== undefined) {
    score += result.vectorScore * vector;
    totalWeight += vector;
  }

  if (result.keywordScore !== undefined) {
    score += result.keywordScore * keyword;
    totalWeight += keyword;
  }

  if (result.recency !== undefined) {
    score += result.recency * recency;
    totalWeight += recency;
  }

  if (result.popularity !== undefined) {
    score += result.popularity * popularity;
    totalWeight += popularity;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Estimate token count for a text (rough approximation).
 * OpenAI uses ~4 characters per token on average.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a token limit.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  return text.substring(0, maxChars - 3) + "...";
}

/**
 * Format relevance score as a percentage.
 */
export function formatRelevanceScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get a human-readable description of search mode.
 */
export function getSearchModeDescription(mode: SearchMode): string {
  switch (mode) {
    case "keyword":
      return "Keyword search matches exact words in your documents";
    case "semantic":
      return "Semantic search understands meaning and finds related content";
    case "hybrid":
      return "Hybrid search combines keyword and semantic matching for best results";
  }
}

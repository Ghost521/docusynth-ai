/**
 * Content Extractor Service
 *
 * Client-side utilities for content extraction and processing.
 * Provides functions for DOM cleaning, content extraction, and preview generation.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractedPageContent {
  title: string;
  description?: string;
  content: string;
  markdown: string;
  links: string[];
  images: { src: string; alt: string }[];
  codeBlocks: { language: string; code: string }[];
  wordCount: number;
  readingTimeMinutes: number;
}

export interface ContentPreview {
  title: string;
  description: string;
  wordCount: number;
  linkCount: number;
  imageCount: number;
  codeBlockCount: number;
  estimatedReadTime: string;
}

export interface UrlValidationResult {
  valid: boolean;
  normalized: string;
  domain: string;
  protocol: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// URL Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate and normalize a URL
 */
export function validateUrl(url: string): UrlValidationResult {
  try {
    // Add protocol if missing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const parsed = new URL(normalizedUrl);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalized: url,
        domain: '',
        protocol: '',
        error: 'Only HTTP and HTTPS URLs are supported',
      };
    }

    // Normalize
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Remove trailing slash from path (except for root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return {
      valid: true,
      normalized: parsed.toString(),
      domain: parsed.hostname,
      protocol: parsed.protocol.slice(0, -1), // Remove trailing colon
    };
  } catch {
    return {
      valid: false,
      normalized: url,
      domain: '',
      protocol: '',
      error: 'Invalid URL format',
    };
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  return extractDomain(url1) === extractDomain(url2);
}

/**
 * Check if URL matches any pattern in a list
 */
export function matchesPatterns(url: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, 'i').test(url)) {
        return true;
      }
    } catch {
      // If regex is invalid, try simple includes
      if (url.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Content Preview Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a preview summary from markdown content
 */
export function generateContentPreview(markdown: string): ContentPreview {
  // Extract title (first heading)
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  // Extract description (first paragraph after title)
  const descriptionMatch = markdown.match(/^(?:#[^\n]*\n+)?(.{1,200})/s);
  let description = descriptionMatch ? descriptionMatch[1].trim() : '';
  description = description.replace(/^#+\s*/, ''); // Remove heading markers
  if (description.length === 200) {
    description += '...';
  }

  // Count words
  const words = markdown.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Count links
  const linkMatches = markdown.match(/\[([^\]]+)\]\([^)]+\)/g) || [];
  const linkCount = linkMatches.length;

  // Count images
  const imageMatches = markdown.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
  const imageCount = imageMatches.length;

  // Count code blocks
  const codeBlockMatches = markdown.match(/```[\s\S]*?```/g) || [];
  const codeBlockCount = codeBlockMatches.length;

  // Estimate reading time (average 200 words per minute)
  const readingMinutes = Math.ceil(wordCount / 200);
  const estimatedReadTime =
    readingMinutes === 1 ? '1 min read' : `${readingMinutes} min read`;

  return {
    title,
    description,
    wordCount,
    linkCount,
    imageCount,
    codeBlockCount,
    estimatedReadTime,
  };
}

/**
 * Extract table of contents from markdown
 */
export function extractTableOfContents(
  markdown: string
): { level: number; text: string; slug: string }[] {
  const headings: { level: number; text: string; slug: string }[] = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    headings.push({ level, text, slug });
  }

  return headings;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pattern Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse patterns from comma-separated string
 */
export function parsePatterns(patternsString: string): string[] {
  if (!patternsString.trim()) return [];

  return patternsString
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Validate a regex pattern
 */
export function validatePattern(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid pattern',
    };
  }
}

/**
 * Common exclude patterns for web crawling
 */
export const COMMON_EXCLUDE_PATTERNS = [
  // Authentication
  'login',
  'signin',
  'signup',
  'register',
  'auth',
  'oauth',
  // Non-content pages
  'pricing',
  'terms',
  'privacy',
  'legal',
  'cookie',
  // Admin/internal
  'admin',
  'dashboard',
  'settings',
  'account',
  // E-commerce
  'cart',
  'checkout',
  'order',
  // Social/share
  'share',
  'social',
  'twitter',
  'facebook',
  'linkedin',
  // Misc
  '404',
  'error',
  'search\\?',
  'feed',
  'rss',
  'sitemap',
];

/**
 * Common include patterns for documentation sites
 */
export const DOC_INCLUDE_PATTERNS = [
  '/docs?/',
  '/api/',
  '/guide/',
  '/tutorial/',
  '/reference/',
  '/getting-started/',
  '/quickstart/',
  '/introduction/',
  '/overview/',
  '/concepts/',
  '/examples/',
];

// ═══════════════════════════════════════════════════════════════════════════
// Crawl Configuration Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estimate crawl duration based on settings
 */
export function estimateCrawlDuration(
  maxPages: number,
  delayMs: number,
  averagePageFetchMs: number = 2000
): string {
  const totalMs = maxPages * (delayMs + averagePageFetchMs);
  const totalSeconds = Math.ceil(totalMs / 1000);

  if (totalSeconds < 60) {
    return `~${totalSeconds}s`;
  }

  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) {
    return `~${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `~${hours} hr`;
  }
  return `~${hours}h ${remainingMinutes}m`;
}

/**
 * Get recommended settings based on site type
 */
export function getRecommendedSettings(siteType: 'documentation' | 'blog' | 'general' | 'api'): {
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  domainRestriction: 'same' | 'subdomains' | 'any';
  includePatterns: string[];
  excludePatterns: string[];
} {
  switch (siteType) {
    case 'documentation':
      return {
        maxPages: 100,
        maxDepth: 4,
        delayMs: 1000,
        domainRestriction: 'subdomains',
        includePatterns: DOC_INCLUDE_PATTERNS,
        excludePatterns: COMMON_EXCLUDE_PATTERNS,
      };

    case 'api':
      return {
        maxPages: 50,
        maxDepth: 3,
        delayMs: 1500,
        domainRestriction: 'same',
        includePatterns: ['/api/', '/reference/', '/endpoints/', '/sdk/'],
        excludePatterns: [...COMMON_EXCLUDE_PATTERNS, 'changelog', 'blog'],
      };

    case 'blog':
      return {
        maxPages: 30,
        maxDepth: 2,
        delayMs: 2000,
        domainRestriction: 'same',
        includePatterns: ['/blog/', '/posts/', '/articles/'],
        excludePatterns: [...COMMON_EXCLUDE_PATTERNS, 'tag/', 'category/', 'author/'],
      };

    case 'general':
    default:
      return {
        maxPages: 50,
        maxDepth: 3,
        delayMs: 1500,
        domainRestriction: 'same',
        includePatterns: [],
        excludePatterns: COMMON_EXCLUDE_PATTERNS,
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Format Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Helpers
// ═══════════════════════════════════════════════════════════════════════════

export type CrawlJobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Get status color for UI display
 */
export function getStatusColor(status: CrawlJobStatus): string {
  switch (status) {
    case 'idle':
      return 'text-secondary';
    case 'queued':
      return 'text-yellow-500';
    case 'running':
      return 'text-primary';
    case 'paused':
      return 'text-orange-500';
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    case 'cancelled':
      return 'text-secondary';
    default:
      return 'text-secondary';
  }
}

/**
 * Get status background color for badges
 */
export function getStatusBgColor(status: CrawlJobStatus): string {
  switch (status) {
    case 'idle':
      return 'bg-secondary/10';
    case 'queued':
      return 'bg-yellow-500/10';
    case 'running':
      return 'bg-primary/10';
    case 'paused':
      return 'bg-orange-500/10';
    case 'completed':
      return 'bg-green-500/10';
    case 'failed':
      return 'bg-red-500/10';
    case 'cancelled':
      return 'bg-secondary/10';
    default:
      return 'bg-secondary/10';
  }
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: CrawlJobStatus): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'queued':
      return 'Starting...';
    case 'running':
      return 'Crawling';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

/**
 * Check if job is in a terminal state
 */
export function isTerminalStatus(status: CrawlJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Check if job can be started
 */
export function canStartJob(status: CrawlJobStatus): boolean {
  return status === 'idle' || status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Check if job can be paused
 */
export function canPauseJob(status: CrawlJobStatus): boolean {
  return status === 'running' || status === 'queued';
}

/**
 * Check if job can be resumed
 */
export function canResumeJob(status: CrawlJobStatus): boolean {
  return status === 'paused';
}

/**
 * Check if job can be cancelled
 */
export function canCancelJob(status: CrawlJobStatus): boolean {
  return status === 'running' || status === 'queued' || status === 'paused';
}

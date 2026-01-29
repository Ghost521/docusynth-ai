/**
 * Crawler Utility Functions
 *
 * This module provides utility functions for the advanced web crawler:
 * - robots.txt parsing
 * - sitemap parsing
 * - content extraction
 * - HTML to markdown conversion
 * - URL normalization and filtering
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface RobotsTxtRules {
  allowedPaths: string[];
  disallowedPaths: string[];
  crawlDelay?: number;
  sitemaps: string[];
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
  changefreq?: string;
}

export interface ExtractedContent {
  title: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  content: string;
  markdown: string;
  links: string[];
  images: { src: string; alt: string }[];
  codeBlocks: { language: string; code: string }[];
  tables: string[][];
  structuredData?: Record<string, unknown>;
  wordCount: number;
}

export interface CrawlConfig {
  includePatterns: string[];
  excludePatterns: string[];
  domainRestriction: "same" | "subdomains" | "any";
  maxDepth: number;
  contentTypes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// URL Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a URL to a canonical form for deduplication
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }

    // Remove trailing slash from path (except for root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Sort query parameters
    const params = new URLSearchParams(parsed.search);
    const sortedParams = new URLSearchParams();
    [...params.keys()].sort().forEach((key) => {
      const values = params.getAll(key);
      values.forEach((value) => sortedParams.append(key, value));
    });
    parsed.search = sortedParams.toString();

    // Remove fragments
    parsed.hash = "";

    // Remove common tracking parameters
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "ref", "_ga", "mc_eid"
    ];
    trackingParams.forEach((param) => {
      const searchParams = new URLSearchParams(parsed.search);
      searchParams.delete(param);
      parsed.search = searchParams.toString();
    });

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract the domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Extract the base domain (without subdomains) from a URL
 */
export function extractBaseDomain(url: string): string {
  const hostname = extractDomain(url);
  if (!hostname) return "";

  // Handle IP addresses
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return hostname;
  }

  // Split by dots and get last two parts (or more for ccTLDs)
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;

  // Common two-part TLDs
  const twoPartTLDs = ["co.uk", "com.au", "co.nz", "co.jp", "co.in", "gov.uk"];
  const lastTwo = parts.slice(-2).join(".");

  if (twoPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

/**
 * Check if a URL matches the domain restriction
 */
export function matchesDomainRestriction(
  url: string,
  startUrl: string,
  restriction: "same" | "subdomains" | "any"
): boolean {
  if (restriction === "any") return true;

  const urlDomain = extractDomain(url);
  const startDomain = extractDomain(startUrl);

  if (restriction === "same") {
    return urlDomain === startDomain;
  }

  // subdomains - match base domain
  const urlBase = extractBaseDomain(url);
  const startBase = extractBaseDomain(startUrl);
  return urlBase === startBase;
}

/**
 * Check if a URL should be crawled based on configuration
 */
export function shouldCrawl(
  url: string,
  startUrl: string,
  config: CrawlConfig,
  currentDepth: number,
  robotsRules?: RobotsTxtRules
): { allowed: boolean; reason?: string } {
  // Check depth
  if (currentDepth > config.maxDepth) {
    return { allowed: false, reason: "Exceeds max depth" };
  }

  // Check domain restriction
  if (!matchesDomainRestriction(url, startUrl, config.domainRestriction)) {
    return { allowed: false, reason: "Domain restriction" };
  }

  // Check robots.txt rules
  if (robotsRules) {
    const path = new URL(url).pathname;

    // Check disallowed paths
    for (const pattern of robotsRules.disallowedPaths) {
      if (pathMatchesPattern(path, pattern)) {
        // Check if there's an explicit allow that overrides
        let isAllowed = false;
        for (const allowPattern of robotsRules.allowedPaths) {
          if (pathMatchesPattern(path, allowPattern) && allowPattern.length > pattern.length) {
            isAllowed = true;
            break;
          }
        }
        if (!isAllowed) {
          return { allowed: false, reason: "Blocked by robots.txt" };
        }
      }
    }
  }

  // Check include patterns (if any, URL must match at least one)
  if (config.includePatterns.length > 0) {
    const matches = config.includePatterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(url);
      } catch {
        return url.includes(pattern);
      }
    });
    if (!matches) {
      return { allowed: false, reason: "Does not match include patterns" };
    }
  }

  // Check exclude patterns
  for (const pattern of config.excludePatterns) {
    try {
      if (new RegExp(pattern, "i").test(url)) {
        return { allowed: false, reason: `Matches exclude pattern: ${pattern}` };
      }
    } catch {
      if (url.includes(pattern)) {
        return { allowed: false, reason: `Contains excluded text: ${pattern}` };
      }
    }
  }

  // Check for non-content pages
  const nonContentPatterns = [
    /\/login\/?$/i,
    /\/signin\/?$/i,
    /\/signup\/?$/i,
    /\/register\/?$/i,
    /\/auth\/?/i,
    /\/404\/?$/i,
    /\/500\/?$/i,
    /\/error\/?$/i,
    /\/cart\/?$/i,
    /\/checkout\/?$/i,
    /\/admin\/?/i,
    /\/wp-admin\/?/i,
    /\.(jpg|jpeg|png|gif|svg|ico|pdf|zip|tar|gz|exe|dmg|mp3|mp4|avi|mov)$/i,
  ];

  for (const pattern of nonContentPatterns) {
    if (pattern.test(url)) {
      return { allowed: false, reason: "Non-content page detected" };
    }
  }

  return { allowed: true };
}

/**
 * Check if a path matches a robots.txt pattern
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
  // Convert robots.txt pattern to regex
  // * matches any sequence of characters
  // $ at end means exact match
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special chars except *
    .replace(/\*/g, ".*");

  if (!regexPattern.endsWith("$")) {
    regexPattern = `^${regexPattern}`;
  } else {
    regexPattern = `^${regexPattern.slice(0, -1)}$`;
  }

  try {
    return new RegExp(regexPattern).test(path);
  } catch {
    return path.startsWith(pattern.replace("*", ""));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Robots.txt Parsing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse robots.txt content
 */
export function parseRobotsTxt(content: string, userAgent = "*"): RobotsTxtRules {
  const rules: RobotsTxtRules = {
    allowedPaths: [],
    disallowedPaths: [],
    sitemaps: [],
  };

  if (!content) return rules;

  const lines = content.split("\n").map((line) => line.trim());
  let currentUserAgent = "";
  let isRelevantSection = false;

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line || line.startsWith("#")) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (directive === "user-agent") {
      currentUserAgent = value.toLowerCase();
      // Check if this section applies to us
      isRelevantSection =
        currentUserAgent === "*" ||
        currentUserAgent === userAgent.toLowerCase() ||
        userAgent.toLowerCase().includes(currentUserAgent);
    } else if (directive === "sitemap") {
      // Sitemaps are global, not user-agent specific
      if (value && !rules.sitemaps.includes(value)) {
        rules.sitemaps.push(value);
      }
    } else if (isRelevantSection) {
      if (directive === "allow" && value) {
        rules.allowedPaths.push(value);
      } else if (directive === "disallow" && value) {
        rules.disallowedPaths.push(value);
      } else if (directive === "crawl-delay") {
        const delay = parseInt(value, 10);
        if (!isNaN(delay)) {
          rules.crawlDelay = delay * 1000; // Convert to ms
        }
      }
    }
  }

  return rules;
}

/**
 * Fetch and parse robots.txt for a domain
 */
export async function fetchRobotsTxt(url: string): Promise<RobotsTxtRules | null> {
  try {
    const domain = extractDomain(url);
    const protocol = new URL(url).protocol;
    const robotsUrl = `${protocol}//${domain}/robots.txt`;

    const response = await fetch(robotsUrl, {
      headers: {
        "User-Agent": "DocuSynth-Crawler/1.0 (+https://docusynth.ai/bot)",
      },
    });

    if (!response.ok) {
      // No robots.txt means everything is allowed
      return null;
    }

    const content = await response.text();
    return parseRobotsTxt(content);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sitemap Parsing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a sitemap XML content
 */
export function parseSitemap(content: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  // Simple XML parsing without dependencies
  // Match <url> elements
  const urlMatches = content.matchAll(/<url[^>]*>([\s\S]*?)<\/url>/gi);

  for (const match of urlMatches) {
    const urlContent = match[1];

    // Extract loc (required)
    const locMatch = urlContent.match(/<loc[^>]*>([^<]+)<\/loc>/i);
    if (!locMatch) continue;

    const url: SitemapUrl = {
      loc: locMatch[1].trim(),
    };

    // Extract optional fields
    const lastmodMatch = urlContent.match(/<lastmod[^>]*>([^<]+)<\/lastmod>/i);
    if (lastmodMatch) url.lastmod = lastmodMatch[1].trim();

    const priorityMatch = urlContent.match(/<priority[^>]*>([^<]+)<\/priority>/i);
    if (priorityMatch) url.priority = parseFloat(priorityMatch[1]);

    const changefreqMatch = urlContent.match(/<changefreq[^>]*>([^<]+)<\/changefreq>/i);
    if (changefreqMatch) url.changefreq = changefreqMatch[1].trim();

    urls.push(url);
  }

  // Also handle sitemap indexes
  const sitemapMatches = content.matchAll(/<sitemap[^>]*>([\s\S]*?)<\/sitemap>/gi);
  for (const match of sitemapMatches) {
    const sitemapContent = match[1];
    const locMatch = sitemapContent.match(/<loc[^>]*>([^<]+)<\/loc>/i);
    if (locMatch) {
      urls.push({ loc: locMatch[1].trim() });
    }
  }

  return urls;
}

/**
 * Check if content is a sitemap index (containing other sitemaps)
 */
export function isSitemapIndex(content: string): boolean {
  return content.includes("<sitemapindex") || content.includes("<sitemap>");
}

/**
 * Fetch and parse a sitemap
 */
export async function fetchSitemap(url: string): Promise<SitemapUrl[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DocuSynth-Crawler/1.0 (+https://docusynth.ai/bot)",
        "Accept": "application/xml, text/xml, */*",
      },
    });

    if (!response.ok) return [];

    const content = await response.text();
    return parseSitemap(content);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Content Extraction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract main content from HTML, removing navigation, ads, etc.
 */
export function extractContent(html: string, url: string): ExtractedContent {
  // Remove scripts, styles, and other non-content elements
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract metadata
  const title = extractTitle(content);
  const description = extractMetaContent(content, "description");
  const author = extractMetaContent(content, "author");
  const publishedDate = extractPublishedDate(content);

  // Extract structured data (JSON-LD)
  const structuredData = extractStructuredData(content);

  // Extract links before removing elements
  const links = extractLinks(content, url);

  // Extract images
  const images = extractImages(content, url);

  // Extract code blocks before converting to markdown
  const codeBlocks = extractCodeBlocks(content);

  // Extract tables
  const tables = extractTables(content);

  // Remove non-content elements
  content = removeNonContent(content);

  // Convert to markdown
  const markdown = htmlToMarkdown(content);

  // Count words
  const wordCount = countWords(markdown);

  return {
    title,
    description,
    author,
    publishedDate,
    content: stripHtml(content),
    markdown,
    links,
    images,
    codeBlocks,
    tables,
    structuredData,
    wordCount,
  };
}

/**
 * Extract the title from HTML
 */
function extractTitle(html: string): string {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim());

  // Try og:title
  const ogTitle = extractMetaContent(html, "og:title", "property");
  if (ogTitle) return ogTitle;

  // Try first h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return decodeHtmlEntities(h1Match[1].trim());

  return "Untitled";
}

/**
 * Extract meta tag content
 */
function extractMetaContent(html: string, name: string, attribute = "name"): string | undefined {
  const patterns = [
    new RegExp(`<meta\\s+${attribute}=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']+)["'][^>]*${attribute}=["']${name}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1].trim());
  }

  return undefined;
}

/**
 * Extract published date from various sources
 */
function extractPublishedDate(html: string): string | undefined {
  // Try meta tags
  const metaNames = [
    "article:published_time",
    "datePublished",
    "date",
    "DC.date.issued",
  ];

  for (const name of metaNames) {
    const date = extractMetaContent(html, name, "property") ||
      extractMetaContent(html, name, "name");
    if (date) return date;
  }

  // Try time element
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch) return timeMatch[1];

  return undefined;
}

/**
 * Extract JSON-LD structured data
 */
function extractStructuredData(html: string): Record<string, unknown> | undefined {
  const scriptMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (scriptMatch) {
    try {
      return JSON.parse(scriptMatch[1]);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Extract all links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: Set<string> = new Set();
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi);

  for (const match of linkMatches) {
    try {
      const href = match[1].trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) {
        continue;
      }
      const absoluteUrl = new URL(href, baseUrl).toString();
      links.add(normalizeUrl(absoluteUrl));
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(links);
}

/**
 * Extract images from HTML
 */
function extractImages(html: string, baseUrl: string): { src: string; alt: string }[] {
  const images: { src: string; alt: string }[] = [];
  const imgMatches = html.matchAll(/<img[^>]*>/gi);

  for (const match of imgMatches) {
    const tag = match[0];

    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;

    try {
      const src = new URL(srcMatch[1], baseUrl).toString();
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : "";

      images.push({ src, alt });
    } catch {
      // Invalid URL, skip
    }
  }

  return images;
}

/**
 * Extract code blocks from HTML
 */
function extractCodeBlocks(html: string): { language: string; code: string }[] {
  const codeBlocks: { language: string; code: string }[] = [];

  // Match <pre><code> blocks
  const preCodeMatches = html.matchAll(
    /<pre[^>]*>[\s]*<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>[\s]*<\/pre>/gi
  );

  for (const match of preCodeMatches) {
    const language = match[1] || "";
    const code = stripHtml(match[2]).trim();
    if (code) codeBlocks.push({ language, code });
  }

  // Match standalone <code> blocks
  const codeMatches = html.matchAll(
    /<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>/gi
  );

  for (const match of codeMatches) {
    // Skip if it's a multi-line block (already captured above)
    const code = stripHtml(match[2]).trim();
    if (code && !code.includes("\n")) {
      codeBlocks.push({ language: match[1] || "", code });
    }
  }

  return codeBlocks;
}

/**
 * Extract tables from HTML
 */
function extractTables(html: string): string[][] {
  const tables: string[][] = [];
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const match of tableMatches) {
    const tableContent = match[1];
    const rows: string[] = [];

    const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const rowMatch of rowMatches) {
      const cellMatches = rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
      const cells: string[] = [];
      for (const cellMatch of cellMatches) {
        cells.push(stripHtml(cellMatch[1]).trim());
      }
      if (cells.length > 0) {
        rows.push(cells.join(" | "));
      }
    }

    if (rows.length > 0) {
      tables.push(rows);
    }
  }

  return tables;
}

/**
 * Remove non-content elements from HTML
 */
function removeNonContent(html: string): string {
  // Remove header, footer, nav, aside, ads
  const tagsToRemove = [
    "header", "footer", "nav", "aside", "menu", "menuitem",
    "form", "button", "input", "select", "textarea",
  ];

  let cleaned = html;
  for (const tag of tagsToRemove) {
    cleaned = cleaned.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      ""
    );
  }

  // Remove elements with common non-content classes/IDs
  const nonContentPatterns = [
    /class=["'][^"']*(?:nav|menu|sidebar|footer|header|advertisement|ad-|social|share|comment|related)[^"']*["']/gi,
    /id=["'][^"']*(?:nav|menu|sidebar|footer|header|ad|social|share|comment|related)[^"']*["']/gi,
  ];

  // Remove elements with these patterns (simplified approach)
  for (const pattern of nonContentPatterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      // Find the start of this tag
      let tagStart = match.index;
      while (tagStart > 0 && cleaned[tagStart] !== "<") {
        tagStart--;
      }

      // Find the tag name
      const tagNameMatch = cleaned.substring(tagStart).match(/<(\w+)/);
      if (tagNameMatch) {
        const tagName = tagNameMatch[1];
        const closeTag = `</${tagName}>`;
        const closeIndex = cleaned.indexOf(closeTag, match.index);
        if (closeIndex !== -1) {
          cleaned = cleaned.substring(0, tagStart) +
            cleaned.substring(closeIndex + closeTag.length);
        }
      }
    }
  }

  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML to Markdown Conversion
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert HTML to clean Markdown
 */
export function htmlToMarkdown(html: string): string {
  let markdown = html;

  // Normalize whitespace
  markdown = markdown.replace(/[\r\n]+/g, "\n").replace(/[ \t]+/g, " ");

  // Convert headings
  for (let i = 6; i >= 1; i--) {
    const hashes = "#".repeat(i);
    markdown = markdown.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, "gi"),
      `\n\n${hashes} $1\n\n`
    );
  }

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Convert bold
  markdown = markdown.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, "**$1**");

  // Convert italic
  markdown = markdown.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, "*$1*");

  // Convert code blocks
  markdown = markdown.replace(
    /<pre[^>]*>[\s]*<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>[\s]*<\/pre>/gi,
    (_, lang, code) => `\n\n\`\`\`${lang || ""}\n${stripHtml(code).trim()}\n\`\`\`\n\n`
  );

  // Convert inline code
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Convert links
  markdown = markdown.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    "[$2]($1)"
  );

  // Convert images
  markdown = markdown.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
    "![$2]($1)"
  );
  markdown = markdown.replace(
    /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    "![$1]($2)"
  );
  markdown = markdown.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    "![]($1)"
  );

  // Convert unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  });

  // Convert ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let index = 1;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => {
      return `${index++}. ` + "$1\n";
    });
  });

  // Convert blockquotes
  markdown = markdown.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, content) => {
      return content
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
    }
  );

  // Convert horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // Convert tables
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[] = [];
    let headerDone = false;

    const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const rowMatch of rowMatches) {
      const cellMatches = rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
      const cells: string[] = [];
      for (const cellMatch of cellMatches) {
        cells.push(stripHtml(cellMatch[1]).trim());
      }

      if (cells.length > 0) {
        rows.push(`| ${cells.join(" | ")} |`);
        if (!headerDone) {
          rows.push(`| ${cells.map(() => "---").join(" | ")} |`);
          headerDone = true;
        }
      }
    }

    return `\n\n${rows.join("\n")}\n\n`;
  });

  // Remove remaining HTML tags
  markdown = stripHtml(markdown);

  // Decode HTML entities
  markdown = decodeHtmlEntities(markdown);

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .trim();

  return markdown;
}

/**
 * Strip all HTML tags from a string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "(c)",
    "&reg;": "(R)",
    "&trade;": "(TM)",
    "&mdash;": "--",
    "&ndash;": "-",
    "&hellip;": "...",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Decode numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  return decoded;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Hashing
// ═══════════════════════════════════════════════════════════════════════════

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a content hash for change detection using Web Crypto API
 */
export async function generateContentHash(content: string): Promise<string> {
  // Normalize content before hashing
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// Priority Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate crawl priority for a URL (0-100, higher = more important)
 */
export function calculatePriority(
  url: string,
  anchorText: string | undefined,
  depth: number,
  sitemapPriority?: number
): number {
  let priority = 50; // Base priority

  // Depth penalty (deeper = lower priority)
  priority -= depth * 5;

  // Sitemap priority boost
  if (sitemapPriority !== undefined) {
    priority += sitemapPriority * 20;
  }

  // URL patterns that indicate important content
  const importantPatterns = [
    { pattern: /\/docs?\//i, boost: 15 },
    { pattern: /\/api\//i, boost: 15 },
    { pattern: /\/guide/i, boost: 10 },
    { pattern: /\/tutorial/i, boost: 10 },
    { pattern: /\/getting-started/i, boost: 12 },
    { pattern: /\/quickstart/i, boost: 12 },
    { pattern: /\/reference/i, boost: 10 },
    { pattern: /readme/i, boost: 15 },
    { pattern: /index\.html?$/i, boost: 5 },
  ];

  for (const { pattern, boost } of importantPatterns) {
    if (pattern.test(url)) {
      priority += boost;
      break;
    }
  }

  // Anchor text analysis
  if (anchorText) {
    const importantAnchorWords = [
      "documentation", "docs", "api", "guide", "tutorial",
      "getting started", "quick start", "reference", "overview",
    ];

    const lowerAnchor = anchorText.toLowerCase();
    for (const word of importantAnchorWords) {
      if (lowerAnchor.includes(word)) {
        priority += 8;
        break;
      }
    }
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, priority));
}

import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Bundles Backend - Feature #24
// ═══════════════════════════════════════════════════════════════

const bundleOptionsValidator = v.object({
  includeToc: v.boolean(),
  includeMetadata: v.boolean(),
  brandingLogo: v.optional(v.string()),
  brandingTitle: v.optional(v.string()),
  brandingColors: v.optional(
    v.object({
      primary: v.string(),
      secondary: v.string(),
      background: v.string(),
    })
  ),
  customCss: v.optional(v.string()),
  tocDepth: v.optional(v.number()),
  pageBreaks: v.optional(v.boolean()),
});

// ═══════════════════════════════════════════════════════════════
// Query Functions
// ═══════════════════════════════════════════════════════════════

export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  handler: async (ctx, { collectionId }) => {
    const userId = await getUserId(ctx);

    // Verify collection ownership
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("byCollection", (q) => q.eq("collectionId", collectionId))
      .collect();

    // Add share info
    const bundlesWithShares = await Promise.all(
      bundles.map(async (bundle) => {
        const shares = await ctx.db
          .query("bundleShares")
          .withIndex("byBundle", (q) => q.eq("bundleId", bundle._id))
          .collect();
        return {
          ...bundle,
          shareCount: shares.length,
          activeShares: shares.filter(
            (s) => !s.expiresAt || s.expiresAt > Date.now()
          ),
        };
      })
    );

    return bundlesWithShares.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("bundles") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(id);
    if (!bundle || bundle.userId !== userId) return null;

    // Get share info
    const shares = await ctx.db
      .query("bundleShares")
      .withIndex("byBundle", (q) => q.eq("bundleId", id))
      .collect();

    // Get download count
    const downloads = await ctx.db
      .query("bundleDownloads")
      .withIndex("byBundle", (q) => q.eq("bundleId", id))
      .collect();

    return {
      ...bundle,
      shares,
      totalDownloads: downloads.length,
    };
  },
});

export const getStatus = query({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, { bundleId }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(bundleId);
    if (!bundle || bundle.userId !== userId) return null;

    return {
      status: bundle.status,
      progress: bundle.progress,
      error: bundle.error,
      downloadUrl: bundle.downloadUrl,
    };
  },
});

export const getAnalytics = query({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, { bundleId }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(bundleId);
    if (!bundle || bundle.userId !== userId) return null;

    const downloads = await ctx.db
      .query("bundleDownloads")
      .withIndex("byBundle", (q) => q.eq("bundleId", bundleId))
      .collect();

    // Group by day
    const downloadsByDay = new Map<string, number>();
    for (const dl of downloads) {
      const day = new Date(dl.downloadedAt).toISOString().split("T")[0];
      downloadsByDay.set(day, (downloadsByDay.get(day) || 0) + 1);
    }

    // Get share stats
    const shares = await ctx.db
      .query("bundleShares")
      .withIndex("byBundle", (q) => q.eq("bundleId", bundleId))
      .collect();

    return {
      totalDownloads: downloads.length,
      downloadsByDay: Object.fromEntries(downloadsByDay),
      recentDownloads: downloads.slice(-10).reverse(),
      totalShares: shares.length,
      activeShares: shares.filter((s) => !s.expiresAt || s.expiresAt > Date.now()).length,
      downloadsFromShares: downloads.filter((d) => d.shareToken).length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Mutation Functions
// ═══════════════════════════════════════════════════════════════

export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    format: v.union(v.literal("zip"), v.literal("pdf"), v.literal("markdown")),
    options: v.optional(bundleOptionsValidator),
  },
  handler: async (ctx, { collectionId, format, options }) => {
    const userId = await getUserId(ctx);

    // Verify collection ownership
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Create bundle record
    const bundleId = await ctx.db.insert("bundles", {
      collectionId,
      userId,
      format,
      status: "pending",
      progress: 0,
      fileSize: null,
      downloadUrl: null,
      expiresAt: null,
      error: null,
      options: options || {
        includeToc: true,
        includeMetadata: true,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return bundleId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("bundles"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.optional(v.number()),
    downloadUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    error: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(id);
    if (!bundle || bundle.userId !== userId) {
      throw new Error("Bundle not found");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.progress !== undefined) patch.progress = updates.progress;
    if (updates.downloadUrl !== undefined) patch.downloadUrl = updates.downloadUrl;
    if (updates.fileSize !== undefined) patch.fileSize = updates.fileSize;
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.expiresAt !== undefined) patch.expiresAt = updates.expiresAt;

    await ctx.db.patch(id, patch);
  },
});

// Internal version for actions
export const updateStatusInternal = internalMutation({
  args: {
    bundleId: v.id("bundles"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    progress: v.optional(v.number()),
    downloadUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    error: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { bundleId, ...updates }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.progress !== undefined) patch.progress = updates.progress;
    if (updates.downloadUrl !== undefined) patch.downloadUrl = updates.downloadUrl;
    if (updates.fileSize !== undefined) patch.fileSize = updates.fileSize;
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.expiresAt !== undefined) patch.expiresAt = updates.expiresAt;

    await ctx.db.patch(bundleId, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("bundles") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(id);
    if (!bundle || bundle.userId !== userId) {
      throw new Error("Bundle not found");
    }

    // Delete shares
    const shares = await ctx.db
      .query("bundleShares")
      .withIndex("byBundle", (q) => q.eq("bundleId", id))
      .collect();
    for (const share of shares) {
      await ctx.db.delete(share._id);
    }

    // Delete download records
    const downloads = await ctx.db
      .query("bundleDownloads")
      .withIndex("byBundle", (q) => q.eq("bundleId", id))
      .collect();
    for (const dl of downloads) {
      await ctx.db.delete(dl._id);
    }

    await ctx.db.delete(id);
  },
});

// ═══════════════════════════════════════════════════════════════
// Share Link Functions
// ═══════════════════════════════════════════════════════════════

export const createShareLink = mutation({
  args: {
    bundleId: v.id("bundles"),
    expiresInDays: v.optional(v.number()),
    maxDownloads: v.optional(v.number()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { bundleId, expiresInDays, maxDownloads, password }) => {
    const userId = await getUserId(ctx);
    const bundle = await ctx.db.get(bundleId);
    if (!bundle || bundle.userId !== userId) {
      throw new Error("Bundle not found");
    }

    if (bundle.status !== "completed") {
      throw new Error("Bundle is not ready for sharing");
    }

    // Generate secure token
    const token = generateShareToken();

    const expiresAt = expiresInDays
      ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      : null;

    const shareId = await ctx.db.insert("bundleShares", {
      bundleId,
      token,
      expiresAt,
      downloadCount: 0,
      maxDownloads: maxDownloads || null,
      passwordHash: password ? hashPassword(password) : null,
      createdAt: Date.now(),
    });

    return { shareId, token };
  },
});

export const revokeShareLink = mutation({
  args: { shareId: v.id("bundleShares") },
  handler: async (ctx, { shareId }) => {
    const userId = await getUserId(ctx);
    const share = await ctx.db.get(shareId);
    if (!share) {
      throw new Error("Share not found");
    }

    const bundle = await ctx.db.get(share.bundleId);
    if (!bundle || bundle.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(shareId);
  },
});

export const validateShareToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db
      .query("bundleShares")
      .withIndex("byToken", (q) => q.eq("token", token))
      .unique();

    if (!share) {
      return { valid: false, reason: "Invalid token" };
    }

    if (share.expiresAt && share.expiresAt < Date.now()) {
      return { valid: false, reason: "Link has expired" };
    }

    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return { valid: false, reason: "Download limit reached" };
    }

    const bundle = await ctx.db.get(share.bundleId);
    if (!bundle || bundle.status !== "completed") {
      return { valid: false, reason: "Bundle not available" };
    }

    return {
      valid: true,
      requiresPassword: !!share.passwordHash,
      bundleId: bundle._id,
      format: bundle.format,
    };
  },
});

export const trackDownload = mutation({
  args: {
    bundleId: v.id("bundles"),
    shareToken: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { bundleId, shareToken, userAgent }) => {
    // Record download
    await ctx.db.insert("bundleDownloads", {
      bundleId,
      downloadedAt: Date.now(),
      shareToken,
      userAgent,
    });

    // Update share download count if applicable
    if (shareToken) {
      const share = await ctx.db
        .query("bundleShares")
        .withIndex("byToken", (q) => q.eq("token", shareToken))
        .unique();

      if (share) {
        await ctx.db.patch(share._id, {
          downloadCount: share.downloadCount + 1,
        });
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Bundle Generation Action
// ═══════════════════════════════════════════════════════════════

export const generateBundle = action({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, { bundleId }) => {
    // Get bundle info
    const bundle = await ctx.runQuery(internal.bundles.getBundleInternal, { bundleId });
    if (!bundle) {
      throw new Error("Bundle not found");
    }

    // Update status to processing
    await ctx.runMutation(internal.bundles.updateStatusInternal, {
      bundleId,
      status: "processing",
      progress: 10,
    });

    try {
      // Get collection with documents
      const collection = await ctx.runQuery(internal.collections.getInternal, {
        collectionId: bundle.collectionId,
        userId: bundle.userId,
      });

      if (!collection) {
        throw new Error("Collection not found");
      }

      // Get documents
      const documents = await ctx.runQuery(internal.collections.listDocumentsInternal, {
        collectionId: bundle.collectionId,
      });

      await ctx.runMutation(internal.bundles.updateStatusInternal, {
        bundleId,
        progress: 30,
      });

      // Generate content based on format
      let content: string;
      let filename: string;

      const options = bundle.options || { includeToc: true, includeMetadata: true };

      switch (bundle.format) {
        case "markdown":
          content = generateCombinedMarkdown(collection, documents, options);
          filename = `${sanitizeFilename(collection.name)}.md`;
          break;
        case "zip":
          content = generateZipContent(collection, documents, options);
          filename = `${sanitizeFilename(collection.name)}.zip`;
          break;
        case "pdf":
          // For PDF, we generate HTML that can be converted client-side
          content = generatePdfHtml(collection, documents, options);
          filename = `${sanitizeFilename(collection.name)}.html`;
          break;
        default:
          throw new Error(`Unsupported format: ${bundle.format}`);
      }

      await ctx.runMutation(internal.bundles.updateStatusInternal, {
        bundleId,
        progress: 80,
      });

      // Store the generated content
      // In a real implementation, this would upload to Convex file storage
      // For now, we store a data URL for smaller bundles
      const dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(content)))}`;

      await ctx.runMutation(internal.bundles.updateStatusInternal, {
        bundleId,
        status: "completed",
        progress: 100,
        downloadUrl: dataUrl,
        fileSize: content.length,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return { success: true, bundleId };
    } catch (error) {
      await ctx.runMutation(internal.bundles.updateStatusInternal, {
        bundleId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Internal Functions
// ═══════════════════════════════════════════════════════════════

export const getBundleInternal = internalQuery({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, { bundleId }) => {
    return await ctx.db.get(bundleId);
  },
});

export const cleanupExpiredBundles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired bundles
    const expiredBundles = await ctx.db
      .query("bundles")
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), null),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .collect();

    for (const bundle of expiredBundles) {
      // Delete shares
      const shares = await ctx.db
        .query("bundleShares")
        .withIndex("byBundle", (q) => q.eq("bundleId", bundle._id))
        .collect();
      for (const share of shares) {
        await ctx.db.delete(share._id);
      }

      // Note: We keep download records for analytics
      // but remove the bundle itself
      await ctx.db.patch(bundle._id, {
        downloadUrl: null,
        status: "expired" as any, // Mark as expired
      });
    }

    // Clean up expired share links
    const expiredShares = await ctx.db
      .query("bundleShares")
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), null),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .collect();

    for (const share of expiredShares) {
      await ctx.db.delete(share._id);
    }

    return {
      expiredBundles: expiredBundles.length,
      expiredShares: expiredShares.length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function generateShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function hashPassword(password: string): string {
  // Simple hash for demo - in production, use proper hashing
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}

interface BundleOptions {
  includeToc: boolean;
  includeMetadata: boolean;
  brandingLogo?: string;
  brandingTitle?: string;
  brandingColors?: {
    primary: string;
    secondary: string;
    background: string;
  };
  customCss?: string;
  tocDepth?: number;
  pageBreaks?: boolean;
}

interface Document {
  _id: Id<"documents">;
  topic: string;
  content: string;
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
}

interface Collection {
  _id: Id<"collections">;
  name: string;
  description?: string;
}

function generateCombinedMarkdown(
  collection: Collection,
  documents: Document[],
  options: BundleOptions
): string {
  let content = "";

  // Header
  content += `# ${collection.name}\n\n`;
  if (collection.description) {
    content += `${collection.description}\n\n`;
  }

  // Table of Contents
  if (options.includeToc && documents.length > 0) {
    content += `## Table of Contents\n\n`;
    documents.forEach((doc, i) => {
      const anchor = doc.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      content += `${i + 1}. [${doc.topic}](#${anchor})\n`;
    });
    content += "\n---\n\n";
  }

  // Documents
  documents.forEach((doc, i) => {
    if (options.pageBreaks && i > 0) {
      content += "\n<div style=\"page-break-before: always;\"></div>\n\n";
    }

    content += `## ${doc.topic}\n\n`;

    if (options.includeMetadata) {
      content += `*Created: ${new Date(doc.createdAt).toLocaleDateString()}*\n\n`;
    }

    content += doc.content + "\n\n";

    if (options.includeMetadata && doc.sources.length > 0) {
      content += `### Sources\n\n`;
      doc.sources.forEach((source) => {
        content += `- [${source.title}](${source.url})\n`;
      });
      content += "\n";
    }

    content += "---\n\n";
  });

  // Footer
  content += `\n*Generated by DocuSynth AI on ${new Date().toLocaleString()}*\n`;

  return content;
}

function generateZipContent(
  collection: Collection,
  documents: Document[],
  options: BundleOptions
): string {
  // For ZIP, we generate a manifest JSON that the client can use
  // to create the actual ZIP file using JSZip
  const manifest = {
    collection: {
      name: collection.name,
      description: collection.description,
    },
    options,
    files: documents.map((doc, i) => ({
      filename: `${String(i + 1).padStart(2, "0")}-${sanitizeFilename(doc.topic)}.md`,
      content: generateDocumentMarkdown(doc, options),
    })),
    readme: generateReadmeContent(collection, documents, options),
  };

  return JSON.stringify(manifest, null, 2);
}

function generateDocumentMarkdown(doc: Document, options: BundleOptions): string {
  let content = `# ${doc.topic}\n\n`;

  if (options.includeMetadata) {
    content += `*Created: ${new Date(doc.createdAt).toLocaleDateString()}*\n\n`;
  }

  content += doc.content + "\n\n";

  if (options.includeMetadata && doc.sources.length > 0) {
    content += `## Sources\n\n`;
    doc.sources.forEach((source) => {
      content += `- [${source.title}](${source.url})\n`;
    });
  }

  return content;
}

function generateReadmeContent(
  collection: Collection,
  documents: Document[],
  options: BundleOptions
): string {
  let content = `# ${collection.name}\n\n`;

  if (collection.description) {
    content += `${collection.description}\n\n`;
  }

  content += `## Contents\n\n`;
  content += `This bundle contains ${documents.length} document(s):\n\n`;

  documents.forEach((doc, i) => {
    content += `${i + 1}. ${doc.topic}\n`;
  });

  content += `\n## Generated\n\n`;
  content += `This bundle was generated by DocuSynth AI on ${new Date().toLocaleString()}.\n`;

  return content;
}

function generatePdfHtml(
  collection: Collection,
  documents: Document[],
  options: BundleOptions
): string {
  const colors = options.brandingColors || {
    primary: "#6366f1",
    secondary: "#64748b",
    background: "#ffffff",
  };

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(collection.name)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: ${colors.background};
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { color: ${colors.primary}; border-bottom: 2px solid ${colors.primary}; padding-bottom: 10px; }
    h2 { color: ${colors.primary}; margin-top: 2em; }
    h3 { color: ${colors.secondary}; }
    a { color: ${colors.primary}; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #1a1a2e; color: #e4e4e7; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: transparent; color: inherit; }
    blockquote { border-left: 4px solid ${colors.primary}; margin: 0; padding-left: 16px; color: ${colors.secondary}; }
    .toc { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 8px 0; }
    .metadata { color: ${colors.secondary}; font-size: 0.9em; margin-bottom: 1em; }
    .sources { background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 2em; }
    .page-break { page-break-before: always; }
    ${options.customCss || ""}
  </style>
</head>
<body>
`;

  // Header with optional branding
  if (options.brandingLogo) {
    html += `<img src="${options.brandingLogo}" alt="Logo" style="max-height: 60px; margin-bottom: 20px;" />\n`;
  }

  html += `<h1>${escapeHtml(options.brandingTitle || collection.name)}</h1>\n`;

  if (collection.description) {
    html += `<p>${escapeHtml(collection.description)}</p>\n`;
  }

  // Table of Contents
  if (options.includeToc && documents.length > 0) {
    html += `<div class="toc">\n<h2>Table of Contents</h2>\n<ul>\n`;
    documents.forEach((doc, i) => {
      html += `<li>${i + 1}. ${escapeHtml(doc.topic)}</li>\n`;
    });
    html += `</ul>\n</div>\n`;
  }

  // Documents
  documents.forEach((doc, i) => {
    if (options.pageBreaks && i > 0) {
      html += `<div class="page-break"></div>\n`;
    }

    html += `<h2>${escapeHtml(doc.topic)}</h2>\n`;

    if (options.includeMetadata) {
      html += `<p class="metadata">Created: ${new Date(doc.createdAt).toLocaleDateString()}</p>\n`;
    }

    // Convert markdown to basic HTML
    html += markdownToHtml(doc.content) + "\n";

    if (options.includeMetadata && doc.sources.length > 0) {
      html += `<div class="sources">\n<h3>Sources</h3>\n<ul>\n`;
      doc.sources.forEach((source) => {
        html += `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></li>\n`;
      });
      html += `</ul>\n</div>\n`;
    }
  });

  // Footer
  html += `<hr style="margin-top: 40px;" />\n`;
  html += `<p style="color: ${colors.secondary}; font-size: 0.8em; text-align: center;">`;
  html += `Generated by DocuSynth AI on ${new Date().toLocaleString()}</p>\n`;

  html += `</body>\n</html>`;

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownToHtml(markdown: string): string {
  // Basic markdown to HTML conversion
  let html = markdown
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>") // Demote since we use h2 for doc titles
    .replace(/^# (.*$)/gm, "<h3>$1</h3>")
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>")
    // Lists
    .replace(/^\- (.*$)/gm, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gm, "<li>$1</li>")
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");

  // Wrap in paragraph tags
  html = "<p>" + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

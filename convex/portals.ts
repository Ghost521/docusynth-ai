import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Portal Management
// ═══════════════════════════════════════════════════════════════

// Create a new portal
export const createPortal = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    subdomain: v.string(),
  },
  handler: async (ctx, { workspaceId, name, subdomain }) => {
    const userId = await getUserId(ctx);

    // Validate subdomain format (alphanumeric and hyphens, 3-63 chars)
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      throw new Error("Invalid subdomain format. Use lowercase letters, numbers, and hyphens (3-63 characters).");
    }

    // Check if subdomain is available
    const existing = await ctx.db
      .query("portals")
      .withIndex("bySubdomain", (q) => q.eq("subdomain", subdomain))
      .unique();

    if (existing) {
      throw new Error("Subdomain is already taken.");
    }

    // Reserved subdomains
    const reserved = ["www", "api", "app", "admin", "portal", "docs", "help", "support", "status"];
    if (reserved.includes(subdomain)) {
      throw new Error("This subdomain is reserved.");
    }

    const now = Date.now();
    const portalId = await ctx.db.insert("portals", {
      userId,
      workspaceId,
      name,
      subdomain,
      branding: {
        primaryColor: "#3B82F6",
        accentColor: "#10B981",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      theme: "system",
      accessType: "public",
      showRecentUpdates: true,
      showFeaturedDocs: true,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });

    return portalId;
  },
});

// Update portal configuration
export const updatePortal = mutation({
  args: {
    portalId: v.id("portals"),
    name: v.optional(v.string()),
    customDomain: v.optional(v.string()),
    branding: v.optional(v.object({
      logo: v.optional(v.string()),
      primaryColor: v.string(),
      accentColor: v.string(),
      fontFamily: v.string(),
      faviconUrl: v.optional(v.string()),
    })),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"), v.literal("custom"))),
    customCss: v.optional(v.string()),
    customHeader: v.optional(v.string()),
    customFooter: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    socialImage: v.optional(v.string()),
    analyticsId: v.optional(v.string()),
    accessType: v.optional(v.union(v.literal("public"), v.literal("password"), v.literal("authenticated"))),
    password: v.optional(v.string()),
    homepageContent: v.optional(v.string()),
    showRecentUpdates: v.optional(v.boolean()),
    showFeaturedDocs: v.optional(v.boolean()),
  },
  handler: async (ctx, { portalId, ...updates }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    const filtered: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    await ctx.db.patch(portalId, filtered);
  },
});

// Delete portal
export const deletePortal = mutation({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    // Delete all portal documents
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    for (const doc of portalDocs) {
      await ctx.db.delete(doc._id);
    }

    // Delete nav items
    const navItems = await ctx.db
      .query("portalNavItems")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    for (const item of navItems) {
      await ctx.db.delete(item._id);
    }

    // Delete page views
    const pageViews = await ctx.db
      .query("portalPageViews")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    for (const view of pageViews) {
      await ctx.db.delete(view._id);
    }

    // Delete the portal
    await ctx.db.delete(portalId);
  },
});

// Get portal by ID
export const getPortal = query({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      return null;
    }

    return portal;
  },
});

// Get portal by subdomain (public)
export const getPortalBySubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const portal = await ctx.db
      .query("portals")
      .withIndex("bySubdomain", (q) => q.eq("subdomain", subdomain))
      .unique();

    if (!portal || !portal.isPublished) {
      return null;
    }

    // Return public-safe portal data
    return {
      _id: portal._id,
      name: portal.name,
      subdomain: portal.subdomain,
      customDomain: portal.customDomain,
      branding: portal.branding,
      theme: portal.theme,
      customCss: portal.customCss,
      customHeader: portal.customHeader,
      customFooter: portal.customFooter,
      seoTitle: portal.seoTitle,
      seoDescription: portal.seoDescription,
      socialImage: portal.socialImage,
      analyticsId: portal.analyticsId,
      accessType: portal.accessType,
      homepageContent: portal.homepageContent,
      showRecentUpdates: portal.showRecentUpdates,
      showFeaturedDocs: portal.showFeaturedDocs,
    };
  },
});

// Get portal by custom domain (public)
export const getPortalByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    const portal = await ctx.db
      .query("portals")
      .withIndex("byCustomDomain", (q) => q.eq("customDomain", domain))
      .unique();

    if (!portal || !portal.isPublished) {
      return null;
    }

    return {
      _id: portal._id,
      name: portal.name,
      subdomain: portal.subdomain,
      customDomain: portal.customDomain,
      branding: portal.branding,
      theme: portal.theme,
      customCss: portal.customCss,
      customHeader: portal.customHeader,
      customFooter: portal.customFooter,
      seoTitle: portal.seoTitle,
      seoDescription: portal.seoDescription,
      socialImage: portal.socialImage,
      analyticsId: portal.analyticsId,
      accessType: portal.accessType,
      homepageContent: portal.homepageContent,
      showRecentUpdates: portal.showRecentUpdates,
      showFeaturedDocs: portal.showFeaturedDocs,
    };
  },
});

// List portals for user/workspace
export const listPortals = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    if (workspaceId) {
      return await ctx.db
        .query("portals")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    }

    return await ctx.db
      .query("portals")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Check if subdomain is available
export const checkSubdomainAvailability = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    // Validate format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      return { available: false, reason: "Invalid format" };
    }

    // Check reserved
    const reserved = ["www", "api", "app", "admin", "portal", "docs", "help", "support", "status"];
    if (reserved.includes(subdomain)) {
      return { available: false, reason: "Reserved subdomain" };
    }

    // Check database
    const existing = await ctx.db
      .query("portals")
      .withIndex("bySubdomain", (q) => q.eq("subdomain", subdomain))
      .unique();

    return { available: !existing, reason: existing ? "Already taken" : null };
  },
});

// Publish portal
export const publishPortal = mutation({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    await ctx.db.patch(portalId, {
      isPublished: true,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Unpublish portal
export const unpublishPortal = mutation({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    await ctx.db.patch(portalId, {
      isPublished: false,
      updatedAt: Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// Portal Document Management
// ═══════════════════════════════════════════════════════════════

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Publish document to portal
export const publishDocument = mutation({
  args: {
    portalId: v.id("portals"),
    documentId: v.id("documents"),
    slug: v.optional(v.string()),
    titleOverride: v.optional(v.string()),
    descriptionOverride: v.optional(v.string()),
    parentId: v.optional(v.id("portalDocuments")),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { portalId, documentId, slug, titleOverride, descriptionOverride, parentId, icon }) => {
    const userId = await getUserId(ctx);

    // Verify portal ownership
    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    // Verify document ownership
    const document = await ctx.db.get(documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied.");
    }

    // Check if already published
    const existingDoc = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .filter((q) => q.eq(q.field("documentId"), documentId))
      .unique();

    if (existingDoc) {
      throw new Error("Document is already published to this portal.");
    }

    // Generate or validate slug
    const finalSlug = slug || generateSlug(document.topic);

    // Check slug uniqueness within portal
    const slugExists = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndSlug", (q) => q.eq("portalId", portalId).eq("slug", finalSlug))
      .unique();

    if (slugExists) {
      throw new Error("Slug already exists in this portal. Please choose a different slug.");
    }

    // Get max position
    const allDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const maxPosition = allDocs.reduce((max, doc) => Math.max(max, doc.position), -1);

    const now = Date.now();
    const portalDocId = await ctx.db.insert("portalDocuments", {
      portalId,
      documentId,
      slug: finalSlug,
      titleOverride,
      descriptionOverride,
      position: maxPosition + 1,
      parentId,
      isSection: false,
      isDraft: false,
      icon,
      publishedAt: now,
      updatedAt: now,
    });

    return portalDocId;
  },
});

// Unpublish document from portal
export const unpublishDocument = mutation({
  args: {
    portalId: v.id("portals"),
    portalDocumentId: v.id("portalDocuments"),
  },
  handler: async (ctx, { portalId, portalDocumentId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    const portalDoc = await ctx.db.get(portalDocumentId);
    if (!portalDoc || portalDoc.portalId !== portalId) {
      throw new Error("Portal document not found.");
    }

    await ctx.db.delete(portalDocumentId);
  },
});

// Update portal document
export const updatePortalDocument = mutation({
  args: {
    portalDocumentId: v.id("portalDocuments"),
    slug: v.optional(v.string()),
    titleOverride: v.optional(v.string()),
    descriptionOverride: v.optional(v.string()),
    parentId: v.optional(v.id("portalDocuments")),
    isDraft: v.optional(v.boolean()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { portalDocumentId, ...updates }) => {
    const userId = await getUserId(ctx);

    const portalDoc = await ctx.db.get(portalDocumentId);
    if (!portalDoc) {
      throw new Error("Portal document not found.");
    }

    const portal = await ctx.db.get(portalDoc.portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Access denied.");
    }

    // If slug is being updated, check uniqueness
    if (updates.slug && updates.slug !== portalDoc.slug) {
      const slugExists = await ctx.db
        .query("portalDocuments")
        .withIndex("byPortalAndSlug", (q) =>
          q.eq("portalId", portalDoc.portalId).eq("slug", updates.slug!)
        )
        .unique();

      if (slugExists) {
        throw new Error("Slug already exists in this portal.");
      }
    }

    const filtered: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    await ctx.db.patch(portalDocumentId, filtered);
  },
});

// List portal documents
export const listPortalDocuments = query({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      return [];
    }

    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    // Fetch actual documents for titles
    const docsWithData = await Promise.all(
      portalDocs.map(async (pd) => {
        const doc = await ctx.db.get(pd.documentId);
        return {
          ...pd,
          documentTopic: doc?.topic || "Unknown",
          documentContent: doc?.content?.substring(0, 200) || "",
        };
      })
    );

    return docsWithData;
  },
});

// Reorder navigation
export const reorderNavigation = mutation({
  args: {
    portalId: v.id("portals"),
    order: v.array(v.object({
      id: v.id("portalDocuments"),
      position: v.number(),
      parentId: v.optional(v.id("portalDocuments")),
    })),
  },
  handler: async (ctx, { portalId, order }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    for (const item of order) {
      await ctx.db.patch(item.id, {
        position: item.position,
        parentId: item.parentId,
        updatedAt: Date.now(),
      });
    }
  },
});

// Create section (group header)
export const createSection = mutation({
  args: {
    portalId: v.id("portals"),
    sectionName: v.string(),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("portalDocuments")),
  },
  handler: async (ctx, { portalId, sectionName, icon, parentId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    // Get max position
    const allDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const maxPosition = allDocs.reduce((max, doc) => Math.max(max, doc.position), -1);

    const now = Date.now();
    // Create a placeholder document ID for sections
    // In practice, sections don't have real documents, so we use a special approach
    // We'll use a random ID approach by creating a minimal entry
    const sectionId = await ctx.db.insert("portalDocuments", {
      portalId,
      documentId: "placeholder" as Id<"documents">, // This will be filtered out in queries
      slug: generateSlug(sectionName) + "-section-" + Date.now(),
      sectionName,
      position: maxPosition + 1,
      parentId,
      isSection: true,
      isDraft: false,
      icon,
      publishedAt: now,
      updatedAt: now,
    });

    return sectionId;
  },
});

// ═══════════════════════════════════════════════════════════════
// Portal Navigation Items (External Links)
// ═══════════════════════════════════════════════════════════════

export const createNavItem = mutation({
  args: {
    portalId: v.id("portals"),
    label: v.string(),
    externalUrl: v.optional(v.string()),
    documentId: v.optional(v.id("portalDocuments")),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("portalNavItems")),
  },
  handler: async (ctx, { portalId, label, externalUrl, documentId, icon, parentId }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Portal not found or access denied.");
    }

    const allItems = await ctx.db
      .query("portalNavItems")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const maxPosition = allItems.reduce((max, item) => Math.max(max, item.position), -1);

    const navItemId = await ctx.db.insert("portalNavItems", {
      portalId,
      label,
      externalUrl,
      documentId,
      icon,
      parentId,
      position: maxPosition + 1,
      isExpanded: true,
      createdAt: Date.now(),
    });

    return navItemId;
  },
});

export const deleteNavItem = mutation({
  args: { navItemId: v.id("portalNavItems") },
  handler: async (ctx, { navItemId }) => {
    const userId = await getUserId(ctx);

    const navItem = await ctx.db.get(navItemId);
    if (!navItem) {
      throw new Error("Nav item not found.");
    }

    const portal = await ctx.db.get(navItem.portalId);
    if (!portal || portal.userId !== userId) {
      throw new Error("Access denied.");
    }

    await ctx.db.delete(navItemId);
  },
});

export const listNavItems = query({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    return await ctx.db
      .query("portalNavItems")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════

export const getPortalAnalytics = query({
  args: {
    portalId: v.id("portals"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { portalId, days = 30 }) => {
    const userId = await getUserId(ctx);

    const portal = await ctx.db.get(portalId);
    if (!portal || portal.userId !== userId) {
      return null;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const pageViews = await ctx.db
      .query("portalPageViews")
      .withIndex("byPortalAndViewedAt", (q) =>
        q.eq("portalId", portalId).gte("viewedAt", cutoff)
      )
      .collect();

    // Aggregate stats
    const totalViews = pageViews.length;
    const uniqueVisitors = new Set(pageViews.map((v) => v.visitorId)).size;

    // Views by document
    const viewsByDoc: Record<string, number> = {};
    for (const view of pageViews) {
      const key = view.documentId?.toString() || "homepage";
      viewsByDoc[key] = (viewsByDoc[key] || 0) + 1;
    }

    // Views by day
    const viewsByDay: Record<string, number> = {};
    for (const view of pageViews) {
      const day = new Date(view.viewedAt).toISOString().split("T")[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    }

    // Top referrers
    const referrerCounts: Record<string, number> = {};
    for (const view of pageViews) {
      if (view.referrer) {
        referrerCounts[view.referrer] = (referrerCounts[view.referrer] || 0) + 1;
      }
    }

    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }));

    return {
      totalViews,
      uniqueVisitors,
      viewsByDoc,
      viewsByDay,
      topReferrers,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Internal Functions for HTTP Routes
// ═══════════════════════════════════════════════════════════════

export const trackPageView = internalMutation({
  args: {
    portalId: v.id("portals"),
    documentId: v.optional(v.id("documents")),
    visitorId: v.string(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    path: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("portalPageViews", {
      ...args,
      viewedAt: Date.now(),
    });
  },
});

export const getPublicPortalInternal = internalQuery({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const portal = await ctx.db
      .query("portals")
      .withIndex("bySubdomain", (q) => q.eq("subdomain", subdomain))
      .unique();

    if (!portal || !portal.isPublished) {
      return null;
    }

    return portal;
  },
});

export const getPublicDocumentInternal = internalQuery({
  args: {
    portalId: v.id("portals"),
    slug: v.string(),
  },
  handler: async (ctx, { portalId, slug }) => {
    const portalDoc = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndSlug", (q) => q.eq("portalId", portalId).eq("slug", slug))
      .unique();

    if (!portalDoc || portalDoc.isDraft || portalDoc.isSection) {
      return null;
    }

    const document = await ctx.db.get(portalDoc.documentId);
    if (!document) {
      return null;
    }

    return {
      ...portalDoc,
      document: {
        topic: document.topic,
        content: document.content,
        sources: document.sources,
        createdAt: document.createdAt,
      },
    };
  },
});

export const getPublicNavigationInternal = internalQuery({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    // Filter out drafts and build tree structure
    const publishedDocs = portalDocs.filter((d) => !d.isDraft);

    // Fetch document titles
    const docsWithTitles = await Promise.all(
      publishedDocs.map(async (pd) => {
        if (pd.isSection) {
          return {
            id: pd._id,
            slug: pd.slug,
            title: pd.sectionName || "Section",
            isSection: true,
            position: pd.position,
            parentId: pd.parentId,
            icon: pd.icon,
          };
        }

        const doc = await ctx.db.get(pd.documentId);
        return {
          id: pd._id,
          slug: pd.slug,
          title: pd.titleOverride || doc?.topic || "Document",
          description: pd.descriptionOverride || doc?.content?.substring(0, 150),
          isSection: false,
          position: pd.position,
          parentId: pd.parentId,
          icon: pd.icon,
        };
      })
    );

    // Get nav items (external links)
    const navItems = await ctx.db
      .query("portalNavItems")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    return {
      documents: docsWithTitles,
      navItems: navItems.map((item) => ({
        id: item._id,
        label: item.label,
        externalUrl: item.externalUrl,
        documentId: item.documentId,
        position: item.position,
        parentId: item.parentId,
        icon: item.icon,
      })),
    };
  },
});

export const searchPublicDocsInternal = internalQuery({
  args: {
    portalId: v.id("portals"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { portalId, query, limit = 10 }) => {
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = portalDocs.filter((d) => !d.isDraft && !d.isSection);

    const searchResults = [];
    const lowerQuery = query.toLowerCase();

    for (const pd of publishedDocs) {
      const doc = await ctx.db.get(pd.documentId);
      if (!doc) continue;

      const title = pd.titleOverride || doc.topic;
      const content = doc.content;

      // Simple text search
      const titleMatch = title.toLowerCase().includes(lowerQuery);
      const contentMatch = content.toLowerCase().includes(lowerQuery);

      if (titleMatch || contentMatch) {
        // Find snippet
        let snippet = "";
        const contentLower = content.toLowerCase();
        const idx = contentLower.indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(content.length, idx + query.length + 100);
          snippet = (start > 0 ? "..." : "") + content.substring(start, end) + (end < content.length ? "..." : "");
        } else {
          snippet = content.substring(0, 150) + "...";
        }

        searchResults.push({
          slug: pd.slug,
          title,
          snippet,
          score: titleMatch ? 2 : 1,
        });
      }
    }

    return searchResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
});

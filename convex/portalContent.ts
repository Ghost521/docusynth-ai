import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════
// Public Portal Content API
// These queries are for rendering the public documentation portal
// ═══════════════════════════════════════════════════════════════

// Get public portal by subdomain
export const getPublicPortal = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const portal = await ctx.db
      .query("portals")
      .withIndex("bySubdomain", (q) => q.eq("subdomain", subdomain))
      .unique();

    if (!portal || !portal.isPublished) {
      return null;
    }

    // Return public-safe portal data (exclude password hash)
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

// Get public portal by custom domain
export const getPublicPortalByDomain = query({
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

// Get public document by slug
export const getPublicDocument = query({
  args: {
    portalId: v.id("portals"),
    slug: v.string(),
  },
  handler: async (ctx, { portalId, slug }) => {
    // Verify portal is published
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished) {
      return null;
    }

    // Find the portal document by slug
    const portalDoc = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndSlug", (q) => q.eq("portalId", portalId).eq("slug", slug))
      .unique();

    if (!portalDoc || portalDoc.isDraft || portalDoc.isSection) {
      return null;
    }

    // Get the actual document content
    const document = await ctx.db.get(portalDoc.documentId);
    if (!document) {
      return null;
    }

    // Get navigation for prev/next
    const allDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = allDocs
      .filter((d) => !d.isDraft && !d.isSection)
      .sort((a, b) => a.position - b.position);

    const currentIndex = publishedDocs.findIndex((d) => d._id === portalDoc._id);

    let prevDoc = null;
    let nextDoc = null;

    if (currentIndex > 0) {
      const prev = publishedDocs[currentIndex - 1];
      const prevDocument = await ctx.db.get(prev.documentId);
      prevDoc = {
        slug: prev.slug,
        title: prev.titleOverride || prevDocument?.topic || "Previous",
      };
    }

    if (currentIndex < publishedDocs.length - 1) {
      const next = publishedDocs[currentIndex + 1];
      const nextDocument = await ctx.db.get(next.documentId);
      nextDoc = {
        slug: next.slug,
        title: next.titleOverride || nextDocument?.topic || "Next",
      };
    }

    return {
      slug: portalDoc.slug,
      title: portalDoc.titleOverride || document.topic,
      description: portalDoc.descriptionOverride,
      content: document.content,
      sources: document.sources,
      createdAt: document.createdAt,
      publishedAt: portalDoc.publishedAt,
      updatedAt: portalDoc.updatedAt,
      icon: portalDoc.icon,
      navigation: {
        prev: prevDoc,
        next: nextDoc,
      },
    };
  },
});

// Get navigation structure
export const getNavigation = query({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    // Verify portal is published
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished) {
      return null;
    }

    // Get all portal documents
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    // Filter out drafts
    const publishedDocs = portalDocs.filter((d) => !d.isDraft);

    // Build navigation items with document titles
    const navItems = await Promise.all(
      publishedDocs.map(async (pd) => {
        if (pd.isSection) {
          return {
            id: pd._id.toString(),
            type: "section" as const,
            slug: pd.slug,
            title: pd.sectionName || "Section",
            position: pd.position,
            parentId: pd.parentId?.toString(),
            icon: pd.icon,
            children: [],
          };
        }

        const doc = await ctx.db.get(pd.documentId);
        return {
          id: pd._id.toString(),
          type: "document" as const,
          slug: pd.slug,
          title: pd.titleOverride || doc?.topic || "Document",
          description: pd.descriptionOverride || doc?.content?.substring(0, 100),
          position: pd.position,
          parentId: pd.parentId?.toString(),
          icon: pd.icon,
          children: [],
        };
      })
    );

    // Build tree structure
    const itemMap = new Map(navItems.map((item) => [item.id, item]));
    const rootItems: typeof navItems = [];

    for (const item of navItems) {
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!;
        parent.children.push(item);
      } else {
        rootItems.push(item);
      }
    }

    // Sort children by position
    const sortChildren = (items: typeof navItems) => {
      items.sort((a, b) => a.position - b.position);
      for (const item of items) {
        if (item.children.length > 0) {
          sortChildren(item.children);
        }
      }
    };

    sortChildren(rootItems);

    // Get external nav items
    const externalNavItems = await ctx.db
      .query("portalNavItems")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    return {
      items: rootItems,
      externalLinks: externalNavItems.map((item) => ({
        id: item._id.toString(),
        label: item.label,
        url: item.externalUrl,
        icon: item.icon,
        position: item.position,
      })),
    };
  },
});

// Search public documents
export const searchPublicDocs = query({
  args: {
    portalId: v.id("portals"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { portalId, query, limit = 20 }) => {
    // Verify portal is published
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished) {
      return [];
    }

    // Get all published documents
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = portalDocs.filter((d) => !d.isDraft && !d.isSection);

    // Search through documents
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const pd of publishedDocs) {
      const doc = await ctx.db.get(pd.documentId);
      if (!doc) continue;

      const title = (pd.titleOverride || doc.topic).toLowerCase();
      const content = doc.content.toLowerCase();

      // Calculate relevance score
      let score = 0;
      let matchType: "title" | "content" | "both" = "content";

      if (title.includes(lowerQuery)) {
        score += 10;
        matchType = "title";
      }

      // Count occurrences in content
      const occurrences = (content.match(new RegExp(lowerQuery, "g")) || []).length;
      if (occurrences > 0) {
        score += Math.min(occurrences, 5);
        if (matchType === "title") {
          matchType = "both";
        }
      }

      if (score > 0) {
        // Generate snippet with highlighted context
        let snippet = "";
        const idx = content.indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(doc.content.length, idx + query.length + 120);
          snippet =
            (start > 0 ? "..." : "") +
            doc.content.substring(start, end) +
            (end < doc.content.length ? "..." : "");
        } else {
          snippet = doc.content.substring(0, 180) + "...";
        }

        results.push({
          slug: pd.slug,
          title: pd.titleOverride || doc.topic,
          snippet,
          matchType,
          score,
        });
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
});

// Get recent updates for homepage
export const getRecentUpdates = query({
  args: {
    portalId: v.id("portals"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { portalId, limit = 5 }) => {
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished) {
      return [];
    }

    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = portalDocs.filter((d) => !d.isDraft && !d.isSection);

    // Sort by updatedAt
    const sorted = publishedDocs.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);

    // Get document details
    const results = await Promise.all(
      sorted.map(async (pd) => {
        const doc = await ctx.db.get(pd.documentId);
        return {
          slug: pd.slug,
          title: pd.titleOverride || doc?.topic || "Document",
          description: pd.descriptionOverride || doc?.content?.substring(0, 150),
          updatedAt: pd.updatedAt,
          icon: pd.icon,
        };
      })
    );

    return results;
  },
});

// Get featured documents for homepage
export const getFeaturedDocs = query({
  args: {
    portalId: v.id("portals"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { portalId, limit = 6 }) => {
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished) {
      return [];
    }

    // For now, just return the first few documents
    // In a future version, we could add a "featured" flag
    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortalAndPosition", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = portalDocs
      .filter((d) => !d.isDraft && !d.isSection)
      .slice(0, limit);

    const results = await Promise.all(
      publishedDocs.map(async (pd) => {
        const doc = await ctx.db.get(pd.documentId);
        return {
          slug: pd.slug,
          title: pd.titleOverride || doc?.topic || "Document",
          description: pd.descriptionOverride || doc?.content?.substring(0, 200),
          icon: pd.icon,
        };
      })
    );

    return results;
  },
});

// Verify portal password
export const verifyPortalPassword = query({
  args: {
    portalId: v.id("portals"),
    password: v.string(),
  },
  handler: async (ctx, { portalId, password }) => {
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished || portal.accessType !== "password") {
      return false;
    }

    // Simple comparison - in production, use proper password hashing
    return portal.password === password;
  },
});

// Generate sitemap data
export const getSitemapData = query({
  args: { portalId: v.id("portals") },
  handler: async (ctx, { portalId }) => {
    const portal = await ctx.db.get(portalId);
    if (!portal || !portal.isPublished || portal.accessType !== "public") {
      return null;
    }

    const portalDocs = await ctx.db
      .query("portalDocuments")
      .withIndex("byPortal", (q) => q.eq("portalId", portalId))
      .collect();

    const publishedDocs = portalDocs.filter((d) => !d.isDraft && !d.isSection);

    const baseUrl = portal.customDomain
      ? `https://${portal.customDomain}`
      : `https://${portal.subdomain}.docusynth.io`;

    const urls = [
      {
        loc: baseUrl,
        lastmod: new Date(portal.updatedAt).toISOString().split("T")[0],
        priority: 1.0,
      },
    ];

    for (const pd of publishedDocs) {
      urls.push({
        loc: `${baseUrl}/docs/${pd.slug}`,
        lastmod: new Date(pd.updatedAt).toISOString().split("T")[0],
        priority: 0.8,
      });
    }

    return {
      portalName: portal.name,
      baseUrl,
      urls,
    };
  },
});

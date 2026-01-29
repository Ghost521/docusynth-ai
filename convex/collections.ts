import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import { Doc, Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Collections Backend - Feature #24
// ═══════════════════════════════════════════════════════════════

// Smart collection rule validators
const smartRuleValidator = v.object({
  field: v.union(
    v.literal("tag"),
    v.literal("project"),
    v.literal("date"),
    v.literal("source"),
    v.literal("visibility")
  ),
  operator: v.union(
    v.literal("equals"),
    v.literal("not_equals"),
    v.literal("contains"),
    v.literal("not_contains"),
    v.literal("before"),
    v.literal("after"),
    v.literal("between")
  ),
  value: v.string(),
  secondValue: v.optional(v.string()), // For "between" operator
});

const smartRulesValidator = v.object({
  logic: v.union(v.literal("and"), v.literal("or")),
  rules: v.array(smartRuleValidator),
});

// ═══════════════════════════════════════════════════════════════
// Query Functions
// ═══════════════════════════════════════════════════════════════

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    parentId: v.optional(v.id("collections")),
    includeNested: v.optional(v.boolean()),
  },
  handler: async (ctx, { workspaceId, parentId, includeNested = false }) => {
    const userId = await getUserId(ctx);

    let collections;

    if (workspaceId) {
      collections = await ctx.db
        .query("collections")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    } else {
      collections = await ctx.db
        .query("collections")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .collect();
    }

    // Filter by parent if specified
    if (parentId !== undefined) {
      collections = collections.filter((c) => c.parentId === parentId);
    } else if (!includeNested) {
      // Only top-level collections if no parent specified and not including nested
      collections = collections.filter((c) => !c.parentId);
    }

    // Add document counts
    const collectionsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        const docCount = await ctx.db
          .query("collectionDocuments")
          .withIndex("byCollection", (q) => q.eq("collectionId", collection._id))
          .collect();
        return {
          ...collection,
          documentCount: docCount.length,
        };
      })
    );

    return collectionsWithCounts.sort((a, b) => a.order - b.order);
  },
});

export const get = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) return null;

    // Get documents in collection
    const collectionDocs = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollection", (q) => q.eq("collectionId", id))
      .collect();

    // Sort by position
    collectionDocs.sort((a, b) => a.position - b.position);

    // Fetch actual documents
    const documents = await Promise.all(
      collectionDocs.map(async (cd) => {
        const doc = await ctx.db.get(cd.documentId);
        return doc ? { ...doc, collectionPosition: cd.position } : null;
      })
    );

    // Get nested collections
    const nestedCollections = await ctx.db
      .query("collections")
      .withIndex("byParent", (q) => q.eq("parentId", id))
      .collect();

    return {
      ...collection,
      documents: documents.filter(Boolean),
      nestedCollections: nestedCollections.sort((a, b) => a.order - b.order),
    };
  },
});

export const getWithDocuments = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) return null;

    // Get documents in collection
    const collectionDocs = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollection", (q) => q.eq("collectionId", id))
      .collect();

    // Sort by position
    collectionDocs.sort((a, b) => a.position - b.position);

    // Fetch actual documents with full content
    const documents = await Promise.all(
      collectionDocs.map(async (cd) => {
        const doc = await ctx.db.get(cd.documentId);
        if (!doc) return null;
        return {
          _id: doc._id,
          topic: doc.topic,
          content: doc.content,
          sources: doc.sources,
          visibility: doc.visibility,
          projectId: doc.projectId,
          createdAt: doc.createdAt,
          collectionPosition: cd.position,
        };
      })
    );

    return {
      ...collection,
      documents: documents.filter(Boolean),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Mutation Functions
// ═══════════════════════════════════════════════════════════════

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.id("collections")),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.union(v.literal("private"), v.literal("workspace"), v.literal("public")),
    isSmartCollection: v.optional(v.boolean()),
    smartRules: v.optional(smartRulesValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate parent exists and belongs to user
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.userId !== userId) {
        throw new Error("Parent collection not found");
      }
    }

    // Get order for new collection
    let existingCount = 0;
    if (args.parentId) {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byParent", (q) => q.eq("parentId", args.parentId))
        .collect();
      existingCount = siblings.length;
    } else if (args.workspaceId) {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();
      existingCount = siblings.length;
    } else {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("workspaceId"), undefined),
            q.eq(q.field("parentId"), undefined)
          )
        )
        .collect();
      existingCount = siblings.length;
    }

    const id = await ctx.db.insert("collections", {
      userId,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      icon: args.icon || "Folder",
      color: args.color || "#6366f1",
      parentId: args.parentId,
      isSmartCollection: args.isSmartCollection || false,
      smartRules: args.smartRules,
      visibility: args.visibility,
      sharedWith: [],
      order: existingCount,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.union(v.id("collections"), v.null())),
    visibility: v.optional(v.union(v.literal("private"), v.literal("workspace"), v.literal("public"))),
    smartRules: v.optional(smartRulesValidator),
  },
  handler: async (ctx, { id, parentId, ...updates }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Validate parent change doesn't create circular reference
    if (parentId !== undefined) {
      if (parentId !== null) {
        // Check not setting parent to self
        if (parentId === id) {
          throw new Error("Cannot set collection as its own parent");
        }
        // Check not setting parent to a child of this collection
        let current = await ctx.db.get(parentId);
        while (current && current.parentId) {
          if (current.parentId === id) {
            throw new Error("Cannot create circular collection hierarchy");
          }
          current = await ctx.db.get(current.parentId);
        }
      }
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.icon !== undefined) patch.icon = updates.icon;
    if (updates.color !== undefined) patch.color = updates.color;
    if (updates.visibility !== undefined) patch.visibility = updates.visibility;
    if (updates.smartRules !== undefined) patch.smartRules = updates.smartRules;
    if (parentId !== undefined) patch.parentId = parentId === null ? undefined : parentId;

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Delete all document associations
    const collectionDocs = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollection", (q) => q.eq("collectionId", id))
      .collect();

    for (const cd of collectionDocs) {
      await ctx.db.delete(cd._id);
    }

    // Delete all bundles for this collection
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("byCollection", (q) => q.eq("collectionId", id))
      .collect();

    for (const bundle of bundles) {
      // Delete bundle shares
      const shares = await ctx.db
        .query("bundleShares")
        .withIndex("byBundle", (q) => q.eq("bundleId", bundle._id))
        .collect();
      for (const share of shares) {
        await ctx.db.delete(share._id);
      }
      // Delete bundle downloads
      const downloads = await ctx.db
        .query("bundleDownloads")
        .withIndex("byBundle", (q) => q.eq("bundleId", bundle._id))
        .collect();
      for (const dl of downloads) {
        await ctx.db.delete(dl._id);
      }
      await ctx.db.delete(bundle._id);
    }

    // Recursively delete nested collections
    const nestedCollections = await ctx.db
      .query("collections")
      .withIndex("byParent", (q) => q.eq("parentId", id))
      .collect();

    for (const nested of nestedCollections) {
      // Move nested collections to parent level instead of deleting
      await ctx.db.patch(nested._id, { parentId: collection.parentId });
    }

    await ctx.db.delete(id);
  },
});

export const addDocument = mutation({
  args: {
    collectionId: v.id("collections"),
    documentId: v.id("documents"),
    position: v.optional(v.number()),
  },
  handler: async (ctx, { collectionId, documentId, position }) => {
    const userId = await getUserId(ctx);

    // Verify collection ownership
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Verify document ownership
    const document = await ctx.db.get(documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found");
    }

    // Check if already in collection
    const existing = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollectionAndDocument", (q) =>
        q.eq("collectionId", collectionId).eq("documentId", documentId)
      )
      .unique();

    if (existing) {
      throw new Error("Document already in collection");
    }

    // Get position if not specified
    let finalPosition = position;
    if (finalPosition === undefined) {
      const docs = await ctx.db
        .query("collectionDocuments")
        .withIndex("byCollection", (q) => q.eq("collectionId", collectionId))
        .collect();
      finalPosition = docs.length;
    }

    await ctx.db.insert("collectionDocuments", {
      collectionId,
      documentId,
      position: finalPosition,
      addedAt: Date.now(),
    });

    // Update collection timestamp
    await ctx.db.patch(collectionId, { updatedAt: Date.now() });
  },
});

export const removeDocument = mutation({
  args: {
    collectionId: v.id("collections"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, { collectionId, documentId }) => {
    const userId = await getUserId(ctx);

    // Verify collection ownership
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    const collectionDoc = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollectionAndDocument", (q) =>
        q.eq("collectionId", collectionId).eq("documentId", documentId)
      )
      .unique();

    if (!collectionDoc) {
      throw new Error("Document not in collection");
    }

    // Reorder remaining documents
    const remainingDocs = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollection", (q) => q.eq("collectionId", collectionId))
      .collect();

    const removedPosition = collectionDoc.position;

    await ctx.db.delete(collectionDoc._id);

    // Update positions for documents after the removed one
    for (const doc of remainingDocs) {
      if (doc._id !== collectionDoc._id && doc.position > removedPosition) {
        await ctx.db.patch(doc._id, { position: doc.position - 1 });
      }
    }

    // Update collection timestamp
    await ctx.db.patch(collectionId, { updatedAt: Date.now() });
  },
});

export const reorderDocuments = mutation({
  args: {
    collectionId: v.id("collections"),
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, { collectionId, documentIds }) => {
    const userId = await getUserId(ctx);

    // Verify collection ownership
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Update positions
    for (let i = 0; i < documentIds.length; i++) {
      const collectionDoc = await ctx.db
        .query("collectionDocuments")
        .withIndex("byCollectionAndDocument", (q) =>
          q.eq("collectionId", collectionId).eq("documentId", documentIds[i])
        )
        .unique();

      if (collectionDoc) {
        await ctx.db.patch(collectionDoc._id, { position: i });
      }
    }

    // Update collection timestamp
    await ctx.db.patch(collectionId, { updatedAt: Date.now() });
  },
});

export const duplicate = mutation({
  args: {
    id: v.id("collections"),
    newName: v.optional(v.string()),
  },
  handler: async (ctx, { id, newName }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    // Get existing collections for order
    let existingCount = 0;
    if (collection.parentId) {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byParent", (q) => q.eq("parentId", collection.parentId))
        .collect();
      existingCount = siblings.length;
    } else if (collection.workspaceId) {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", collection.workspaceId))
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();
      existingCount = siblings.length;
    } else {
      const siblings = await ctx.db
        .query("collections")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("workspaceId"), undefined),
            q.eq(q.field("parentId"), undefined)
          )
        )
        .collect();
      existingCount = siblings.length;
    }

    // Create new collection
    const newId = await ctx.db.insert("collections", {
      userId,
      workspaceId: collection.workspaceId,
      name: newName || `${collection.name} (Copy)`,
      description: collection.description,
      icon: collection.icon,
      color: collection.color,
      parentId: collection.parentId,
      isSmartCollection: collection.isSmartCollection,
      smartRules: collection.smartRules,
      visibility: collection.visibility,
      sharedWith: [],
      order: existingCount,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Copy document associations (but not for smart collections)
    if (!collection.isSmartCollection) {
      const collectionDocs = await ctx.db
        .query("collectionDocuments")
        .withIndex("byCollection", (q) => q.eq("collectionId", id))
        .collect();

      for (const cd of collectionDocs) {
        await ctx.db.insert("collectionDocuments", {
          collectionId: newId,
          documentId: cd.documentId,
          position: cd.position,
          addedAt: Date.now(),
        });
      }
    }

    return newId;
  },
});

export const reorderCollections = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
  },
  handler: async (ctx, { collectionIds }) => {
    const userId = await getUserId(ctx);

    for (let i = 0; i < collectionIds.length; i++) {
      const collection = await ctx.db.get(collectionIds[i]);
      if (collection && collection.userId === userId) {
        await ctx.db.patch(collectionIds[i], { order: i });
      }
    }
  },
});

export const shareCollection = mutation({
  args: {
    id: v.id("collections"),
    shareWith: v.array(v.string()), // User IDs
    permission: v.union(v.literal("view"), v.literal("edit")),
  },
  handler: async (ctx, { id, shareWith, permission }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found");
    }

    const sharedWith = shareWith.map((uid) => ({
      userId: uid,
      permission,
      sharedAt: Date.now(),
    }));

    await ctx.db.patch(id, {
      sharedWith,
      updatedAt: Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// Smart Collection Functions
// ═══════════════════════════════════════════════════════════════

export const getSmartCollectionDocuments = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const userId = await getUserId(ctx);
    const collection = await ctx.db.get(id);
    if (!collection || collection.userId !== userId) return null;
    if (!collection.isSmartCollection || !collection.smartRules) return [];

    // Get all user's documents
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    // Get all document tags
    const allTags = await ctx.db
      .query("documentTags")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const tagsByDoc = new Map<string, string[]>();
    for (const tag of allTags) {
      const docTags = tagsByDoc.get(tag.documentId.toString()) || [];
      docTags.push(tag.tag);
      tagsByDoc.set(tag.documentId.toString(), docTags);
    }

    // Apply rules
    const rules = collection.smartRules;
    const matchingDocs = allDocs.filter((doc) => {
      const results = rules.rules.map((rule) => {
        const docTags = tagsByDoc.get(doc._id.toString()) || [];
        return evaluateRule(doc, rule, docTags);
      });

      if (rules.logic === "and") {
        return results.every(Boolean);
      } else {
        return results.some(Boolean);
      }
    });

    return matchingDocs;
  },
});

// Helper function to evaluate a single rule
function evaluateRule(
  doc: Doc<"documents">,
  rule: { field: string; operator: string; value: string; secondValue?: string },
  docTags: string[]
): boolean {
  switch (rule.field) {
    case "tag":
      return evaluateTagRule(docTags, rule.operator, rule.value);
    case "project":
      return evaluateProjectRule(doc.projectId?.toString(), rule.operator, rule.value);
    case "date":
      return evaluateDateRule(doc.createdAt, rule.operator, rule.value, rule.secondValue);
    case "source":
      return evaluateSourceRule(doc.sources, rule.operator, rule.value);
    case "visibility":
      return doc.visibility === rule.value;
    default:
      return false;
  }
}

function evaluateTagRule(tags: string[], operator: string, value: string): boolean {
  switch (operator) {
    case "equals":
      return tags.includes(value);
    case "not_equals":
      return !tags.includes(value);
    case "contains":
      return tags.some((t) => t.toLowerCase().includes(value.toLowerCase()));
    case "not_contains":
      return !tags.some((t) => t.toLowerCase().includes(value.toLowerCase()));
    default:
      return false;
  }
}

function evaluateProjectRule(projectId: string | undefined, operator: string, value: string): boolean {
  switch (operator) {
    case "equals":
      return projectId === value;
    case "not_equals":
      return projectId !== value;
    default:
      return false;
  }
}

function evaluateDateRule(
  timestamp: number,
  operator: string,
  value: string,
  secondValue?: string
): boolean {
  const docDate = new Date(timestamp);
  const compareDate = new Date(value);

  switch (operator) {
    case "before":
      return docDate < compareDate;
    case "after":
      return docDate > compareDate;
    case "between":
      if (!secondValue) return false;
      const endDate = new Date(secondValue);
      return docDate >= compareDate && docDate <= endDate;
    default:
      return false;
  }
}

function evaluateSourceRule(
  sources: Array<{ title: string; url: string }>,
  operator: string,
  value: string
): boolean {
  switch (operator) {
    case "contains":
      return sources.some(
        (s) =>
          s.url.toLowerCase().includes(value.toLowerCase()) ||
          s.title.toLowerCase().includes(value.toLowerCase())
      );
    case "not_contains":
      return !sources.some(
        (s) =>
          s.url.toLowerCase().includes(value.toLowerCase()) ||
          s.title.toLowerCase().includes(value.toLowerCase())
      );
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Internal Functions for API/Actions
// ═══════════════════════════════════════════════════════════════

export const getInternal = internalQuery({
  args: {
    collectionId: v.id("collections"),
    userId: v.string(),
  },
  handler: async (ctx, { collectionId, userId }) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.userId !== userId) return null;
    return collection;
  },
});

export const listDocumentsInternal = internalQuery({
  args: {
    collectionId: v.id("collections"),
  },
  handler: async (ctx, { collectionId }) => {
    const collectionDocs = await ctx.db
      .query("collectionDocuments")
      .withIndex("byCollection", (q) => q.eq("collectionId", collectionId))
      .collect();

    collectionDocs.sort((a, b) => a.position - b.position);

    const documents = await Promise.all(
      collectionDocs.map(async (cd) => {
        const doc = await ctx.db.get(cd.documentId);
        return doc;
      })
    );

    return documents.filter(Boolean);
  },
});

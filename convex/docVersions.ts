import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

export const listByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getUserId(ctx);
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) return [];

    return await ctx.db
      .query("docVersions")
      .withIndex("byDocument", (q) => q.eq("documentId", documentId))
      .collect();
  },
});

export const revert = mutation({
  args: {
    documentId: v.id("documents"),
    versionId: v.id("docVersions"),
  },
  handler: async (ctx, { documentId, versionId }) => {
    const userId = await getUserId(ctx);

    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Document not found");
    }

    const version = await ctx.db.get(versionId);
    if (!version || version.documentId !== documentId) {
      throw new Error("Version not found");
    }

    // Save current content as a pre-revert snapshot
    await ctx.db.insert("docVersions", {
      userId,
      documentId,
      content: doc.content,
      label: "Pre-Revert Snapshot",
      createdAt: Date.now(),
    });

    // Revert to the selected version's content
    await ctx.db.patch(documentId, { content: version.content });
  },
});

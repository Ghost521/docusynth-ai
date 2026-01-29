import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import { internal } from "./_generated/api";

// ===============================================================
// Types
// ===============================================================

const changeTypeValidator = v.union(
  v.literal("create_document"),
  v.literal("update_document"),
  v.literal("delete_document"),
  v.literal("update_visibility"),
  v.literal("move_document"),
  v.literal("create_project"),
  v.literal("delete_project")
);

const offlineChangeValidator = v.object({
  id: v.string(),
  type: changeTypeValidator,
  entityType: v.union(v.literal("document"), v.literal("project")),
  entityId: v.string(),
  payload: v.any(),
  timestamp: v.number(),
  clientId: v.string(),
});

// ===============================================================
// Batch Fetch Documents for Sync
// ===============================================================

export const getDocumentsForSync = query({
  args: {
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, { documentIds }) => {
    const userId = await getUserId(ctx);

    const documents = await Promise.all(
      documentIds.map(async (id) => {
        const doc = await ctx.db.get(id);
        if (!doc || doc.userId !== userId) return null;
        return {
          _id: doc._id,
          topic: doc.topic,
          content: doc.content,
          projectId: doc.projectId,
          visibility: doc.visibility,
          sources: doc.sources,
          createdAt: doc.createdAt,
          updatedAt: (doc as any).updatedAt || doc.createdAt,
        };
      })
    );

    return documents.filter(Boolean);
  },
});

// ===============================================================
// Get Latest Versions (for conflict detection)
// ===============================================================

export const getLatestVersions = query({
  args: {
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, { documentIds }) => {
    const userId = await getUserId(ctx);

    const versions: Record<string, { updatedAt: number; version: number }> = {};

    for (const id of documentIds) {
      const doc = await ctx.db.get(id);
      if (doc && doc.userId === userId) {
        // Count versions
        const docVersions = await ctx.db
          .query("docVersions")
          .withIndex("byDocument", (q) => q.eq("documentId", id))
          .collect();

        versions[id] = {
          updatedAt: (doc as any).updatedAt || doc.createdAt,
          version: docVersions.length,
        };
      }
    }

    return versions;
  },
});

// ===============================================================
// Apply Offline Changes
// ===============================================================

export const applyOfflineChanges = action({
  args: {
    changes: v.array(offlineChangeValidator),
  },
  handler: async (ctx, { changes }) => {
    const results: Array<{
      changeId: string;
      success: boolean;
      conflict: boolean;
      error?: string;
    }> = [];

    for (const change of changes) {
      try {
        // Check for conflicts
        const conflict = await ctx.runQuery(internal.offlineSync.checkConflict, {
          entityId: change.entityId,
          entityType: change.entityType,
          clientTimestamp: change.timestamp,
        });

        if (conflict.hasConflict) {
          results.push({
            changeId: change.id,
            success: false,
            conflict: true,
            error: "Server has newer changes",
          });
          continue;
        }

        // Apply the change
        await ctx.runMutation(internal.offlineSync.applyChange, {
          type: change.type,
          entityType: change.entityType,
          entityId: change.entityId,
          payload: change.payload,
        });

        results.push({
          changeId: change.id,
          success: true,
          conflict: false,
        });
      } catch (error) {
        results.push({
          changeId: change.id,
          success: false,
          conflict: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

// ===============================================================
// Detect Conflicts
// ===============================================================

export const detectConflicts = query({
  args: {
    changes: v.array(
      v.object({
        entityId: v.string(),
        entityType: v.union(v.literal("document"), v.literal("project")),
        timestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, { changes }) => {
    const userId = await getUserId(ctx);

    const conflicts: Array<{
      entityId: string;
      hasConflict: boolean;
      serverTimestamp?: number;
      localTimestamp: number;
    }> = [];

    for (const change of changes) {
      if (change.entityType === "document") {
        try {
          const doc = await ctx.db.get(change.entityId as any);
          if (doc && doc.userId === userId) {
            const serverTimestamp = (doc as any).updatedAt || doc.createdAt;
            conflicts.push({
              entityId: change.entityId,
              hasConflict: serverTimestamp > change.timestamp,
              serverTimestamp,
              localTimestamp: change.timestamp,
            });
          }
        } catch {
          // Entity might be deleted
          conflicts.push({
            entityId: change.entityId,
            hasConflict: true,
            localTimestamp: change.timestamp,
          });
        }
      } else if (change.entityType === "project") {
        try {
          const project = await ctx.db.get(change.entityId as any);
          if (project && project.userId === userId) {
            const serverTimestamp = project.createdAt;
            conflicts.push({
              entityId: change.entityId,
              hasConflict: serverTimestamp > change.timestamp,
              serverTimestamp,
              localTimestamp: change.timestamp,
            });
          }
        } catch {
          conflicts.push({
            entityId: change.entityId,
            hasConflict: true,
            localTimestamp: change.timestamp,
          });
        }
      }
    }

    return conflicts;
  },
});

// ===============================================================
// Resolve Conflicts
// ===============================================================

export const resolveConflicts = mutation({
  args: {
    resolutions: v.array(
      v.object({
        entityId: v.string(),
        entityType: v.union(v.literal("document"), v.literal("project")),
        resolution: v.union(
          v.literal("keep_local"),
          v.literal("keep_server"),
          v.literal("merge")
        ),
        mergedContent: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { resolutions }) => {
    const userId = await getUserId(ctx);

    const results: Array<{
      entityId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const res of resolutions) {
      try {
        if (res.entityType === "document") {
          const doc = await ctx.db.get(res.entityId as any);
          if (!doc || doc.userId !== userId) {
            results.push({
              entityId: res.entityId,
              success: false,
              error: "Document not found",
            });
            continue;
          }

          if (res.resolution === "keep_local" && res.mergedContent) {
            // Update with local content
            await ctx.db.patch(doc._id, {
              content: res.mergedContent,
            });
          } else if (res.resolution === "merge" && res.mergedContent) {
            // Create version snapshot before merge
            await ctx.db.insert("docVersions", {
              userId,
              documentId: doc._id,
              content: doc.content,
              label: "Pre-merge backup",
              createdAt: Date.now(),
            });

            // Update with merged content
            await ctx.db.patch(doc._id, {
              content: res.mergedContent,
            });
          }
          // keep_server: no action needed, already at server state

          results.push({
            entityId: res.entityId,
            success: true,
          });
        }
      } catch (error) {
        results.push({
          entityId: res.entityId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

// ===============================================================
// Internal Functions
// ===============================================================

export const checkConflict = internalQuery({
  args: {
    entityId: v.string(),
    entityType: v.union(v.literal("document"), v.literal("project")),
    clientTimestamp: v.number(),
  },
  handler: async (ctx, { entityId, entityType, clientTimestamp }) => {
    if (entityType === "document") {
      try {
        const doc = await ctx.db.get(entityId as any);
        if (doc) {
          const serverTimestamp = (doc as any).updatedAt || doc.createdAt;
          return {
            hasConflict: serverTimestamp > clientTimestamp,
            serverTimestamp,
          };
        }
      } catch {
        return { hasConflict: true };
      }
    } else if (entityType === "project") {
      try {
        const project = await ctx.db.get(entityId as any);
        if (project) {
          return {
            hasConflict: project.createdAt > clientTimestamp,
            serverTimestamp: project.createdAt,
          };
        }
      } catch {
        return { hasConflict: true };
      }
    }

    return { hasConflict: false };
  },
});

export const applyChange = internalMutation({
  args: {
    type: changeTypeValidator,
    entityType: v.union(v.literal("document"), v.literal("project")),
    entityId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { type, entityType, entityId, payload }) => {
    switch (type) {
      case "update_document": {
        const doc = await ctx.db.get(entityId as any);
        if (doc && payload.content !== undefined) {
          // Create version snapshot
          await ctx.db.insert("docVersions", {
            userId: doc.userId,
            documentId: doc._id,
            content: doc.content,
            label: "Offline sync",
            createdAt: Date.now(),
          });

          await ctx.db.patch(doc._id, {
            content: payload.content,
            ...(payload.topic && { topic: payload.topic }),
          });
        }
        break;
      }

      case "update_visibility": {
        const doc = await ctx.db.get(entityId as any);
        if (doc && payload.visibility) {
          await ctx.db.patch(doc._id, {
            visibility: payload.visibility,
          });
        }
        break;
      }

      case "move_document": {
        const doc = await ctx.db.get(entityId as any);
        if (doc) {
          await ctx.db.patch(doc._id, {
            projectId: payload.projectId || undefined,
          });
        }
        break;
      }

      case "delete_document": {
        const doc = await ctx.db.get(entityId as any);
        if (doc) {
          // Delete versions first
          const versions = await ctx.db
            .query("docVersions")
            .withIndex("byDocument", (q) => q.eq("documentId", doc._id))
            .collect();

          for (const version of versions) {
            await ctx.db.delete(version._id);
          }

          await ctx.db.delete(doc._id);
        }
        break;
      }

      case "create_project": {
        // Project already exists if we get here, skip
        break;
      }

      case "delete_project": {
        const project = await ctx.db.get(entityId as any);
        if (project) {
          await ctx.db.delete(project._id);
        }
        break;
      }
    }
  },
});

// ===============================================================
// Sync Metadata
// ===============================================================

export const getSyncMetadata = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Get counts
    const documents = await ctx.db
      .query("documents")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    return {
      documentCount: documents.length,
      projectCount: projects.length,
      lastServerUpdate: Date.now(),
    };
  },
});

// ===============================================================
// Full Sync (for initial offline setup)
// ===============================================================

export const getFullSyncData = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Get all documents
    const documentsQuery = workspaceId
      ? ctx.db
          .query("documents")
          .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      : ctx.db
          .query("documents")
          .withIndex("byUser", (q) => q.eq("userId", userId));

    const documents = await documentsQuery.collect();

    // Get all projects
    const projectsQuery = workspaceId
      ? ctx.db
          .query("projects")
          .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      : ctx.db
          .query("projects")
          .withIndex("byUser", (q) => q.eq("userId", userId));

    const projects = await projectsQuery.collect();

    return {
      documents: documents.map((doc) => ({
        _id: doc._id,
        topic: doc.topic,
        content: doc.content,
        projectId: doc.projectId,
        visibility: doc.visibility,
        sources: doc.sources,
        createdAt: doc.createdAt,
      })),
      projects: projects.map((project) => ({
        _id: project._id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        createdAt: project.createdAt,
      })),
      syncedAt: Date.now(),
    };
  },
});

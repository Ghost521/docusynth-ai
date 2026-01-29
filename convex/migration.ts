import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * One-time migration action that imports data from the old localStorage-based
 * JSON export format into the Convex database for the authenticated user.
 *
 * Usage: Call this action with the JSON string from the "Export All" feature
 * of the previous version.
 */
export const importFromLocalStorage = action({
  args: {
    jsonData: v.string(),
  },
  handler: async (ctx, { jsonData }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const data = JSON.parse(jsonData);

    let projectsImported = 0;
    let docsImported = 0;

    // Map old project IDs to new Convex IDs
    const projectIdMap = new Map<string, any>();

    // Import projects
    if (data.projects && Array.isArray(data.projects)) {
      for (let i = 0; i < data.projects.length; i++) {
        const project = data.projects[i];
        const newId = await ctx.runMutation(internal.migrationHelpers.insertProject, {
          userId,
          name: project.name || "Untitled Project",
          description: project.description,
          visibility: project.visibility || "private",
          order: i,
          createdAt: project.createdAt || Date.now(),
        });
        projectIdMap.set(project.id, newId);
        projectsImported++;
      }
    }

    // Import documents (history)
    const docs = data.history || data.documents || [];
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        const projectId = doc.projectId ? projectIdMap.get(doc.projectId) : undefined;

        const newDocId = await ctx.runMutation(internal.migrationHelpers.insertDocument, {
          userId,
          topic: doc.topic || "Untitled",
          content: doc.content || "",
          sources: (doc.sources || []).map((s: any) => ({
            title: s.title || "Source",
            url: s.url || "",
          })),
          projectId,
          visibility: doc.visibility || "private",
          createdAt: doc.createdAt || Date.now(),
        });

        // Import versions if present
        if (doc.versions && Array.isArray(doc.versions)) {
          for (const version of doc.versions) {
            await ctx.runMutation(internal.migrationHelpers.insertVersion, {
              userId,
              documentId: newDocId,
              content: version.content || "",
              label: version.label,
              createdAt: version.createdAt || Date.now(),
            });
          }
        }

        docsImported++;
      }
    }

    return {
      success: true,
      projectsImported,
      docsImported,
    };
  },
});

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const GITHUB_API_BASE = "https://api.github.com";

async function getGitHubToken(ctx: any, userId: string): Promise<string> {
  const settings = await ctx.runQuery(internal.userSettings.getInternal, {
    userId,
  });
  if (!settings?.githubToken) {
    throw new Error("GitHub token not configured. Please add it in Settings.");
  }
  return settings.githubToken;
}

export const checkToken = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const token = await getGitHubToken(ctx, userId);

    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.login };
    }
    return { valid: false, username: null };
  },
});

export const createRepo = action({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, { name, description, isPrivate }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const token = await getGitHubToken(ctx, userId);

    const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create repository");
    }

    const repo = await response.json();
    return { owner: repo.owner.login, name: repo.name, url: repo.html_url };
  },
});

export const pushToGitHub = action({
  args: {
    documentId: v.id("documents"),
    owner: v.string(),
    repo: v.string(),
    path: v.string(),
    message: v.string(),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, owner, repo, path, message, branch }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const token = await getGitHubToken(ctx, userId);
    const branchName = branch || "main";

    // Get document content
    const doc = await ctx.runQuery(internal.documents.getInternal, {
      documentId,
      userId,
    });
    if (!doc) throw new Error("Document not found");

    // Check if file exists to get SHA (for update)
    let sha: string | undefined;
    const getUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branchName}`;

    const getResponse = await fetch(getUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    }

    // Base64 encode content (Node.js Buffer)
    const contentBase64 = Buffer.from(doc.content, "utf-8").toString("base64");

    // Create or update file
    const putUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch: branchName,
        sha,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to push file");
    }

    const result = await response.json();
    return { url: result.content.html_url };
  },
});

export const checkRepoExists = action({
  args: {
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, { owner, repo }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const token = await getGitHubToken(ctx, userId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    return { exists: response.ok };
  },
});

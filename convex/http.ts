import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  formatSlackError,
  formatDiscordError,
  type SlackMessage,
  type DiscordMessage,
} from "./botTypes";

const http = httpRouter();

// ===================
// CORS Helper
// ===================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

// ===================
// OPTIONS Handler (CORS preflight)
// ===================
http.route({
  path: "/api/documents",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/api/projects",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/api/generate",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/api/workspaces",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// ===================
// Health Check
// ===================
http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => {
    return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
  }),
});

// ===================
// Documents API
// ===================

// GET /api/documents - List documents
http.route({
  path: "/api/documents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    // Validate API key
    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    // Check scope
    if (!validation.scopes?.includes("documents:read")) {
      return errorResponse("Insufficient permissions: documents:read required", 403);
    }

    // Record usage
    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      // Get query params
      const url = new URL(request.url);
      const projectId = url.searchParams.get("projectId");
      const workspaceId = url.searchParams.get("workspaceId");

      const documents = await ctx.runQuery(internal.documents.listForApi, {
        userId: validation.userId!,
        projectId: projectId || undefined,
        workspaceId: workspaceId || undefined,
      });

      // Log request
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/documents",
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      return jsonResponse({ documents });
    } catch (error: any) {
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/documents",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// POST /api/documents - Create document
http.route({
  path: "/api/documents",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    if (!validation.scopes?.includes("documents:write")) {
      return errorResponse("Insufficient permissions: documents:write required", 403);
    }

    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      const body = await request.json();
      const { topic, content, sources, projectId, workspaceId, visibility } = body;

      if (!topic || !content) {
        return errorResponse("Missing required fields: topic, content", 400);
      }

      const documentId = await ctx.runMutation(internal.documents.createForApi, {
        userId: validation.userId!,
        topic,
        content,
        sources: sources || [],
        projectId,
        workspaceId,
        visibility: visibility || "private",
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/documents",
        statusCode: 201,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      // Trigger webhook
      await ctx.runAction(internal.webhooks.triggerEvent, {
        userId: validation.userId!,
        eventType: "document.created",
        data: { documentId, topic },
        workspaceId,
      });

      return jsonResponse({ documentId }, 201);
    } catch (error: any) {
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/documents",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// ===================
// Projects API
// ===================

// GET /api/projects - List projects
http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    if (!validation.scopes?.includes("projects:read")) {
      return errorResponse("Insufficient permissions: projects:read required", 403);
    }

    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      const url = new URL(request.url);
      const workspaceId = url.searchParams.get("workspaceId");

      const projects = await ctx.runQuery(internal.projects.listForApi, {
        userId: validation.userId!,
        workspaceId: workspaceId || undefined,
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/projects",
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      return jsonResponse({ projects });
    } catch (error: any) {
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/projects",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// POST /api/projects - Create project
http.route({
  path: "/api/projects",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    if (!validation.scopes?.includes("projects:write")) {
      return errorResponse("Insufficient permissions: projects:write required", 403);
    }

    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      const body = await request.json();
      const { name, description, workspaceId, visibility } = body;

      if (!name) {
        return errorResponse("Missing required field: name", 400);
      }

      const projectId = await ctx.runMutation(internal.projects.createForApi, {
        userId: validation.userId!,
        name,
        description,
        workspaceId,
        visibility: visibility || "private",
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/projects",
        statusCode: 201,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      // Trigger webhook
      await ctx.runAction(internal.webhooks.triggerEvent, {
        userId: validation.userId!,
        eventType: "project.created",
        data: { projectId, name },
        workspaceId,
      });

      return jsonResponse({ projectId }, 201);
    } catch (error: any) {
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/projects",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// ===================
// Workspaces API
// ===================

// GET /api/workspaces - List workspaces
http.route({
  path: "/api/workspaces",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    if (!validation.scopes?.includes("workspaces:read")) {
      return errorResponse("Insufficient permissions: workspaces:read required", 403);
    }

    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      const workspaces = await ctx.runQuery(internal.workspaces.listForApi, {
        userId: validation.userId!,
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/workspaces",
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      return jsonResponse({ workspaces });
    } catch (error: any) {
      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "GET",
        path: "/api/workspaces",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// ===================
// Generate API
// ===================

// POST /api/generate - Generate document
http.route({
  path: "/api/generate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return errorResponse("Missing API key", 401);
    }

    const validation = await ctx.runQuery(internal.apiKeys.validateKey, { apiKey });
    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid API key", 401);
    }

    if (!validation.scopes?.includes("generate")) {
      return errorResponse("Insufficient permissions: generate required", 403);
    }

    await ctx.runMutation(internal.apiKeys.recordUsage, {
      keyId: validation.keyId!,
      needsReset: validation.needsReset || false,
    });

    try {
      const body = await request.json();
      const { topic, mode, projectId, workspaceId, provider } = body;

      if (!topic) {
        return errorResponse("Missing required field: topic", 400);
      }

      // Trigger webhook for generation started
      await ctx.runAction(internal.webhooks.triggerEvent, {
        userId: validation.userId!,
        eventType: "generation.started",
        data: { topic, mode: mode || "research" },
        workspaceId,
      });

      // Create streaming session and start generation
      const sessionId = await ctx.runMutation(internal.streaming.createSession, {
        userId: validation.userId!,
        topic,
        mode: mode || "research",
        projectId,
      });

      // Start the generation in the background
      await ctx.scheduler.runAfter(0, internal.streaming.runGeneration, {
        sessionId,
        provider: provider || "gemini",
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/generate",
        statusCode: 202,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
      });

      return jsonResponse({
        sessionId,
        message: "Generation started. Poll GET /api/generate/:sessionId for status.",
      }, 202);
    } catch (error: any) {
      // Trigger webhook for generation failed
      await ctx.runAction(internal.webhooks.triggerEvent, {
        userId: validation.userId!,
        eventType: "generation.failed",
        data: { error: error.message },
      });

      await ctx.runMutation(internal.apiKeys.logRequest, {
        apiKeyId: validation.keyId!,
        userId: validation.userId!,
        method: "POST",
        path: "/api/generate",
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      return errorResponse(error.message, 500);
    }
  }),
});

// ===================
// Slack Bot Integration
// ===================

// OPTIONS handler for Slack
http.route({
  path: "/api/slack/events",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/api/slack/commands",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// Slack Events API - Handle events like app_mention
http.route({
  path: "/api/slack/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp") || "";
    const signature = request.headers.get("x-slack-signature") || "";

    // Get signing secret from environment
    const signingSecret = (process as any).env?.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("SLACK_SIGNING_SECRET not configured");
      return errorResponse("Server configuration error", 500);
    }

    // Verify Slack signature via internal action
    const isValid = await ctx.runAction(internal.bots.verifySlackSignatureAction, {
      signingSecret,
      requestSignature: signature,
      timestamp,
      body,
    });
    if (!isValid) {
      return errorResponse("Invalid signature", 401);
    }

    const payload = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return new Response(payload.challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Handle event callbacks
    if (payload.type === "event_callback") {
      const event = payload.event;

      // Handle app_mention events
      if (event.type === "app_mention") {
        const text = event.text || "";
        const teamId = payload.team_id;
        const channelId = event.channel;
        const userId = event.user;

        // Parse command from mention (e.g., "@DocuSynth search react hooks")
        const mentionPattern = /<@[A-Z0-9]+>\s*/;
        const commandText = text.replace(mentionPattern, "").trim();
        const [command, ...argParts] = commandText.split(/\s+/);
        const args = argParts.join(" ");

        // Handle the command
        const response = await ctx.runAction(internal.bots.handleBotCommand, {
          platform: "slack" as const,
          command: command?.toLowerCase() || "help",
          args,
          teamId,
          channelId,
          platformUserId: userId,
        });

        // Post response back to Slack
        const botConfig = await ctx.runQuery(internal.botsQueries.getBotConfig, {
          platform: "slack",
          teamId,
        });

        if (botConfig?.botToken) {
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${botConfig.botToken}`,
            },
            body: JSON.stringify({
              channel: channelId,
              ...(response as SlackMessage),
            }),
          });
        }
      }
    }

    // Acknowledge receipt
    return new Response(null, { status: 200, headers: corsHeaders });
  }),
});

// Slack Slash Commands
http.route({
  path: "/api/slack/commands",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp") || "";
    const signature = request.headers.get("x-slack-signature") || "";

    // Get signing secret from environment
    const signingSecret = (process as any).env?.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("SLACK_SIGNING_SECRET not configured");
      return jsonResponse(formatSlackError("Server configuration error"));
    }

    // Verify Slack signature via internal action
    const isValid = await ctx.runAction(internal.bots.verifySlackSignatureAction, {
      signingSecret,
      requestSignature: signature,
      timestamp,
      body,
    });
    if (!isValid) {
      return jsonResponse(formatSlackError("Invalid signature"));
    }

    // Parse URL-encoded form data
    const params = new URLSearchParams(body);
    const teamId = params.get("team_id") || "";
    const channelId = params.get("channel_id") || "";
    const userId = params.get("user_id") || "";
    const userName = params.get("user_name") || "";
    const commandText = params.get("text") || "";
    const responseUrl = params.get("response_url") || "";

    // Parse command and args
    const [command, ...argParts] = commandText.trim().split(/\s+/);
    const args = argParts.join(" ");

    // For quick commands, respond immediately
    if (command === "help" || command === "link" || !command) {
      const response = await ctx.runAction(internal.bots.handleBotCommand, {
        platform: "slack" as const,
        command: command || "help",
        args,
        teamId,
        channelId,
        platformUserId: userId,
        platformUserName: userName,
      });

      return jsonResponse(response);
    }

    // For longer commands, run async and post to response_url
    // We run it in the background via scheduler since we need to respond within 3s
    const handleAsyncCommand = async () => {
      try {
        const response = await ctx.runAction(internal.bots.handleBotCommand, {
          platform: "slack" as const,
          command,
          args,
          teamId,
          channelId,
          platformUserId: userId,
          platformUserName: userName,
        });

        // Send response to response_url
        if (responseUrl) {
          await fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              response_type: "in_channel",
              ...(response as SlackMessage),
            }),
          });
        }
      } catch (error: any) {
        // Send error to response_url
        if (responseUrl) {
          await fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              response_type: "ephemeral",
              text: `Error: ${error.message}`,
            }),
          });
        }
      }
    };

    // Run async without waiting (we can't await since we need to respond within 3s)
    // Note: In production, you might want to use ctx.scheduler.runAfter for reliability
    handleAsyncCommand();

    // Immediate acknowledgment
    return jsonResponse({
      response_type: "ephemeral",
      text: "Processing your request...",
    });
  }),
});

// ===================
// Discord Bot Integration
// ===================

// OPTIONS handler for Discord
http.route({
  path: "/api/discord/interactions",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// Discord Interactions endpoint
http.route({
  path: "/api/discord/interactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const timestamp = request.headers.get("x-signature-timestamp") || "";
    const signature = request.headers.get("x-signature-ed25519") || "";

    // Get public key from environment
    const publicKey = (process as any).env?.DISCORD_PUBLIC_KEY;
    if (!publicKey) {
      console.error("DISCORD_PUBLIC_KEY not configured");
      return errorResponse("Server configuration error", 500);
    }

    // Verify Discord signature via internal action
    const isValid = await ctx.runAction(internal.bots.verifyDiscordSignatureAction, {
      publicKey,
      signature,
      timestamp,
      body,
    });
    if (!isValid) {
      return errorResponse("Invalid signature", 401);
    }

    const payload = JSON.parse(body);

    // Handle PING (required for Discord verification)
    if (payload.type === 1) {
      return jsonResponse({ type: 1 });
    }

    // Handle APPLICATION_COMMAND (slash commands)
    if (payload.type === 2) {
      const commandName = payload.data?.name || "";
      const guildId = payload.guild_id;
      const channelId = payload.channel_id;
      const user = payload.member?.user || payload.user;
      const userId = user?.id || "";
      const userName = user?.username || "";

      // Get command options
      const options = payload.data?.options || [];
      let subCommand = "";
      let args = "";

      if (options.length > 0) {
        // Check if it's a subcommand
        if (options[0].type === 1) {
          subCommand = options[0].name;
          const subOptions = options[0].options || [];
          args = subOptions.map((o: any) => o.value).join(" ");
        } else {
          args = options.map((o: any) => o.value).join(" ");
        }
      }

      // Use subcommand as command, or the main command name
      const command = subCommand || commandName.replace("docusynth", "").replace("-", "") || "help";

      // For quick commands, respond immediately
      if (command === "help" || command === "link") {
        const response = await ctx.runAction(internal.bots.handleBotCommand, {
          platform: "discord" as const,
          command,
          args,
          guildId,
          channelId,
          platformUserId: userId,
          platformUserName: userName,
        });

        return jsonResponse({
          type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
          data: response as DiscordMessage,
        });
      }

      // For longer commands, defer and respond async
      const interactionToken = payload.token;
      const applicationId = payload.application_id;

      // Run async command handler
      const handleAsyncCommand = async () => {
        try {
          const response = await ctx.runAction(internal.bots.handleBotCommand, {
            platform: "discord" as const,
            command,
            args,
            guildId,
            channelId,
            platformUserId: userId,
            platformUserName: userName,
          });

          // Send follow-up message
          await fetch(
            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response as DiscordMessage),
            }
          );
        } catch (error: any) {
          // Send error follow-up
          await fetch(
            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `Error: ${error.message}`,
              }),
            }
          );
        }
      };

      // Run async without waiting
      handleAsyncCommand();

      // Return deferred response
      return jsonResponse({
        type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });
    }

    // Handle MESSAGE_COMPONENT (button clicks, etc.)
    if (payload.type === 3) {
      const customId = payload.data?.custom_id || "";
      const guildId = payload.guild_id;
      const channelId = payload.channel_id;
      const user = payload.member?.user || payload.user;
      const userId = user?.id || "";
      const userName = user?.username || "";

      // Parse custom_id for actions like "share_docId"
      if (customId.startsWith("share_")) {
        const docId = customId.replace("share_", "");

        const response = await ctx.runAction(internal.bots.handleBotCommand, {
          platform: "discord" as const,
          command: "share",
          args: docId,
          guildId,
          channelId,
          platformUserId: userId,
          platformUserName: userName,
        });

        return jsonResponse({
          type: 4,
          data: response as DiscordMessage,
        });
      }

      // Default acknowledgment for unknown components
      return jsonResponse({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
    }

    // Unknown interaction type
    return jsonResponse({ type: 1 });
  }),
});

// ===================
// Clerk Webhook (existing)
// ===================

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const payload = await request.json();
    const eventType = payload.type as string;

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const { id, first_name, last_name, email_addresses, image_url } =
          payload.data;
        const name = [first_name, last_name].filter(Boolean).join(" ") || "User";
        const email = email_addresses?.[0]?.email_address;

        await ctx.runMutation(internal.users.upsertFromClerk, {
          externalId: id,
          name,
          email,
          imageUrl: image_url,
        });
        break;
      }
      case "user.deleted": {
        const { id } = payload.data;
        if (id) {
          await ctx.runMutation(internal.users.deleteFromClerk, {
            externalId: id,
          });
        }
        break;
      }
    }

    return new Response(null, { status: 200 });
  }),
});

// ===================
// Public Documentation Portal API
// ===================

// CORS headers for portal
const portalCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

// OPTIONS handler for portal routes
http.route({
  path: "/portal/api/content",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: portalCorsHeaders })),
});

http.route({
  path: "/portal/api/search",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: portalCorsHeaders })),
});

http.route({
  path: "/portal/api/analytics",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: portalCorsHeaders })),
});

// Get portal by subdomain
http.route({
  path: "/portal/api/portal",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const subdomain = url.searchParams.get("subdomain");
    const domain = url.searchParams.get("domain");

    if (!subdomain && !domain) {
      return jsonResponse({ error: "subdomain or domain required" }, 400);
    }

    try {
      let portal;
      if (subdomain) {
        portal = await ctx.runQuery(internal.portals.getPublicPortalInternal, { subdomain });
      }
      // Domain lookup would be similar but using a different query

      if (!portal) {
        return jsonResponse({ error: "Portal not found" }, 404);
      }

      return new Response(JSON.stringify(portal), {
        status: 200,
        headers: { ...portalCorsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }),
});

// Get portal navigation
http.route({
  path: "/portal/api/navigation",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const portalId = url.searchParams.get("portalId");

    if (!portalId) {
      return jsonResponse({ error: "portalId required" }, 400);
    }

    try {
      const navigation = await ctx.runQuery(internal.portals.getPublicNavigationInternal, {
        portalId: portalId as any,
      });

      return new Response(JSON.stringify(navigation), {
        status: 200,
        headers: { ...portalCorsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }),
});

// Get portal document content
http.route({
  path: "/portal/api/content",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const portalId = url.searchParams.get("portalId");
    const slug = url.searchParams.get("slug");

    if (!portalId || !slug) {
      return jsonResponse({ error: "portalId and slug required" }, 400);
    }

    try {
      const document = await ctx.runQuery(internal.portals.getPublicDocumentInternal, {
        portalId: portalId as any,
        slug,
      });

      if (!document) {
        return jsonResponse({ error: "Document not found" }, 404);
      }

      return new Response(JSON.stringify(document), {
        status: 200,
        headers: { ...portalCorsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }),
});

// Search portal documents
http.route({
  path: "/portal/api/search",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const portalId = url.searchParams.get("portalId");
    const query = url.searchParams.get("q");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!portalId || !query) {
      return jsonResponse({ error: "portalId and q required" }, 400);
    }

    try {
      const results = await ctx.runQuery(internal.portals.searchPublicDocsInternal, {
        portalId: portalId as any,
        query,
        limit,
      });

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...portalCorsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }),
});

// Track page view (analytics)
http.route({
  path: "/portal/api/analytics",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { portalId, documentId, visitorId, path, referrer } = body;

      if (!portalId || !visitorId || !path) {
        return jsonResponse({ error: "portalId, visitorId, and path required" }, 400);
      }

      const userAgent = request.headers.get("user-agent") || undefined;

      await ctx.runMutation(internal.portals.trackPageView, {
        portalId: portalId as any,
        documentId: documentId as any,
        visitorId,
        path,
        referrer,
        userAgent,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...portalCorsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }),
});

// Generate sitemap.xml
http.route({
  path: "/portal/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const subdomain = url.searchParams.get("subdomain");

    if (!subdomain) {
      return new Response("subdomain required", { status: 400 });
    }

    try {
      // Get portal
      const portal = await ctx.runQuery(internal.portals.getPublicPortalInternal, { subdomain });
      if (!portal || portal.accessType !== "public") {
        return new Response("Portal not found", { status: 404 });
      }

      // Get navigation for document slugs
      const navigation = await ctx.runQuery(internal.portals.getPublicNavigationInternal, {
        portalId: portal._id,
      });

      const baseUrl = portal.customDomain
        ? `https://${portal.customDomain}`
        : `https://${subdomain}.docusynth.io`;

      // Build sitemap XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Homepage
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>1.0</priority>\n`;
      xml += `  </url>\n`;

      // Documents
      for (const doc of navigation.documents) {
        if (!doc.isSection) {
          xml += `  <url>\n`;
          xml += `    <loc>${baseUrl}/docs/${doc.slug}</loc>\n`;
          xml += `    <changefreq>weekly</changefreq>\n`;
          xml += `    <priority>0.8</priority>\n`;
          xml += `  </url>\n`;
        }
      }

      xml += '</urlset>';

      return new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error: any) {
      return new Response(`Error generating sitemap: ${error.message}`, { status: 500 });
    }
  }),
});

export default http;

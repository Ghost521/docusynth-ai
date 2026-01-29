import { query, mutation, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getUserId } from "./users";
import type { Id } from "./_generated/dataModel";

// Available webhook events
export const WEBHOOK_EVENTS = {
  "document.created": "When a new document is created",
  "document.updated": "When a document is updated",
  "document.deleted": "When a document is deleted",
  "project.created": "When a new project is created",
  "project.updated": "When a project is updated",
  "project.deleted": "When a project is deleted",
  "generation.started": "When document generation starts",
  "generation.completed": "When document generation completes",
  "generation.failed": "When document generation fails",
  "workspace.member_joined": "When a member joins a workspace",
  "workspace.member_left": "When a member leaves a workspace",
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert ArrayBuffer to base64url string
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Generate a secure webhook secret using Web Crypto API
function generateWebhookSecret(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${bufferToBase64Url(randomBytes.buffer)}`;
}

// Sign a webhook payload with HMAC-SHA256 using Web Crypto API
async function signPayload(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  // Import the secret as a key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const signature = bufferToHex(signatureBuffer);
  return `t=${timestamp},v1=${signature}`;
}

// ===================
// PUBLIC QUERIES
// ===================

// List all webhooks for the current user
export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    let webhooks;
    if (workspaceId) {
      webhooks = await ctx.db
        .query("webhooks")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    } else {
      webhooks = await ctx.db
        .query("webhooks")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .collect();
    }

    // Return webhooks without full secret (show only first 10 chars)
    return webhooks.map((wh) => ({
      ...wh,
      secret: wh.secret.substring(0, 16) + "...",
    }));
  },
});

// Get available webhook events
export const getEvents = query({
  args: {},
  handler: async () => {
    return Object.entries(WEBHOOK_EVENTS).map(([id, description]) => ({
      id,
      description,
    }));
  },
});

// Get delivery logs for a webhook
export const getDeliveryLogs = query({
  args: {
    webhookId: v.id("webhooks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { webhookId, limit = 50 }) => {
    const userId = await getUserId(ctx);

    // Verify ownership
    const webhook = await ctx.db.get(webhookId);
    if (!webhook || webhook.userId !== userId) {
      throw new Error("Webhook not found");
    }

    const logs = await ctx.db
      .query("webhookDeliveries")
      .withIndex("byWebhookAndCreatedAt", (q) => q.eq("webhookId", webhookId))
      .order("desc")
      .take(limit);

    return logs;
  },
});

// ===================
// PUBLIC MUTATIONS
// ===================

// Create a new webhook
export const create = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate URL
    try {
      new URL(args.url);
    } catch {
      throw new Error("Invalid URL");
    }

    // Validate events
    const validEvents = Object.keys(WEBHOOK_EVENTS);
    for (const event of args.events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid event: ${event}`);
      }
    }

    if (args.events.length === 0) {
      throw new Error("At least one event is required");
    }

    // Generate secret
    const secret = generateWebhookSecret();

    const id = await ctx.db.insert("webhooks", {
      userId,
      workspaceId: args.workspaceId,
      name: args.name,
      url: args.url,
      secret,
      events: args.events,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id, secret };
  },
});

// Update a webhook
export const update = mutation({
  args: {
    webhookId: v.id("webhooks"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.userId !== userId) {
      throw new Error("Webhook not found");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.url !== undefined) {
      try {
        new URL(args.url);
      } catch {
        throw new Error("Invalid URL");
      }
      updates.url = args.url;
    }

    if (args.events !== undefined) {
      const validEvents = Object.keys(WEBHOOK_EVENTS);
      for (const event of args.events) {
        if (!validEvents.includes(event)) {
          throw new Error(`Invalid event: ${event}`);
        }
      }
      updates.events = args.events;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    await ctx.db.patch(args.webhookId, updates);
  },
});

// Regenerate webhook secret
export const regenerateSecret = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, { webhookId }) => {
    const userId = await getUserId(ctx);

    const webhook = await ctx.db.get(webhookId);
    if (!webhook || webhook.userId !== userId) {
      throw new Error("Webhook not found");
    }

    const newSecret = generateWebhookSecret();
    await ctx.db.patch(webhookId, {
      secret: newSecret,
      updatedAt: Date.now(),
    });

    return { secret: newSecret };
  },
});

// Delete a webhook
export const remove = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, { webhookId }) => {
    const userId = await getUserId(ctx);

    const webhook = await ctx.db.get(webhookId);
    if (!webhook || webhook.userId !== userId) {
      throw new Error("Webhook not found");
    }

    // Delete delivery logs
    const logs = await ctx.db
      .query("webhookDeliveries")
      .withIndex("byWebhook", (q) => q.eq("webhookId", webhookId))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(webhookId);
  },
});

// Test a webhook (send a test event)
export const test = action({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, { webhookId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const webhook = await ctx.runQuery(internal.webhooks.getWebhookInternal, { webhookId });
    if (!webhook) {
      throw new Error("Webhook not found");
    }

    // Create test payload
    const payload = {
      event: "test",
      data: {
        message: "This is a test webhook delivery",
        timestamp: new Date().toISOString(),
      },
    };

    // Deliver the test webhook
    const result = await ctx.runAction(internal.webhooks.deliverWebhook, {
      webhookId,
      eventType: "test",
      payload,
    });

    return result;
  },
});

// ===================
// INTERNAL FUNCTIONS
// ===================

// Get webhook by ID (internal)
export const getWebhookInternal = internalQuery({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, { webhookId }) => {
    return await ctx.db.get(webhookId);
  },
});

// Get all webhooks subscribed to an event
export const getWebhooksForEvent = internalQuery({
  args: {
    userId: v.string(),
    eventType: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { userId, eventType, workspaceId }) => {
    // Get user's personal webhooks
    const personalWebhooks = await ctx.db
      .query("webhooks")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("workspaceId"), undefined)
        )
      )
      .collect();

    // Get workspace webhooks if applicable
    let workspaceWebhooks: typeof personalWebhooks = [];
    if (workspaceId) {
      workspaceWebhooks = await ctx.db
        .query("webhooks")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    }

    // Filter by event type
    const allWebhooks = [...personalWebhooks, ...workspaceWebhooks];
    return allWebhooks.filter((wh) => wh.events.includes(eventType));
  },
});

// Trigger webhooks for an event
export const triggerEvent = internalAction({
  args: {
    userId: v.string(),
    eventType: v.string(),
    data: v.any(),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    // Get all webhooks subscribed to this event
    const webhooks = await ctx.runQuery(internal.webhooks.getWebhooksForEvent, {
      userId: args.userId,
      eventType: args.eventType,
      workspaceId: args.workspaceId,
    });

    // Deliver to each webhook
    const results = await Promise.all(
      webhooks.map((webhook) =>
        ctx.runAction(internal.webhooks.deliverWebhook, {
          webhookId: webhook._id,
          eventType: args.eventType,
          payload: {
            event: args.eventType,
            data: args.data,
            timestamp: new Date().toISOString(),
          },
        }).catch((error) => ({
          webhookId: webhook._id,
          success: false,
          error: error.message,
        }))
      )
    );

    return results;
  },
});

// Deliver a webhook
export const deliverWebhook = internalAction({
  args: {
    webhookId: v.id("webhooks"),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { webhookId, eventType, payload }) => {
    const webhook = await ctx.runQuery(internal.webhooks.getWebhookInternal, { webhookId });
    if (!webhook) {
      throw new Error("Webhook not found");
    }

    // Create delivery record
    const deliveryId = await ctx.runMutation(internal.webhooks.createDelivery, {
      webhookId,
      eventType,
      payload,
    });

    // Sign the payload
    const payloadString = JSON.stringify(payload);
    const signature = await signPayload(payloadString, webhook.secret);

    // Deliver the webhook
    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": eventType,
          "X-Webhook-Delivery": deliveryId,
          "User-Agent": "DocuSynth-Webhook/1.0",
        },
        body: payloadString,
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => null);

      if (!response.ok) {
        errorMessage = `HTTP ${response.status}: ${responseBody?.substring(0, 200) || "Unknown error"}`;
      }
    } catch (error: any) {
      errorMessage = error.message || "Network error";
    }

    const responseTimeMs = Date.now() - startTime;
    const success = statusCode !== null && statusCode >= 200 && statusCode < 300;

    // Update delivery record
    await ctx.runMutation(internal.webhooks.updateDelivery, {
      deliveryId,
      status: success ? "success" : "failed",
      statusCode,
      responseBody: responseBody?.substring(0, 1000) || null,
      errorMessage,
      completedAt: Date.now(),
    });

    // Schedule retry if failed
    if (!success) {
      const delivery = await ctx.runQuery(internal.webhooks.getDeliveryInternal, { deliveryId });
      if (delivery && delivery.attempts < 3) {
        // Exponential backoff: 1min, 5min, 25min
        const delayMs = Math.pow(5, delivery.attempts) * 60 * 1000;
        await ctx.scheduler.runAfter(delayMs, internal.webhooks.retryDelivery, {
          deliveryId,
        });

        await ctx.runMutation(internal.webhooks.updateDelivery, {
          deliveryId,
          status: "retrying",
          nextRetryAt: Date.now() + delayMs,
        });
      }
    }

    return {
      success,
      statusCode,
      responseTimeMs,
      error: errorMessage,
    };
  },
});

// Retry a failed delivery
export const retryDelivery = internalAction({
  args: {
    deliveryId: v.id("webhookDeliveries"),
  },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.runQuery(internal.webhooks.getDeliveryInternal, { deliveryId });
    if (!delivery || delivery.status === "success") {
      return;
    }

    // Increment attempts
    await ctx.runMutation(internal.webhooks.incrementAttempts, { deliveryId });

    // Re-deliver
    await ctx.runAction(internal.webhooks.deliverWebhook, {
      webhookId: delivery.webhookId,
      eventType: delivery.eventType,
      payload: delivery.payload,
    });
  },
});

// Create delivery record
export const createDelivery = internalMutation({
  args: {
    webhookId: v.id("webhooks"),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("webhookDeliveries", {
      webhookId: args.webhookId,
      eventType: args.eventType,
      payload: args.payload,
      status: "pending",
      statusCode: null,
      responseBody: null,
      errorMessage: null,
      attempts: 1,
      nextRetryAt: null,
      createdAt: Date.now(),
      completedAt: null,
    });
  },
});

// Update delivery record
export const updateDelivery = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("retrying")
    )),
    statusCode: v.optional(v.union(v.number(), v.null())),
    responseBody: v.optional(v.union(v.string(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
    completedAt: v.optional(v.union(v.number(), v.null())),
    nextRetryAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { deliveryId, ...updates }) => {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    await ctx.db.patch(deliveryId, filtered);
  },
});

// Get delivery (internal)
export const getDeliveryInternal = internalQuery({
  args: {
    deliveryId: v.id("webhookDeliveries"),
  },
  handler: async (ctx, { deliveryId }) => {
    return await ctx.db.get(deliveryId);
  },
});

// Increment delivery attempts
export const incrementAttempts = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
  },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (delivery) {
      await ctx.db.patch(deliveryId, {
        attempts: delivery.attempts + 1,
      });
    }
  },
});

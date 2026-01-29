import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),

  projects: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")), // Team workspace scope
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
    order: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"]),

  documents: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")), // Team workspace scope
    topic: v.string(),
    content: v.string(),
    projectId: v.optional(v.id("projects")),
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("workspace")),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byUserAndProject", ["userId", "projectId"])
    .index("byUserAndCreatedAt", ["userId", "createdAt"]),

  docVersions: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    content: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
  }).index("byDocument", ["documentId"]),

  crawlTasks: defineTable({
    userId: v.string(),
    url: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"]),

  userSettings: defineTable({
    userId: v.string(),
    ollamaEndpoint: v.string(),
    ollamaBaseModel: v.string(),
    tabnineEnabled: v.boolean(),
    cursorRulesEnabled: v.boolean(),
    claudeModelPreference: v.string(),
    geminiModelPreference: v.string(),
    openAiEnabled: v.boolean(),
    openAiModelPreference: v.string(),
    customSystemInstruction: v.optional(v.string()),
    claudeApiKey: v.optional(v.string()),
    openAiApiKey: v.optional(v.string()),
    githubToken: v.optional(v.string()),
    crawlMaxPages: v.number(),
    crawlDepth: v.number(),
    crawlDelay: v.number(),
    crawlExcludePatterns: v.string(),
    // Multi-provider AI settings
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai"))),
  }).index("byUser", ["userId"]),

  // Full-text search index for documents
  documentSearchIndex: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    topic: v.string(),
    contentPreview: v.string(), // First 1000 chars for search display
    searchableText: v.string(), // Full text for search
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .searchIndex("search_content", {
      searchField: "searchableText",
      filterFields: ["userId"],
    }),

  // Document templates
  templates: defineTable({
    userId: v.optional(v.string()), // null for system templates
    name: v.string(),
    description: v.string(),
    category: v.string(),
    content: v.string(),
    isSystemTemplate: v.boolean(),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byCategory", ["category"]),

  // Analytics events for usage tracking
  analyticsEvents: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")), // Optional workspace scope
    eventType: v.string(),
    eventData: v.optional(v.any()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    // Generation mode for document events
    generationMode: v.optional(v.union(
      v.literal("search"),
      v.literal("crawl"),
      v.literal("github"),
      v.literal("mcp")
    )),
    // Performance metrics
    durationMs: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorType: v.optional(v.string()),
    // Content metrics
    wordCount: v.optional(v.number()),
    sourceCount: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndType", ["userId", "eventType"])
    .index("byUserAndTimestamp", ["userId", "timestamp"])
    .index("byTimestamp", ["timestamp"])
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndTimestamp", ["workspaceId", "timestamp"]),

  // Pre-aggregated daily statistics for faster dashboard loading
  dailyStats: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    date: v.string(), // YYYY-MM-DD format
    // Document generation stats
    documentsGenerated: v.number(),
    documentsByMode: v.object({
      search: v.number(),
      crawl: v.number(),
      github: v.number(),
      mcp: v.number(),
    }),
    avgGenerationTimeMs: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
    // Content metrics
    totalWordCount: v.number(),
    totalTokensUsed: v.number(),
    totalSourcesUsed: v.number(),
    // API & integration usage
    apiCallCount: v.number(),
    webhookDeliveryCount: v.number(),
    botCommandCount: v.number(),
    importCount: v.number(),
    // Provider breakdown
    providerUsage: v.any(), // Record<string, number>
    modelUsage: v.any(), // Record<string, number>
    // User activity (only for workspace-level)
    activeUserCount: v.optional(v.number()),
    // Computed at aggregation time
    aggregatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndDate", ["userId", "date"])
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndDate", ["workspaceId", "date"])
    .index("byDate", ["date"]),

  recentSearches: defineTable({
    userId: v.string(),
    query: v.string(),
    createdAt: v.number(),
  }).index("byUserAndCreatedAt", ["userId", "createdAt"]),

  rateLimitEvents: defineTable({
    userId: v.string(),
    timestamp: v.number(),
  }).index("byUserAndTimestamp", ["userId", "timestamp"]),

  // Streaming sessions for real-time document generation
  streamingSessions: defineTable({
    userId: v.string(),
    topic: v.string(),
    mode: v.string(),
    projectId: v.optional(v.id("projects")),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("completed"),
      v.literal("error")
    ),
    provider: v.union(v.string(), v.null()),
    model: v.union(v.string(), v.null()),
    tokensUsed: v.union(v.number(), v.null()),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    error: v.union(v.string(), v.null()),
    startedAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"]),

  // Team Workspaces
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(), // URL-friendly identifier
    description: v.optional(v.string()),
    ownerId: v.string(),
    settings: v.object({
      allowMemberInvites: v.boolean(), // Can members invite others?
      defaultDocVisibility: v.union(v.literal("workspace"), v.literal("private")),
      requireApprovalForPublic: v.boolean(), // Require owner approval for public docs?
    }),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    memberLimit: v.number(), // Max members based on plan
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byOwner", ["ownerId"])
    .index("bySlug", ["slug"]),

  // Workspace Members
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    joinedAt: v.number(),
    invitedBy: v.optional(v.string()),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byUser", ["userId"])
    .index("byWorkspaceAndUser", ["workspaceId", "userId"]),

  // Workspace Invitations
  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    invitedBy: v.string(),
    token: v.string(), // Unique invite token
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byEmail", ["email"])
    .index("byToken", ["token"]),

  // Workspace Activity Log (for audit trail)
  workspaceActivity: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    action: v.string(), // e.g., "member_invited", "document_created", "settings_changed"
    targetType: v.optional(v.string()), // e.g., "member", "document", "project"
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndTimestamp", ["workspaceId", "timestamp"]),

  // ═══════════════════════════════════════════════════════════════
  // REST API & Webhooks (Phase 4)
  // ═══════════════════════════════════════════════════════════════

  // API Keys for REST API authentication
  apiKeys: defineTable({
    userId: v.string(),
    name: v.string(), // User-friendly name for the key
    keyPrefix: v.string(), // First 8 chars of key for identification (e.g., "ds_abc123")
    keyHash: v.string(), // SHA-256 hash of the full key
    scopes: v.array(v.string()), // Permissions: ["documents:read", "documents:write", "generate", etc.]
    lastUsedAt: v.union(v.number(), v.null()),
    expiresAt: v.union(v.number(), v.null()), // null = never expires
    rateLimit: v.number(), // Requests per hour
    requestCount: v.number(), // Current hour request count
    requestCountResetAt: v.number(), // When to reset request count
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byKeyPrefix", ["keyPrefix"])
    .index("byKeyHash", ["keyHash"]),

  // Webhooks for event notifications
  webhooks: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")), // Optional workspace scope
    name: v.string(),
    url: v.string(), // Endpoint URL
    secret: v.string(), // For HMAC signature verification
    events: v.array(v.string()), // Events to subscribe to
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"]),

  // Webhook delivery logs
  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    eventType: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    statusCode: v.union(v.number(), v.null()),
    responseBody: v.union(v.string(), v.null()),
    errorMessage: v.union(v.string(), v.null()),
    attempts: v.number(),
    nextRetryAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
  })
    .index("byWebhook", ["webhookId"])
    .index("byStatus", ["status"])
    .index("byWebhookAndCreatedAt", ["webhookId", "createdAt"]),

  // API request logs for analytics and debugging
  apiRequestLogs: defineTable({
    apiKeyId: v.id("apiKeys"),
    userId: v.string(),
    method: v.string(),
    path: v.string(),
    statusCode: v.number(),
    responseTimeMs: v.number(),
    errorMessage: v.union(v.string(), v.null()),
    timestamp: v.number(),
  })
    .index("byApiKey", ["apiKeyId"])
    .index("byUser", ["userId"])
    .index("byTimestamp", ["timestamp"]),

  // ═══════════════════════════════════════════════════════════════
  // Scheduled Document Updates (Phase 5)
  // ═══════════════════════════════════════════════════════════════

  // Document update schedules
  documentSchedules: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    workspaceId: v.optional(v.id("workspaces")),
    // Schedule configuration
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    dayOfWeek: v.optional(v.number()), // 0-6 for weekly schedules (0 = Sunday)
    dayOfMonth: v.optional(v.number()), // 1-31 for monthly schedules
    hourOfDay: v.number(), // 0-23, hour to run the update (UTC)
    // Status tracking
    isActive: v.boolean(),
    lastRunAt: v.union(v.number(), v.null()),
    lastRunStatus: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped"),
      v.null()
    ),
    lastRunError: v.union(v.string(), v.null()),
    nextRunAt: v.number(), // Pre-computed next run timestamp
    // Statistics
    totalRuns: v.number(),
    successfulRuns: v.number(),
    failedRuns: v.number(),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .index("byNextRun", ["nextRunAt"])
    .index("byActiveAndNextRun", ["isActive", "nextRunAt"]),

  // Schedule run history
  scheduleRunHistory: defineTable({
    scheduleId: v.id("documentSchedules"),
    documentId: v.id("documents"),
    userId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    // Run details
    startedAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    durationMs: v.union(v.number(), v.null()),
    // Content tracking
    previousContentHash: v.union(v.string(), v.null()), // To detect changes
    newContentHash: v.union(v.string(), v.null()),
    contentChanged: v.union(v.boolean(), v.null()),
    // Provider info
    provider: v.union(v.string(), v.null()),
    model: v.union(v.string(), v.null()),
    tokensUsed: v.union(v.number(), v.null()),
    // Error info
    errorMessage: v.union(v.string(), v.null()),
  })
    .index("bySchedule", ["scheduleId"])
    .index("byDocument", ["documentId"])
    .index("byUser", ["userId"])
    .index("byStartedAt", ["startedAt"]),

  // ═══════════════════════════════════════════════════════════════
  // Document Comments & Annotations (Phase 3)
  // ═══════════════════════════════════════════════════════════════

  // Comment threads on documents
  documentComments: defineTable({
    documentId: v.id("documents"),
    userId: v.string(), // Author of the comment
    workspaceId: v.optional(v.id("workspaces")), // Workspace scope for team comments
    // Position in document
    selectionStart: v.optional(v.number()), // Character offset start
    selectionEnd: v.optional(v.number()), // Character offset end
    selectedText: v.optional(v.string()), // The text that was selected (for display even if content changes)
    lineNumber: v.optional(v.number()), // Alternative: line-based positioning
    // Comment content
    content: v.string(),
    // Status
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("wontfix")
    ),
    resolvedBy: v.optional(v.string()), // User who resolved
    resolvedAt: v.optional(v.number()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byDocumentAndStatus", ["documentId", "status"])
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"]),

  // Replies to comment threads
  commentReplies: defineTable({
    commentId: v.id("documentComments"),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byComment", ["commentId"])
    .index("byUser", ["userId"]),

  // ═══════════════════════════════════════════════════════════════
  // Real-Time Collaboration (Phase 3)
  // ═══════════════════════════════════════════════════════════════

  // Document presence - who is currently viewing/editing a document
  documentPresence: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    userColor: v.string(), // Assigned color for cursor/highlights
    // Cursor/selection state
    cursorPosition: v.optional(v.number()), // Character offset
    selectionStart: v.optional(v.number()),
    selectionEnd: v.optional(v.number()),
    // Activity state
    isEditing: v.boolean(),
    lastActivity: v.number(),
    // Session tracking
    sessionId: v.string(), // Unique per browser tab
  })
    .index("byDocument", ["documentId"])
    .index("byDocumentAndUser", ["documentId", "userId"])
    .index("bySession", ["sessionId"])
    .index("byLastActivity", ["lastActivity"]),

  // Document edit operations for operational transform / conflict resolution
  documentOperations: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    sessionId: v.string(),
    // Operation details
    operationType: v.union(
      v.literal("insert"),
      v.literal("delete"),
      v.literal("replace")
    ),
    position: v.number(), // Character offset where operation starts
    content: v.optional(v.string()), // Content for insert/replace
    deleteCount: v.optional(v.number()), // Characters to delete
    // Versioning
    baseVersion: v.number(), // Document version this operation is based on
    timestamp: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byDocumentAndTimestamp", ["documentId", "timestamp"]),

  // Document version tracking for collaborative editing
  documentCollabState: defineTable({
    documentId: v.id("documents"),
    version: v.number(), // Increments with each edit
    lastEditedBy: v.string(),
    lastEditedAt: v.number(),
  })
    .index("byDocument", ["documentId"]),

  // ═══════════════════════════════════════════════════════════════
  // Slack/Discord Bot Integrations (Phase 6)
  // ═══════════════════════════════════════════════════════════════

  // Bot configurations for Slack/Discord
  botConfigurations: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    platform: v.union(v.literal("slack"), v.literal("discord")),
    // Platform-specific identifiers
    teamId: v.optional(v.string()), // Slack team ID
    guildId: v.optional(v.string()), // Discord guild ID
    // Bot tokens (encrypted)
    botToken: v.string(),
    // Configuration
    defaultChannelId: v.optional(v.string()), // Default channel for notifications
    allowedChannels: v.array(v.string()), // Channels where bot can respond
    enabledCommands: v.array(v.string()), // Enabled slash commands
    // Status
    isActive: v.boolean(),
    lastActivityAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byPlatformAndTeam", ["platform", "teamId"])
    .index("byPlatformAndGuild", ["platform", "guildId"]),

  // Bot command logs for analytics and debugging
  botCommandLogs: defineTable({
    botConfigId: v.id("botConfigurations"),
    userId: v.string(),
    platform: v.union(v.literal("slack"), v.literal("discord")),
    command: v.string(),
    args: v.string(),
    channelId: v.string(),
    // User info from platform
    platformUserId: v.string(),
    platformUserName: v.optional(v.string()),
    // Response tracking
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed")
    ),
    responseTimeMs: v.union(v.number(), v.null()),
    errorMessage: v.union(v.string(), v.null()),
    // Result reference
    documentId: v.optional(v.id("documents")),
    timestamp: v.number(),
  })
    .index("byBotConfig", ["botConfigId"])
    .index("byUser", ["userId"])
    .index("byPlatform", ["platform"])
    .index("byTimestamp", ["timestamp"]),

  // Linked bot users (map platform users to DocuSynth users)
  botLinkedUsers: defineTable({
    userId: v.string(), // DocuSynth user ID
    platform: v.union(v.literal("slack"), v.literal("discord")),
    platformUserId: v.string(),
    platformUserName: v.optional(v.string()),
    teamId: v.optional(v.string()), // Slack team ID
    guildId: v.optional(v.string()), // Discord guild ID
    linkedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byPlatformUser", ["platform", "platformUserId"])
    .index("byPlatformAndTeam", ["platform", "teamId", "platformUserId"]),

  // ═══════════════════════════════════════════════════════════════
  // External Imports - Notion & Confluence (Phase 6)
  // ═══════════════════════════════════════════════════════════════

  // Connected external sources for imports
  importSources: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    // Source type and connection info
    sourceType: v.union(v.literal("notion"), v.literal("confluence")),
    name: v.string(), // User-friendly name for the connection
    // Connection credentials (encrypted)
    accessToken: v.optional(v.string()), // Notion integration token
    apiToken: v.optional(v.string()), // Confluence API token
    baseUrl: v.optional(v.string()), // Confluence base URL
    email: v.optional(v.string()), // Confluence email for auth
    // Connection status
    isActive: v.boolean(),
    lastSyncAt: v.union(v.number(), v.null()),
    lastSyncStatus: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("partial"),
      v.null()
    ),
    lastSyncError: v.union(v.string(), v.null()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndType", ["userId", "sourceType"])
    .index("byWorkspace", ["workspaceId"]),

  // Import jobs for tracking import progress
  importJobs: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    sourceId: v.id("importSources"),
    projectId: v.optional(v.id("projects")), // Target project for imports
    // Job configuration
    sourceType: v.union(v.literal("notion"), v.literal("confluence")),
    importType: v.union(
      v.literal("page"), // Single page
      v.literal("database"), // Notion database
      v.literal("space"), // Confluence space
      v.literal("batch") // Multiple selected pages
    ),
    // Source identifiers
    sourcePageIds: v.array(v.string()), // Page/database/space IDs to import
    sourcePageTitles: v.array(v.string()), // Original titles for reference
    // Progress tracking
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    totalItems: v.number(),
    processedItems: v.number(),
    successfulItems: v.number(),
    failedItems: v.number(),
    // Results
    documentIds: v.array(v.id("documents")), // Created document IDs
    errors: v.array(v.object({
      pageId: v.string(),
      pageTitle: v.string(),
      error: v.string(),
    })),
    // Timestamps
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"])
    .index("bySource", ["sourceId"])
    .index("byWorkspace", ["workspaceId"]),

  // Import history for de-duplication
  importHistory: defineTable({
    userId: v.string(),
    sourceId: v.id("importSources"),
    sourcePageId: v.string(), // External page ID
    documentId: v.id("documents"), // Local document ID
    // Version tracking for re-import detection
    lastImportedVersion: v.string(), // Hash or version ID from source
    lastImportedAt: v.number(),
    importCount: v.number(), // How many times this page has been imported
  })
    .index("bySource", ["sourceId"])
    .index("bySourceAndPage", ["sourceId", "sourcePageId"])
    .index("byDocument", ["documentId"]),

  // ═══════════════════════════════════════════════════════════════
  // Vector Embeddings & Semantic Search (Feature #17)
  // ═══════════════════════════════════════════════════════════════

  // Document embedding tracking (RAG component handles actual vectors)
  documentEmbeddings: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    // Embedding metadata
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    chunkCount: v.number(), // Number of chunks this document was split into
    entryId: v.optional(v.string()), // RAG component entry ID for deletion
    // Model info
    model: v.string(), // Embedding model used
    dimension: v.number(), // Vector dimension (1536 for text-embedding-3-small)
    // Error tracking
    error: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"]),

  // Embedding generation queue
  embeddingQueue: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    priority: v.union(
      v.literal("high"),
      v.literal("normal"),
      v.literal("low")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("failed")
    ),
    // Retry tracking
    attempts: v.number(),
    error: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byUser", ["userId"])
    .index("byStatus", ["status"])
    .index("byStatusAndPriority", ["status", "priority"]),

  // ===============================================================
  // Change Detection & Alerts (Feature #27)
  // ===============================================================

  // Source snapshots for change detection
  sourceSnapshots: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    sourceType: v.union(
      v.literal("url"),
      v.literal("github_repo"),
      v.literal("github_release"),
      v.literal("api_docs")
    ),
    contentHash: v.string(), // SHA-256 hash of normalized content
    contentSummary: v.string(), // First 500 chars or AI summary for display
    metadata: v.optional(v.object({
      // GitHub specific
      commitSha: v.optional(v.string()),
      releaseTag: v.optional(v.string()),
      // URL specific
      lastModified: v.optional(v.string()),
      etag: v.optional(v.string()),
      // General
      contentLength: v.optional(v.number()),
    })),
    checkedAt: v.number(),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .index("bySourceUrl", ["sourceUrl"])
    .index("byDocumentAndSource", ["documentId", "sourceUrl"]),

  // Change alerts
  changeAlerts: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    // Change details
    changeType: v.union(
      v.literal("content_modified"),
      v.literal("new_release"),
      v.literal("new_commit"),
      v.literal("source_unavailable"),
      v.literal("major_update"),
      v.literal("minor_update")
    ),
    significance: v.number(), // 0-100 score
    diffSummary: v.string(), // Human-readable summary of changes
    diffDetails: v.optional(v.object({
      addedLines: v.number(),
      removedLines: v.number(),
      changedSections: v.array(v.string()),
    })),
    // Previous and new hashes for comparison
    previousHash: v.string(),
    newHash: v.string(),
    // Status management
    status: v.union(
      v.literal("pending"),
      v.literal("read"),
      v.literal("dismissed"),
      v.literal("snoozed"),
      v.literal("actioned")
    ),
    snoozeUntil: v.union(v.number(), v.null()),
    // Timestamps
    createdAt: v.number(),
    readAt: v.union(v.number(), v.null()),
    actionedAt: v.union(v.number(), v.null()),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"])
    .index("byDocument", ["documentId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byCreatedAt", ["createdAt"]),

  // Alert preferences (per-document or global)
  alertPreferences: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    documentId: v.union(v.id("documents"), v.null()), // null = global defaults
    // Notification channels
    notifyInApp: v.boolean(),
    notifyEmail: v.boolean(),
    notifyWebhook: v.boolean(),
    webhookUrl: v.union(v.string(), v.null()),
    notifySlack: v.boolean(),
    notifyDiscord: v.boolean(),
    // Behavior settings
    autoRegenerate: v.boolean(), // Auto-regenerate doc when source changes
    minSignificance: v.number(), // Only alert for changes >= this score (0-100)
    checkFrequency: v.union(
      v.literal("hourly"),
      v.literal("every_6_hours"),
      v.literal("daily"),
      v.literal("weekly")
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .index("byUserAndDocument", ["userId", "documentId"]),

  // Source monitoring queue for scheduled checks
  sourceMonitorQueue: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    sourceUrl: v.string(),
    sourceType: v.union(
      v.literal("url"),
      v.literal("github_repo"),
      v.literal("github_release"),
      v.literal("api_docs")
    ),
    // Scheduling
    lastCheckedAt: v.union(v.number(), v.null()),
    nextCheckAt: v.number(),
    checkFrequency: v.union(
      v.literal("hourly"),
      v.literal("every_6_hours"),
      v.literal("daily"),
      v.literal("weekly")
    ),
    // Status
    isActive: v.boolean(),
    consecutiveFailures: v.number(),
    lastError: v.union(v.string(), v.null()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .index("byNextCheck", ["nextCheckAt"])
    .index("byActiveAndNextCheck", ["isActive", "nextCheckAt"]),

  // ═══════════════════════════════════════════════════════════════
  // Advanced Web Crawler (Feature #18)
  // ═══════════════════════════════════════════════════════════════

  // Crawl jobs - main configuration and status tracking
  crawlJobs: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    projectId: v.optional(v.id("projects")),
    // Configuration
    name: v.string(), // User-friendly name for this crawl
    startUrl: v.string(),
    // URL filtering
    includePatterns: v.array(v.string()), // Regex patterns for URLs to include
    excludePatterns: v.array(v.string()), // Regex patterns for URLs to exclude
    domainRestriction: v.union(
      v.literal("same"), // Only same domain
      v.literal("subdomains"), // Same domain + subdomains
      v.literal("any") // Follow any domain
    ),
    // Content filtering
    contentTypes: v.array(v.string()), // Allowed content types: html, pdf, etc.
    // Limits
    maxPages: v.number(),
    maxDepth: v.number(),
    // Rate limiting
    requestDelayMs: v.number(), // Delay between requests
    maxConcurrent: v.number(), // Max concurrent requests
    // Authentication (optional)
    authType: v.optional(v.union(
      v.literal("none"),
      v.literal("basic"),
      v.literal("bearer"),
      v.literal("cookie")
    )),
    authCredentials: v.optional(v.string()), // Encrypted credentials
    customHeaders: v.optional(v.string()), // JSON string of custom headers
    // Scheduling (optional)
    scheduleEnabled: v.boolean(),
    scheduleFrequency: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    )),
    scheduleHour: v.optional(v.number()), // 0-23 UTC
    scheduleDayOfWeek: v.optional(v.number()), // 0-6 for weekly
    scheduleDayOfMonth: v.optional(v.number()), // 1-31 for monthly
    nextScheduledRun: v.optional(v.number()),
    // Status
    status: v.union(
      v.literal("idle"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    // Progress tracking
    pagesDiscovered: v.number(),
    pagesCrawled: v.number(),
    pagesSuccessful: v.number(),
    pagesFailed: v.number(),
    pagesSkipped: v.number(),
    // Content statistics
    totalWords: v.number(),
    totalLinks: v.number(),
    // Timing
    startedAt: v.optional(v.number()),
    pausedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),
    // Error tracking
    lastError: v.optional(v.string()),
    errorCount: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"])
    .index("byWorkspace", ["workspaceId"])
    .index("byProject", ["projectId"])
    .index("byNextScheduledRun", ["nextScheduledRun"]),

  // Crawl queue - URLs waiting to be crawled
  crawlQueue: defineTable({
    jobId: v.id("crawlJobs"),
    userId: v.string(),
    url: v.string(),
    normalizedUrl: v.string(), // Canonicalized URL for deduplication
    depth: v.number(), // Distance from start URL
    priority: v.number(), // Higher = process first (0-100)
    // Discovery info
    discoveredFrom: v.optional(v.string()), // Parent URL
    anchorText: v.optional(v.string()), // Link text
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    // Retry tracking
    attempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    // Error info
    errorMessage: v.optional(v.string()),
    skipReason: v.optional(v.string()), // Why it was skipped
    // Timestamps
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("byJob", ["jobId"])
    .index("byJobAndStatus", ["jobId", "status"])
    .index("byJobAndPriority", ["jobId", "priority"])
    .index("byNormalizedUrl", ["jobId", "normalizedUrl"])
    .index("byNextRetry", ["nextRetryAt"]),

  // Crawl pages - results of crawled pages
  crawlPages: defineTable({
    jobId: v.id("crawlJobs"),
    userId: v.string(),
    queueItemId: v.id("crawlQueue"),
    // URL info
    url: v.string(),
    finalUrl: v.string(), // After redirects
    // HTTP info
    statusCode: v.number(),
    contentType: v.string(),
    contentLength: v.optional(v.number()),
    // Extracted content
    title: v.string(),
    description: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedDate: v.optional(v.string()),
    // Content
    markdownContent: v.string(), // Cleaned markdown
    rawHtmlSize: v.number(), // Original HTML size for stats
    // Statistics
    wordCount: v.number(),
    linkCount: v.number(),
    imageCount: v.number(),
    codeBlockCount: v.number(),
    tableCount: v.number(),
    // Extracted data
    outgoingLinks: v.array(v.string()), // URLs found on this page
    structuredData: v.optional(v.string()), // JSON-LD, microdata as JSON string
    // Content hash for change detection
    contentHash: v.string(),
    // Timestamps
    crawledAt: v.number(),
  })
    .index("byJob", ["jobId"])
    .index("byUrl", ["jobId", "url"])
    .index("byContentHash", ["jobId", "contentHash"]),

  // Robots.txt cache
  robotsCache: defineTable({
    domain: v.string(),
    robotsTxt: v.optional(v.string()), // Raw robots.txt content
    rules: v.string(), // Parsed rules as JSON
    sitemaps: v.array(v.string()), // Sitemap URLs found
    crawlDelay: v.optional(v.number()), // Crawl-delay directive
    fetchedAt: v.number(),
    expiresAt: v.number(), // When to refetch (24h default)
  })
    .index("byDomain", ["domain"]),

  // Sitemap cache
  sitemapCache: defineTable({
    jobId: v.id("crawlJobs"),
    url: v.string(),
    urls: v.array(v.object({
      loc: v.string(),
      lastmod: v.optional(v.string()),
      priority: v.optional(v.number()),
      changefreq: v.optional(v.string()),
    })),
    fetchedAt: v.number(),
  })
    .index("byJob", ["jobId"])
    .index("byUrl", ["url"]),

  // Crawl history - for comparing crawl runs
  crawlRunHistory: defineTable({
    jobId: v.id("crawlJobs"),
    userId: v.string(),
    runNumber: v.number(),
    // Summary stats
    pagesDiscovered: v.number(),
    pagesCrawled: v.number(),
    pagesSuccessful: v.number(),
    pagesFailed: v.number(),
    pagesChanged: v.number(), // Pages with content changes from previous run
    pagesNew: v.number(), // New pages not in previous run
    // Content stats
    totalWords: v.number(),
    totalLinks: v.number(),
    // Timing
    startedAt: v.number(),
    completedAt: v.number(),
    durationMs: v.number(),
  })
    .index("byJob", ["jobId"])
    .index("byJobAndRun", ["jobId", "runNumber"]),

  // ===============================================================
  // AI Chat Interface (Feature #26)
  // ===============================================================

  // Chat conversations
  chatConversations: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    // Documents included in this conversation's context
    documentIds: v.array(v.id("documents")),
    // Optional project context
    projectId: v.optional(v.id("projects")),
    // Conversation type
    type: v.union(
      v.literal("document"), // Chat about specific document(s)
      v.literal("project"), // Chat about entire project
      v.literal("knowledge_base"), // Chat across all user docs
      v.literal("general") // General AI chat
    ),
    // Metadata
    messageCount: v.number(),
    lastMessageAt: v.number(),
    // Status
    isArchived: v.boolean(),
    isPinned: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndUpdated", ["userId", "updatedAt"])
    .index("byUserAndPinned", ["userId", "isPinned"])
    .index("byWorkspace", ["workspaceId"])
    .index("byProject", ["projectId"]),

  // Chat messages within conversations
  chatMessages: defineTable({
    conversationId: v.id("chatConversations"),
    userId: v.string(),
    // Message content
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    // Source citations for assistant messages
    sources: v.optional(v.array(v.object({
      documentId: v.id("documents"),
      documentTitle: v.string(),
      snippet: v.string(),
      relevanceScore: v.number(),
    }))),
    // AI metadata
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    // User feedback
    rating: v.optional(v.union(v.literal("up"), v.literal("down"))),
    ratingFeedback: v.optional(v.string()),
    // Status
    isRegenerated: v.boolean(),
    regeneratedFrom: v.optional(v.id("chatMessages")),
    // Timestamps
    createdAt: v.number(),
  })
    .index("byConversation", ["conversationId"])
    .index("byConversationAndCreated", ["conversationId", "createdAt"])
    .index("byUser", ["userId"])
    .index("byRating", ["rating"]),

  // Suggested questions cache
  chatSuggestions: defineTable({
    userId: v.string(),
    documentId: v.optional(v.id("documents")),
    projectId: v.optional(v.id("projects")),
    suggestions: v.array(v.string()),
    // Expiry for cache
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byProject", ["projectId"])
    .index("byExpiry", ["expiresAt"]),

  // ═══════════════════════════════════════════════════════════════
  // Smart Document Suggestions (Feature #22)
  // ═══════════════════════════════════════════════════════════════

  // Document views for usage-based recommendations
  documentViews: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    // View details
    timestamp: v.number(),
    duration: v.optional(v.number()), // Time spent viewing (ms)
    source: v.union(
      v.literal("search"),
      v.literal("navigation"),
      v.literal("suggestion"),
      v.literal("direct"),
      v.literal("related")
    ),
    // Context when viewed
    referringDocumentId: v.optional(v.id("documents")),
    searchQuery: v.optional(v.string()),
  })
    .index("byDocument", ["documentId"])
    .index("byUser", ["userId"])
    .index("byUserAndTimestamp", ["userId", "timestamp"])
    .index("byWorkspace", ["workspaceId"])
    .index("byDocumentAndUser", ["documentId", "userId"]),

  // Auto-generated topic tags for documents
  documentTags: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    tag: v.string(), // The tag text
    confidence: v.number(), // 0-1 confidence score
    source: v.union(
      v.literal("ai"),
      v.literal("extracted"),
      v.literal("user")
    ),
    generatedAt: v.number(),
  })
    .index("byDocument", ["documentId"])
    .index("byUser", ["userId"])
    .index("byTag", ["tag"])
    .index("byUserAndTag", ["userId", "tag"]),

  // Topic clusters for document grouping
  topicClusters: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(), // Human-readable cluster name
    description: v.optional(v.string()),
    // Cluster content
    documentIds: v.array(v.id("documents")),
    primaryTags: v.array(v.string()), // Top tags in this cluster
    // Statistics
    documentCount: v.number(),
    averageRelevance: v.number(), // Average intra-cluster similarity
    // Metadata
    isAutoGenerated: v.boolean(),
    lastUpdated: v.number(),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byName", ["userId", "name"]),

  // Suggestion feedback for learning
  suggestionFeedback: defineTable({
    userId: v.string(),
    documentId: v.id("documents"),
    suggestionType: v.union(
      v.literal("context"),
      v.literal("trending"),
      v.literal("frequent"),
      v.literal("stale"),
      v.literal("related")
    ),
    // Feedback
    action: v.union(
      v.literal("clicked"),
      v.literal("dismissed"),
      v.literal("snoozed"),
      v.literal("helpful"),
      v.literal("not_helpful")
    ),
    timestamp: v.number(),
    // Context
    contextDocumentId: v.optional(v.id("documents")),
    reason: v.optional(v.string()),
  })
    .index("byUser", ["userId"])
    .index("byDocument", ["documentId"])
    .index("byUserAndType", ["userId", "suggestionType"]),

  // ===============================================================
  // SSO Configuration (Feature #20)
  // ===============================================================

  // SSO configurations per workspace
  ssoConfigurations: defineTable({
    workspaceId: v.id("workspaces"),
    // Provider type
    provider: v.union(v.literal("saml"), v.literal("oidc")),
    name: v.string(), // Display name (e.g., "Okta", "Azure AD")
    enabled: v.boolean(),
    // SAML-specific fields
    samlEntityId: v.optional(v.string()), // IdP Entity ID
    samlSsoUrl: v.optional(v.string()), // IdP SSO URL
    samlSloUrl: v.optional(v.string()), // IdP SLO URL (optional)
    samlCertificate: v.optional(v.string()), // IdP X.509 Certificate (encrypted)
    samlSignRequests: v.optional(v.boolean()), // Sign AuthnRequests
    samlSignatureAlgorithm: v.optional(v.string()), // e.g., "sha256", "sha512"
    samlDigestAlgorithm: v.optional(v.string()), // e.g., "sha256", "sha512"
    samlNameIdFormat: v.optional(v.string()), // NameID format
    // OIDC-specific fields
    oidcClientId: v.optional(v.string()),
    oidcClientSecret: v.optional(v.string()), // Encrypted
    oidcIssuer: v.optional(v.string()), // Issuer URL (for well-known config)
    oidcAuthUrl: v.optional(v.string()), // Authorization endpoint
    oidcTokenUrl: v.optional(v.string()), // Token endpoint
    oidcUserInfoUrl: v.optional(v.string()), // UserInfo endpoint
    oidcJwksUrl: v.optional(v.string()), // JWKS endpoint
    oidcScopes: v.optional(v.array(v.string())), // Requested scopes
    // Attribute mapping (IdP attribute -> DocuSynth field)
    attributeMapping: v.object({
      email: v.string(), // Required
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      groups: v.optional(v.string()), // For role mapping
      avatar: v.optional(v.string()),
    }),
    // Group/role mapping (IdP group -> DocuSynth role)
    groupRoleMapping: v.optional(v.array(v.object({
      idpGroup: v.string(),
      role: v.union(
        v.literal("admin"),
        v.literal("member"),
        v.literal("viewer")
      ),
    }))),
    // Domain restrictions
    allowedDomains: v.array(v.string()), // Empty = allow all
    blockedDomains: v.array(v.string()),
    // Enforcement settings
    enforceSSO: v.boolean(), // Require SSO for all workspace members
    allowBypassForOwner: v.boolean(), // Allow owner to bypass SSO
    // Just-in-time provisioning
    jitProvisioning: v.boolean(), // Auto-create users on first login
    jitDefaultRole: v.union(
      v.literal("member"),
      v.literal("viewer")
    ),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    lastUsedAt: v.union(v.number(), v.null()),
    // Test mode (for configuration testing)
    testMode: v.boolean(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndEnabled", ["workspaceId", "enabled"])
    .index("byWorkspaceAndProvider", ["workspaceId", "provider"]),

  // SSO sessions for tracking IdP-linked sessions
  ssoSessions: defineTable({
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    configId: v.id("ssoConfigurations"),
    // IdP session info
    idpSessionId: v.optional(v.string()), // Session ID from IdP (for SLO)
    idpSubject: v.string(), // Subject/NameID from IdP
    // Session state
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("revoked"),
      v.literal("logged_out")
    ),
    // Tokens (for OIDC)
    accessToken: v.optional(v.string()), // Encrypted
    refreshToken: v.optional(v.string()), // Encrypted
    idToken: v.optional(v.string()), // Encrypted
    tokenExpiresAt: v.optional(v.number()),
    // Session metadata
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    deviceInfo: v.optional(v.object({
      browser: v.optional(v.string()),
      os: v.optional(v.string()),
      device: v.optional(v.string()),
    })),
    // Timestamps
    createdAt: v.number(),
    lastActivityAt: v.number(),
    expiresAt: v.number(),
    terminatedAt: v.optional(v.number()),
  })
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"])
    .index("byWorkspace", ["workspaceId"])
    .index("byConfig", ["configId"])
    .index("byIdpSession", ["idpSessionId"])
    .index("byExpiry", ["expiresAt"]),

  // SSO authentication state (for CSRF protection)
  ssoAuthState: defineTable({
    state: v.string(), // Random state parameter
    workspaceId: v.id("workspaces"),
    configId: v.id("ssoConfigurations"),
    // OIDC PKCE
    codeVerifier: v.optional(v.string()),
    nonce: v.optional(v.string()),
    // Request metadata
    redirectUri: v.string(),
    initiatedBy: v.optional(v.string()), // User ID if re-authenticating
    // Timestamps
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("byState", ["state"])
    .index("byExpiry", ["expiresAt"]),

  // SSO audit log
  ssoAuditLog: defineTable({
    workspaceId: v.id("workspaces"),
    configId: v.optional(v.id("ssoConfigurations")),
    userId: v.optional(v.string()),
    sessionId: v.optional(v.id("ssoSessions")),
    // Event details
    eventType: v.union(
      v.literal("config_created"),
      v.literal("config_updated"),
      v.literal("config_deleted"),
      v.literal("config_enabled"),
      v.literal("config_disabled"),
      v.literal("login_initiated"),
      v.literal("login_success"),
      v.literal("login_failed"),
      v.literal("logout_initiated"),
      v.literal("logout_success"),
      v.literal("session_created"),
      v.literal("session_refreshed"),
      v.literal("session_expired"),
      v.literal("session_revoked"),
      v.literal("jit_user_created"),
      v.literal("attribute_sync"),
      v.literal("test_connection")
    ),
    // Event metadata
    success: v.boolean(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    // Request info
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    // Timestamp
    timestamp: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndTimestamp", ["workspaceId", "timestamp"])
    .index("byConfig", ["configId"])
    .index("byUser", ["userId"])
    .index("byEventType", ["eventType"])
    .index("byTimestamp", ["timestamp"]),

  // SSO domain routing (for IdP-initiated SSO)
  ssoDomainRouting: defineTable({
    domain: v.string(), // Email domain (e.g., "company.com")
    workspaceId: v.id("workspaces"),
    configId: v.id("ssoConfigurations"),
    // Verification
    verified: v.boolean(),
    verificationToken: v.optional(v.string()),
    verificationMethod: v.optional(v.union(
      v.literal("dns_txt"),
      v.literal("email"),
      v.literal("manual")
    )),
    verifiedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("byDomain", ["domain"])
    .index("byWorkspace", ["workspaceId"])
    .index("byConfig", ["configId"]),

  // ═══════════════════════════════════════════════════════════════
  // Public Documentation Portal (Feature #29)
  // ═══════════════════════════════════════════════════════════════

  // Portal configurations
  portals: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.string(),
    name: v.string(),
    subdomain: v.string(), // e.g., "my-docs" -> my-docs.docusynth.io
    customDomain: v.optional(v.string()), // e.g., "docs.example.com"
    // Branding
    branding: v.object({
      logo: v.optional(v.string()), // URL or data URI
      primaryColor: v.string(),
      accentColor: v.string(),
      fontFamily: v.string(),
      faviconUrl: v.optional(v.string()),
    }),
    // Theming
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system"), v.literal("custom")),
    customCss: v.optional(v.string()),
    customHeader: v.optional(v.string()), // Custom HTML for header
    customFooter: v.optional(v.string()), // Custom HTML for footer
    // SEO
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    socialImage: v.optional(v.string()), // OG image URL
    // Analytics
    analyticsId: v.optional(v.string()), // Google Analytics ID
    // Access control
    accessType: v.union(
      v.literal("public"),
      v.literal("password"),
      v.literal("authenticated")
    ),
    password: v.optional(v.string()), // Hashed password for protected portals
    // Homepage configuration
    homepageContent: v.optional(v.string()), // Markdown for homepage
    showRecentUpdates: v.boolean(),
    showFeaturedDocs: v.boolean(),
    // Status
    isPublished: v.boolean(),
    publishedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byUser", ["userId"])
    .index("bySubdomain", ["subdomain"])
    .index("byCustomDomain", ["customDomain"]),

  // Published documents in portals
  portalDocuments: defineTable({
    portalId: v.id("portals"),
    documentId: v.id("documents"),
    slug: v.string(), // URL-friendly slug
    titleOverride: v.optional(v.string()), // Override document title in portal
    descriptionOverride: v.optional(v.string()), // Override description
    // Navigation positioning
    position: v.number(), // Order in navigation
    parentId: v.optional(v.id("portalDocuments")), // For nested sections
    isSection: v.boolean(), // Is this a section header (grouping only)?
    sectionName: v.optional(v.string()), // Name if it's a section
    // Version control
    publishedVersion: v.optional(v.string()), // Specific version ID, null = latest
    isDraft: v.boolean(), // Draft or published
    // Metadata
    icon: v.optional(v.string()), // Emoji or icon name
    // Timestamps
    publishedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byPortal", ["portalId"])
    .index("byDocument", ["documentId"])
    .index("byPortalAndSlug", ["portalId", "slug"])
    .index("byPortalAndParent", ["portalId", "parentId"])
    .index("byPortalAndPosition", ["portalId", "position"]),

  // Portal page views for analytics
  portalPageViews: defineTable({
    portalId: v.id("portals"),
    documentId: v.optional(v.id("documents")), // null for homepage
    visitorId: v.string(), // Anonymous visitor ID (cookie-based)
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    path: v.string(), // Page path
    // Geo info (optional)
    country: v.optional(v.string()),
    // Timestamps
    viewedAt: v.number(),
  })
    .index("byPortal", ["portalId"])
    .index("byPortalAndDocument", ["portalId", "documentId"])
    .index("byPortalAndViewedAt", ["portalId", "viewedAt"])
    .index("byViewedAt", ["viewedAt"]),

  // Portal navigation structure (for custom nav items like external links)
  portalNavItems: defineTable({
    portalId: v.id("portals"),
    label: v.string(),
    // Link target (one of these)
    documentId: v.optional(v.id("portalDocuments")), // Link to published doc
    externalUrl: v.optional(v.string()), // External link
    // Positioning
    position: v.number(),
    parentId: v.optional(v.id("portalNavItems")), // For nested nav
    // Display options
    icon: v.optional(v.string()),
    isExpanded: v.boolean(), // Default expanded state
    // Timestamps
    createdAt: v.number(),
  })
    .index("byPortal", ["portalId"])
    .index("byPortalAndParent", ["portalId", "parentId"])
    .index("byPortalAndPosition", ["portalId", "position"]),

  // ═══════════════════════════════════════════════════════════════
  // Enterprise Audit Logging (Feature #19)
  // ═══════════════════════════════════════════════════════════════

  // Main audit log table - immutable, append-only
  auditLogs: defineTable({
    // Timestamp with millisecond precision
    timestamp: v.number(),
    // User who performed the action
    userId: v.string(),
    userEmail: v.optional(v.string()),
    // Action details
    action: v.string(), // e.g., "document.created", "workspace.member_added"
    actionCategory: v.string(), // e.g., "document", "workspace", "auth"
    // Resource being acted upon
    resourceType: v.optional(v.string()), // e.g., "document", "project", "workspace"
    resourceId: v.optional(v.string()), // ID of the resource
    resourceName: v.optional(v.string()), // Human-readable name
    // Context
    workspaceId: v.optional(v.id("workspaces")), // Workspace context
    sessionId: v.optional(v.string()), // Session identifier
    ipAddress: v.optional(v.string()), // Client IP
    userAgent: v.optional(v.string()), // Browser/client info
    // Changes made (for update operations)
    changes: v.optional(v.object({
      before: v.optional(v.any()), // State before change
      after: v.optional(v.any()), // State after change
    })),
    // Additional metadata
    metadata: v.optional(v.any()), // Flexible metadata storage
    // Severity level
    severity: v.optional(v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    )),
  })
    .index("byTimestamp", ["timestamp"])
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byAction", ["action"])
    .index("byActionCategory", ["actionCategory"])
    .index("byResourceType", ["resourceType"])
    .index("byResourceId", ["resourceId"])
    .index("bySeverity", ["severity"])
    .index("byWorkspaceAndTimestamp", ["workspaceId", "timestamp"])
    .index("byUserAndTimestamp", ["userId", "timestamp"])
    .index("byWorkspaceAndAction", ["workspaceId", "action"]),

  // Retention policies per workspace
  auditRetentionPolicies: defineTable({
    workspaceId: v.id("workspaces"),
    retentionDays: v.number(), // How long to keep audit logs (min 30, max 2555)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"]),

  // ═══════════════════════════════════════════════════════════════
  // Document Collections & Bundles (Feature #24)
  // ═══════════════════════════════════════════════════════════════

  // Collections - groupings of documents
  collections: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(), // Icon name from Icons component
    color: v.string(), // Hex color for visual identification
    parentId: v.optional(v.id("collections")), // For nested collections
    isSmartCollection: v.boolean(), // Auto-populated by rules
    smartRules: v.optional(v.object({
      logic: v.union(v.literal("and"), v.literal("or")),
      rules: v.array(v.object({
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
      })),
    })),
    visibility: v.union(v.literal("private"), v.literal("workspace"), v.literal("public")),
    sharedWith: v.array(v.object({
      userId: v.string(),
      permission: v.union(v.literal("view"), v.literal("edit")),
      sharedAt: v.number(),
    })),
    order: v.number(), // For ordering collections in UI
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byWorkspace", ["workspaceId"])
    .index("byParent", ["parentId"])
    .index("byUserAndParent", ["userId", "parentId"]),

  // Collection-Document membership (many-to-many relationship)
  collectionDocuments: defineTable({
    collectionId: v.id("collections"),
    documentId: v.id("documents"),
    position: v.number(), // Order of document within collection
    addedAt: v.number(),
  })
    .index("byCollection", ["collectionId"])
    .index("byDocument", ["documentId"])
    .index("byCollectionAndDocument", ["collectionId", "documentId"])
    .index("byCollectionAndPosition", ["collectionId", "position"]),

  // Bundles - generated downloadable packages
  bundles: defineTable({
    collectionId: v.id("collections"),
    userId: v.string(),
    format: v.union(v.literal("zip"), v.literal("pdf"), v.literal("markdown")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100 progress percentage
    fileSize: v.union(v.number(), v.null()), // Size in bytes when completed
    downloadUrl: v.union(v.string(), v.null()), // URL to download the bundle
    expiresAt: v.union(v.number(), v.null()), // When the download URL expires
    error: v.union(v.string(), v.null()), // Error message if failed
    options: v.object({
      includeToc: v.boolean(),
      includeMetadata: v.boolean(),
      brandingLogo: v.optional(v.string()),
      brandingTitle: v.optional(v.string()),
      brandingColors: v.optional(v.object({
        primary: v.string(),
        secondary: v.string(),
        background: v.string(),
      })),
      customCss: v.optional(v.string()),
      tocDepth: v.optional(v.number()),
      pageBreaks: v.optional(v.boolean()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byCollection", ["collectionId"])
    .index("byUser", ["userId"])
    .index("byUserAndStatus", ["userId", "status"])
    .index("byStatus", ["status"]),

  // Bundle share links for public access
  bundleShares: defineTable({
    bundleId: v.id("bundles"),
    token: v.string(), // Unique share token
    expiresAt: v.union(v.number(), v.null()), // Expiration timestamp, null = never
    downloadCount: v.number(), // Number of times downloaded
    maxDownloads: v.union(v.number(), v.null()), // Max downloads allowed, null = unlimited
    passwordHash: v.union(v.string(), v.null()), // Optional password protection
    createdAt: v.number(),
  })
    .index("byBundle", ["bundleId"])
    .index("byToken", ["token"]),

  // Bundle download tracking for analytics
  bundleDownloads: defineTable({
    bundleId: v.id("bundles"),
    downloadedAt: v.number(),
    shareToken: v.optional(v.string()), // If downloaded via share link
    userAgent: v.optional(v.string()),
  })
    .index("byBundle", ["bundleId"])
    .index("byDownloadedAt", ["downloadedAt"]),

  // ═══════════════════════════════════════════════════════════════
  // Cost Management & Budgets (Feature #21)
  // ═══════════════════════════════════════════════════════════════

  // Usage records - detailed token and cost tracking
  usageRecords: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    projectId: v.optional(v.id("projects")),
    documentId: v.optional(v.id("documents")),
    // Provider info
    provider: v.string(), // e.g., "openai", "anthropic", "google"
    model: v.string(), // e.g., "gpt-4o", "claude-sonnet-4", "gemini-2.0-flash"
    // Token usage
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    // Cost (in USD)
    cost: v.number(),
    // Operation type
    operation: v.string(), // e.g., "document_generation", "refresh", "mcp", "crawl"
    // Metadata
    metadata: v.optional(v.any()),
    // Timestamp
    timestamp: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndTimestamp", ["userId", "timestamp"])
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndTimestamp", ["workspaceId", "timestamp"])
    .index("byProject", ["projectId"])
    .index("byProjectAndTimestamp", ["projectId", "timestamp"])
    .index("byDocument", ["documentId"])
    .index("byProvider", ["provider"])
    .index("byOperation", ["operation"])
    .index("byTimestamp", ["timestamp"]),

  // Budgets - cost limits and tracking
  budgets: defineTable({
    userId: v.string(), // Creator of the budget
    // Scope of the budget
    scope: v.union(
      v.literal("workspace"),
      v.literal("project"),
      v.literal("user")
    ),
    scopeId: v.string(), // ID of workspace/project/user this budget applies to
    // Budget details
    name: v.string(),
    amount: v.number(), // Budget amount in currency
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    currency: v.string(), // e.g., "USD", "EUR", "GBP"
    // Tracking
    currentSpend: v.number(), // Current period spend
    periodStart: v.number(), // Start of current period
    periodEnd: v.number(), // End of current period
    // Alerts
    alertThresholds: v.array(v.number()), // e.g., [50, 80, 100] for 50%, 80%, 100%
    hardLimit: v.boolean(), // If true, block requests when exceeded
    // Rollover unused budget to next period
    rollover: v.boolean(),
    // Status
    isActive: v.boolean(),
    // Notification preferences
    notifyEmail: v.optional(v.boolean()),
    notifyInApp: v.optional(v.boolean()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byScope", ["scope"])
    .index("byScopeId", ["scopeId"])
    .index("byScopeAndId", ["scope", "scopeId"])
    .index("byScopeAndPeriod", ["scope", "scopeId", "period"])
    .index("byActive", ["isActive"]),

  // Budget alerts - triggered threshold notifications
  budgetAlerts: defineTable({
    budgetId: v.id("budgets"),
    userId: v.string(), // User who triggered the spend
    // Alert details
    threshold: v.number(), // Which threshold was crossed (e.g., 50, 80, 100)
    currentSpend: v.number(),
    budgetAmount: v.number(),
    utilization: v.number(), // Percentage (currentSpend / budgetAmount * 100)
    // Timestamps
    triggeredAt: v.number(),
    // Status
    dismissed: v.boolean(),
    dismissedAt: v.optional(v.number()),
  })
    .index("byBudget", ["budgetId"])
    .index("byBudgetAndThreshold", ["budgetId", "threshold"])
    .index("byUser", ["userId"])
    .index("byTriggeredAt", ["triggeredAt"])
    .index("byDismissed", ["dismissed"]),
});

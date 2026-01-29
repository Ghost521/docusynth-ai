
export interface Project {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  createdAt: number;
}

export interface DocVersion {
  id: string;
  content: string;
  createdAt: number;
  label?: string;
}

export interface GeneratedDoc {
  id: string;
  topic: string;
  content: string;
  projectId?: string; // Optional project association
  visibility: 'public' | 'private';
  versions?: DocVersion[]; // Historical snapshots
  sources: Array<{
    title: string;
    url: string;
  }>;
  createdAt: number;
}

export interface GenerationStatus {
  isGenerating: boolean;
  step: 'idle' | 'searching' | 'synthesizing' | 'formatting' | 'complete' | 'error';
  message?: string;
}

export type Theme = 'light' | 'dark';

export interface DiscoveredLink {
  url: string;
  title: string;
}

export interface CrawlTask {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  docId?: string;
}

export interface CrawlOptions {
  maxPages: number;
  depth: number;
  delay: number; // in milliseconds
  excludePatterns: string; // comma separated
}

export interface IntegrationSettings {
  ollamaEndpoint: string;
  ollamaBaseModel: string;
  tabnineEnabled: boolean;
  cursorRulesEnabled: boolean;
  claudeModelPreference: string;
  geminiModelPreference: string;
  openAiEnabled: boolean;
  openAiModelPreference: string;
  customSystemInstruction?: string;
  // Server-side secret indicators (never contain actual values)
  hasGithubToken?: boolean;
  hasClaudeApiKey?: boolean;
  hasOpenAiApiKey?: boolean;
  // Crawl options (merged from server settings)
  crawlMaxPages?: number;
  crawlDepth?: number;
  crawlDelay?: number;
  crawlExcludePatterns?: string;
}

// ═══════════════════════════════════════════════════════════════
// External Import Types
// ═══════════════════════════════════════════════════════════════

export type ImportSourceType = 'notion' | 'confluence';

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ImportType = 'page' | 'database' | 'space' | 'batch';

export type ImportSyncStatus = 'success' | 'failed' | 'partial' | null;

export interface ImportSource {
  id: string;
  sourceType: ImportSourceType;
  name: string;
  isActive: boolean;
  lastSyncAt: number | null;
  lastSyncStatus: ImportSyncStatus;
  lastSyncError: string | null;
  createdAt: number;
  updatedAt: number;
  // Redacted credential indicators
  hasAccessToken?: boolean;
  hasApiToken?: boolean;
  baseUrl?: string;
  email?: string;
}

export interface ImportJob {
  id: string;
  sourceId: string;
  projectId?: string;
  sourceType: ImportSourceType;
  importType: ImportType;
  sourcePageIds: string[];
  sourcePageTitles: string[];
  status: ImportJobStatus;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  documentIds: string[];
  errors: ImportJobError[];
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface ImportJobError {
  pageId: string;
  pageTitle: string;
  error: string;
}

export interface ImportHistory {
  id: string;
  sourceId: string;
  sourcePageId: string;
  documentId: string;
  lastImportedVersion: string;
  lastImportedAt: number;
  importCount: number;
}

// Notion API types
export interface NotionPage {
  id: string;
  type: 'page' | 'database';
  title: string;
  icon: string | null;
  lastEditedTime: string;
  url: string;
  parentType: string;
  parentId: string;
}

export interface NotionBrowseResult {
  items: NotionPage[];
  hasMore: boolean;
  nextCursor: string | undefined;
}

// Confluence API types
export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  description: string;
  type: string;
  url: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  status: string;
  lastUpdated: string;
  url: string;
}

export interface ConfluenceSpacesResult {
  spaces: ConfluenceSpace[];
  hasMore: boolean;
  nextStart: number;
}

export interface ConfluencePagesResult {
  pages: ConfluencePage[];
  hasMore: boolean;
  nextStart: number;
}

// ═══════════════════════════════════════════════════════════════
// Semantic Search Types
// ═══════════════════════════════════════════════════════════════

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export type EmbeddingStatus = 'pending' | 'completed' | 'failed' | 'not_indexed';

export interface EmbeddingStatusInfo {
  status: EmbeddingStatus;
  message: string;
  chunkCount?: number;
  error?: string;
}

export interface EmbeddingStats {
  totalDocuments: number;
  indexed: number;
  failed: number;
  pending: number;
  queued: number;
  totalChunks: number;
}

export interface SemanticSearchResult {
  documentId: string;
  topic: string;
  content: string;
  contentPreview: string;
  projectId?: string;
  visibility: 'public' | 'private' | 'workspace';
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
  searchType: SearchMode;
}

export interface SearchOptions {
  mode: SearchMode;
  limit?: number;
  projectId?: string;
  visibility?: 'public' | 'private' | 'workspace';
  sourceType?: string;
  minScore?: number;
  semanticWeight?: number;
}

// ═══════════════════════════════════════════════════════════════
// Smart Document Suggestions Types (Feature #22)
// ═══════════════════════════════════════════════════════════════

export type SuggestionType = 'context' | 'trending' | 'frequent' | 'stale' | 'related';

export type ViewSource = 'search' | 'navigation' | 'suggestion' | 'direct' | 'related';

export type SuggestionFeedbackAction = 'clicked' | 'dismissed' | 'snoozed' | 'helpful' | 'not_helpful';

export type TagSource = 'ai' | 'extracted' | 'user';

export interface DocumentSuggestion {
  documentId: string;
  topic: string;
  contentPreview: string;
  projectId?: string;
  createdAt: number;
  suggestionType: SuggestionType;
  reason: string;
  score: number;
  tags?: string[];
}

export interface SuggestionContext {
  currentDocumentId?: string;
  clipboardText?: string;
  recentSearchQuery?: string;
  projectId?: string;
}

export interface DocumentView {
  documentId: string;
  userId: string;
  workspaceId?: string;
  timestamp: number;
  duration?: number;
  source: ViewSource;
  referringDocumentId?: string;
  searchQuery?: string;
}

export interface DocumentTag {
  documentId: string;
  userId: string;
  tag: string;
  confidence: number;
  source: TagSource;
  generatedAt: number;
}

export interface TopicCluster {
  id: string;
  userId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  documentIds: string[];
  primaryTags: string[];
  documentCount: number;
  averageRelevance: number;
  isAutoGenerated: boolean;
  lastUpdated: number;
  createdAt: number;
}

export interface SuggestionFeedback {
  userId: string;
  documentId: string;
  suggestionType: SuggestionType;
  action: SuggestionFeedbackAction;
  timestamp: number;
  contextDocumentId?: string;
  reason?: string;
}

export interface StalenessInfo {
  score: number;
  daysSinceUpdate: number;
  reasons: string[];
  shouldUpdate: boolean;
}

// ═══════════════════════════════════════════════════════════════
// AI Chat Interface Types (Feature #26)
// ═══════════════════════════════════════════════════════════════

export type ChatType = 'document' | 'project' | 'knowledge_base' | 'general';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type MessageRating = 'up' | 'down' | null;

export interface ChatSource {
  documentId: string;
  documentTitle: string;
  snippet: string;
  relevanceScore: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  sources?: ChatSource[];
  provider?: string;
  model?: string;
  tokensUsed?: number;
  rating?: MessageRating;
  ratingFeedback?: string;
  isRegenerated: boolean;
  regeneratedFrom?: string;
  createdAt: number;
}

export interface ChatConversation {
  id: string;
  userId: string;
  workspaceId?: string;
  title: string;
  documentIds: string[];
  projectId?: string;
  type: ChatType;
  messageCount: number;
  lastMessageAt: number;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatContextStats {
  documentCount: number;
  messageCount: number;
  estimatedTokens: {
    documents: number;
    messages: number;
    total: number;
  };
  maxTokens: number;
  utilizationPercent: number;
  remainingTokens: number;
  canAddMore: boolean;
}

export interface ChatSendResult {
  messageId: string;
  content: string;
  sources: ChatSource[];
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface ChatExportOptions {
  format: 'markdown' | 'json' | 'text';
}

export interface ChatSuggestion {
  text: string;
  category?: 'question' | 'action' | 'explore';
}

// ═══════════════════════════════════════════════════════════════
// Document Collections & Bundles Types (Feature #24)
// ═══════════════════════════════════════════════════════════════

export type CollectionVisibility = 'private' | 'workspace' | 'public';

export type SmartRuleField = 'tag' | 'project' | 'date' | 'source' | 'visibility';

export type SmartRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'before'
  | 'after'
  | 'between';

export type SmartRuleLogic = 'and' | 'or';

export interface SmartRule {
  field: SmartRuleField;
  operator: SmartRuleOperator;
  value: string;
  secondValue?: string; // For 'between' operator
}

export interface SmartRules {
  logic: SmartRuleLogic;
  rules: SmartRule[];
}

export interface CollectionShareInfo {
  userId: string;
  permission: 'view' | 'edit';
  sharedAt: number;
}

export interface Collection {
  id: string;
  userId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  parentId?: string;
  isSmartCollection: boolean;
  smartRules?: SmartRules;
  visibility: CollectionVisibility;
  sharedWith: CollectionShareInfo[];
  order: number;
  documentCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionDocument {
  collectionId: string;
  documentId: string;
  position: number;
  addedAt: number;
}

export type BundleFormat = 'zip' | 'pdf' | 'markdown';

export type BundleStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BundleBrandingColors {
  primary: string;
  secondary: string;
  background: string;
}

export interface BundleOptions {
  includeToc: boolean;
  includeMetadata: boolean;
  brandingLogo?: string;
  brandingTitle?: string;
  brandingColors?: BundleBrandingColors;
  customCss?: string;
  tocDepth?: number;
  pageBreaks?: boolean;
}

export interface Bundle {
  id: string;
  collectionId: string;
  userId: string;
  format: BundleFormat;
  status: BundleStatus;
  progress: number;
  fileSize: number | null;
  downloadUrl: string | null;
  expiresAt: number | null;
  error: string | null;
  options: BundleOptions;
  createdAt: number;
  updatedAt: number;
  shareCount?: number;
  totalDownloads?: number;
}

export interface BundleShare {
  id: string;
  bundleId: string;
  token: string;
  expiresAt: number | null;
  downloadCount: number;
  maxDownloads: number | null;
  hasPassword: boolean;
  createdAt: number;
}

export interface BundleDownload {
  id: string;
  bundleId: string;
  downloadedAt: number;
  shareToken?: string;
  userAgent?: string;
}

export interface BundleAnalytics {
  totalDownloads: number;
  downloadsByDay: Record<string, number>;
  recentDownloads: BundleDownload[];
  totalShares: number;
  activeShares: number;
  downloadsFromShares: number;
}

export interface ShareLinkValidation {
  valid: boolean;
  reason?: string;
  requiresPassword?: boolean;
  bundleId?: string;
  format?: BundleFormat;
}

// ═══════════════════════════════════════════════════════════════
// Public Documentation Portal Types (Feature #29)
// ═══════════════════════════════════════════════════════════════

export type PortalTheme = 'light' | 'dark' | 'system' | 'custom';

export type PortalAccessType = 'public' | 'password' | 'authenticated';

export interface PortalBranding {
  logo?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  faviconUrl?: string;
}

export interface Portal {
  id: string;
  userId: string;
  workspaceId?: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  branding: PortalBranding;
  theme: PortalTheme;
  customCss?: string;
  customHeader?: string;
  customFooter?: string;
  seoTitle?: string;
  seoDescription?: string;
  socialImage?: string;
  analyticsId?: string;
  accessType: PortalAccessType;
  homepageContent?: string;
  showRecentUpdates: boolean;
  showFeaturedDocs: boolean;
  isPublished: boolean;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PortalDocument {
  id: string;
  portalId: string;
  documentId: string;
  slug: string;
  titleOverride?: string;
  descriptionOverride?: string;
  position: number;
  parentId?: string;
  isSection: boolean;
  sectionName?: string;
  publishedVersion?: string;
  isDraft: boolean;
  icon?: string;
  publishedAt: number;
  updatedAt: number;
}

export interface PortalNavItem {
  id: string;
  type: 'document' | 'section';
  slug: string;
  title: string;
  description?: string;
  position: number;
  parentId?: string;
  icon?: string;
  children: PortalNavItem[];
}

export interface PortalNavigation {
  items: PortalNavItem[];
  externalLinks: PortalExternalLink[];
}

export interface PortalExternalLink {
  id: string;
  label: string;
  url?: string;
  icon?: string;
  position: number;
}

export interface PortalSearchResult {
  slug: string;
  title: string;
  snippet: string;
  matchType: 'title' | 'content' | 'both';
  score: number;
}

export interface PortalPageView {
  portalId: string;
  documentId?: string;
  visitorId: string;
  referrer?: string;
  userAgent?: string;
  path: string;
  country?: string;
  viewedAt: number;
}

export interface PortalAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  viewsByDoc: Record<string, number>;
  viewsByDay: Record<string, number>;
  topReferrers: Array<{ referrer: string; count: number }>;
}

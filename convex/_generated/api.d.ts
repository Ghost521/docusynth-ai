/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiProvider from "../aiProvider.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auditLog from "../auditLog.js";
import type * as auditMiddleware from "../auditMiddleware.js";
import type * as botTypes from "../botTypes.js";
import type * as bots from "../bots.js";
import type * as botsQueries from "../botsQueries.js";
import type * as budgets from "../budgets.js";
import type * as bundles from "../bundles.js";
import type * as changeDetection from "../changeDetection.js";
import type * as chat from "../chat.js";
import type * as chatContext from "../chatContext.js";
import type * as chatContextQueries from "../chatContextQueries.js";
import type * as chatConversations from "../chatConversations.js";
import type * as collections from "../collections.js";
import type * as comments from "../comments.js";
import type * as costs from "../costs.js";
import type * as crawlTasks from "../crawlTasks.js";
import type * as crawler from "../crawler.js";
import type * as crawlerUtils from "../crawlerUtils.js";
import type * as crons from "../crons.js";
import type * as docVersions from "../docVersions.js";
import type * as documents from "../documents.js";
import type * as embeddings from "../embeddings.js";
import type * as embeddingsQueries from "../embeddingsQueries.js";
import type * as encryption from "../encryption.js";
import type * as encryptionQueries from "../encryptionQueries.js";
import type * as geminiActions from "../geminiActions.js";
import type * as githubActions from "../githubActions.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as migration from "../migration.js";
import type * as migrationHelpers from "../migrationHelpers.js";
import type * as offlineSync from "../offlineSync.js";
import type * as portalContent from "../portalContent.js";
import type * as portals from "../portals.js";
import type * as presence from "../presence.js";
import type * as projects from "../projects.js";
import type * as rateLimit from "../rateLimit.js";
import type * as recentSearches from "../recentSearches.js";
import type * as schedules from "../schedules.js";
import type * as search from "../search.js";
import type * as sso from "../sso.js";
import type * as ssoSessions from "../ssoSessions.js";
import type * as streaming from "../streaming.js";
import type * as suggestions from "../suggestions.js";
import type * as templates from "../templates.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";
import type * as vectorSearch from "../vectorSearch.js";
import type * as vectorSearchQueries from "../vectorSearchQueries.js";
import type * as webhooks from "../webhooks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiProvider: typeof aiProvider;
  alerts: typeof alerts;
  analytics: typeof analytics;
  apiKeys: typeof apiKeys;
  auditLog: typeof auditLog;
  auditMiddleware: typeof auditMiddleware;
  botTypes: typeof botTypes;
  bots: typeof bots;
  botsQueries: typeof botsQueries;
  budgets: typeof budgets;
  bundles: typeof bundles;
  changeDetection: typeof changeDetection;
  chat: typeof chat;
  chatContext: typeof chatContext;
  chatContextQueries: typeof chatContextQueries;
  chatConversations: typeof chatConversations;
  collections: typeof collections;
  comments: typeof comments;
  costs: typeof costs;
  crawlTasks: typeof crawlTasks;
  crawler: typeof crawler;
  crawlerUtils: typeof crawlerUtils;
  crons: typeof crons;
  docVersions: typeof docVersions;
  documents: typeof documents;
  embeddings: typeof embeddings;
  embeddingsQueries: typeof embeddingsQueries;
  encryption: typeof encryption;
  encryptionQueries: typeof encryptionQueries;
  geminiActions: typeof geminiActions;
  githubActions: typeof githubActions;
  http: typeof http;
  imports: typeof imports;
  migration: typeof migration;
  migrationHelpers: typeof migrationHelpers;
  offlineSync: typeof offlineSync;
  portalContent: typeof portalContent;
  portals: typeof portals;
  presence: typeof presence;
  projects: typeof projects;
  rateLimit: typeof rateLimit;
  recentSearches: typeof recentSearches;
  schedules: typeof schedules;
  search: typeof search;
  sso: typeof sso;
  ssoSessions: typeof ssoSessions;
  streaming: typeof streaming;
  suggestions: typeof suggestions;
  templates: typeof templates;
  userSettings: typeof userSettings;
  users: typeof users;
  vectorSearch: typeof vectorSearch;
  vectorSearchQueries: typeof vectorSearchQueries;
  webhooks: typeof webhooks;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rag: {
    chunks: {
      insert: FunctionReference<
        "mutation",
        "internal",
        {
          chunks: Array<{
            content: { metadata?: Record<string, any>; text: string };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entryId: string;
          startOrder: number;
        },
        { status: "pending" | "ready" | "replaced" }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          entryId: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            metadata?: Record<string, any>;
            order: number;
            state: "pending" | "ready" | "replaced";
            text: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      replaceChunksPage: FunctionReference<
        "mutation",
        "internal",
        { entryId: string; startOrder: number },
        { nextStartOrder: number; status: "pending" | "ready" | "replaced" }
      >;
    };
    entries: {
      add: FunctionReference<
        "mutation",
        "internal",
        {
          allChunks?: Array<{
            content: { metadata?: Record<string, any>; text: string };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entry: {
            contentHash?: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        {
          created: boolean;
          entryId: string;
          replacedVersion: {
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            status: "pending" | "ready" | "replaced";
            title?: string;
          } | null;
          status: "pending" | "ready" | "replaced";
        }
      >;
      addAsync: FunctionReference<
        "mutation",
        "internal",
        {
          chunker: string;
          entry: {
            contentHash?: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        { created: boolean; entryId: string; status: "pending" | "ready" }
      >;
      deleteAsync: FunctionReference<
        "mutation",
        "internal",
        { entryId: string; startOrder: number },
        null
      >;
      findByContentHash: FunctionReference<
        "query",
        "internal",
        {
          contentHash: string;
          dimension: number;
          filterNames: Array<string>;
          key: string;
          modelId: string;
          namespace: string;
        },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{ name: string; value: any }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null
      >;
      get: FunctionReference<
        "query",
        "internal",
        { entryId: string },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{ name: string; value: any }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          namespaceId: string;
          order?: "desc" | "asc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        { entryId: string },
        {
          replacedVersion: {
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            status: "pending" | "ready" | "replaced";
            title?: string;
          } | null;
        }
      >;
    };
    namespaces: {
      get: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | {
          createdAt: number;
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          namespaceId: string;
          status: "pending" | "ready" | "replaced";
          version: number;
        }
      >;
      getOrCreate: FunctionReference<
        "mutation",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          onComplete?: string;
          status: "pending" | "ready";
        },
        { namespaceId: string; status: "pending" | "ready" }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      lookup: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | string
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        { namespaceId: string },
        {
          replacedVersion: null | {
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          };
        }
      >;
    };
    search: {
      search: FunctionReference<
        "action",
        "internal",
        {
          chunkContext?: { after: number; before: number };
          embedding: Array<number>;
          filters: Array<{ name: string; value: any }>;
          limit: number;
          modelId: string;
          namespace: string;
          vectorScoreThreshold?: number;
        },
        {
          entries: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          results: Array<{
            content: Array<{ metadata?: Record<string, any>; text: string }>;
            entryId: string;
            order: number;
            score: number;
            startOrder: number;
          }>;
        }
      >;
    };
  };
};

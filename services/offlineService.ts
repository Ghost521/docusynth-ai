// ===============================================================
// Offline Service - Document Caching & Offline Management
// ===============================================================

import { Id } from "../convex/_generated/dataModel";

// ===============================================================
// Types
// ===============================================================

export interface CachedDocument {
  documentId: string;
  topic: string;
  content: string;
  projectId?: string;
  visibility: "public" | "private" | "workspace";
  sources: Array<{ title: string; url: string }>;
  cachedAt: number;
  size: number;
}

export interface CacheStats {
  totalDocuments: number;
  totalSize: number;
  quotaUsed: number;
  quotaAvailable: number;
  percentUsed: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  serviceWorkerActive: boolean;
  syncRegistered: boolean;
  lastOnlineAt: number | null;
}

// ===============================================================
// Constants
// ===============================================================

const DB_NAME = "docusynth-offline";
const DB_VERSION = 1;
const DOCUMENTS_STORE = "cachedDocuments";
const METADATA_STORE = "cacheMetadata";

const CACHE_NAME = "docusynth-documents-v1";
const MAX_CACHE_SIZE_MB = 100; // 100MB default limit
const AUTO_CACHE_RECENT_COUNT = 10;

// ===============================================================
// IndexedDB Initialization
// ===============================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[OfflineService] Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Documents store
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const docsStore = db.createObjectStore(DOCUMENTS_STORE, {
          keyPath: "documentId",
        });
        docsStore.createIndex("cachedAt", "cachedAt", { unique: false });
        docsStore.createIndex("projectId", "projectId", { unique: false });
      }

      // Metadata store (for settings, stats, etc.)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

// ===============================================================
// Document Caching
// ===============================================================

/**
 * Cache a document for offline access
 */
export async function cacheDocument(
  documentId: Id<"documents">,
  documentData: {
    topic: string;
    content: string;
    projectId?: Id<"projects">;
    visibility: "public" | "private" | "workspace";
    sources: Array<{ title: string; url: string }>;
  }
): Promise<void> {
  const db = await openDatabase();

  const cachedDoc: CachedDocument = {
    documentId: documentId.toString(),
    topic: documentData.topic,
    content: documentData.content,
    projectId: documentData.projectId?.toString(),
    visibility: documentData.visibility,
    sources: documentData.sources,
    cachedAt: Date.now(),
    size: new Blob([JSON.stringify(documentData)]).size,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENTS_STORE], "readwrite");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.put(cachedDoc);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Also notify service worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_DOCUMENT",
          payload: {
            documentId: documentId.toString(),
            content: JSON.stringify(cachedDoc),
          },
        });
      }
      resolve();
    };
  });
}

/**
 * Remove a document from offline cache
 */
export async function uncacheDocument(documentId: Id<"documents">): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENTS_STORE], "readwrite");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.delete(documentId.toString());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Also notify service worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "UNCACHE_DOCUMENT",
          payload: { documentId: documentId.toString() },
        });
      }
      resolve();
    };
  });
}

/**
 * Get all cached documents
 */
export async function getCachedDocuments(): Promise<CachedDocument[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENTS_STORE], "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get a specific cached document
 */
export async function getCachedDocument(
  documentId: Id<"documents">
): Promise<CachedDocument | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENTS_STORE], "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.get(documentId.toString());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Check if a document is cached
 */
export async function isDocumentCached(documentId: Id<"documents">): Promise<boolean> {
  const doc = await getCachedDocument(documentId);
  return doc !== null;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  const docs = await getCachedDocuments();

  let totalSize = 0;
  for (const doc of docs) {
    totalSize += doc.size;
  }

  // Get storage estimate
  let quotaUsed = totalSize;
  let quotaAvailable = MAX_CACHE_SIZE_MB * 1024 * 1024;

  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      quotaUsed = estimate.usage || totalSize;
      quotaAvailable = estimate.quota || quotaAvailable;
    } catch (e) {
      console.warn("[OfflineService] Failed to get storage estimate:", e);
    }
  }

  return {
    totalDocuments: docs.length,
    totalSize,
    quotaUsed,
    quotaAvailable,
    percentUsed: Math.round((quotaUsed / quotaAvailable) * 100),
  };
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENTS_STORE], "readwrite");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Also notify service worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CLEAR_CACHE",
        });
      }
      resolve();
    };
  });
}

/**
 * Clear old cached documents to free space
 */
export async function pruneCache(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openDatabase();
  const cutoff = Date.now() - maxAgeMs;

  const docs = await getCachedDocuments();
  const oldDocs = docs.filter((doc) => doc.cachedAt < cutoff);

  let removed = 0;

  for (const doc of oldDocs) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([DOCUMENTS_STORE], "readwrite");
      const store = transaction.objectStore(DOCUMENTS_STORE);
      const request = store.delete(doc.documentId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        removed++;
        resolve();
      };
    });
  }

  return removed;
}

// ===============================================================
// Offline Status
// ===============================================================

/**
 * Get current offline status
 */
export function getOfflineStatus(): OfflineStatus {
  const lastOnlineStr = localStorage.getItem("docu_synth_last_online");

  return {
    isOnline: navigator.onLine,
    serviceWorkerActive: !!navigator.serviceWorker?.controller,
    syncRegistered: "sync" in (window as any).SyncManager,
    lastOnlineAt: lastOnlineStr ? parseInt(lastOnlineStr, 10) : null,
  };
}

/**
 * Update last online timestamp
 */
export function updateLastOnline(): void {
  localStorage.setItem("docu_synth_last_online", Date.now().toString());
}

/**
 * Listen for online/offline status changes
 */
export function addOnlineStatusListener(
  callback: (isOnline: boolean) => void
): () => void {
  const handleOnline = () => {
    updateLastOnline();
    callback(true);
  };
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// ===============================================================
// Auto-Caching
// ===============================================================

interface AutoCacheSettings {
  enabled: boolean;
  recentDocsCount: number;
  cacheOnView: boolean;
  maxCacheSizeMB: number;
}

const DEFAULT_AUTO_CACHE_SETTINGS: AutoCacheSettings = {
  enabled: true,
  recentDocsCount: AUTO_CACHE_RECENT_COUNT,
  cacheOnView: true,
  maxCacheSizeMB: MAX_CACHE_SIZE_MB,
};

/**
 * Get auto-cache settings
 */
export function getAutoCacheSettings(): AutoCacheSettings {
  const stored = localStorage.getItem("docu_synth_auto_cache");
  if (stored) {
    try {
      return { ...DEFAULT_AUTO_CACHE_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_AUTO_CACHE_SETTINGS;
    }
  }
  return DEFAULT_AUTO_CACHE_SETTINGS;
}

/**
 * Update auto-cache settings
 */
export function setAutoCacheSettings(settings: Partial<AutoCacheSettings>): void {
  const current = getAutoCacheSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem("docu_synth_auto_cache", JSON.stringify(updated));
}

/**
 * Auto-cache a document if settings allow
 */
export async function autoCacheDocument(
  documentId: Id<"documents">,
  documentData: {
    topic: string;
    content: string;
    projectId?: Id<"projects">;
    visibility: "public" | "private" | "workspace";
    sources: Array<{ title: string; url: string }>;
  }
): Promise<boolean> {
  const settings = getAutoCacheSettings();

  if (!settings.enabled || !settings.cacheOnView) {
    return false;
  }

  // Check if we have space
  const stats = await getCacheStats();
  const maxBytes = settings.maxCacheSizeMB * 1024 * 1024;

  if (stats.totalSize >= maxBytes) {
    // Try to prune old documents
    await pruneCache();
    const newStats = await getCacheStats();
    if (newStats.totalSize >= maxBytes) {
      console.warn("[OfflineService] Cache full, cannot auto-cache document");
      return false;
    }
  }

  await cacheDocument(documentId, documentData);
  return true;
}

// ===============================================================
// Cache by Project
// ===============================================================

/**
 * Cache all documents in a project
 */
export async function cacheProject(
  projectId: Id<"projects">,
  documents: Array<{
    _id: Id<"documents">;
    topic: string;
    content: string;
    visibility: "public" | "private" | "workspace";
    sources: Array<{ title: string; url: string }>;
  }>
): Promise<number> {
  let cached = 0;

  for (const doc of documents) {
    try {
      await cacheDocument(doc._id, {
        topic: doc.topic,
        content: doc.content,
        projectId,
        visibility: doc.visibility,
        sources: doc.sources,
      });
      cached++;
    } catch (error) {
      console.error(
        `[OfflineService] Failed to cache document ${doc._id}:`,
        error
      );
    }
  }

  return cached;
}

/**
 * Get cached documents for a project
 */
export async function getCachedProjectDocuments(
  projectId: Id<"projects">
): Promise<CachedDocument[]> {
  const allDocs = await getCachedDocuments();
  return allDocs.filter((doc) => doc.projectId === projectId.toString());
}

/**
 * Clear cached documents for a project
 */
export async function clearProjectCache(projectId: Id<"projects">): Promise<number> {
  const projectDocs = await getCachedProjectDocuments(projectId);

  for (const doc of projectDocs) {
    await uncacheDocument(doc.documentId as Id<"documents">);
  }

  return projectDocs.length;
}

// ===============================================================
// Service Worker Communication
// ===============================================================

/**
 * Request service worker to cache specific documents
 */
export function requestServiceWorkerCache(documentIds: string[]): void {
  if (!navigator.serviceWorker?.controller) {
    console.warn("[OfflineService] No active service worker");
    return;
  }

  for (const documentId of documentIds) {
    navigator.serviceWorker.controller.postMessage({
      type: "CACHE_DOCUMENT",
      payload: { documentId },
    });
  }
}

/**
 * Register for background sync
 */
export async function registerBackgroundSync(tag: string = "docusynth-sync"): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("sync" in window)) {
    console.warn("[OfflineService] Background sync not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register(tag);
    return true;
  } catch (error) {
    console.error("[OfflineService] Failed to register sync:", error);
    return false;
  }
}

// ===============================================================
// Export Cached Documents
// ===============================================================

/**
 * Export all cached documents as JSON
 */
export async function exportCachedDocuments(): Promise<string> {
  const docs = await getCachedDocuments();
  return JSON.stringify(docs, null, 2);
}

/**
 * Import cached documents from JSON
 */
export async function importCachedDocuments(json: string): Promise<number> {
  const docs = JSON.parse(json) as CachedDocument[];
  const db = await openDatabase();

  let imported = 0;

  for (const doc of docs) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([DOCUMENTS_STORE], "readwrite");
      const store = transaction.objectStore(DOCUMENTS_STORE);
      const request = store.put(doc);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        imported++;
        resolve();
      };
    });
  }

  return imported;
}

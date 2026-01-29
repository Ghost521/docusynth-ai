// ===============================================================
// Sync Service - Offline Change Queue & Synchronization
// ===============================================================

import { Id } from "../convex/_generated/dataModel";

// ===============================================================
// Types
// ===============================================================

export type ChangeType =
  | "create_document"
  | "update_document"
  | "delete_document"
  | "update_visibility"
  | "move_document"
  | "create_project"
  | "delete_project";

export type ChangeStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export interface PendingChange {
  id: string;
  type: ChangeType;
  entityType: "document" | "project";
  entityId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  status: ChangeStatus;
  retryCount: number;
  lastError?: string;
  conflictData?: ConflictData;
}

export interface ConflictData {
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  conflictedFields: string[];
  detectedAt: number;
}

export type ConflictResolution = "keep_local" | "keep_server" | "merge";

export interface SyncHistoryEntry {
  id: string;
  changeId: string;
  changeType: ChangeType;
  entityId: string;
  status: "success" | "failed" | "conflict_resolved";
  syncedAt: number;
  resolution?: ConflictResolution;
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncAt: number | null;
  lastSyncError: string | null;
}

// ===============================================================
// Constants
// ===============================================================

const DB_NAME = "docusynth-sync";
const DB_VERSION = 1;
const CHANGES_STORE = "pendingChanges";
const HISTORY_STORE = "syncHistory";

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 5000;
const SYNC_HISTORY_LIMIT = 100;

// ===============================================================
// IndexedDB Initialization
// ===============================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[SyncService] Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending changes store
      if (!db.objectStoreNames.contains(CHANGES_STORE)) {
        const changesStore = db.createObjectStore(CHANGES_STORE, {
          keyPath: "id",
        });
        changesStore.createIndex("status", "status", { unique: false });
        changesStore.createIndex("timestamp", "timestamp", { unique: false });
        changesStore.createIndex("entityId", "entityId", { unique: false });
      }

      // Sync history store
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, {
          keyPath: "id",
        });
        historyStore.createIndex("syncedAt", "syncedAt", { unique: false });
        historyStore.createIndex("changeId", "changeId", { unique: false });
      }
    };
  });

  return dbPromise;
}

// ===============================================================
// Change Queue Management
// ===============================================================

/**
 * Queue a change for synchronization
 */
export async function queueChange(
  type: ChangeType,
  entityType: "document" | "project",
  entityId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const db = await openDatabase();

  const change: PendingChange = {
    id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    entityType,
    entityId,
    payload,
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readwrite");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.add(change);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Register for background sync
      registerBackgroundSync();
      resolve(change.id);
    };
  });
}

/**
 * Get all pending changes
 */
export async function getPendingChanges(): Promise<PendingChange[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readonly");
    const store = transaction.objectStore(CHANGES_STORE);
    const index = store.index("status");
    const request = index.getAll(IDBKeyRange.only("pending"));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get all changes (including failed and conflicts)
 */
export async function getAllChanges(): Promise<PendingChange[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readonly");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get changes with conflicts
 */
export async function getConflictingChanges(): Promise<PendingChange[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readonly");
    const store = transaction.objectStore(CHANGES_STORE);
    const index = store.index("status");
    const request = index.getAll(IDBKeyRange.only("conflict"));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Update a pending change
 */
async function updateChange(change: PendingChange): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readwrite");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.put(change);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Remove a change from the queue
 */
async function removeChange(changeId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readwrite");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.delete(changeId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ===============================================================
// Synchronization
// ===============================================================

let isSyncing = false;
let syncListeners: Array<(status: SyncStatus) => void> = [];

/**
 * Sync all pending changes
 */
export async function syncChanges(): Promise<{
  synced: number;
  failed: number;
  conflicts: number;
}> {
  if (isSyncing) {
    console.log("[SyncService] Sync already in progress");
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  if (!navigator.onLine) {
    console.log("[SyncService] Offline, cannot sync");
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  isSyncing = true;
  notifyListeners();

  const results = { synced: 0, failed: 0, conflicts: 0 };

  try {
    const pendingChanges = await getPendingChanges();

    for (const change of pendingChanges) {
      try {
        change.status = "syncing";
        await updateChange(change);
        notifyListeners();

        // Check for conflicts first
        const hasConflict = await checkForConflict(change);

        if (hasConflict) {
          change.status = "conflict";
          await updateChange(change);
          results.conflicts++;
          continue;
        }

        // Apply the change
        await applyChange(change);

        // Record success
        await addToHistory({
          id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          changeId: change.id,
          changeType: change.type,
          entityId: change.entityId,
          status: "success",
          syncedAt: Date.now(),
        });

        // Remove from pending
        await removeChange(change.id);
        results.synced++;
      } catch (error) {
        console.error(`[SyncService] Failed to sync change ${change.id}:`, error);

        change.retryCount++;
        change.lastError = error instanceof Error ? error.message : "Unknown error";

        if (change.retryCount >= MAX_RETRY_COUNT) {
          change.status = "failed";
        } else {
          change.status = "pending";
        }

        await updateChange(change);
        results.failed++;
      }
    }

    // Update last sync time
    localStorage.setItem("docu_synth_last_sync", Date.now().toString());
    localStorage.removeItem("docu_synth_last_sync_error");
  } catch (error) {
    console.error("[SyncService] Sync failed:", error);
    localStorage.setItem(
      "docu_synth_last_sync_error",
      error instanceof Error ? error.message : "Unknown error"
    );
  } finally {
    isSyncing = false;
    notifyListeners();
  }

  return results;
}

/**
 * Check if a change conflicts with server data
 */
async function checkForConflict(change: PendingChange): Promise<boolean> {
  // For update operations, check if server version has changed
  if (
    change.type === "update_document" ||
    change.type === "update_visibility" ||
    change.type === "move_document"
  ) {
    try {
      // This would typically call the server to get the current version
      // For now, we'll use a simple timestamp comparison
      const serverVersion = await fetchServerVersion(change.entityId);

      if (serverVersion && serverVersion.updatedAt > change.timestamp) {
        // Server has newer changes
        change.conflictData = {
          localVersion: change.payload,
          serverVersion: serverVersion.data,
          conflictedFields: detectConflictedFields(change.payload, serverVersion.data),
          detectedAt: Date.now(),
        };
        return true;
      }
    } catch (error) {
      console.warn("[SyncService] Could not check for conflicts:", error);
    }
  }

  return false;
}

/**
 * Fetch server version of an entity (mock implementation)
 */
async function fetchServerVersion(
  entityId: string
): Promise<{ updatedAt: number; data: Record<string, unknown> } | null> {
  // This would typically be an API call
  // For now, return null (no conflict)
  return null;
}

/**
 * Detect which fields conflict between local and server versions
 */
function detectConflictedFields(
  local: Record<string, unknown>,
  server: Record<string, unknown>
): string[] {
  const conflicted: string[] = [];

  for (const key of Object.keys(local)) {
    if (JSON.stringify(local[key]) !== JSON.stringify(server[key])) {
      conflicted.push(key);
    }
  }

  return conflicted;
}

/**
 * Apply a change to the server
 */
async function applyChange(change: PendingChange): Promise<void> {
  // This would typically call Convex mutations
  // The actual implementation depends on how you want to handle server communication
  console.log("[SyncService] Applying change:", change.type, change.entityId);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Post message to main app to apply the change
  if (typeof window !== "undefined") {
    window.postMessage(
      {
        type: "APPLY_SYNC_CHANGE",
        payload: change,
      },
      "*"
    );
  }
}

// ===============================================================
// Conflict Resolution
// ===============================================================

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  changeId: string,
  resolution: ConflictResolution
): Promise<void> {
  const db = await openDatabase();

  // Get the change
  const change = await new Promise<PendingChange | undefined>((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readonly");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.get(changeId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  if (!change || change.status !== "conflict") {
    throw new Error("Change not found or not in conflict state");
  }

  switch (resolution) {
    case "keep_local":
      // Force apply local changes
      change.status = "pending";
      change.conflictData = undefined;
      await updateChange(change);
      await syncChanges();
      break;

    case "keep_server":
      // Discard local changes
      await addToHistory({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        changeId: change.id,
        changeType: change.type,
        entityId: change.entityId,
        status: "conflict_resolved",
        syncedAt: Date.now(),
        resolution: "keep_server",
      });
      await removeChange(changeId);
      break;

    case "merge":
      // Merge changes (keep both where possible)
      if (change.conflictData) {
        const merged = mergeChanges(
          change.payload,
          change.conflictData.serverVersion
        );
        change.payload = merged;
        change.status = "pending";
        change.conflictData = undefined;
        await updateChange(change);
        await syncChanges();
      }
      break;
  }

  notifyListeners();
}

/**
 * Merge local and server changes
 */
function mergeChanges(
  local: Record<string, unknown>,
  server: Record<string, unknown>
): Record<string, unknown> {
  // Simple merge: prefer local for conflicting fields, keep all fields from both
  return {
    ...server,
    ...local,
    _mergedAt: Date.now(),
  };
}

// ===============================================================
// Sync History
// ===============================================================

/**
 * Add an entry to sync history
 */
async function addToHistory(entry: SyncHistoryEntry): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.add(entry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Prune old history
  await pruneHistory();
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit: number = 50): Promise<SyncHistoryEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readonly");
    const store = transaction.objectStore(HISTORY_STORE);
    const index = store.index("syncedAt");

    const entries: SyncHistoryEntry[] = [];
    const request = index.openCursor(null, "prev");

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && entries.length < limit) {
        entries.push(cursor.value);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
  });
}

/**
 * Prune old history entries
 */
async function pruneHistory(): Promise<void> {
  const db = await openDatabase();
  const history = await getSyncHistory(SYNC_HISTORY_LIMIT + 50);

  if (history.length > SYNC_HISTORY_LIMIT) {
    const toDelete = history.slice(SYNC_HISTORY_LIMIT);

    for (const entry of toDelete) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], "readwrite");
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.delete(entry.id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }
  }
}

/**
 * Clear sync history
 */
export async function clearSyncHistory(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ===============================================================
// Sync Status
// ===============================================================

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const allChanges = await getAllChanges();

  const lastSyncStr = localStorage.getItem("docu_synth_last_sync");
  const lastSyncError = localStorage.getItem("docu_synth_last_sync_error");

  return {
    isOnline: navigator.onLine,
    isSyncing,
    pendingCount: allChanges.filter((c) => c.status === "pending").length,
    failedCount: allChanges.filter((c) => c.status === "failed").length,
    conflictCount: allChanges.filter((c) => c.status === "conflict").length,
    lastSyncAt: lastSyncStr ? parseInt(lastSyncStr, 10) : null,
    lastSyncError,
  };
}

/**
 * Add a sync status listener
 */
export function addSyncStatusListener(
  callback: (status: SyncStatus) => void
): () => void {
  syncListeners.push(callback);

  return () => {
    syncListeners = syncListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Notify all listeners of status change
 */
async function notifyListeners(): Promise<void> {
  const status = await getSyncStatus();
  for (const listener of syncListeners) {
    try {
      listener(status);
    } catch (error) {
      console.error("[SyncService] Listener error:", error);
    }
  }
}

// ===============================================================
// Background Sync
// ===============================================================

/**
 * Register for background sync
 */
async function registerBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("sync" in window)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register("docusynth-sync");
  } catch (error) {
    console.warn("[SyncService] Background sync registration failed:", error);
  }
}

/**
 * Retry a failed change
 */
export async function retryFailedChange(changeId: string): Promise<void> {
  const db = await openDatabase();

  const change = await new Promise<PendingChange | undefined>((resolve, reject) => {
    const transaction = db.transaction([CHANGES_STORE], "readonly");
    const store = transaction.objectStore(CHANGES_STORE);
    const request = store.get(changeId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  if (!change) {
    throw new Error("Change not found");
  }

  change.status = "pending";
  change.retryCount = 0;
  change.lastError = undefined;
  await updateChange(change);

  // Trigger sync
  await syncChanges();
}

/**
 * Retry all failed changes
 */
export async function retryAllFailedChanges(): Promise<void> {
  const db = await openDatabase();
  const allChanges = await getAllChanges();
  const failedChanges = allChanges.filter((c) => c.status === "failed");

  for (const change of failedChanges) {
    change.status = "pending";
    change.retryCount = 0;
    change.lastError = undefined;
    await updateChange(change);
  }

  if (failedChanges.length > 0) {
    await syncChanges();
  }
}

/**
 * Discard a failed change
 */
export async function discardChange(changeId: string): Promise<void> {
  await removeChange(changeId);
  notifyListeners();
}

// ===============================================================
// Auto-Sync
// ===============================================================

let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start auto-sync
 */
export function startAutoSync(intervalMs: number = 30000): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  autoSyncInterval = setInterval(async () => {
    if (navigator.onLine && !isSyncing) {
      const status = await getSyncStatus();
      if (status.pendingCount > 0) {
        await syncChanges();
      }
    }
  }, intervalMs);

  // Also sync on coming back online
  window.addEventListener("online", handleOnline);
}

/**
 * Stop auto-sync
 */
export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  window.removeEventListener("online", handleOnline);
}

/**
 * Handle coming back online
 */
async function handleOnline(): Promise<void> {
  console.log("[SyncService] Back online, syncing...");
  await syncChanges();
}

// ===============================================================
// Service Worker Message Handling
// ===============================================================

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", async (event) => {
    const { type, payload } = event.data || {};

    switch (type) {
      case "SYNC_START":
        console.log("[SyncService] Background sync started");
        break;

      case "SYNC_PENDING_CHANGES":
        await syncChanges();
        break;

      case "SYNC_ERROR":
        console.error("[SyncService] Background sync error:", payload?.error);
        break;

      case "QUEUE_OFFLINE_CHANGE":
        // Store the offline change
        if (payload) {
          await queueChange(
            "update_document" as ChangeType,
            "document",
            payload.url,
            {
              method: payload.method,
              headers: payload.headers,
              body: payload.body,
              timestamp: payload.timestamp,
            }
          );
        }
        break;
    }
  });
}

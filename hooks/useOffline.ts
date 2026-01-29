import { useState, useEffect, useCallback, useRef } from "react";
import {
  getOfflineStatus,
  addOnlineStatusListener,
  getCacheStats,
  CacheStats,
  OfflineStatus,
} from "../services/offlineService";
import {
  getSyncStatus,
  addSyncStatusListener,
  syncChanges,
  startAutoSync,
  stopAutoSync,
  SyncStatus,
} from "../services/syncService";

// ===============================================================
// Types
// ===============================================================

export interface UseOfflineReturn {
  // Status
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  hasServiceWorker: boolean;

  // Counts
  pendingChangesCount: number;
  failedChangesCount: number;
  conflictCount: number;
  cachedDocumentsCount: number;

  // Timestamps
  lastOnlineAt: Date | null;
  lastSyncAt: Date | null;

  // Storage
  cacheStats: CacheStats | null;
  cachePercentUsed: number;

  // Sync
  syncStatus: SyncStatus | null;
  syncError: string | null;

  // Actions
  triggerSync: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

// ===============================================================
// Hook Implementation
// ===============================================================

export function useOffline(): UseOfflineReturn {
  // State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refs
  const mountedRef = useRef(true);

  // Refresh all status
  const refreshStatus = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const [offline, sync, cache] = await Promise.all([
        Promise.resolve(getOfflineStatus()),
        getSyncStatus(),
        getCacheStats(),
      ]);

      if (mountedRef.current) {
        setOfflineStatus(offline);
        setSyncStatus(sync);
        setCacheStats(cache);
        setIsOnline(offline.isOnline);
      }
    } catch (error) {
      console.error("[useOffline] Failed to refresh status:", error);
    }
  }, []);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      await syncChanges();
      await refreshStatus();
    } catch (error) {
      console.error("[useOffline] Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshStatus]);

  // Setup listeners and auto-sync
  useEffect(() => {
    mountedRef.current = true;

    // Initial status fetch
    refreshStatus();

    // Listen for online/offline changes
    const unsubOnline = addOnlineStatusListener((online) => {
      setIsOnline(online);
      if (online) {
        // Sync when coming back online
        triggerSync();
      }
    });

    // Listen for sync status changes
    const unsubSync = addSyncStatusListener((status) => {
      if (mountedRef.current) {
        setSyncStatus(status);
        setIsSyncing(status.isSyncing);
      }
    });

    // Start auto-sync (every 30 seconds)
    startAutoSync(30000);

    // Cleanup
    return () => {
      mountedRef.current = false;
      unsubOnline();
      unsubSync();
      stopAutoSync();
    };
  }, [refreshStatus, triggerSync]);

  // Refresh status periodically
  useEffect(() => {
    const interval = setInterval(refreshStatus, 60000); // Every minute
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Computed values
  const lastOnlineAt = offlineStatus?.lastOnlineAt
    ? new Date(offlineStatus.lastOnlineAt)
    : null;

  const lastSyncAt = syncStatus?.lastSyncAt
    ? new Date(syncStatus.lastSyncAt)
    : null;

  return {
    // Status
    isOnline,
    isOffline: !isOnline,
    isSyncing: isSyncing || (syncStatus?.isSyncing ?? false),
    hasServiceWorker: offlineStatus?.serviceWorkerActive ?? false,

    // Counts
    pendingChangesCount: syncStatus?.pendingCount ?? 0,
    failedChangesCount: syncStatus?.failedCount ?? 0,
    conflictCount: syncStatus?.conflictCount ?? 0,
    cachedDocumentsCount: cacheStats?.totalDocuments ?? 0,

    // Timestamps
    lastOnlineAt,
    lastSyncAt,

    // Storage
    cacheStats,
    cachePercentUsed: cacheStats?.percentUsed ?? 0,

    // Sync
    syncStatus,
    syncError: syncStatus?.lastSyncError ?? null,

    // Actions
    triggerSync,
    refreshStatus,
  };
}

export default useOffline;

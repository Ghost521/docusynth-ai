import React, { useState, useEffect } from "react";
import { Icons } from "./Icon";
import { useOffline } from "../hooks/useOffline";
import { useServiceWorker } from "../hooks/useServiceWorker";
import {
  getCacheStats,
  clearCache,
  pruneCache,
  getCachedDocuments,
  uncacheDocument,
  getAutoCacheSettings,
  setAutoCacheSettings,
  CachedDocument,
} from "../services/offlineService";
import { Id } from "../convex/_generated/dataModel";

// ===============================================================
// Types
// ===============================================================

interface OfflineSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ===============================================================
// Component
// ===============================================================

export function OfflineSettings({
  isOpen,
  onClose,
}: OfflineSettingsProps): JSX.Element | null {
  // State
  const [activeTab, setActiveTab] = useState<"status" | "cache" | "settings">("status");
  const [cachedDocs, setCachedDocs] = useState<CachedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoCacheEnabled, setAutoCacheEnabled] = useState(true);
  const [cacheOnView, setCacheOnView] = useState(true);
  const [maxCacheSize, setMaxCacheSize] = useState(100);

  // Hooks
  const offline = useOffline();
  const sw = useServiceWorker();

  // Load cached documents and settings
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const docs = await getCachedDocuments();
      setCachedDocs(docs);

      const settings = getAutoCacheSettings();
      setAutoCacheEnabled(settings.enabled);
      setCacheOnView(settings.cacheOnView);
      setMaxCacheSize(settings.maxCacheSizeMB);
    } catch (error) {
      console.error("Failed to load offline data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Handle clear cache
  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear all cached documents?")) return;

    setIsLoading(true);
    try {
      await clearCache();
      setCachedDocs([]);
      await offline.refreshStatus();
    } catch (error) {
      console.error("Failed to clear cache:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle prune cache
  const handlePruneCache = async () => {
    setIsLoading(true);
    try {
      const removed = await pruneCache(7 * 24 * 60 * 60 * 1000); // 7 days
      if (removed > 0) {
        await loadData();
      }
    } catch (error) {
      console.error("Failed to prune cache:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle remove document from cache
  const handleRemoveFromCache = async (documentId: string) => {
    try {
      await uncacheDocument(documentId as Id<"documents">);
      setCachedDocs(docs => docs.filter(d => d.documentId !== documentId));
    } catch (error) {
      console.error("Failed to remove document from cache:", error);
    }
  };

  // Save settings
  const handleSaveSettings = () => {
    setAutoCacheSettings({
      enabled: autoCacheEnabled,
      cacheOnView,
      maxCacheSizeMB: maxCacheSize,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-xl animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.CloudDownload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">Offline Mode</h2>
              <p className="text-sm text-secondary">
                Manage cached documents and offline settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: "status", label: "Status", icon: Icons.Signal },
            { id: "cache", label: "Cached Documents", icon: Icons.HardDrive },
            { id: "settings", label: "Settings", icon: Icons.Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-secondary hover:text-main hover:bg-surface-hover"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Status Tab */}
          {activeTab === "status" && (
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="p-4 bg-background rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  {offline.isOnline ? (
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Icons.Wifi className="w-5 h-5 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <Icons.WifiOff className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  <div>
                    <p className={`font-medium ${offline.isOnline ? "text-emerald-500" : "text-red-500"}`}>
                      {offline.isOnline ? "Online" : "Offline"}
                    </p>
                    <p className="text-sm text-secondary">
                      {offline.lastSyncAt
                        ? `Last synced ${offline.lastSyncAt.toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface rounded-lg">
                    <p className="text-2xl font-bold text-main">
                      {offline.pendingChangesCount}
                    </p>
                    <p className="text-xs text-secondary">Pending Changes</p>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <p className="text-2xl font-bold text-main">
                      {offline.cachedDocumentsCount}
                    </p>
                    <p className="text-xs text-secondary">Cached Documents</p>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <p className="text-2xl font-bold text-main">
                      {offline.failedChangesCount}
                    </p>
                    <p className="text-xs text-secondary">Failed Syncs</p>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <p className="text-2xl font-bold text-main">
                      {offline.conflictCount}
                    </p>
                    <p className="text-xs text-secondary">Conflicts</p>
                  </div>
                </div>
              </div>

              {/* Service Worker Status */}
              <div className="p-4 bg-background rounded-lg border border-border">
                <h3 className="font-medium text-main mb-3">Service Worker</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        sw.isActivated ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="text-sm text-secondary">
                      Status: {sw.status}
                    </span>
                  </div>
                  {sw.isUpdateAvailable && (
                    <button
                      onClick={sw.skipWaiting}
                      className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                    >
                      Update Available
                    </button>
                  )}
                </div>
              </div>

              {/* Storage Usage */}
              {offline.cacheStats && (
                <div className="p-4 bg-background rounded-lg border border-border">
                  <h3 className="font-medium text-main mb-3">Storage Usage</h3>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-secondary">
                        {formatBytes(offline.cacheStats.quotaUsed)} used
                      </span>
                      <span className="text-secondary">
                        {formatBytes(offline.cacheStats.quotaAvailable)} total
                      </span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${offline.cachePercentUsed}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-secondary">
                    {offline.cachePercentUsed}% of available storage used
                  </p>
                </div>
              )}

              {/* Sync Button */}
              {offline.isOnline && offline.pendingChangesCount > 0 && (
                <button
                  onClick={offline.triggerSync}
                  disabled={offline.isSyncing}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {offline.isSyncing ? (
                    <>
                      <Icons.RefreshCw className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Icons.Sync className="w-4 h-4" />
                      Sync Now ({offline.pendingChangesCount} changes)
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Cache Tab */}
          {activeTab === "cache" && (
            <div className="space-y-4">
              {/* Cache Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handlePruneCache}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icons.Trash className="w-4 h-4" />
                  Remove Old ({">"}7 days)
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icons.Trash className="w-4 h-4" />
                  Clear All
                </button>
              </div>

              {/* Cached Documents List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Icons.Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : cachedDocs.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.HardDrive className="w-12 h-12 text-secondary mx-auto mb-3 opacity-50" />
                  <p className="text-secondary">No documents cached</p>
                  <p className="text-sm text-secondary mt-1">
                    View documents to cache them automatically
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cachedDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-main truncate">
                          {doc.topic}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-secondary mt-1">
                          <span>{formatBytes(doc.size)}</span>
                          <span>
                            Cached {new Date(doc.cachedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCache(doc.documentId)}
                        className="p-2 text-secondary hover:text-red-500 transition-colors"
                        title="Remove from cache"
                      >
                        <Icons.X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Auto-Cache Toggle */}
              <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                <div>
                  <p className="font-medium text-main">Auto-Cache</p>
                  <p className="text-sm text-secondary">
                    Automatically cache documents for offline access
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAutoCacheEnabled(!autoCacheEnabled);
                    handleSaveSettings();
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoCacheEnabled ? "bg-primary" : "bg-surface"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoCacheEnabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Cache on View Toggle */}
              <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                <div>
                  <p className="font-medium text-main">Cache on View</p>
                  <p className="text-sm text-secondary">
                    Cache documents when you open them
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCacheOnView(!cacheOnView);
                    handleSaveSettings();
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    cacheOnView ? "bg-primary" : "bg-surface"
                  }`}
                  disabled={!autoCacheEnabled}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      cacheOnView ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Max Cache Size */}
              <div className="p-4 bg-background rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-main">Max Cache Size</p>
                    <p className="text-sm text-secondary">
                      Maximum storage for cached documents
                    </p>
                  </div>
                  <span className="text-sm font-medium text-main">
                    {maxCacheSize} MB
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={maxCacheSize}
                  onChange={(e) => {
                    setMaxCacheSize(parseInt(e.target.value));
                    handleSaveSettings();
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-secondary mt-1">
                  <span>50 MB</span>
                  <span>500 MB</span>
                </div>
              </div>

              {/* PWA Install Prompt */}
              {!window.matchMedia("(display-mode: standalone)").matches && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <div className="flex items-start gap-3">
                    <Icons.Smartphone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-main">Install App</p>
                      <p className="text-sm text-secondary mt-1">
                        Install DocuSynth AI for the best offline experience
                      </p>
                      <button
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("showInstallPrompt")
                          );
                        }}
                        className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                      >
                        Install Now
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineSettings;

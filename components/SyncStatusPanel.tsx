import React, { useState, useEffect } from "react";
import { Icons } from "./Icon";
import {
  getSyncStatus,
  getSyncHistory,
  getAllChanges,
  retryFailedChange,
  retryAllFailedChanges,
  discardChange,
  PendingChange,
  SyncHistoryEntry,
  SyncStatus,
} from "../services/syncService";

// ===============================================================
// Types
// ===============================================================

interface SyncStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResolveConflict?: (changeId: string) => void;
}

// ===============================================================
// Component
// ===============================================================

export function SyncStatusPanel({
  isOpen,
  onClose,
  onResolveConflict,
}: SyncStatusPanelProps): JSX.Element | null {
  // State
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [syncStatus, changes, syncHistory] = await Promise.all([
        getSyncStatus(),
        getAllChanges(),
        getSyncHistory(50),
      ]);

      setStatus(syncStatus);
      setPendingChanges(changes);
      setHistory(syncHistory);
    } catch (error) {
      console.error("Failed to load sync data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle retry
  const handleRetry = async (changeId: string) => {
    setRetryingId(changeId);
    try {
      await retryFailedChange(changeId);
      await loadData();
    } catch (error) {
      console.error("Failed to retry change:", error);
    } finally {
      setRetryingId(null);
    }
  };

  // Handle retry all
  const handleRetryAll = async () => {
    setIsLoading(true);
    try {
      await retryAllFailedChanges();
      await loadData();
    } catch (error) {
      console.error("Failed to retry all changes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle discard
  const handleDiscard = async (changeId: string) => {
    if (!confirm("Are you sure you want to discard this change?")) return;

    try {
      await discardChange(changeId);
      await loadData();
    } catch (error) {
      console.error("Failed to discard change:", error);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Get change type icon
  const getChangeIcon = (type: PendingChange["type"]) => {
    switch (type) {
      case "create_document":
        return Icons.Plus;
      case "update_document":
        return Icons.Edit;
      case "delete_document":
        return Icons.Trash;
      case "update_visibility":
        return Icons.Eye;
      case "move_document":
        return Icons.Folder;
      case "create_project":
        return Icons.FolderPlus;
      case "delete_project":
        return Icons.Trash;
      default:
        return Icons.FileText;
    }
  };

  // Get status badge
  const getStatusBadge = (changeStatus: PendingChange["status"]) => {
    switch (changeStatus) {
      case "pending":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
            Pending
          </span>
        );
      case "syncing":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30 flex items-center gap-1">
            <Icons.Loader className="w-3 h-3 animate-spin" />
            Syncing
          </span>
        );
      case "synced":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
            Synced
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 border border-red-500/30">
            Failed
          </span>
        );
      case "conflict":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/30">
            Conflict
          </span>
        );
    }
  };

  if (!isOpen) return null;

  const failedChanges = pendingChanges.filter((c) => c.status === "failed");
  const conflictChanges = pendingChanges.filter((c) => c.status === "conflict");
  const actualPending = pendingChanges.filter((c) => c.status === "pending" || c.status === "syncing");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-xl animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Sync className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">Sync Status</h2>
              <p className="text-sm text-secondary">
                {status?.isSyncing
                  ? "Syncing changes..."
                  : status?.pendingCount
                  ? `${status.pendingCount} pending changes`
                  : "All changes synced"}
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

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-background border-b border-border">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-main">{actualPending.length}</p>
              <p className="text-xs text-secondary">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{failedChanges.length}</p>
              <p className="text-xs text-secondary">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-500">{conflictChanges.length}</p>
              <p className="text-xs text-secondary">Conflicts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-500">{history.length}</p>
              <p className="text-xs text-secondary">Synced</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "pending"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-secondary hover:text-main hover:bg-surface-hover"
            }`}
          >
            Pending Changes ({pendingChanges.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-secondary hover:text-main hover:bg-surface-hover"
            }`}
          >
            Sync History ({history.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icons.Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activeTab === "pending" ? (
            <div className="space-y-4">
              {/* Retry All Button */}
              {failedChanges.length > 1 && (
                <button
                  onClick={handleRetryAll}
                  className="w-full py-2 px-4 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.RefreshCw className="w-4 h-4" />
                  Retry All Failed ({failedChanges.length})
                </button>
              )}

              {/* Changes List */}
              {pendingChanges.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-main font-medium">All synced!</p>
                  <p className="text-sm text-secondary mt-1">
                    No pending changes
                  </p>
                </div>
              ) : (
                pendingChanges.map((change) => {
                  const ChangeIcon = getChangeIcon(change.type);
                  return (
                    <div
                      key={change.id}
                      className={`p-4 rounded-lg border ${
                        change.status === "conflict"
                          ? "bg-purple-500/5 border-purple-500/30"
                          : change.status === "failed"
                          ? "bg-red-500/5 border-red-500/30"
                          : "bg-background border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-surface rounded-lg">
                            <ChangeIcon className="w-4 h-4 text-secondary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-main">
                                {change.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                              </p>
                              {getStatusBadge(change.status)}
                            </div>
                            <p className="text-sm text-secondary mt-1">
                              {change.entityType}: {change.entityId.slice(0, 12)}...
                            </p>
                            <p className="text-xs text-secondary mt-1">
                              {formatTime(change.timestamp)}
                              {change.retryCount > 0 && ` (${change.retryCount} retries)`}
                            </p>
                            {change.lastError && (
                              <p className="text-xs text-red-500 mt-1">
                                Error: {change.lastError}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {change.status === "conflict" && onResolveConflict && (
                            <button
                              onClick={() => onResolveConflict(change.id)}
                              className="px-3 py-1.5 text-xs bg-purple-500/10 text-purple-500 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          {change.status === "failed" && (
                            <button
                              onClick={() => handleRetry(change.id)}
                              disabled={retryingId === change.id}
                              className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                            >
                              {retryingId === change.id ? (
                                <Icons.Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                "Retry"
                              )}
                            </button>
                          )}
                          {(change.status === "failed" || change.status === "pending") && (
                            <button
                              onClick={() => handleDiscard(change.id)}
                              className="p-1.5 text-secondary hover:text-red-500 transition-colors"
                              title="Discard change"
                            >
                              <Icons.X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.History className="w-12 h-12 text-secondary mx-auto mb-3 opacity-50" />
                  <p className="text-secondary">No sync history yet</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          entry.status === "success"
                            ? "bg-emerald-500"
                            : entry.status === "conflict_resolved"
                            ? "bg-purple-500"
                            : "bg-red-500"
                        }`}
                      />
                      <div>
                        <p className="text-sm text-main">
                          {entry.changeType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-secondary">
                          {entry.entityId.slice(0, 12)}...
                          {entry.resolution && ` (${entry.resolution.replace(/_/g, " ")})`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs font-medium ${
                          entry.status === "success"
                            ? "text-emerald-500"
                            : entry.status === "conflict_resolved"
                            ? "text-purple-500"
                            : "text-red-500"
                        }`}
                      >
                        {entry.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-secondary">
                        {formatTime(entry.syncedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background flex justify-between items-center">
          <p className="text-xs text-secondary">
            {status?.lastSyncAt
              ? `Last sync: ${new Date(status.lastSyncAt).toLocaleString()}`
              : "Never synced"}
          </p>
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

export default SyncStatusPanel;

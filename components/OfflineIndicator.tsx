import React, { useState } from "react";
import { Icons } from "./Icon";
import { useOffline } from "../hooks/useOffline";

// ===============================================================
// Types
// ===============================================================

interface OfflineIndicatorProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

// ===============================================================
// Component
// ===============================================================

export function OfflineIndicator({
  showDetails = false,
  compact = false,
  className = "",
}: OfflineIndicatorProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    isOnline,
    isSyncing,
    pendingChangesCount,
    failedChangesCount,
    conflictCount,
    lastSyncAt,
    triggerSync,
  } = useOffline();

  // Format last sync time
  const formatLastSync = (date: Date | null): string => {
    if (!date) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Determine status color and icon
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        icon: Icons.WifiOff,
        label: "Offline",
      };
    }
    if (conflictCount > 0) {
      return {
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        icon: Icons.AlertTriangle,
        label: "Conflicts",
      };
    }
    if (isSyncing) {
      return {
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        icon: Icons.RefreshCw,
        label: "Syncing",
      };
    }
    if (pendingChangesCount > 0) {
      return {
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        icon: Icons.Cloud,
        label: "Pending",
      };
    }
    return {
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      icon: Icons.Wifi,
      label: "Online",
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  // Compact mode - just an icon
  if (compact) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative p-2 rounded-lg ${status.bgColor} ${status.color} transition-colors hover:opacity-80 ${className}`}
        title={`${status.label}${pendingChangesCount > 0 ? ` (${pendingChangesCount} pending)` : ""}`}
      >
        <StatusIcon
          className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        {(pendingChangesCount > 0 || conflictCount > 0) && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
        )}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main indicator button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${status.bgColor} ${status.borderColor} ${status.color} transition-all hover:opacity-90`}
      >
        <StatusIcon
          className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        <span className="text-sm font-medium">{status.label}</span>
        {pendingChangesCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-surface text-secondary">
            {pendingChangesCount}
          </span>
        )}
        <Icons.ChevronDown
          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded details panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className={`px-4 py-3 ${status.bgColor} border-b border-border`}>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${status.color}`} />
              <div>
                <p className={`font-semibold ${status.color}`}>{status.label}</p>
                <p className="text-xs text-secondary">
                  Last synced: {formatLastSync(lastSyncAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 space-y-3">
            {/* Pending changes */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-secondary">
                <Icons.Clock className="w-4 h-4" />
                <span className="text-sm">Pending changes</span>
              </div>
              <span className={`text-sm font-medium ${pendingChangesCount > 0 ? "text-amber-500" : "text-main"}`}>
                {pendingChangesCount}
              </span>
            </div>

            {/* Failed syncs */}
            {failedChangesCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-secondary">
                  <Icons.AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Failed syncs</span>
                </div>
                <span className="text-sm font-medium text-red-500">
                  {failedChangesCount}
                </span>
              </div>
            )}

            {/* Conflicts */}
            {conflictCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-secondary">
                  <Icons.GitMerge className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">Conflicts</span>
                </div>
                <span className="text-sm font-medium text-amber-500">
                  {conflictCount}
                </span>
              </div>
            )}

            {/* Sync button */}
            {isOnline && !isSyncing && pendingChangesCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSync();
                }}
                className="w-full mt-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Sync className="w-4 h-4" />
                Sync Now
              </button>
            )}

            {/* Offline message */}
            {!isOnline && (
              <div className="mt-2 p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-500">
                  Changes will sync automatically when you're back online.
                </p>
              </div>
            )}

            {/* Conflict warning */}
            {conflictCount > 0 && (
              <div className="mt-2 p-3 bg-amber-500/10 rounded-lg">
                <p className="text-sm text-amber-500">
                  {conflictCount} document{conflictCount !== 1 ? "s have" : " has"} conflicts that need resolution.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {showDetails && (
            <div className="px-4 py-3 bg-surface border-t border-border">
              <button
                onClick={() => {
                  // Open offline settings
                  window.dispatchEvent(
                    new CustomEvent("openOfflineSettings")
                  );
                  setIsExpanded(false);
                }}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Icons.Settings className="w-3 h-3" />
                Offline Settings
              </button>
            </div>
          )}
        </div>
      )}

      {/* Click outside handler */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

export default OfflineIndicator;

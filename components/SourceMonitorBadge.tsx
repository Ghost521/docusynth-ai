import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface SourceMonitorBadgeProps {
  documentId: Id<"documents">;
  compact?: boolean;
  onOpenPreferences?: () => void;
}

type CheckFrequency = "hourly" | "every_6_hours" | "daily" | "weekly";

const FREQUENCY_LABELS: Record<CheckFrequency, string> = {
  hourly: "Hourly",
  every_6_hours: "Every 6h",
  daily: "Daily",
  weekly: "Weekly",
};

export default function SourceMonitorBadge({
  documentId,
  compact = false,
  onOpenPreferences,
}: SourceMonitorBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceFrequency, setNewSourceFrequency] = useState<CheckFrequency>("daily");
  const [isAdding, setIsAdding] = useState(false);

  const monitoredSources = useQuery(api.changeDetection.getMonitoredSources, {
    documentId,
  });

  const addSource = useMutation(api.changeDetection.addSourceToMonitor);
  const removeSource = useMutation(api.changeDetection.removeSourceFromMonitor);
  const updateSource = useMutation(api.changeDetection.updateMonitorSettings);
  const registerAllSources = useMutation(api.changeDetection.registerDocumentSources);

  const hasActiveMonitors = monitoredSources?.some((s) => s.isActive) || false;
  const pendingAlerts = monitoredSources?.filter(
    (s) => s.lastSnapshot && s.isActive
  ).length || 0;

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return;
    setIsAdding(true);
    try {
      await addSource({
        documentId,
        sourceUrl: newSourceUrl,
        checkFrequency: newSourceFrequency,
      });
      setNewSourceUrl("");
      setShowAddSource(false);
    } catch (error) {
      console.error("Failed to add source:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSource = async (monitorId: Id<"sourceMonitorQueue">) => {
    try {
      await removeSource({ monitorId });
    } catch (error) {
      console.error("Failed to remove source:", error);
    }
  };

  const handleToggleActive = async (
    monitorId: Id<"sourceMonitorQueue">,
    isActive: boolean
  ) => {
    try {
      await updateSource({ monitorId, isActive: !isActive });
    } catch (error) {
      console.error("Failed to update source:", error);
    }
  };

  const handleRegisterAll = async () => {
    try {
      await registerAllSources({ documentId });
    } catch (error) {
      console.error("Failed to register sources:", error);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case "github_repo":
      case "github_release":
        return <Icons.GitHub className="w-4 h-4" />;
      case "api_docs":
        return <Icons.Code className="w-4 h-4" />;
      default:
        return <Icons.Link className="w-4 h-4" />;
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(true)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
          hasActiveMonitors
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            : "bg-gray-100 dark:bg-surface-hover text-secondary"
        }`}
        title={`${monitoredSources?.length || 0} sources monitored`}
      >
        <Icons.Radar className="w-3.5 h-3.5" />
        {hasActiveMonitors ? (
          <>
            <span>{monitoredSources?.filter((s) => s.isActive).length || 0}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </>
        ) : (
          <span>Monitor</span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Main badge button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          hasActiveMonitors
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : "bg-gray-50 dark:bg-surface-hover/50 border-border text-secondary"
        }`}
      >
        <Icons.Radar className="w-4 h-4" />
        <span className="text-sm font-medium">
          {hasActiveMonitors
            ? `${monitoredSources?.filter((s) => s.isActive).length} sources monitored`
            : "No monitoring"}
        </span>
        {hasActiveMonitors && (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
        <Icons.ChevronDown
          className={`w-4 h-4 transition-transform ${
            showDetails ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Details dropdown */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-main">
              Source Monitoring
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRegisterAll}
                className="p-1.5 text-gray-500 hover:bg-surface-hover rounded-lg transition-colors"
                title="Register all document sources"
              >
                <Icons.Plus className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenPreferences}
                className="p-1.5 text-gray-500 hover:bg-surface-hover rounded-lg transition-colors"
                title="Alert preferences"
              >
                <Icons.Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sources list */}
          <div className="max-h-64 overflow-y-auto">
            {!monitoredSources || monitoredSources.length === 0 ? (
              <div className="p-4 text-center text-secondary">
                <Icons.Radar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sources being monitored</p>
                <p className="text-xs mt-1">
                  Add sources to detect changes automatically
                </p>
              </div>
            ) : (
              monitoredSources.map((source) => (
                <div
                  key={source._id}
                  className="p-3 border-b border-gray-100 dark:border-border/50 last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-gray-400">
                      {getSourceTypeIcon(source.sourceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-main truncate"
                        title={source.sourceUrl}
                      >
                        {new URL(source.sourceUrl).hostname}
                      </p>
                      <p className="text-xs text-secondary truncate">
                        {source.sourceUrl.replace(/^https?:\/\//, "").substring(0, 50)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            source.isActive
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-gray-100 dark:bg-surface-hover text-secondary"
                          }`}
                        >
                          {source.isActive ? "Active" : "Paused"}
                        </span>
                        <span className="text-gray-400">
                          {FREQUENCY_LABELS[source.checkFrequency]}
                        </span>
                        <span className="text-gray-400">
                          Checked: {formatDate(source.lastCheckedAt)}
                        </span>
                      </div>
                      {source.lastError && (
                        <p className="text-xs text-red-500 mt-1 truncate">
                          Error: {source.lastError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          handleToggleActive(source._id, source.isActive)
                        }
                        className={`p-1 rounded transition-colors ${
                          source.isActive
                            ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                            : "text-gray-400 hover:bg-surface-hover"
                        }`}
                        title={source.isActive ? "Pause monitoring" : "Resume monitoring"}
                      >
                        {source.isActive ? (
                          <Icons.Eye className="w-4 h-4" />
                        ) : (
                          <Icons.EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveSource(source._id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove from monitoring"
                      >
                        <Icons.X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add source form */}
          {showAddSource ? (
            <div className="p-3 border-t border-border bg-gray-50 dark:bg-surface-hover/30">
              <div className="space-y-2">
                <input
                  type="url"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://example.com/docs"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newSourceFrequency}
                    onChange={(e) =>
                      setNewSourceFrequency(e.target.value as CheckFrequency)
                    }
                    className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddSource}
                    disabled={isAdding || !newSourceUrl.trim()}
                    className="px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isAdding && <Icons.Loader className="w-3 h-3 animate-spin" />}
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddSource(false)}
                    className="px-3 py-2 text-sm font-medium text-secondary hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowAddSource(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
              >
                <Icons.Plus className="w-4 h-4" />
                Add custom source
              </button>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showDetails && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDetails(false);
            setShowAddSource(false);
          }}
        />
      )}
    </div>
  );
}

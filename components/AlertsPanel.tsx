import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDocument?: (documentId: Id<"documents">) => void;
  onViewDiff?: (alertId: Id<"changeAlerts">) => void;
}

type FilterStatus = "all" | "pending" | "read" | "dismissed" | "snoozed";
type SnoozeDuration = "1_hour" | "4_hours" | "1_day" | "1_week";

const SNOOZE_LABELS: Record<SnoozeDuration, string> = {
  "1_hour": "1 hour",
  "4_hours": "4 hours",
  "1_day": "1 day",
  "1_week": "1 week",
};

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  content_modified: { label: "Content Modified", color: "text-blue-500" },
  new_release: { label: "New Release", color: "text-green-500" },
  new_commit: { label: "New Commit", color: "text-purple-500" },
  source_unavailable: { label: "Source Unavailable", color: "text-red-500" },
  major_update: { label: "Major Update", color: "text-orange-500" },
  minor_update: { label: "Minor Update", color: "text-gray-500" },
};

export default function AlertsPanel({
  isOpen,
  onClose,
  onViewDocument,
  onViewDiff,
}: AlertsPanelProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedAlerts, setSelectedAlerts] = useState<Set<Id<"changeAlerts">>>(new Set());
  const [snoozeMenuAlertId, setSnoozeMenuAlertId] = useState<Id<"changeAlerts"> | null>(null);

  const alerts = useQuery(api.alerts.list, { status: filterStatus, limit: 100 });
  const pendingCount = useQuery(api.alerts.getPendingCount);

  const markAsRead = useMutation(api.alerts.markAsRead);
  const markAllAsRead = useMutation(api.alerts.markAllAsRead);
  const dismissAlert = useMutation(api.alerts.dismiss);
  const snoozeAlert = useMutation(api.alerts.snooze);
  const bulkDismiss = useMutation(api.alerts.bulkDismiss);

  const groupedAlerts = useMemo(() => {
    if (!alerts) return {};

    const groups: Record<string, typeof alerts> = {};
    const now = new Date();

    for (const alert of alerts) {
      const alertDate = new Date(alert.createdAt);
      let key: string;

      if (alertDate.toDateString() === now.toDateString()) {
        key = "Today";
      } else if (
        alertDate.toDateString() ===
        new Date(now.getTime() - 86400000).toDateString()
      ) {
        key = "Yesterday";
      } else if (now.getTime() - alertDate.getTime() < 7 * 86400000) {
        key = "This Week";
      } else {
        key = "Older";
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(alert);
    }

    return groups;
  }, [alerts]);

  const handleMarkAsRead = async (alertId: Id<"changeAlerts">) => {
    await markAsRead({ alertId });
  };

  const handleDismiss = async (alertId: Id<"changeAlerts">) => {
    await dismissAlert({ alertId });
  };

  const handleSnooze = async (alertId: Id<"changeAlerts">, duration: SnoozeDuration) => {
    await snoozeAlert({ alertId, duration });
    setSnoozeMenuAlertId(null);
  };

  const handleBulkDismiss = async () => {
    if (selectedAlerts.size === 0) return;
    await bulkDismiss({ alertIds: Array.from(selectedAlerts) });
    setSelectedAlerts(new Set());
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({});
  };

  const toggleSelectAlert = (alertId: Id<"changeAlerts">) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const selectAll = () => {
    if (!alerts) return;
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map((a) => a._id)));
    }
  };

  const formatDate = (timestamp: number) => {
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

  const getSignificanceColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-orange-500";
    if (score >= 20) return "bg-yellow-500";
    return "bg-gray-400";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md bg-surface shadow-2xl flex flex-col h-full animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Icons.Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">
                Alerts
              </h2>
              {pendingCount !== undefined && pendingCount > 0 && (
                <p className="text-sm text-secondary">
                  {pendingCount} pending
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
          {(["all", "pending", "read", "snoozed", "dismissed"] as FilterStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  filterStatus === status
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                    : "text-secondary hover:bg-surface-hover"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Bulk actions */}
        {alerts && alerts.length > 0 && (
          <div className="flex items-center gap-2 p-2 border-b border-border">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover rounded transition-colors"
            >
              <div
                className={`w-4 h-4 border rounded flex items-center justify-center ${
                  selectedAlerts.size === alerts.length
                    ? "bg-orange-500 border-orange-500"
                    : "border-border"
                }`}
              >
                {selectedAlerts.size === alerts.length && (
                  <Icons.Check className="w-3 h-3 text-white" />
                )}
              </div>
              Select all
            </button>

            {selectedAlerts.size > 0 && (
              <>
                <div className="w-px h-4 bg-gray-200 dark:bg-surface-hover" />
                <button
                  onClick={handleBulkDismiss}
                  className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  Dismiss ({selectedAlerts.size})
                </button>
              </>
            )}

            <div className="flex-1" />

            <button
              onClick={handleMarkAllAsRead}
              className="px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover rounded transition-colors"
            >
              Mark all read
            </button>
          </div>
        )}

        {/* Alerts list */}
        <div className="flex-1 overflow-y-auto">
          {!alerts ? (
            <div className="flex items-center justify-center h-32">
              <Icons.Loader className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-secondary">
              <Icons.BellOff className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No alerts</p>
              <p className="text-xs text-tertiary mt-1">
                Source changes will appear here
              </p>
            </div>
          ) : (
            Object.entries(groupedAlerts).map(([group, groupAlerts]) => (
              <div key={group}>
                <div className="sticky top-0 px-4 py-2 bg-gray-50 dark:bg-surface-hover/50 text-xs font-semibold text-secondary uppercase">
                  {group}
                </div>
                {groupAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`relative border-b border-gray-100 dark:border-border/50 ${
                      alert.status === "pending"
                        ? "bg-orange-50/50 dark:bg-orange-900/10"
                        : ""
                    }`}
                  >
                    <div className="p-4">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSelectAlert(alert._id)}
                          className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center shrink-0 ${
                            selectedAlerts.has(alert._id)
                              ? "bg-orange-500 border-orange-500"
                              : "border-border"
                          }`}
                        >
                          {selectedAlerts.has(alert._id) && (
                            <Icons.Check className="w-3 h-3 text-white" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* Document title */}
                          <button
                            onClick={() => onViewDocument?.(alert.documentId)}
                            className="text-sm font-medium text-main hover:text-orange-600 dark:hover:text-orange-400 truncate block w-full text-left"
                          >
                            {alert.documentTopic}
                          </button>

                          {/* Change type badge */}
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-xs font-medium ${
                                CHANGE_TYPE_LABELS[alert.changeType]?.color ||
                                "text-gray-500"
                              }`}
                            >
                              {CHANGE_TYPE_LABELS[alert.changeType]?.label ||
                                alert.changeType}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(alert.createdAt)}
                            </span>
                          </div>

                          {/* Source URL */}
                          <p
                            className="text-xs text-secondary truncate mt-1"
                            title={alert.sourceUrl}
                          >
                            {alert.sourceUrl}
                          </p>

                          {/* Diff summary */}
                          <p className="text-sm text-secondary mt-2">
                            {alert.diffSummary}
                          </p>

                          {/* Significance indicator */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-surface-hover rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getSignificanceColor(
                                  alert.significance
                                )} rounded-full transition-all`}
                                style={{ width: `${alert.significance}%` }}
                              />
                            </div>
                            <span className="text-xs text-secondary">
                              {alert.significance}% significant
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pl-7">
                        {alert.status === "pending" && (
                          <button
                            onClick={() => handleMarkAsRead(alert._id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover rounded transition-colors"
                          >
                            <Icons.Eye className="w-3.5 h-3.5" />
                            Mark read
                          </button>
                        )}

                        <button
                          onClick={() => onViewDiff?.(alert._id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        >
                          <Icons.Diff className="w-3.5 h-3.5" />
                          View diff
                        </button>

                        <div className="relative">
                          <button
                            onClick={() =>
                              setSnoozeMenuAlertId(
                                snoozeMenuAlertId === alert._id ? null : alert._id
                              )
                            }
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover rounded transition-colors"
                          >
                            <Icons.Snooze className="w-3.5 h-3.5" />
                            Snooze
                          </button>

                          {snoozeMenuAlertId === alert._id && (
                            <div className="absolute left-0 mt-1 w-32 bg-surface border border-border rounded-lg shadow-lg z-10 py-1">
                              {(Object.entries(SNOOZE_LABELS) as [SnoozeDuration, string][]).map(
                                ([key, label]) => (
                                  <button
                                    key={key}
                                    onClick={() => handleSnooze(alert._id, key)}
                                    className="w-full px-3 py-1.5 text-left text-xs text-secondary hover:bg-surface-hover"
                                  >
                                    {label}
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDismiss(alert._id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Icons.X className="w-3.5 h-3.5" />
                          Dismiss
                        </button>
                      </div>

                      {/* Snooze indicator */}
                      {alert.status === "snoozed" && alert.snoozeUntil && (
                        <div className="flex items-center gap-1.5 mt-2 pl-7 text-xs text-yellow-600 dark:text-yellow-400">
                          <Icons.Clock className="w-3.5 h-3.5" />
                          Snoozed until{" "}
                          {new Date(alert.snoozeUntil).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slideInRight {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

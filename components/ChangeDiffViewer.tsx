import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface ChangeDiffViewerProps {
  alertId: Id<"changeAlerts">;
  onClose: () => void;
  onRegenerate?: (documentId: Id<"documents">) => void;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed" | "header";
  content: string;
  lineNumber?: number;
}

// Generate a simple diff view from summary
function generateDisplayDiff(
  summary: string,
  details?: {
    addedLines: number;
    removedLines: number;
    changedSections: string[];
  }
): DiffLine[] {
  const lines: DiffLine[] = [];

  // Add a header section
  lines.push({
    type: "header",
    content: "Change Summary",
  });

  // Add the summary
  lines.push({
    type: "unchanged",
    content: summary,
    lineNumber: 1,
  });

  if (details) {
    lines.push({
      type: "header",
      content: "Statistics",
    });

    if (details.addedLines > 0) {
      lines.push({
        type: "added",
        content: `${details.addedLines} lines added`,
        lineNumber: 2,
      });
    }

    if (details.removedLines > 0) {
      lines.push({
        type: "removed",
        content: `${details.removedLines} lines removed`,
        lineNumber: 3,
      });
    }

    if (details.changedSections.length > 0) {
      lines.push({
        type: "header",
        content: "Modified Sections",
      });

      details.changedSections.forEach((section, index) => {
        lines.push({
          type: "unchanged",
          content: section,
          lineNumber: 4 + index,
        });
      });
    }
  }

  return lines;
}

export default function ChangeDiffViewer({
  alertId,
  onClose,
  onRegenerate,
}: ChangeDiffViewerProps) {
  const [isActioning, setIsActioning] = useState(false);

  const alert = useQuery(api.alerts.get, { alertId });
  const markAsRead = useMutation(api.alerts.markAsRead);
  const dismissAlert = useMutation(api.alerts.dismiss);

  const diffLines = useMemo(() => {
    if (!alert) return [];
    return generateDisplayDiff(alert.diffSummary, alert.diffDetails);
  }, [alert]);

  const handleMarkAsRead = async () => {
    if (!alert) return;
    await markAsRead({ alertId });
  };

  const handleDismiss = async () => {
    if (!alert) return;
    setIsActioning(true);
    try {
      await dismissAlert({ alertId });
      onClose();
    } finally {
      setIsActioning(false);
    }
  };

  const handleRegenerate = async () => {
    if (!alert) return;
    setIsActioning(true);
    try {
      onRegenerate?.(alert.documentId);
      await markAsRead({ alertId });
      onClose();
    } finally {
      setIsActioning(false);
    }
  };

  const getSignificanceColor = (score: number) => {
    if (score >= 70) return "text-red-500 bg-red-100 dark:bg-red-900/30";
    if (score >= 40) return "text-orange-500 bg-orange-100 dark:bg-orange-900/30";
    if (score >= 20) return "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30";
    return "text-gray-500 bg-gray-100 dark:bg-gray-700";
  };

  const getChangeTypeInfo = (changeType: string) => {
    const types: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      content_modified: {
        label: "Content Modified",
        icon: <Icons.Edit className="w-4 h-4" />,
        color: "text-blue-500",
      },
      new_release: {
        label: "New Release",
        icon: <Icons.Tag className="w-4 h-4" />,
        color: "text-green-500",
      },
      new_commit: {
        label: "New Commit",
        icon: <Icons.GitHub className="w-4 h-4" />,
        color: "text-purple-500",
      },
      source_unavailable: {
        label: "Source Unavailable",
        icon: <Icons.AlertTriangle className="w-4 h-4" />,
        color: "text-red-500",
      },
      major_update: {
        label: "Major Update",
        icon: <Icons.Zap className="w-4 h-4" />,
        color: "text-orange-500",
      },
      minor_update: {
        label: "Minor Update",
        icon: <Icons.Minus className="w-4 h-4" />,
        color: "text-gray-500",
      },
    };
    return types[changeType] || types.content_modified;
  };

  if (!alert) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 flex items-center justify-center">
          <Icons.Loader className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  const changeTypeInfo = getChangeTypeInfo(alert.changeType);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icons.Diff className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Source Change Detected
              </h2>
            </div>

            {/* Change type badge */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${changeTypeInfo.color} bg-opacity-10`}
            >
              {changeTypeInfo.icon}
              {changeTypeInfo.label}
            </div>

            {/* Significance badge */}
            <div
              className={`px-2 py-1 rounded-lg text-xs font-bold ${getSignificanceColor(
                alert.significance
              )}`}
            >
              {alert.significance}% significant
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
        </div>

        {/* Alert info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Document
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {alert.documentTopic}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Source
              </p>
              <a
                href={alert.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
              >
                {alert.sourceUrl}
              </a>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Detected At
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(alert.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Status
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                {alert.status}
              </p>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="font-mono text-xs">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={`flex ${
                  line.type === "added"
                    ? "bg-green-100 dark:bg-green-900/30"
                    : line.type === "removed"
                    ? "bg-red-100 dark:bg-red-900/30"
                    : line.type === "header"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold justify-center py-2 border-y border-blue-100 dark:border-blue-800"
                    : "bg-white dark:bg-gray-800"
                }`}
              >
                {line.type !== "header" && (
                  <>
                    <div className="w-12 text-right pr-2 text-gray-400 select-none shrink-0 border-r border-gray-200 dark:border-gray-700 py-1">
                      {line.lineNumber || ""}
                    </div>
                    <div className="w-6 text-center select-none shrink-0 py-1">
                      {line.type === "added" && (
                        <span className="text-green-600 dark:text-green-400">+</span>
                      )}
                      {line.type === "removed" && (
                        <span className="text-red-600 dark:text-red-400">-</span>
                      )}
                    </div>
                  </>
                )}
                <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-1 text-gray-700 dark:text-gray-300">
                  {line.content}
                </pre>
              </div>
            ))}
          </div>

          {/* Summary section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Change Summary
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{alert.diffSummary}</p>

            {alert.diffDetails && (
              <div className="mt-3 flex items-center gap-4">
                {alert.diffDetails.addedLines > 0 && (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <span className="font-bold">+{alert.diffDetails.addedLines}</span> added
                  </span>
                )}
                {alert.diffDetails.removedLines > 0 && (
                  <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <span className="font-bold">-{alert.diffDetails.removedLines}</span>{" "}
                    removed
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500/20 rounded" /> Added
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500/20 rounded" /> Removed
            </span>
          </div>

          <div className="flex items-center gap-2">
            {alert.status === "pending" && (
              <button
                onClick={handleMarkAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Icons.Eye className="w-4 h-4" />
                Mark as Read
              </button>
            )}

            <button
              onClick={handleDismiss}
              disabled={isActioning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <Icons.X className="w-4 h-4" />
              Dismiss
            </button>

            <button
              onClick={handleRegenerate}
              disabled={isActioning}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isActioning ? (
                <Icons.Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Icons.Refresh className="w-4 h-4" />
              )}
              Regenerate Document
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

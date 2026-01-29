"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";
import type { AuditFilters } from "./AuditLogViewer";

interface AuditExportModalProps {
  workspaceId?: Id<"workspaces">;
  filters: AuditFilters;
  onClose: () => void;
}

type ExportFormat = "json" | "csv";

// Helper to get default dates
function getDefaultDateRange() {
  const end = Date.now();
  const start = end - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  return { start, end };
}

export default function AuditExportModal({
  workspaceId,
  filters,
  onClose,
}: AuditExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [startTime, setStartTime] = useState<number>(
    filters.startTime || getDefaultDateRange().start
  );
  const [endTime, setEndTime] = useState<number>(
    filters.endTime || getDefaultDateRange().end
  );
  const [category, setCategory] = useState<string | undefined>(filters.actionCategory);
  const [severity, setSeverity] = useState<string | undefined>(filters.severity);
  const [maxRecords, setMaxRecords] = useState<number>(10000);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Fetch categories for filter
  const categories = useQuery(api.auditLog.getActionCategories);

  // Fetch export data
  const exportData = useQuery(api.auditLog.exportEvents, {
    workspaceId,
    format,
    startTime,
    endTime,
    actionCategory: category,
    severity,
    limit: maxRecords,
  });

  // Handle download
  const handleDownload = () => {
    if (!exportData) {
      setExportError("No data available to export");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === "json") {
        content = JSON.stringify(exportData.data, null, 2);
        mimeType = "application/json";
        extension = "json";
      } else {
        content = exportData.data as string;
        mimeType = "text/csv";
        extension = "csv";
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `audit-log-export-${timestamp}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Close modal after successful download
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export audit logs"
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Format date for input
  const formatDateForInput = (timestamp: number): string => {
    return new Date(timestamp).toISOString().split("T")[0];
  };

  // Parse date input
  const parseDateInput = (dateStr: string): number => {
    return new Date(dateStr).getTime();
  };

  // Calculate stats
  const recordCount = exportData?.count || 0;
  const dateRange = {
    start: new Date(startTime).toLocaleDateString(),
    end: new Date(endTime).toLocaleDateString(),
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icons.Download className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Export Audit Logs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Error Message */}
          {exportError && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {exportError}
            </div>
          )}

          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat("json")}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  format === "json"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icons.FileJson className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    JSON
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Machine-readable format for integrations
                </p>
              </button>
              <button
                onClick={() => setFormat("csv")}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  format === "csv"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icons.FileText className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    CSV
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Spreadsheet format for analysis
                </p>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={formatDateForInput(startTime)}
                onChange={(e) => setStartTime(parseDateInput(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={formatDateForInput(endTime)}
                onChange={(e) => setEndTime(parseDateInput(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category || ""}
                onChange={(e) => setCategory(e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Severity
              </label>
              <select
                value={severity || ""}
                onChange={(e) => setSeverity(e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Max Records */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum Records
            </label>
            <select
              value={maxRecords}
              onChange={(e) => setMaxRecords(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1000}>1,000 records</option>
              <option value={5000}>5,000 records</option>
              <option value={10000}>10,000 records</option>
            </select>
          </div>

          {/* Export Summary */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400">Format:</div>
              <div className="text-gray-900 dark:text-white font-medium">
                {format.toUpperCase()}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Date Range:</div>
              <div className="text-gray-900 dark:text-white font-medium">
                {dateRange.start} - {dateRange.end}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Records:</div>
              <div className="text-gray-900 dark:text-white font-medium">
                {recordCount.toLocaleString()} events
              </div>
              {category && (
                <>
                  <div className="text-gray-500 dark:text-gray-400">Category:</div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {category}
                  </div>
                </>
              )}
              {severity && (
                <>
                  <div className="text-gray-500 dark:text-gray-400">Severity:</div>
                  <div className="text-gray-900 dark:text-white font-medium capitalize">
                    {severity}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Export for compliance audits
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={isExporting || recordCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Icons.Download className="w-4 h-4" />
                  Download {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

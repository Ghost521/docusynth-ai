"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";
import type { AuditFilters } from "./AuditLogViewer";

interface AuditLogFiltersProps {
  filters: AuditFilters;
  onApply: (filters: AuditFilters) => void;
  onReset: () => void;
  workspaceId?: Id<"workspaces">;
}

// Quick date range presets
const DATE_PRESETS = [
  { label: "Today", getValue: () => ({ start: getStartOfDay(0), end: Date.now() }) },
  { label: "Yesterday", getValue: () => ({ start: getStartOfDay(1), end: getStartOfDay(0) }) },
  { label: "Last 7 days", getValue: () => ({ start: getStartOfDay(7), end: Date.now() }) },
  { label: "Last 30 days", getValue: () => ({ start: getStartOfDay(30), end: Date.now() }) },
  { label: "Last 90 days", getValue: () => ({ start: getStartOfDay(90), end: Date.now() }) },
  { label: "All time", getValue: () => ({ start: undefined, end: undefined }) },
];

function getStartOfDay(daysAgo: number): number {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
}

function parseDateInput(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).getTime();
}

export default function AuditLogFilters({
  filters,
  onApply,
  onReset,
  workspaceId,
}: AuditLogFiltersProps) {
  // Local state for filter form
  const [localFilters, setLocalFilters] = useState<AuditFilters>(filters);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Fetch categories and action types
  const categories = useQuery(api.auditLog.getActionCategories);
  const actionTypes = useQuery(api.auditLog.getActionTypes, {
    category: localFilters.actionCategory,
  });

  // Sync with parent filters
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Handle date preset selection
  const handlePresetSelect = (preset: typeof DATE_PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setLocalFilters({
      ...localFilters,
      startTime: start,
      endTime: end,
    });
    setSelectedPreset(preset.label);
  };

  // Handle apply
  const handleApply = () => {
    onApply(localFilters);
  };

  // Handle reset
  const handleReset = () => {
    setLocalFilters({});
    setSelectedPreset(null);
    onReset();
  };

  // Update local filter
  const updateFilter = <K extends keyof AuditFilters>(
    key: K,
    value: AuditFilters[K]
  ) => {
    setLocalFilters({ ...localFilters, [key]: value });
    setSelectedPreset(null); // Clear preset when manually changing dates
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>

          {/* Presets */}
          <div className="flex flex-wrap gap-1 mb-3">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetSelect(preset)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedPreset === preset.label
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="date"
                value={formatDateForInput(localFilters.startTime)}
                onChange={(e) =>
                  updateFilter("startTime", parseDateInput(e.target.value))
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Start date"
              />
            </div>
            <span className="text-gray-500">to</span>
            <div className="flex-1">
              <input
                type="date"
                value={formatDateForInput(localFilters.endTime)}
                onChange={(e) =>
                  updateFilter("endTime", parseDateInput(e.target.value))
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="End date"
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={localFilters.actionCategory || ""}
            onChange={(e) =>
              updateFilter(
                "actionCategory",
                e.target.value || undefined
              )
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Severity
          </label>
          <select
            value={localFilters.severity || ""}
            onChange={(e) =>
              updateFilter(
                "severity",
                (e.target.value || undefined) as AuditFilters["severity"]
              )
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Action Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Action Type
          </label>
          <select
            value={localFilters.action || ""}
            onChange={(e) =>
              updateFilter("action", e.target.value || undefined)
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All actions</option>
            {actionTypes?.map((action) => (
              <option key={action.value} value={action.value}>
                {action.value.split(".").join(" - ")}
              </option>
            ))}
          </select>
        </div>

        {/* Resource Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Resource Type
          </label>
          <select
            value={localFilters.resourceType || ""}
            onChange={(e) =>
              updateFilter("resourceType", e.target.value || undefined)
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All resources</option>
            <option value="user">User</option>
            <option value="document">Document</option>
            <option value="project">Project</option>
            <option value="workspace">Workspace</option>
            <option value="api_key">API Key</option>
            <option value="webhook">Webhook</option>
            <option value="schedule">Schedule</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* User ID Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            User ID
          </label>
          <input
            type="text"
            value={localFilters.userId || ""}
            onChange={(e) =>
              updateFilter("userId", e.target.value || undefined)
            }
            placeholder="Filter by user ID"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Reset Filters
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Apply Filters
        </button>
      </div>

      {/* Active Filters Summary */}
      {Object.keys(filters).filter((k) => filters[k as keyof AuditFilters]).length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
          {filters.startTime && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              From: {new Date(filters.startTime).toLocaleDateString()}
            </span>
          )}
          {filters.endTime && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              To: {new Date(filters.endTime).toLocaleDateString()}
            </span>
          )}
          {filters.actionCategory && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              Category: {filters.actionCategory}
            </span>
          )}
          {filters.severity && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              Severity: {filters.severity}
            </span>
          )}
          {filters.action && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              Action: {filters.action}
            </span>
          )}
          {filters.resourceType && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              Resource: {filters.resourceType}
            </span>
          )}
          {filters.userId && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
              User: {filters.userId.slice(0, 8)}...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

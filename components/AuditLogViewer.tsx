"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";
import AuditLogEntry from "./AuditLogEntry";
import AuditLogFilters from "./AuditLogFilters";
import AuditExportModal from "./AuditExportModal";

interface AuditLogViewerProps {
  workspaceId?: Id<"workspaces">;
  onClose?: () => void;
}

export type AuditFilters = {
  userId?: string;
  action?: string;
  actionCategory?: string;
  resourceType?: string;
  severity?: "info" | "warning" | "critical";
  startTime?: number;
  endTime?: number;
  searchQuery?: string;
};

export default function AuditLogViewer({ workspaceId, onClose }: AuditLogViewerProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [limit] = useState(50);

  // Fetch audit events
  const eventsResult = useQuery(api.auditLog.listEvents, {
    workspaceId,
    ...filters,
    limit,
    cursor,
  });

  // Fetch statistics
  const stats = useQuery(api.auditLog.getEventStats, {
    workspaceId,
    startTime: filters.startTime,
    endTime: filters.endTime,
  });

  // Fetch action categories for display
  const categories = useQuery(api.auditLog.getActionCategories);

  // Computed values
  const events = eventsResult?.events || [];
  const hasMore = eventsResult?.hasMore || false;
  const totalCount = eventsResult?.totalCount || 0;

  // Filter events by search query (client-side)
  const filteredEvents = useMemo(() => {
    if (!filters.searchQuery) return events;
    const query = filters.searchQuery.toLowerCase();
    return events.filter((event) => {
      return (
        event.action.toLowerCase().includes(query) ||
        event.userEmail?.toLowerCase().includes(query) ||
        event.resourceName?.toLowerCase().includes(query) ||
        event.resourceId?.toLowerCase().includes(query)
      );
    });
  }, [events, filters.searchQuery]);

  // Active filter count
  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  // Load more events
  const loadMore = () => {
    if (eventsResult?.nextCursor) {
      setCursor(eventsResult.nextCursor);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({});
    setCursor(undefined);
  };

  // Apply filters
  const applyFilters = (newFilters: AuditFilters) => {
    setFilters(newFilters);
    setCursor(undefined); // Reset pagination when filters change
  };

  // Get category name from id
  const getCategoryName = (categoryId: string) => {
    const category = categories?.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  // Format severity badge
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
            Warning
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Icons.Shield className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Audit Log
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all activities and changes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <Icons.Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-indigo-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Icons.Download className="w-4 h-4" />
            Export
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.totalEvents.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Events</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {stats.bySeverity.critical || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Critical</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
              {stats.bySeverity.warning || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Warnings</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
              {Object.keys(stats.byCategory).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Categories</div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <AuditLogFilters
          filters={filters}
          onApply={applyFilters}
          onReset={resetFilters}
          workspaceId={workspaceId}
        />
      )}

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events by action, user, or resource..."
            value={filters.searchQuery || ""}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Icons.History className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No audit events found</p>
            <p className="text-sm mt-1">
              {activeFilterCount > 0
                ? "Try adjusting your filters"
                : "Events will appear here as actions are performed"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEvents.map((event) => (
              <AuditLogEntry
                key={event._id}
                event={event}
                isExpanded={expandedEventId === event._id}
                onToggle={() =>
                  setExpandedEventId(
                    expandedEventId === event._id ? null : event._id
                  )
                }
                getCategoryName={getCategoryName}
                getSeverityBadge={getSeverityBadge}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4 text-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Load More ({totalCount - filteredEvents.length} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Showing {filteredEvents.length} of {totalCount} events
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <AuditExportModal
          workspaceId={workspaceId}
          filters={filters}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

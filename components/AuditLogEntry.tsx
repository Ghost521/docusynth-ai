"use client";

import { Icons } from "./Icon";
import type { Doc } from "../convex/_generated/dataModel";

interface AuditLogEntryProps {
  event: Doc<"auditLogs">;
  isExpanded: boolean;
  onToggle: () => void;
  getCategoryName: (categoryId: string) => string;
  getSeverityBadge: (severity: string) => React.ReactNode;
}

// Map action types to icons
const ACTION_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  // Auth
  "auth.login": Icons.User,
  "auth.logout": Icons.LogOut,
  "auth.login_failed": Icons.AlertTriangle,
  "auth.password_changed": Icons.Lock,

  // Documents
  "document.created": Icons.Plus,
  "document.read": Icons.Eye,
  "document.updated": Icons.Edit,
  "document.deleted": Icons.Trash,
  "document.shared": Icons.Share,
  "document.exported": Icons.Download,

  // Projects
  "project.created": Icons.FolderPlus,
  "project.updated": Icons.Folder,
  "project.deleted": Icons.Trash,

  // Workspaces
  "workspace.created": Icons.Building,
  "workspace.member_invited": Icons.UserPlus,
  "workspace.member_joined": Icons.Users,
  "workspace.member_removed": Icons.UserMinus,

  // API
  "api.key_created": Icons.Key,
  "api.key_revoked": Icons.Key,
  "api.call": Icons.Zap,

  // Security
  "security.permission_denied": Icons.Lock,
  "security.rate_limited": Icons.AlertTriangle,
};

// Map categories to colors
const CATEGORY_COLORS: Record<string, string> = {
  auth: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  document: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  project: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  workspace: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  api: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  webhook: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  security: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AuditLogEntry({
  event,
  isExpanded,
  onToggle,
  getCategoryName,
  getSeverityBadge,
}: AuditLogEntryProps) {
  // Get the appropriate icon
  const IconComponent = ACTION_ICONS[event.action] || Icons.Info;
  const categoryColor = CATEGORY_COLORS[event.actionCategory] || CATEGORY_COLORS.system;

  // Format timestamp
  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`;
    }

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format action for display
  const formatAction = (action: string) => {
    // Convert "document.created" to "Document Created"
    return action
      .split(".")
      .map((part) =>
        part
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      )
      .join(" - ");
  };

  // Render changes diff
  const renderChanges = () => {
    if (!event.changes) return null;

    const { before, after } = event.changes;

    if (!before && !after) return null;

    return (
      <div className="mt-3 space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Changes</h4>
        <div className="grid grid-cols-2 gap-4">
          {/* Before */}
          {before && Object.keys(before).length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                Before
              </div>
              <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
          )}

          {/* After */}
          {after && Object.keys(after).length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                After
              </div>
              <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render metadata
  const renderMetadata = () => {
    if (!event.metadata) return null;

    return (
      <div className="mt-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Additional Details
        </h4>
        <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
        isExpanded ? "bg-gray-50 dark:bg-gray-800/50" : ""
      }`}
    >
      {/* Main Row */}
      <div
        className="flex items-start gap-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${categoryColor}`}
        >
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Action */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatAction(event.action)}
                </span>
                {getSeverityBadge(event.severity || "info")}
              </div>

              {/* User and Resource */}
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Icons.User className="w-3.5 h-3.5" />
                  {event.userEmail || event.userId}
                </span>
                {event.resourceName && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1">
                      <Icons.FileText className="w-3.5 h-3.5" />
                      {event.resourceName}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Timestamp and Expand Icon */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formatTimestamp(event.timestamp)}
              </span>
              <div
                className={`transform transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                <Icons.ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Category Badge */}
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${categoryColor}`}
            >
              {getCategoryName(event.actionCategory)}
            </span>
            {event.resourceType && (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                {event.resourceType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 ml-14 border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Event ID:</span>
              <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                {event._id}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">User ID:</span>
              <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                {event.userId}
              </span>
            </div>
            {event.sessionId && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Session:</span>
                <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                  {event.sessionId}
                </span>
              </div>
            )}
            {event.resourceId && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Resource ID:</span>
                <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                  {event.resourceId}
                </span>
              </div>
            )}
            {event.ipAddress && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">IP Address:</span>
                <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                  {event.ipAddress}
                </span>
              </div>
            )}
            {event.userAgent && (
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">User Agent:</span>
                <span className="ml-2 font-mono text-gray-700 dark:text-gray-300 text-xs break-all">
                  {event.userAgent}
                </span>
              </div>
            )}
          </div>

          {/* Changes Diff */}
          {renderChanges()}

          {/* Metadata */}
          {renderMetadata()}

          {/* Timestamp Details */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Precise timestamp:</span>{" "}
              {new Date(event.timestamp).toISOString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

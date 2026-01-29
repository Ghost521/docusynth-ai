import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface ContextDocument {
  id: Id<"documents">;
  topic: string;
}

interface ContextStats {
  documentCount: number;
  messageCount: number;
  estimatedTokens: {
    documents: number;
    messages: number;
    total: number;
  };
  maxTokens: number;
  utilizationPercent: number;
}

interface ChatContextPanelProps {
  conversationId?: Id<"chatConversations">;
  documents?: ContextDocument[];
  stats?: ContextStats | null;
  onRemoveDocument?: (documentId: Id<"documents">) => void;
  onAddDocument?: () => void;
  onDocumentClick?: (documentId: Id<"documents">) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ChatContextPanel: React.FC<ChatContextPanelProps> = ({
  conversationId,
  documents = [],
  stats,
  onRemoveDocument,
  onAddDocument,
  onDocumentClick,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showAllDocs, setShowAllDocs] = useState(false);

  // Get utilization color
  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return "text-green-500";
    if (percent < 75) return "text-amber-500";
    return "text-red-500";
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return "bg-green-500";
    if (percent < 75) return "bg-amber-500";
    return "bg-red-500";
  };

  // Format token number
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full border-l border-border bg-surface flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
          title="Expand context panel"
        >
          <Icons.ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div className="p-2 text-secondary" title={`${documents.length} documents`}>
          <Icons.FileText className="w-5 h-5" />
        </div>
        {stats && (
          <div
            className={`p-2 ${getUtilizationColor(stats.utilizationPercent)}`}
            title={`${stats.utilizationPercent}% context used`}
          >
            <Icons.Activity className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 h-full border-l border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-main flex items-center gap-2">
            <Icons.Layers className="w-4 h-4" />
            Context
          </h3>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
              title="Collapse panel"
            >
              <Icons.ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Token usage */}
      {stats && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary">Token Usage</span>
            <span className={`text-xs font-medium ${getUtilizationColor(stats.utilizationPercent)}`}>
              {stats.utilizationPercent}%
            </span>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(stats.utilizationPercent)} transition-all duration-300`}
              style={{ width: `${Math.min(stats.utilizationPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-secondary">
            <span>{formatTokens(stats.estimatedTokens.total)} used</span>
            <span>{formatTokens(stats.maxTokens)} max</span>
          </div>

          {/* Token breakdown */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-secondary flex items-center gap-1">
                <Icons.FileText className="w-3 h-3" />
                Documents
              </span>
              <span className="text-main">{formatTokens(stats.estimatedTokens.documents)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-secondary flex items-center gap-1">
                <Icons.MessageSquare className="w-3 h-3" />
                Messages
              </span>
              <span className="text-main">{formatTokens(stats.estimatedTokens.messages)}</span>
            </div>
          </div>

          {/* Warning if close to limit */}
          {stats.utilizationPercent > 80 && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg text-[10px] text-amber-500">
              <Icons.AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Context is nearly full. Consider removing some documents.</span>
            </div>
          )}
        </div>
      )}

      {/* Documents in context */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-secondary">
            Documents ({documents.length})
          </span>
          {onAddDocument && (
            <button
              onClick={onAddDocument}
              className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
              title="Add document to context"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-6">
            <Icons.FileText className="w-8 h-8 text-secondary/30 mx-auto mb-2" />
            <p className="text-xs text-secondary">No documents in context</p>
            {onAddDocument && (
              <button
                onClick={onAddDocument}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Add a document
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {(showAllDocs ? documents : documents.slice(0, 5)).map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-2 p-2 bg-background rounded-lg hover:bg-surface-hover transition-colors"
              >
                <Icons.FileText className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                <button
                  onClick={() => onDocumentClick?.(doc.id)}
                  className="flex-1 text-left text-xs text-main truncate hover:text-primary"
                  title={doc.topic}
                >
                  {doc.topic}
                </button>
                {onRemoveDocument && (
                  <button
                    onClick={() => onRemoveDocument(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-secondary hover:text-red-500 rounded transition-all"
                    title="Remove from context"
                  >
                    <Icons.X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {documents.length > 5 && (
              <button
                onClick={() => setShowAllDocs(!showAllDocs)}
                className="w-full text-xs text-secondary hover:text-main py-1 transition-colors"
              >
                {showAllDocs ? "Show less" : `Show ${documents.length - 5} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="p-3 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-lg font-semibold text-main">
              {documents.length}
            </div>
            <div className="text-[10px] text-secondary">Documents</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-lg font-semibold text-main">
              {stats?.messageCount || 0}
            </div>
            <div className="text-[10px] text-secondary">Messages</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatContextPanel;

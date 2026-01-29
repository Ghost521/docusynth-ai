import React from "react";
import { Icons } from "./Icon";
import { Id } from "../convex/_generated/dataModel";

interface SourceCitationProps {
  documentId: Id<"documents">;
  documentTitle: string;
  snippet: string;
  relevanceScore: number;
  onClick?: () => void;
  variant?: "compact" | "expanded" | "inline";
}

const SourceCitation: React.FC<SourceCitationProps> = ({
  documentId,
  documentTitle,
  snippet,
  relevanceScore,
  onClick,
  variant = "compact",
}) => {
  // Get relevance indicator
  const getRelevanceIndicator = (score: number) => {
    if (score >= 0.8) return { label: "High", color: "text-green-500", bg: "bg-green-500" };
    if (score >= 0.5) return { label: "Medium", color: "text-amber-500", bg: "bg-amber-500" };
    return { label: "Low", color: "text-red-500", bg: "bg-red-500" };
  };

  const relevance = getRelevanceIndicator(relevanceScore);

  if (variant === "inline") {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded hover:bg-primary/20 transition-colors"
        title={`Source: ${documentTitle} (${Math.round(relevanceScore * 100)}% relevance)`}
      >
        <Icons.FileText className="w-3 h-3" />
        <span className="max-w-[150px] truncate">{documentTitle}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 p-2 bg-surface-hover/50 rounded-lg hover:bg-surface-hover transition-colors group w-full text-left"
      >
        <div className="flex-shrink-0">
          <Icons.FileText className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-main truncate">
              {documentTitle}
            </span>
            <span className={`text-[9px] ${relevance.color}`}>
              {Math.round(relevanceScore * 100)}%
            </span>
          </div>
        </div>
        <Icons.ChevronRight className="w-3.5 h-3.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  // Expanded variant
  return (
    <button
      onClick={onClick}
      className="block w-full p-3 bg-background border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group text-left"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
            <Icons.FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-main truncate group-hover:text-primary transition-colors">
              {documentTitle}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${relevance.bg}`} />
          <span className={`text-[10px] font-medium ${relevance.color}`}>
            {relevance.label}
          </span>
        </div>
      </div>

      {/* Snippet */}
      <p className="text-xs text-secondary line-clamp-2 mb-2">
        {snippet}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Icons.Target className="w-3 h-3 text-secondary" />
            <span className="text-[10px] text-secondary">
              {Math.round(relevanceScore * 100)}% match
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span>View document</span>
          <Icons.ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* Relevance bar */}
      <div className="mt-2 h-1 bg-surface-hover rounded-full overflow-hidden">
        <div
          className={`h-full ${relevance.bg} transition-all`}
          style={{ width: `${relevanceScore * 100}%` }}
        />
      </div>
    </button>
  );
};

// Source citation list component
interface SourceCitationListProps {
  sources: Array<{
    documentId: Id<"documents">;
    documentTitle: string;
    snippet: string;
    relevanceScore: number;
  }>;
  onSourceClick?: (documentId: Id<"documents">) => void;
  variant?: "compact" | "expanded";
  maxVisible?: number;
}

export const SourceCitationList: React.FC<SourceCitationListProps> = ({
  sources,
  onSourceClick,
  variant = "compact",
  maxVisible = 3,
}) => {
  const [showAll, setShowAll] = React.useState(false);

  if (sources.length === 0) return null;

  const visibleSources = showAll ? sources : sources.slice(0, maxVisible);
  const hiddenCount = sources.length - maxVisible;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icons.FileText className="w-3.5 h-3.5 text-secondary" />
        <span className="text-xs text-secondary font-medium">
          {sources.length} source{sources.length !== 1 ? "s" : ""} cited
        </span>
      </div>

      <div className={`space-y-${variant === "compact" ? "1" : "2"}`}>
        {visibleSources.map((source, index) => (
          <SourceCitation
            key={`${source.documentId}-${index}`}
            {...source}
            onClick={() => onSourceClick?.(source.documentId)}
            variant={variant}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-xs text-secondary hover:text-main transition-colors"
        >
          <Icons.ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`}
          />
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
};

export default SourceCitation;

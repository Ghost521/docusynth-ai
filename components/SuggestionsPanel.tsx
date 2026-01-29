import React, { useState, useMemo } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { useSuggestions, DocumentSuggestion, SuggestionType } from '../hooks/useSuggestions';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface SuggestionsPanelProps {
  /** Current document being viewed */
  currentDocumentId?: Id<'documents'>;
  /** Current project context */
  projectId?: Id<'projects'>;
  /** Recent search query */
  recentSearchQuery?: string;
  /** Callback when a document is selected */
  onSelectDocument: (documentId: Id<'documents'>) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the panel in compact mode */
  compact?: boolean;
  /** Maximum suggestions to show per category */
  maxPerCategory?: number;
}

// ═══════════════════════════════════════════════════════════════
// Helper Components
// ═══════════════════════════════════════════════════════════════

const SuggestionTypeIcon: React.FC<{ type: SuggestionType }> = ({ type }) => {
  switch (type) {
    case 'context':
      return <Icons.Sparkles className="w-4 h-4 text-purple-500" />;
    case 'trending':
      return <Icons.TrendingUp className="w-4 h-4 text-green-500" />;
    case 'frequent':
      return <Icons.Clock className="w-4 h-4 text-blue-500" />;
    case 'stale':
      return <Icons.AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'related':
      return <Icons.Link className="w-4 h-4 text-cyan-500" />;
    default:
      return <Icons.FileText className="w-4 h-4 text-secondary" />;
  }
};

const SuggestionTypeLabel: React.FC<{ type: SuggestionType }> = ({ type }) => {
  const labels: Record<SuggestionType, string> = {
    context: 'Related to current',
    trending: 'Trending',
    frequent: 'Frequently viewed',
    stale: 'Needs review',
    related: 'You might like',
  };
  return <span>{labels[type]}</span>;
};

interface SuggestionCardProps {
  suggestion: DocumentSuggestion;
  onClick: () => void;
  onDismiss: () => void;
  compact?: boolean;
  showExplanation?: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onClick,
  onDismiss,
  compact = false,
  showExplanation = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showReason, setShowReason] = useState(false);

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors group cursor-pointer"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SuggestionTypeIcon type={suggestion.suggestionType} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-main truncate group-hover:text-primary transition-colors">
            {suggestion.topic}
          </p>
        </div>
        <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowReason(!showReason);
            }}
            className="p-1 rounded hover:bg-surface-hover text-secondary hover:text-main transition-colors"
            title="Why this suggestion?"
          >
            <Icons.Info className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 rounded hover:bg-surface-hover text-secondary hover:text-main transition-colors"
            title="Dismiss"
          >
            <Icons.X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-surface border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-hover/30">
        <SuggestionTypeIcon type={suggestion.suggestionType} />
        <span className="text-xs font-medium text-secondary">
          <SuggestionTypeLabel type={suggestion.suggestionType} />
        </span>
        <div className="flex-1" />
        {isHovered && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowReason(!showReason)}
              className="p-1 rounded hover:bg-background text-secondary hover:text-main transition-colors"
              title="Why this suggestion?"
            >
              <Icons.Info className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-background text-secondary hover:text-main transition-colors"
              title="Dismiss"
            >
              <Icons.X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <button
        onClick={onClick}
        className="w-full p-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <h4 className="font-medium text-sm text-main group-hover:text-primary transition-colors line-clamp-1">
          {suggestion.topic}
        </h4>
        <p className="text-xs text-secondary mt-1 line-clamp-2">
          {suggestion.contentPreview}
        </p>

        {/* Tags */}
        {suggestion.tags && suggestion.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {suggestion.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Reason tooltip */}
        {showReason && (
          <div className="mt-2 p-2 rounded bg-background text-xs text-secondary border border-border">
            <span className="font-medium text-main">Why this?</span>
            <p className="mt-1">{suggestion.reason}</p>
          </div>
        )}
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  currentDocumentId,
  projectId,
  recentSearchQuery,
  onSelectDocument,
  className = '',
  compact = false,
  maxPerCategory = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'context' | 'frequent' | 'stale'>('all');

  // Set context for suggestions
  const {
    suggestions,
    frequentDocs,
    staleDocs,
    isLoading,
    onSuggestionClick,
    onSuggestionDismiss,
    setContext,
  } = useSuggestions({
    limit: maxPerCategory,
    context: {
      currentDocumentId,
      projectId,
      recentSearchQuery,
    },
  });

  // Update context when props change
  React.useEffect(() => {
    setContext({
      currentDocumentId,
      projectId,
      recentSearchQuery,
    });
  }, [currentDocumentId, projectId, recentSearchQuery, setContext]);

  // Group suggestions by type
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, DocumentSuggestion[]> = {
      context: [],
      trending: [],
      frequent: [],
      stale: [],
      related: [],
    };

    for (const suggestion of suggestions) {
      groups[suggestion.suggestionType]?.push(suggestion);
    }

    return groups;
  }, [suggestions]);

  // Filter based on active tab
  const filteredSuggestions = useMemo(() => {
    switch (activeTab) {
      case 'context':
        return groupedSuggestions.context.concat(groupedSuggestions.related);
      case 'frequent':
        return frequentDocs;
      case 'stale':
        return staleDocs;
      default:
        return suggestions;
    }
  }, [activeTab, groupedSuggestions, frequentDocs, staleDocs, suggestions]);

  const handleClick = (suggestion: DocumentSuggestion) => {
    onSuggestionClick(suggestion);
    onSelectDocument(suggestion.documentId);
  };

  const handleDismiss = (suggestion: DocumentSuggestion) => {
    onSuggestionDismiss(suggestion);
  };

  // Don't show if no suggestions
  const totalSuggestions = suggestions.length + frequentDocs.length + staleDocs.length;
  if (!isLoading && totalSuggestions === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <Icons.Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-main">Suggestions</span>
          <span className="text-xs text-secondary">({totalSuggestions})</span>
          <div className="flex-1" />
          {isExpanded ? (
            <Icons.ChevronUp className="w-4 h-4 text-secondary" />
          ) : (
            <Icons.ChevronDown className="w-4 h-4 text-secondary" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-1">
            {isLoading && (
              <div className="flex items-center gap-2 p-2 text-xs text-secondary">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading suggestions...
              </div>
            )}

            {!isLoading && filteredSuggestions.slice(0, 5).map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.documentId}-${suggestion.suggestionType}`}
                suggestion={suggestion}
                onClick={() => handleClick(suggestion)}
                onDismiss={() => handleDismiss(suggestion)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-surface border border-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/30">
        <div className="flex items-center gap-2">
          <Icons.Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-sm text-main">Smart Suggestions</h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-background text-secondary hover:text-main transition-colors"
        >
          {isExpanded ? (
            <Icons.ChevronUp className="w-4 h-4" />
          ) : (
            <Icons.ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { key: 'all', label: 'All', count: suggestions.length },
              { key: 'context', label: 'Related', count: groupedSuggestions.context.length + groupedSuggestions.related.length },
              { key: 'frequent', label: 'Frequent', count: frequentDocs.length },
              { key: 'stale', label: 'Needs Review', count: staleDocs.length },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                  activeTab === key
                    ? 'text-primary'
                    : 'text-secondary hover:text-main'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === key
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-hover text-secondary'
                  }`}>
                    {count}
                  </span>
                )}
                {activeTab === key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Finding suggestions...
                </div>
              </div>
            )}

            {!isLoading && filteredSuggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Icons.FileText className="w-8 h-8 text-secondary/30 mb-2" />
                <p className="text-sm text-secondary">No suggestions yet</p>
                <p className="text-xs text-secondary/60 mt-1">
                  {activeTab === 'context'
                    ? 'Open a document to see related content'
                    : activeTab === 'frequent'
                    ? 'View more documents to build your history'
                    : activeTab === 'stale'
                    ? 'All your documents are up to date!'
                    : 'Create more documents to get suggestions'}
                </p>
              </div>
            )}

            {!isLoading && filteredSuggestions.map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.documentId}-${suggestion.suggestionType}`}
                suggestion={suggestion}
                onClick={() => handleClick(suggestion)}
                onDismiss={() => handleDismiss(suggestion)}
                showExplanation
              />
            ))}
          </div>

          {/* Footer */}
          {filteredSuggestions.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-surface-hover/20">
              <p className="text-[10px] text-secondary text-center">
                Suggestions based on your activity and document content
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SuggestionsPanel;

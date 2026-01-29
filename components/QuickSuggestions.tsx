import React, { useMemo } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { useSuggestions, DocumentSuggestion, useCoViewedDocuments } from '../hooks/useSuggestions';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface QuickSuggestionsProps {
  /** Current document being viewed */
  currentDocumentId?: Id<'documents'>;
  /** Current project context */
  projectId?: Id<'projects'>;
  /** Callback when a document is selected */
  onSelectDocument: (documentId: Id<'documents'>) => void;
  /** Variant: inline (in content area), sidebar (in sidebar), or empty (for empty states) */
  variant?: 'inline' | 'sidebar' | 'empty';
  /** Additional CSS classes */
  className?: string;
  /** Title to display */
  title?: string;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
}

// ═══════════════════════════════════════════════════════════════
// Inline Suggestion Card
// ═══════════════════════════════════════════════════════════════

interface InlineCardProps {
  suggestion: DocumentSuggestion;
  onClick: () => void;
}

const InlineCard: React.FC<InlineCardProps> = ({ suggestion, onClick }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'context':
      case 'related':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'frequent':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'trending':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'stale':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default:
        return 'bg-surface-hover text-secondary border-border';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'context':
        return 'Related';
      case 'frequent':
        return 'Frequent';
      case 'trending':
        return 'Trending';
      case 'stale':
        return 'Review';
      case 'related':
        return 'Similar';
      default:
        return 'Suggested';
    }
  };

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 p-3 w-full text-left bg-surface border border-border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="shrink-0">
        <div className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getTypeColor(suggestion.suggestionType)}`}>
          {getTypeLabel(suggestion.suggestionType)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-main group-hover:text-primary transition-colors truncate">
          {suggestion.topic}
        </h4>
        <p className="text-xs text-secondary mt-0.5 line-clamp-1">
          {suggestion.contentPreview}
        </p>
      </div>
      <Icons.ChevronRight className="w-4 h-4 text-secondary group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// Compact Sidebar Item
// ═══════════════════════════════════════════════════════════════

interface SidebarItemProps {
  suggestion: DocumentSuggestion;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ suggestion, onClick }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'context':
      case 'related':
        return <Icons.Sparkles className="w-3.5 h-3.5 text-purple-500" />;
      case 'frequent':
        return <Icons.Clock className="w-3.5 h-3.5 text-blue-500" />;
      case 'trending':
        return <Icons.TrendingUp className="w-3.5 h-3.5 text-green-500" />;
      case 'stale':
        return <Icons.AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Icons.FileText className="w-3.5 h-3.5 text-secondary" />;
    }
  };

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 p-2 w-full text-left rounded-lg hover:bg-surface-hover transition-colors"
    >
      <div className="shrink-0">{getIcon(suggestion.suggestionType)}</div>
      <span className="flex-1 text-sm text-main truncate group-hover:text-primary transition-colors">
        {suggestion.topic}
      </span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// Empty State Suggestions
// ═══════════════════════════════════════════════════════════════

interface EmptyStateSuggestionsProps {
  suggestions: DocumentSuggestion[];
  onSelectDocument: (documentId: Id<'documents'>) => void;
}

const EmptyStateSuggestions: React.FC<EmptyStateSuggestionsProps> = ({
  suggestions,
  onSelectDocument,
}) => {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <Icons.Search className="w-12 h-12 text-secondary/30 mx-auto mb-3" />
        <h3 className="font-medium text-main mb-1">No documents yet</h3>
        <p className="text-sm text-secondary">
          Start by generating documentation for a topic or library
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-medium text-main mb-1">Quick Access</h3>
        <p className="text-sm text-secondary">
          Jump back into your recent work
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.documentId}
            onClick={() => onSelectDocument(suggestion.documentId)}
            className="flex items-start gap-3 p-4 text-left bg-surface border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.FileText className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-main group-hover:text-primary transition-colors line-clamp-1">
                {suggestion.topic}
              </h4>
              <p className="text-xs text-secondary mt-1 line-clamp-2">
                {suggestion.contentPreview}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-secondary">
                  {new Date(suggestion.createdAt).toLocaleDateString()}
                </span>
                {suggestion.tags && suggestion.tags.length > 0 && (
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {suggestion.tags[0]}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Others Also Viewed Section
// ═══════════════════════════════════════════════════════════════

interface OthersAlsoViewedProps {
  documentId: Id<'documents'>;
  onSelectDocument: (documentId: Id<'documents'>) => void;
}

export const OthersAlsoViewed: React.FC<OthersAlsoViewedProps> = ({
  documentId,
  onSelectDocument,
}) => {
  const { documents, isLoading } = useCoViewedDocuments(documentId, 3);

  if (isLoading || documents.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="flex items-center gap-2 text-xs font-medium text-secondary mb-2">
        <Icons.Users className="w-3.5 h-3.5" />
        Others who viewed this also viewed
      </h4>
      <div className="space-y-1">
        {documents.map((doc) => (
          <button
            key={doc.documentId}
            onClick={() => onSelectDocument(doc.documentId)}
            className="flex items-center gap-2 p-2 w-full text-left rounded-lg hover:bg-surface-hover transition-colors group"
          >
            <Icons.FileText className="w-3.5 h-3.5 text-secondary group-hover:text-primary" />
            <span className="flex-1 text-sm text-main truncate group-hover:text-primary transition-colors">
              {doc.topic}
            </span>
            <span className="text-[10px] text-secondary">
              {Math.round(doc.score * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({
  currentDocumentId,
  projectId,
  onSelectDocument,
  variant = 'inline',
  className = '',
  title,
  maxSuggestions = 5,
}) => {
  const {
    suggestions,
    frequentDocs,
    isLoading,
    onSuggestionClick,
    setContext,
  } = useSuggestions({
    limit: maxSuggestions,
    context: {
      currentDocumentId,
      projectId,
    },
  });

  // Update context when props change
  React.useEffect(() => {
    setContext({
      currentDocumentId,
      projectId,
    });
  }, [currentDocumentId, projectId, setContext]);

  // Combine and deduplicate suggestions
  const allSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: DocumentSuggestion[] = [];

    for (const suggestion of [...suggestions, ...frequentDocs]) {
      if (!seen.has(suggestion.documentId) && suggestion.documentId !== currentDocumentId) {
        seen.add(suggestion.documentId);
        result.push(suggestion);
      }
    }

    return result.slice(0, maxSuggestions);
  }, [suggestions, frequentDocs, currentDocumentId, maxSuggestions]);

  const handleClick = (suggestion: DocumentSuggestion) => {
    onSuggestionClick(suggestion);
    onSelectDocument(suggestion.documentId);
  };

  // Empty state variant
  if (variant === 'empty') {
    return (
      <div className={className}>
        <EmptyStateSuggestions
          suggestions={allSuggestions}
          onSelectDocument={onSelectDocument}
        />
      </div>
    );
  }

  // Don't show if loading or no suggestions
  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 text-sm text-secondary p-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading suggestions...
        </div>
      </div>
    );
  }

  if (allSuggestions.length === 0) {
    return null;
  }

  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <div className={className}>
        {title && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-secondary">
            <Icons.Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            {title}
          </div>
        )}
        <div className="space-y-0.5">
          {allSuggestions.map((suggestion) => (
            <SidebarItem
              key={`${suggestion.documentId}-${suggestion.suggestionType}`}
              suggestion={suggestion}
              onClick={() => handleClick(suggestion)}
            />
          ))}
        </div>
        {currentDocumentId && (
          <OthersAlsoViewed
            documentId={currentDocumentId}
            onSelectDocument={onSelectDocument}
          />
        )}
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div className={className}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Icons.Lightbulb className="w-4 h-4 text-amber-500" />
          <h3 className="font-medium text-sm text-main">{title}</h3>
          <span className="text-xs text-secondary">({allSuggestions.length})</span>
        </div>
      )}
      <div className="space-y-2">
        {allSuggestions.map((suggestion) => (
          <InlineCard
            key={`${suggestion.documentId}-${suggestion.suggestionType}`}
            suggestion={suggestion}
            onClick={() => handleClick(suggestion)}
          />
        ))}
      </div>
    </div>
  );
};

export default QuickSuggestions;

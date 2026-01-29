import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SuggestionType = 'context' | 'trending' | 'frequent' | 'stale' | 'related';

export interface DocumentSuggestion {
  documentId: Id<'documents'>;
  topic: string;
  contentPreview: string;
  projectId?: Id<'projects'>;
  createdAt: number;
  suggestionType: SuggestionType;
  reason: string;
  score: number;
  tags?: string[];
}

export interface SuggestionContext {
  currentDocumentId?: Id<'documents'>;
  clipboardText?: string;
  recentSearchQuery?: string;
  projectId?: Id<'projects'>;
}

export interface UseSuggestionsOptions {
  /** Maximum number of suggestions to fetch */
  limit?: number;
  /** Enable automatic refresh */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Initial context */
  context?: SuggestionContext;
  /** Enable view tracking */
  trackViews?: boolean;
}

export interface UseSuggestionsReturn {
  /** Context-aware suggestions */
  suggestions: DocumentSuggestion[];
  /** Frequently accessed documents */
  frequentDocs: DocumentSuggestion[];
  /** Stale documents that need updates */
  staleDocs: DocumentSuggestion[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Update context to refresh suggestions */
  setContext: (context: SuggestionContext) => void;
  /** Current context */
  context: SuggestionContext;
  /** Record that a suggestion was clicked */
  onSuggestionClick: (suggestion: DocumentSuggestion) => void;
  /** Dismiss a suggestion */
  onSuggestionDismiss: (suggestion: DocumentSuggestion) => void;
  /** Record document view */
  recordView: (
    documentId: Id<'documents'>,
    source: 'search' | 'navigation' | 'suggestion' | 'direct' | 'related'
  ) => void;
  /** Refresh suggestions */
  refresh: () => void;
}

// ═══════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════

export function useSuggestions(options: UseSuggestionsOptions = {}): UseSuggestionsReturn {
  const {
    limit = 5,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute
    context: initialContext = {},
    trackViews = true,
  } = options;

  // State
  const [context, setContext] = useState<SuggestionContext>(initialContext);
  const [error, setError] = useState<Error | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const suggestions = useQuery(api.suggestions.getSuggestionsForContext, {
    currentDocumentId: context.currentDocumentId,
    recentSearchQuery: context.recentSearchQuery,
    projectId: context.projectId,
    limit,
  });

  const frequentDocs = useQuery(api.suggestions.getFrequentDocuments, {
    limit: 5,
    daysBack: 30,
  });

  const staleDocs = useQuery(api.suggestions.getStaleDocuments, {
    limit: 5,
    minStaleness: 0.3,
  });

  // Mutations
  const recordDocumentView = useMutation(api.suggestions.recordDocumentView);
  const recordFeedback = useMutation(api.suggestions.recordSuggestionFeedback);

  // Computed loading state
  const isLoading = suggestions === undefined || frequentDocs === undefined;

  // Handle suggestion click
  const onSuggestionClick = useCallback(async (suggestion: DocumentSuggestion) => {
    try {
      // Record feedback
      await recordFeedback({
        documentId: suggestion.documentId,
        suggestionType: suggestion.suggestionType,
        action: 'clicked',
        contextDocumentId: context.currentDocumentId,
      });

      // Record view
      if (trackViews) {
        await recordDocumentView({
          documentId: suggestion.documentId,
          source: 'suggestion',
          referringDocumentId: context.currentDocumentId,
        });
      }
    } catch (err) {
      console.error('Failed to record suggestion click:', err);
    }
  }, [context.currentDocumentId, recordFeedback, recordDocumentView, trackViews]);

  // Handle suggestion dismiss
  const onSuggestionDismiss = useCallback(async (suggestion: DocumentSuggestion) => {
    try {
      await recordFeedback({
        documentId: suggestion.documentId,
        suggestionType: suggestion.suggestionType,
        action: 'dismissed',
        contextDocumentId: context.currentDocumentId,
      });
    } catch (err) {
      console.error('Failed to record suggestion dismiss:', err);
    }
  }, [context.currentDocumentId, recordFeedback]);

  // Record document view
  const recordView = useCallback(async (
    documentId: Id<'documents'>,
    source: 'search' | 'navigation' | 'suggestion' | 'direct' | 'related'
  ) => {
    if (!trackViews) return;

    try {
      await recordDocumentView({
        documentId,
        source,
        referringDocumentId: context.currentDocumentId,
        searchQuery: context.recentSearchQuery,
      });
    } catch (err) {
      console.error('Failed to record view:', err);
    }
  }, [context.currentDocumentId, context.recentSearchQuery, recordDocumentView, trackViews]);

  // Refresh function (for manual refresh)
  const refresh = useCallback(() => {
    // Convex queries auto-refresh, but we can trigger a context update
    setContext((prev) => ({ ...prev }));
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshRef.current = setInterval(refresh, refreshInterval);
      return () => {
        if (refreshRef.current) {
          clearInterval(refreshRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refresh]);

  // Memoized return value
  return useMemo(() => ({
    suggestions: suggestions || [],
    frequentDocs: frequentDocs || [],
    staleDocs: staleDocs || [],
    isLoading,
    error,
    setContext,
    context,
    onSuggestionClick,
    onSuggestionDismiss,
    recordView,
    refresh,
  }), [
    suggestions,
    frequentDocs,
    staleDocs,
    isLoading,
    error,
    context,
    onSuggestionClick,
    onSuggestionDismiss,
    recordView,
    refresh,
  ]);
}

// ═══════════════════════════════════════════════════════════════
// Specialized Hooks
// ═══════════════════════════════════════════════════════════════

/**
 * Hook for tracking document views with duration.
 */
export function useDocumentViewTracking(documentId: Id<'documents'> | undefined) {
  const recordView = useMutation(api.suggestions.recordDocumentView);
  const updateDuration = useMutation(api.suggestions.updateViewDuration);
  const viewIdRef = useRef<Id<'documentViews'> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start tracking when document changes
  useEffect(() => {
    if (!documentId) return;

    const startTracking = async () => {
      startTimeRef.current = Date.now();
      try {
        const viewId = await recordView({
          documentId,
          source: 'direct',
        });
        viewIdRef.current = viewId ?? null;
      } catch (err) {
        console.error('Failed to start view tracking:', err);
      }
    };

    startTracking();

    // Update duration when unmounting or document changes
    return () => {
      if (viewIdRef.current && startTimeRef.current) {
        const duration = Date.now() - startTimeRef.current;
        updateDuration({
          viewId: viewIdRef.current,
          duration,
        }).catch((err) => console.error('Failed to update view duration:', err));
      }
      viewIdRef.current = null;
      startTimeRef.current = null;
    };
  }, [documentId, recordView, updateDuration]);
}

/**
 * Hook for getting topic clusters.
 */
export function useTopicClusters(workspaceId?: Id<'workspaces'>) {
  const clusters = useQuery(api.suggestions.getTopicClusters, { workspaceId });
  const generateClusters = useAction(api.suggestions.generateTopicClusters);

  const regenerate = useCallback(async () => {
    try {
      await generateClusters({ workspaceId });
    } catch (err) {
      console.error('Failed to generate clusters:', err);
    }
  }, [generateClusters, workspaceId]);

  return {
    clusters: clusters || [],
    isLoading: clusters === undefined,
    regenerate,
  };
}

/**
 * Hook for getting document tags.
 */
export function useDocumentTags(documentId: Id<'documents'> | undefined) {
  const tags = useQuery(
    api.suggestions.getDocumentTags,
    documentId ? { documentId } : 'skip'
  );
  const generateTags = useAction(api.suggestions.generateTopicTags);

  const regenerate = useCallback(async () => {
    if (!documentId) return;
    try {
      await generateTags({ documentId });
    } catch (err) {
      console.error('Failed to generate tags:', err);
    }
  }, [documentId, generateTags]);

  return {
    tags: tags || [],
    isLoading: tags === undefined,
    regenerate,
  };
}

/**
 * Hook for getting co-viewed documents ("others also viewed").
 */
export function useCoViewedDocuments(documentId: Id<'documents'> | undefined, limit = 5) {
  const coViewed = useQuery(
    api.suggestions.getCoViewedDocuments,
    documentId ? { documentId, limit } : 'skip'
  );

  return {
    documents: coViewed || [],
    isLoading: coViewed === undefined,
  };
}

/**
 * Hook for getting staleness score of a document.
 */
export function useStalenessScore(documentId: Id<'documents'> | undefined) {
  const staleness = useQuery(
    api.suggestions.getStalenessScore,
    documentId ? { documentId } : 'skip'
  );

  return {
    score: staleness?.score ?? 0,
    daysSinceUpdate: staleness?.daysSinceUpdate ?? 0,
    reasons: staleness?.reasons ?? [],
    shouldUpdate: staleness?.shouldUpdate ?? false,
    isLoading: staleness === undefined,
  };
}

export default useSuggestions;

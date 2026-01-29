import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import {
  SearchMode,
  getSearchModeDescription,
  formatRelevanceScore,
  extractKeyTerms,
} from '../services/embeddingService';

interface SemanticSearchResult {
  documentId: Id<"documents">;
  topic: string;
  content: string;
  contentPreview: string;
  projectId?: Id<"projects">;
  visibility: 'public' | 'private' | 'workspace';
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
  searchType: SearchMode;
}

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (docId: Id<"documents">) => void;
  initialProjectId?: Id<"projects">;
}

const SemanticSearchModal: React.FC<SemanticSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectDoc,
  initialProjectId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [projectFilter, setProjectFilter] = useState<Id<"projects"> | undefined>(initialProjectId);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string | undefined>();
  const [minScore, setMinScore] = useState(0.3);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Actions for different search modes
  const semanticSearch = useAction(api.vectorSearch.semanticSearch);
  const hybridSearch = useAction(api.vectorSearch.hybridSearch);

  // Keyword search (existing)
  const keywordResults = useQuery(
    api.search.searchDocuments,
    searchMode === 'keyword' && searchQuery.length >= 2
      ? { query: searchQuery, limit: 20 }
      : "skip"
  );

  // Search suggestions for autocomplete
  const suggestions = useQuery(
    api.search.getSearchSuggestions,
    searchQuery.length >= 1 && searchQuery.length < 3
      ? { prefix: searchQuery }
      : "skip"
  ) as string[] | undefined;

  // Projects for filter dropdown
  const projects = useQuery(api.projects.list);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyword search results
  useEffect(() => {
    if (searchMode === 'keyword' && keywordResults) {
      setResults(keywordResults.map((r: any) => ({
        ...r,
        documentId: r._id,
        searchType: 'keyword' as SearchMode,
      })));
      setIsSearching(false);
    }
  }, [keywordResults, searchMode]);

  // Perform search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // Keyword search is handled by useQuery
    if (searchMode === 'keyword') {
      return;
    }

    setIsSearching(true);
    try {
      let searchResults: SemanticSearchResult[];

      if (searchMode === 'semantic') {
        searchResults = await semanticSearch({
          query: searchQuery,
          limit: 20,
          projectId: projectFilter,
          sourceType: sourceTypeFilter,
          minScore,
        });
      } else {
        // Hybrid mode
        searchResults = await hybridSearch({
          query: searchQuery,
          limit: 20,
          projectId: projectFilter,
          sourceType: sourceTypeFilter,
          minScore,
          semanticWeight: 0.6,
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchMode, projectFilter, sourceTypeFilter, minScore, semanticSearch, hybridSearch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [performSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectDoc(results[selectedIndex].documentId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelectDoc = useCallback((docId: Id<"documents">) => {
    onSelectDoc(docId);
    setSearchQuery('');
    setResults([]);
    onClose();
  }, [onSelectDoc, onClose]);

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    inputRef.current?.focus();
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const terms = extractKeyTerms(query);
    let result = text;

    // Simple highlighting - wrap matches in <mark>
    for (const term of terms) {
      const regex = new RegExp(`(${term})`, 'gi');
      result = result.replace(regex, '|||$1|||');
    }

    const parts = result.split('|||');
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = terms.some(
            term => part.toLowerCase() === term.toLowerCase()
          );
          return isMatch ? (
            <mark key={i} className="bg-primary/30 text-main rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </>
    );
  };

  const getSearchTypeIcon = (type: SearchMode) => {
    switch (type) {
      case 'semantic':
        return <Icons.Sparkles className="w-3 h-3 text-purple-500" />;
      case 'keyword':
        return <Icons.Search className="w-3 h-3 text-blue-500" />;
      case 'hybrid':
        return <Icons.Zap className="w-3 h-3 text-amber-500" />;
    }
  };

  const getSearchTypeBadge = (type: SearchMode) => {
    const colors = {
      semantic: 'bg-purple-500/10 text-purple-500',
      keyword: 'bg-blue-500/10 text-blue-500',
      hybrid: 'bg-amber-500/10 text-amber-500',
    };

    return (
      <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${colors[type]}`}>
        {getSearchTypeIcon(type)}
        {type}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Search Mode Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-border bg-surface-hover/30">
          {(['hybrid', 'semantic', 'keyword'] as SearchMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSearchMode(mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                searchMode === mode
                  ? 'bg-primary/10 text-primary'
                  : 'text-secondary hover:text-main hover:bg-surface-hover'
              }`}
              title={getSearchModeDescription(mode)}
            >
              {getSearchTypeIcon(mode)}
              <span className="capitalize">{mode}</span>
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              showFilters || projectFilter || sourceTypeFilter
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:text-main hover:bg-surface-hover'
            }`}
          >
            <Icons.Filter className="w-3.5 h-3.5" />
            Filters
            {(projectFilter || sourceTypeFilter) && (
              <span className="w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-3 border-b border-border bg-surface-hover/20 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Project Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                  Project
                </label>
                <select
                  value={projectFilter || ''}
                  onChange={(e) => setProjectFilter(e.target.value as Id<"projects"> | undefined)}
                  className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Projects</option>
                  {projects?.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Type Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                  Source Type
                </label>
                <select
                  value={sourceTypeFilter || ''}
                  onChange={(e) => setSourceTypeFilter(e.target.value || undefined)}
                  className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Types</option>
                  <option value="documentation">Documentation</option>
                  <option value="api">API Reference</option>
                  <option value="github">GitHub</option>
                  <option value="package">Package</option>
                  <option value="general">General</option>
                </select>
              </div>

              {/* Min Score Slider */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                  Min Relevance: {Math.round(minScore * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setProjectFilter(undefined);
                setSourceTypeFilter(undefined);
                setMinScore(0.3);
              }}
              className="text-[10px] text-secondary hover:text-main transition-colors"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          {getSearchTypeIcon(searchMode)}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search documents (${searchMode} mode)...`}
            className="flex-1 bg-transparent text-main text-lg outline-none placeholder:text-secondary"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-[10px] font-mono text-secondary">
            ESC
          </kbd>
        </div>

        {/* Suggestions (when query is short) */}
        {suggestions && suggestions.length > 0 && searchQuery.length > 0 && searchQuery.length < 3 && (
          <div className="p-2 border-b border-border">
            <p className="text-[10px] text-secondary uppercase tracking-widest px-2 mb-2">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1.5 bg-background hover:bg-surface-hover border border-border rounded-lg text-xs text-main transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {searchQuery.length >= 2 && isSearching && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-secondary">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Searching with {searchMode} mode...
              </div>
            </div>
          )}

          {searchQuery.length >= 2 && !isSearching && results.length === 0 && (
            <div className="p-8 text-center">
              <Icons.Search className="w-12 h-12 text-secondary/30 mx-auto mb-3" />
              <p className="text-secondary text-sm">No documents found</p>
              <p className="text-secondary/60 text-xs mt-1">
                {searchMode === 'semantic'
                  ? "Try different phrasing or switch to keyword search"
                  : "Try different keywords or switch to semantic search"}
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-border">
              {results.map((result, index) => (
                <button
                  key={result.documentId}
                  data-index={index}
                  onClick={() => handleSelectDoc(result.documentId)}
                  className={`w-full p-4 text-left transition-colors group ${
                    selectedIndex === index
                      ? 'bg-primary/5'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-main group-hover:text-primary transition-colors truncate">
                          {highlightMatch(result.topic, searchQuery)}
                        </h4>
                        {getSearchTypeBadge(result.searchType)}
                      </div>
                      <p className="text-xs text-secondary mt-1 line-clamp-2">
                        {highlightMatch(result.matchSnippet, searchQuery)}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {/* Relevance Score */}
                        <span className="text-[10px] font-medium text-primary">
                          {formatRelevanceScore(result.relevanceScore)} match
                        </span>
                        <span className="text-[10px] text-secondary">
                          {new Date(result.createdAt).toLocaleDateString()}
                        </span>
                        {result.sources.length > 0 && (
                          <span className="text-[10px] text-secondary flex items-center gap-1">
                            <Icons.Globe className="w-3 h-3" />
                            {result.sources.length} sources
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            result.visibility === 'public'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-secondary/10 text-secondary'
                          }`}
                        >
                          {result.visibility}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className={`transition-opacity ${
                        selectedIndex === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <Icons.ArrowRight className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center justify-between text-[10px] text-secondary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">up</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">down</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">enter</kbd>
              select
            </span>
          </div>
          <span>
            {results.length > 0
              ? `${results.length} results`
              : getSearchModeDescription(searchMode)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SemanticSearchModal;

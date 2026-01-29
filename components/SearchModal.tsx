import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface SearchResult {
  _id: Id<"documents">;
  topic: string;
  content: string;
  contentPreview: string;
  projectId?: Id<"projects">;
  visibility: 'public' | 'private';
  sources: Array<{ title: string; url: string }>;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (docId: Id<"documents">) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectDoc,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search results
  const searchResults = useQuery(
    api.search.searchDocuments,
    debouncedQuery.length >= 2 ? { query: debouncedQuery, limit: 20 } : "skip"
  ) as SearchResult[] | undefined;

  // Search suggestions
  const suggestions = useQuery(
    api.search.getSearchSuggestions,
    searchQuery.length >= 1 && searchQuery.length < 3
      ? { prefix: searchQuery }
      : "skip"
  ) as string[] | undefined;

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // Parent component handles opening
        } else {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectDoc = useCallback((docId: Id<"documents">) => {
    onSelectDoc(docId);
    setSearchQuery('');
    onClose();
  }, [onSelectDoc, onClose]);

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    inputRef.current?.focus();
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const queryWords = query.toLowerCase().split(/\s+/);
    let result = text;

    // Simple highlighting - wrap matches in <mark>
    queryWords.forEach(word => {
      if (word) {
        const regex = new RegExp(`(${word})`, 'gi');
        result = result.replace(regex, '|||$1|||');
      }
    });

    const parts = result.split('|||');
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = queryWords.some(
            word => part.toLowerCase() === word.toLowerCase()
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icons.Search className="w-5 h-5 text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 bg-transparent text-main text-lg outline-none placeholder:text-secondary"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-[10px] font-mono text-secondary">
            ESC
          </kbd>
        </div>

        {/* Suggestions (when query is short) */}
        {suggestions && suggestions.length > 0 && searchQuery.length < 3 && (
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
        <div className="max-h-[50vh] overflow-y-auto">
          {debouncedQuery.length >= 2 && !searchResults && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-secondary">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Searching...
              </div>
            </div>
          )}

          {searchResults && searchResults.length === 0 && (
            <div className="p-8 text-center">
              <Icons.Search className="w-12 h-12 text-secondary/30 mx-auto mb-3" />
              <p className="text-secondary text-sm">No documents found</p>
              <p className="text-secondary/60 text-xs mt-1">
                Try different keywords or check spelling
              </p>
            </div>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="divide-y divide-border">
              {searchResults.map((result) => (
                <button
                  key={result._id}
                  onClick={() => handleSelectDoc(result._id)}
                  className="w-full p-4 text-left hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-main group-hover:text-primary transition-colors truncate">
                        {highlightMatch(result.topic, debouncedQuery)}
                      </h4>
                      <p className="text-xs text-secondary mt-1 line-clamp-2">
                        {highlightMatch(result.matchSnippet, debouncedQuery)}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
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
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icons.ArrowRight className="w-5 h-5 text-primary" />
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
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↵</kbd>
              to select
            </span>
          </div>
          <span>
            {searchResults ? `${searchResults.length} results` : 'Type to search'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Icons } from '../Icon';

interface SearchResult {
  slug: string;
  title: string;
  snippet: string;
  matchType: 'title' | 'content' | 'both';
  score: number;
}

interface PortalSearchProps {
  portalId: Id<"portals">;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (slug: string) => void;
  primaryColor: string;
  isDark: boolean;
}

const PortalSearch: React.FC<PortalSearchProps> = ({
  portalId,
  isOpen,
  onClose,
  onNavigate,
  primaryColor,
  isDark,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search query with debounce
  const searchResults = useQuery(
    api.portalContent.searchPublicDocs,
    query.length >= 2 ? { portalId, query, limit: 10 } : 'skip'
  );

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !searchResults || searchResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            handleSelect(searchResults[selectedIndex].slug);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && searchResults && searchResults.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, searchResults]);

  const handleSelect = useCallback((slug: string) => {
    onNavigate(slug);
    onClose();
  }, [onNavigate, onClose]);

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-transparent font-semibold"
          style={{ color: primaryColor }}
        >
          {part}
        </mark>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b"
          style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
        >
          <Icons.Search
            className="w-5 h-5 shrink-0"
            style={{ color: query ? primaryColor : isDark ? '#9ca3af' : '#6b7280' }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search documentation..."
            className="flex-1 bg-transparent text-lg outline-none"
            style={{
              color: isDark ? '#ffffff' : '#111827',
            }}
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => setQuery('')}
                className={`p-1 rounded transition-colors ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <Icons.X className="w-4 h-4" />
              </button>
            )}
            <kbd
              className="px-2 py-1 text-xs rounded"
              style={{
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                color: isDark ? '#9ca3af' : '#6b7280',
              }}
            >
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {query.length < 2 ? (
            <div
              className="p-8 text-center"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              <Icons.Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          ) : searchResults === undefined ? (
            <div
              className="p-8 text-center"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              <div
                className="w-6 h-6 mx-auto mb-3 border-2 rounded-full animate-spin"
                style={{
                  borderColor: isDark ? '#374151' : '#e5e7eb',
                  borderTopColor: primaryColor,
                }}
              />
              <p className="text-sm">Searching...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div
              className="p-8 text-center"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              <Icons.FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <button
                  key={result.slug}
                  onClick={() => handleSelect(result.slug)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    index === selectedIndex
                      ? isDark
                        ? 'bg-gray-800'
                        : 'bg-gray-50'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                      }}
                    >
                      <Icons.FileText
                        className="w-4 h-4"
                        style={{ color: primaryColor }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {highlightMatch(result.title, query)}
                      </div>
                      <div
                        className="text-sm mt-1 line-clamp-2"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        {highlightMatch(result.snippet, query)}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: isDark ? '#374151' : '#f3f4f6',
                            color: isDark ? '#9ca3af' : '#6b7280',
                          }}
                        >
                          /docs/{result.slug}
                        </span>
                        {result.matchType === 'title' && (
                          <span
                            className="text-xs"
                            style={{ color: primaryColor }}
                          >
                            Title match
                          </span>
                        )}
                      </div>
                    </div>
                    {index === selectedIndex && (
                      <div
                        className="flex items-center gap-1 text-xs shrink-0"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        <kbd
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: isDark ? '#374151' : '#e5e7eb',
                          }}
                        >
                          Enter
                        </kbd>
                        <span>to select</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {searchResults && searchResults.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t text-xs"
            style={{
              borderColor: isDark ? '#374151' : '#e5e7eb',
              color: isDark ? '#9ca3af' : '#6b7280',
            }}
          >
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  ↑
                </kbd>
                <kbd
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  ↓
                </kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  Enter
                </kbd>
                to select
              </span>
            </div>
            <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalSearch;

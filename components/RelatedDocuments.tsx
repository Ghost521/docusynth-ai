import React, { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { formatRelevanceScore } from '../services/embeddingService';

interface RelatedDocument {
  documentId: Id<"documents">;
  topic: string;
  contentPreview: string;
  projectId?: Id<"projects">;
  createdAt: number;
  relevanceScore: number;
  matchSnippet: string;
}

interface RelatedDocumentsProps {
  documentId: Id<"documents">;
  onSelectDoc: (docId: Id<"documents">) => void;
  className?: string;
  maxItems?: number;
  showHeader?: boolean;
  compact?: boolean;
}

const RelatedDocuments: React.FC<RelatedDocumentsProps> = ({
  documentId,
  onSelectDoc,
  className = '',
  maxItems = 5,
  showHeader = true,
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Get embedding status for the current document
  const embeddingStatus = useQuery(api.vectorSearch.getEmbeddingStatus, { documentId });

  // Find similar documents action
  const findSimilar = useAction(api.vectorSearch.findSimilarDocuments);

  // Load related documents
  const loadRelatedDocs = async () => {
    if (hasLoaded || isLoading) return;

    setIsLoading(true);
    try {
      const results = await findSimilar({
        documentId,
        limit: maxItems,
        excludeSameProject: false,
      });
      setRelatedDocs(results as RelatedDocument[]);
      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to load related documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load when component mounts and embedding is ready
  React.useEffect(() => {
    if (embeddingStatus?.status === 'completed' && !hasLoaded) {
      loadRelatedDocs();
    }
  }, [embeddingStatus?.status, hasLoaded]);

  // Reset when document changes
  React.useEffect(() => {
    setHasLoaded(false);
    setRelatedDocs([]);
  }, [documentId]);

  // Don't render anything if document isn't indexed yet
  if (embeddingStatus?.status !== 'completed') {
    return (
      <div className={`${className} bg-surface border border-border rounded-xl p-4`}>
        <div className="flex items-center gap-2 text-secondary text-sm">
          {embeddingStatus?.status === 'pending' && (
            <>
              <div className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <span>Indexing document...</span>
            </>
          )}
          {embeddingStatus?.status === 'failed' && (
            <>
              <Icons.AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Unable to find related documents</span>
            </>
          )}
          {embeddingStatus?.status === 'not_indexed' && (
            <>
              <Icons.Info className="w-4 h-4" />
              <span>Document not yet indexed</span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={className}>
        {showHeader && (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-main hover:text-primary transition-colors"
            >
              <Icons.Sparkles className="w-4 h-4 text-purple-500" />
              Similar Documents
              {relatedDocs.length > 0 && (
                <span className="text-xs text-secondary">({relatedDocs.length})</span>
              )}
              {isExpanded ? (
                <Icons.ChevronUp className="w-4 h-4 text-secondary" />
              ) : (
                <Icons.ChevronDown className="w-4 h-4 text-secondary" />
              )}
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="space-y-1">
            {isLoading && (
              <div className="flex items-center gap-2 py-2 text-xs text-secondary">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Finding similar documents...
              </div>
            )}

            {!isLoading && relatedDocs.length === 0 && hasLoaded && (
              <div className="py-2 text-xs text-secondary">
                No similar documents found
              </div>
            )}

            {relatedDocs.map((doc) => (
              <button
                key={doc.documentId}
                onClick={() => onSelectDoc(doc.documentId)}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-surface-hover transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-main truncate group-hover:text-primary transition-colors">
                    {doc.topic}
                  </p>
                </div>
                <span className="text-[10px] text-primary font-medium shrink-0">
                  {formatRelevanceScore(doc.relevanceScore)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} bg-surface border border-border rounded-xl overflow-hidden`}>
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/30">
          <div className="flex items-center gap-2">
            <Icons.Sparkles className="w-4 h-4 text-purple-500" />
            <h3 className="font-medium text-sm text-main">Related Documents</h3>
          </div>
          {relatedDocs.length > 0 && (
            <span className="text-xs text-secondary bg-background px-2 py-0.5 rounded-full">
              {relatedDocs.length} found
            </span>
          )}
        </div>
      )}

      <div className="divide-y divide-border">
        {isLoading && (
          <div className="p-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-secondary">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Finding similar documents...
            </div>
          </div>
        )}

        {!isLoading && relatedDocs.length === 0 && hasLoaded && (
          <div className="p-6 text-center">
            <Icons.FileText className="w-8 h-8 text-secondary/30 mx-auto mb-2" />
            <p className="text-sm text-secondary">No similar documents found</p>
            <p className="text-xs text-secondary/60 mt-1">
              Create more documents to discover related content
            </p>
          </div>
        )}

        {relatedDocs.map((doc, index) => (
          <button
            key={doc.documentId}
            onClick={() => onSelectDoc(doc.documentId)}
            className="w-full p-4 text-left hover:bg-surface-hover transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Relevance indicator */}
              <div className="shrink-0 mt-0.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: `rgba(139, 92, 246, ${doc.relevanceScore * 0.3})`,
                    color: doc.relevanceScore > 0.5 ? 'rgb(139, 92, 246)' : 'rgb(107, 114, 128)',
                  }}
                >
                  {Math.round(doc.relevanceScore * 100)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-main group-hover:text-primary transition-colors truncate">
                  {doc.topic}
                </h4>
                <p className="text-xs text-secondary mt-1 line-clamp-2">
                  {doc.matchSnippet || doc.contentPreview}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-secondary">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] text-purple-500 font-medium">
                    {formatRelevanceScore(doc.relevanceScore)} similar
                  </span>
                </div>
              </div>

              <Icons.ChevronRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Refresh button */}
      {hasLoaded && (
        <div className="px-4 py-2 border-t border-border bg-surface-hover/20">
          <button
            onClick={() => {
              setHasLoaded(false);
              loadRelatedDocs();
            }}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-main transition-colors"
          >
            <Icons.Refresh className="w-3 h-3" />
            Refresh suggestions
          </button>
        </div>
      )}
    </div>
  );
};

export default RelatedDocuments;

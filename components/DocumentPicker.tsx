import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface DocumentPickerProps {
  collectionId: Id<"collections">;
  excludeDocumentIds?: Id<"documents">[];
  workspaceId?: Id<"workspaces">;
  onClose: () => void;
  onDocumentsAdded?: (documentIds: Id<"documents">[]) => void;
}

const DocumentPicker: React.FC<DocumentPickerProps> = ({
  collectionId,
  excludeDocumentIds = [],
  workspaceId,
  onClose,
  onDocumentsAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const documents = useQuery(api.documents.list, {
    projectId: selectedProjectId ? selectedProjectId as Id<"projects"> : undefined,
    workspaceId,
  });

  const projects = useQuery(api.projects.list, { workspaceId });

  const addDocument = useMutation(api.collections.addDocument);

  // Filter documents based on search and exclusions
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];

    const excludeSet = new Set(excludeDocumentIds.map(id => id.toString()));

    return documents.filter((doc) => {
      // Exclude already added documents
      if (excludeSet.has(doc._id.toString())) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTopic = doc.topic.toLowerCase().includes(query);
        const matchesContent = doc.content?.toLowerCase().includes(query);
        if (!matchesTopic && !matchesContent) return false;
      }

      return true;
    });
  }, [documents, excludeDocumentIds, searchQuery]);

  const handleToggleDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocumentIds);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocumentIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocumentIds.size === filteredDocuments.length) {
      setSelectedDocumentIds(new Set());
    } else {
      setSelectedDocumentIds(new Set(filteredDocuments.map((d) => d._id)));
    }
  };

  const handleAddDocuments = async () => {
    if (selectedDocumentIds.size === 0) return;

    setIsAdding(true);

    try {
      const documentIds = Array.from(selectedDocumentIds) as Id<"documents">[];

      // Add documents sequentially to maintain order
      for (const documentId of documentIds) {
        await addDocument({ collectionId, documentId });
      }

      onDocumentsAdded?.(documentIds);
      onClose();
    } catch (error) {
      console.error('Failed to add documents:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getContentPreview = (content: string | undefined, maxLength: number = 100): string => {
    if (!content) return '';
    const cleaned = content.replace(/[#*`_~\[\]]/g, '').trim();
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-main">Add Documents</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-secondary transition-colors"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                autoFocus
              />
            </div>

            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="px-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects?.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="px-6 py-3 bg-surface-hover/50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-secondary hover:text-main transition-colors"
            >
              {selectedDocumentIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? (
                <Icons.CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Icons.Square className="w-4 h-4" />
              )}
              Select All
            </button>
            <span className="text-sm text-secondary">
              {selectedDocumentIds.size} of {filteredDocuments.length} selected
            </span>
          </div>

          {selectedDocumentIds.size > 0 && (
            <button
              onClick={() => setSelectedDocumentIds(new Set())}
              className="text-sm text-secondary hover:text-main transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-4">
          {documents === undefined ? (
            <div className="animate-pulse space-y-3">
              <div className="h-20 bg-surface-hover rounded-xl" />
              <div className="h-20 bg-surface-hover rounded-xl" />
              <div className="h-20 bg-surface-hover rounded-xl" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <Icons.FileText className="w-12 h-12 mx-auto text-secondary/30 mb-4" />
              <p className="text-secondary mb-2">
                {searchQuery ? 'No documents match your search' : 'No documents available'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:underline text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocumentIds.has(doc._id);

                return (
                  <div
                    key={doc._id}
                    onClick={() => handleToggleDocument(doc._id)}
                    className={`
                      group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30 hover:bg-surface-hover'
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      {isSelected ? (
                        <Icons.CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Icons.Square className="w-5 h-5 text-secondary group-hover:text-primary transition-colors" />
                      )}
                    </div>

                    {/* Document Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate transition-colors ${
                        isSelected ? 'text-primary' : 'text-main group-hover:text-primary'
                      }`}>
                        {doc.topic}
                      </h3>
                      <p className="text-sm text-secondary mt-1 line-clamp-2">
                        {getContentPreview(doc.content, 150)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-secondary">
                        <span>{formatDate(doc.createdAt)}</span>
                        <span>{doc.sources?.length || 0} sources</span>
                        {doc.visibility === 'public' && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Icons.Globe className="w-3 h-3" />
                            Public
                          </span>
                        )}
                        {doc.projectId && (
                          <span className="flex items-center gap-1">
                            <Icons.Folder className="w-3 h-3" />
                            {projects?.find((p) => p._id === doc.projectId)?.name || 'Project'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preview indicator */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icons.Eye className="w-4 h-4 text-secondary" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between bg-surface">
          <div className="text-sm text-secondary">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-border text-secondary hover:text-main hover:bg-surface-hover transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDocuments}
              disabled={selectedDocumentIds.size === 0 || isAdding}
              className="px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAdding ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Icons.Plus className="w-4 h-4" />
                  Add {selectedDocumentIds.size} Document{selectedDocumentIds.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPicker;

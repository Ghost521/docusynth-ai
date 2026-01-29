import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface CollectionViewProps {
  collectionId: Id<"collections">;
  onEditCollection: () => void;
  onGenerateBundle: () => void;
  onAddDocuments: () => void;
  onViewDocument: (documentId: Id<"documents">) => void;
}

const CollectionView: React.FC<CollectionViewProps> = ({
  collectionId,
  onEditCollection,
  onGenerateBundle,
  onAddDocuments,
  onViewDocument,
}) => {
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const collection = useQuery(api.collections.get, { id: collectionId });
  const removeDocument = useMutation(api.collections.removeDocument);
  const reorderDocuments = useMutation(api.collections.reorderDocuments);

  const handleRemoveDocument = async (documentId: Id<"documents">) => {
    if (confirm('Remove this document from the collection?')) {
      await removeDocument({ collectionId, documentId });
    }
  };

  const handleDragStart = (e: React.DragEvent, docId: string) => {
    setDraggingDocId(docId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (collection && collection.documents && draggingDocId) {
      const documents = collection.documents;
      const sourceIndex = documents.findIndex((d) => d._id === draggingDocId);

      if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
        const newOrder = documents.map((d) => d._id);
        const [removed] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, removed);

        await reorderDocuments({ collectionId, documentIds: newOrder });
      }
    }

    setDraggingDocId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingDocId(null);
    setDragOverIndex(null);
  };

  if (!collection) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-10 bg-surface-hover rounded-lg w-1/3 mb-4" />
        <div className="h-4 bg-surface-hover rounded w-1/2 mb-8" />
        <div className="space-y-3">
          <div className="h-20 bg-surface-hover rounded-lg" />
          <div className="h-20 bg-surface-hover rounded-lg" />
          <div className="h-20 bg-surface-hover rounded-lg" />
        </div>
      </div>
    );
  }

  const documents = collection.documents || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: collection.color }}
            >
              {collection.isSmartCollection ? (
                <Icons.Wand className="w-6 h-6" />
              ) : (
                <Icons.FolderStack className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-main flex items-center gap-2">
                {collection.name}
                {collection.isSmartCollection && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full uppercase font-bold">
                    Smart
                  </span>
                )}
              </h1>
              {collection.description && (
                <p className="text-sm text-secondary mt-1">{collection.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEditCollection}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover hover:bg-black/10 dark:hover:bg-white/10 text-secondary hover:text-main transition-all"
            >
              <Icons.Edit className="w-4 h-4" />
              <span className="text-sm">Edit</span>
            </button>

            <button
              onClick={onGenerateBundle}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all"
            >
              <Icons.Package className="w-4 h-4" />
              <span className="text-sm font-medium">Generate Bundle</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-secondary">
            <Icons.FileText className="w-4 h-4" />
            <span>{documents.length} documents</span>
          </div>
          <div className="flex items-center gap-2 text-secondary">
            <Icons.Clock className="w-4 h-4" />
            <span>Updated {new Date(collection.updatedAt).toLocaleDateString()}</span>
          </div>
          {collection.visibility !== 'private' && (
            <div className="flex items-center gap-2 text-secondary">
              {collection.visibility === 'public' ? (
                <Icons.Globe className="w-4 h-4 text-green-500" />
              ) : (
                <Icons.Users className="w-4 h-4 text-blue-500" />
              )}
              <span className="capitalize">{collection.visibility}</span>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-6">
        {!collection.isSmartCollection && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-secondary uppercase tracking-wider">
              Documents
            </h2>
            <button
              onClick={onAddDocuments}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-primary/10 text-secondary hover:text-primary transition-all text-sm"
            >
              <Icons.Plus className="w-4 h-4" />
              Add Documents
            </button>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-16">
            <Icons.FileText className="w-12 h-12 mx-auto text-secondary/30 mb-4" />
            <p className="text-secondary mb-4">
              {collection.isSmartCollection
                ? 'No documents match the current rules'
                : 'No documents in this collection yet'}
            </p>
            {!collection.isSmartCollection && (
              <button
                onClick={onAddDocuments}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Documents
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div
                key={doc._id}
                draggable={!collection.isSmartCollection}
                onDragStart={(e) => handleDragStart(e, doc._id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  group flex items-center gap-4 p-4 rounded-xl border transition-all
                  ${draggingDocId === doc._id ? 'opacity-50' : ''}
                  ${dragOverIndex === index && draggingDocId !== doc._id
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/30 hover:bg-surface-hover'
                  }
                  ${!collection.isSmartCollection ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                `}
                onClick={() => onViewDocument(doc._id)}
              >
                {/* Drag handle */}
                {!collection.isSmartCollection && (
                  <div className="opacity-0 group-hover:opacity-50 text-secondary">
                    <Icons.GripVertical className="w-5 h-5" />
                  </div>
                )}

                {/* Position number */}
                <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-sm font-bold text-secondary">
                  {index + 1}
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-main truncate group-hover:text-primary transition-colors">
                    {doc.topic}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span>{doc.sources?.length || 0} sources</span>
                    {doc.visibility === 'public' && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Icons.Globe className="w-3 h-3" />
                        Public
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocument(doc._id);
                    }}
                    className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title="View Document"
                  >
                    <Icons.ExternalLink className="w-4 h-4" />
                  </button>
                  {!collection.isSmartCollection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveDocument(doc._id);
                      }}
                      className="p-2 text-secondary hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from Collection"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nested Collections */}
      {collection.nestedCollections && collection.nestedCollections.length > 0 && (
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-wider mb-4">
            Nested Collections
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {collection.nestedCollections.map((nested) => (
              <div
                key={nested._id}
                className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-surface-hover transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                    style={{ backgroundColor: nested.color }}
                  >
                    <Icons.FolderStack className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-main truncate">{nested.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionView;

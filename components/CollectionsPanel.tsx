import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface CollectionsPanelProps {
  workspaceId?: Id<"workspaces">;
  onSelectCollection: (collectionId: Id<"collections"> | null) => void;
  selectedCollectionId: Id<"collections"> | null;
  onCreateCollection: () => void;
}

const CollectionsPanel: React.FC<CollectionsPanelProps> = ({
  workspaceId,
  onSelectCollection,
  selectedCollectionId,
  onCreateCollection,
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);

  const collections = useQuery(api.collections.list, {
    workspaceId,
    includeNested: true,
  });

  const reorderCollections = useMutation(api.collections.reorderCollections);
  const deleteCollection = useMutation(api.collections.remove);

  const toggleExpanded = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, collectionId: string) => {
    setDraggingCollectionId(collectionId);
    e.dataTransfer.setData('collectionId', collectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggingCollectionId && draggingCollectionId !== targetId) {
      setDragOverCollectionId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCollectionId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('collectionId');

    if (sourceId && sourceId !== targetId && collections) {
      const sourceIndex = collections.findIndex((c) => c._id === sourceId);
      const targetIndex = collections.findIndex((c) => c._id === targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = collections.map((c) => c._id);
        const [removed] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, removed);

        await reorderCollections({ collectionIds: newOrder });
      }
    }

    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
  };

  const handleDragEnd = () => {
    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
  };

  const handleDeleteCollection = async (e: React.MouseEvent, collectionId: Id<"collections">) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this collection? Documents will not be deleted.')) {
      await deleteCollection({ id: collectionId });
      if (selectedCollectionId === collectionId) {
        onSelectCollection(null);
      }
    }
  };

  // Build tree structure
  const buildTree = () => {
    if (!collections) return [];

    const rootCollections = collections.filter((c) => !c.parentId);
    const childMap = new Map<string, typeof collections>();

    collections.forEach((c) => {
      if (c.parentId) {
        const parentId = c.parentId.toString();
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(c);
      }
    });

    return { rootCollections, childMap };
  };

  const { rootCollections, childMap } = buildTree() || { rootCollections: [], childMap: new Map() };

  const renderCollection = (collection: NonNullable<typeof collections>[0], depth: number = 0) => {
    const children = childMap?.get(collection._id.toString()) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedCollections.has(collection._id);
    const isSelected = selectedCollectionId === collection._id;
    const isDragging = draggingCollectionId === collection._id;
    const isDragOver = dragOverCollectionId === collection._id;

    return (
      <div key={collection._id} className="relative">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, collection._id)}
          onDragOver={(e) => handleDragOver(e, collection._id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, collection._id)}
          onDragEnd={handleDragEnd}
          onClick={() => onSelectCollection(collection._id)}
          className={`
            group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
            ${isSelected ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-surface-hover border border-transparent'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? 'bg-primary/20 border-primary scale-[1.02]' : ''}
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {/* Drag handle */}
          <div className="opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing">
            <Icons.GripVertical className="w-3 h-3" />
          </div>

          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(collection._id);
              }}
              className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded"
            >
              {isExpanded ? (
                <Icons.ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <Icons.ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Icon with color */}
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-white text-xs shrink-0"
            style={{ backgroundColor: collection.color }}
          >
            {collection.isSmartCollection ? (
              <Icons.Wand className="w-3 h-3" />
            ) : (
              <Icons.FolderStack className="w-3 h-3" />
            )}
          </div>

          {/* Name */}
          <span className="flex-1 truncate text-sm font-medium">{collection.name}</span>

          {/* Document count badge */}
          <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
            {collection.documentCount || 0}
          </span>

          {/* Smart collection indicator */}
          {collection.isSmartCollection && (
            <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold">
              Smart
            </span>
          )}

          {/* Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button
              onClick={(e) => handleDeleteCollection(e, collection._id)}
              className="p-1 text-secondary hover:text-red-500 rounded transition-colors"
              title="Delete Collection"
            >
              <Icons.Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {children
              .sort((a, b) => a.order - b.order)
              .map((child) => renderCollection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (collections === undefined) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-surface-hover rounded" />
          <div className="h-8 bg-surface-hover rounded" />
          <div className="h-8 bg-surface-hover rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-main flex items-center gap-2">
            <Icons.FolderStack className="w-4 h-4 text-primary" />
            Collections
          </h3>
          <button
            onClick={onCreateCollection}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="New Collection"
          >
            <Icons.Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onSelectCollection(null)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
              ${selectedCollectionId === null
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-secondary hover:text-main'
              }
            `}
          >
            <Icons.Globe className="w-3.5 h-3.5" />
            All Docs
          </button>
        </div>
      </div>

      {/* Collections List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {rootCollections.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            <Icons.FolderStack className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No collections yet</p>
            <button
              onClick={onCreateCollection}
              className="mt-3 text-primary hover:underline"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          rootCollections
            .sort((a, b) => a.order - b.order)
            .map((collection) => renderCollection(collection))
        )}
      </div>
    </div>
  );
};

export default CollectionsPanel;

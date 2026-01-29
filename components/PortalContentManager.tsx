import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface PortalContentManagerProps {
  portalId: Id<"portals">;
  workspaceId?: Id<"workspaces">;
  onClose: () => void;
}

interface PortalDocItem {
  _id: Id<"portalDocuments">;
  documentId: Id<"documents">;
  slug: string;
  titleOverride?: string;
  descriptionOverride?: string;
  position: number;
  parentId?: Id<"portalDocuments">;
  isSection: boolean;
  sectionName?: string;
  isDraft: boolean;
  icon?: string;
  documentTopic: string;
  documentContent: string;
}

const PortalContentManager: React.FC<PortalContentManagerProps> = ({
  portalId,
  workspaceId,
  onClose,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<Id<"documents"> | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [editingDoc, setEditingDoc] = useState<PortalDocItem | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Queries
  const portal = useQuery(api.portals.getPortal, { portalId });
  const portalDocs = useQuery(api.portals.listPortalDocuments, { portalId });
  const availableDocs = useQuery(
    api.documents.list,
    workspaceId ? { workspaceId } : {}
  );

  // Mutations
  const publishDocument = useMutation(api.portals.publishDocument);
  const unpublishDocument = useMutation(api.portals.unpublishDocument);
  const updatePortalDocument = useMutation(api.portals.updatePortalDocument);
  const createSection = useMutation(api.portals.createSection);
  const reorderNavigation = useMutation(api.portals.reorderNavigation);

  // Filter out already published documents
  const unpublishedDocs = (availableDocs || []).filter(
    (doc) => !portalDocs?.some((pd) => pd.documentId === doc._id)
  );

  const handlePublishDocument = async () => {
    if (!selectedDocId) return;

    try {
      await publishDocument({
        portalId,
        documentId: selectedDocId,
      });
      setSelectedDocId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnpublishDocument = async (portalDocId: Id<"portalDocuments">) => {
    if (!confirm('Remove this document from the portal?')) return;

    try {
      await unpublishDocument({
        portalId,
        portalDocumentId: portalDocId,
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSection = async () => {
    if (!sectionName.trim()) return;

    try {
      await createSection({
        portalId,
        sectionName: sectionName.trim(),
      });
      setSectionName('');
      setShowAddSection(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateDocument = async () => {
    if (!editingDoc) return;

    try {
      await updatePortalDocument({
        portalDocumentId: editingDoc._id,
        slug: slugInput || undefined,
        titleOverride: titleOverride || undefined,
      });
      setEditingDoc(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleDraft = async (doc: PortalDocItem) => {
    try {
      await updatePortalDocument({
        portalDocumentId: doc._id,
        isDraft: !doc.isDraft,
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEditing = (doc: PortalDocItem) => {
    setEditingDoc(doc);
    setSlugInput(doc.slug);
    setTitleOverride(doc.titleOverride || '');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('text/plain', docId);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    setDragOverId(docId);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string, targetPosition: number) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (draggedId === targetId) return;

    // Calculate new order
    const newOrder = (portalDocs || [])
      .map((doc) => {
        if (doc._id.toString() === draggedId) {
          return {
            id: doc._id,
            position: targetPosition,
            parentId: undefined,
          };
        }
        if (doc.position >= targetPosition && doc._id.toString() !== draggedId) {
          return {
            id: doc._id,
            position: doc.position + 1,
            parentId: doc.parentId,
          };
        }
        return {
          id: doc._id,
          position: doc.position,
          parentId: doc.parentId,
        };
      });

    try {
      await reorderNavigation({
        portalId,
        order: newOrder,
      });
    } catch (err: any) {
      alert(err.message);
    }

    setIsDragging(false);
    setDragOverId(null);
  };

  // Sort documents by position
  const sortedDocs = [...(portalDocs || [])].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icons.FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">
                Manage Portal Content
              </h2>
              <p className="text-xs text-secondary">
                {portal?.name} - Add and organize documentation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Available Documents */}
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-black/5 dark:bg-black/20">
              <h3 className="font-medium text-main text-sm">Available Documents</h3>
              <p className="text-xs text-secondary mt-0.5">
                {unpublishedDocs.length} documents
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unpublishedDocs.map((doc) => (
                <div
                  key={doc._id}
                  onClick={() => setSelectedDocId(doc._id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedDocId === doc._id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icons.FileText className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-main text-sm truncate">
                        {doc.topic}
                      </div>
                      <div className="text-xs text-secondary mt-1 line-clamp-2">
                        {doc.content.substring(0, 100)}...
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {unpublishedDocs.length === 0 && (
                <div className="text-center py-8 text-secondary text-sm">
                  All documents are published
                </div>
              )}
            </div>
            {selectedDocId && (
              <div className="p-3 border-t border-border">
                <button
                  onClick={handlePublishDocument}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Icons.Plus className="w-4 h-4" />
                  Add to Portal
                </button>
              </div>
            )}
          </div>

          {/* Right: Published Documents */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-black/5 dark:bg-black/20 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-main text-sm">Portal Navigation</h3>
                <p className="text-xs text-secondary mt-0.5">
                  Drag to reorder
                </p>
              </div>
              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Icons.Folder className="w-3.5 h-3.5" />
                Add Section
              </button>
            </div>

            {showAddSection && (
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="Section name..."
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
                />
                <button
                  onClick={handleCreateSection}
                  disabled={!sectionName.trim()}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddSection(false)}
                  className="px-3 py-1.5 text-secondary hover:text-main text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sortedDocs.map((doc, index) => (
                <div
                  key={doc._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, doc._id.toString())}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, doc._id.toString())}
                  onDrop={(e) => handleDrop(e, doc._id.toString(), index)}
                  className={`group relative rounded-lg border transition-all ${
                    dragOverId === doc._id.toString()
                      ? 'border-primary border-dashed bg-primary/5'
                      : doc.isDraft
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : doc.isSection
                      ? 'border-border bg-surface-hover'
                      : 'border-border hover:bg-surface-hover'
                  } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <Icons.GripVertical className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />

                    {doc.isSection ? (
                      <Icons.Folder className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <Icons.FileText className="w-4 h-4 text-secondary shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      {editingDoc?._id === doc._id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={titleOverride}
                            onChange={(e) => setTitleOverride(e.target.value)}
                            placeholder={doc.documentTopic}
                            className="w-full px-2 py-1 bg-background border border-border rounded text-sm text-main"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-secondary">/docs/</span>
                            <input
                              type="text"
                              value={slugInput}
                              onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              className="flex-1 px-2 py-1 bg-background border border-border rounded text-xs font-mono text-main"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUpdateDocument}
                              className="px-2 py-1 bg-primary text-white rounded text-xs font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingDoc(null)}
                              className="px-2 py-1 text-secondary hover:text-main text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-main text-sm truncate">
                            {doc.isSection
                              ? doc.sectionName
                              : doc.titleOverride || doc.documentTopic}
                          </div>
                          {!doc.isSection && (
                            <div className="text-xs text-secondary font-mono mt-0.5">
                              /docs/{doc.slug}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {doc.isDraft && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded text-[10px] font-bold uppercase">
                        Draft
                      </span>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!doc.isSection && (
                        <>
                          <button
                            onClick={() => startEditing(doc)}
                            className="p-1.5 hover:bg-surface rounded transition-colors"
                            title="Edit"
                          >
                            <Icons.Edit className="w-3.5 h-3.5 text-secondary" />
                          </button>
                          <button
                            onClick={() => handleToggleDraft(doc)}
                            className="p-1.5 hover:bg-surface rounded transition-colors"
                            title={doc.isDraft ? 'Publish' : 'Set as Draft'}
                          >
                            {doc.isDraft ? (
                              <Icons.Eye className="w-3.5 h-3.5 text-secondary" />
                            ) : (
                              <Icons.EyeOff className="w-3.5 h-3.5 text-secondary" />
                            )}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleUnpublishDocument(doc._id)}
                        className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove from portal"
                      >
                        <Icons.Trash className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sortedDocs.length === 0 && (
                <div className="text-center py-12 text-secondary">
                  <Icons.FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No documents published yet</p>
                  <p className="text-xs mt-1">Select documents from the left to add them</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-black/5 dark:bg-black/20">
          <div className="text-sm text-secondary">
            {sortedDocs.filter((d) => !d.isDraft && !d.isSection).length} published documents
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortalContentManager;

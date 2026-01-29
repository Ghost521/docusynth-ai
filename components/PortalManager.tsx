import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import PortalBuilder from './PortalBuilder';
import PortalContentManager from './PortalContentManager';
import PortalPreview from './PortalPreview';
import PortalNavEditor from './PortalNavEditor';

interface PortalManagerProps {
  workspaceId?: Id<"workspaces">;
  onClose: () => void;
}

interface Portal {
  _id: Id<"portals">;
  name: string;
  subdomain: string;
  customDomain?: string;
  isPublished: boolean;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  branding: {
    logo?: string;
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
  accessType: 'public' | 'password' | 'authenticated';
}

const PortalManager: React.FC<PortalManagerProps> = ({ workspaceId, onClose }) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPortalId, setEditingPortalId] = useState<Id<"portals"> | null>(null);
  const [showContentManager, setShowContentManager] = useState<Id<"portals"> | null>(null);
  const [showPreview, setShowPreview] = useState<Id<"portals"> | null>(null);
  const [showNavEditor, setShowNavEditor] = useState<Id<"portals"> | null>(null);

  // Queries
  const portals = useQuery(api.portals.listPortals, workspaceId ? { workspaceId } : {});

  // Mutations
  const publishPortal = useMutation(api.portals.publishPortal);
  const unpublishPortal = useMutation(api.portals.unpublishPortal);
  const deletePortal = useMutation(api.portals.deletePortal);

  const handlePublish = async (portalId: Id<"portals">) => {
    try {
      await publishPortal({ portalId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnpublish = async (portalId: Id<"portals">) => {
    if (!confirm('Unpublish this portal? It will no longer be accessible to visitors.')) return;

    try {
      await unpublishPortal({ portalId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (portalId: Id<"portals">) => {
    if (!confirm('Delete this portal? This action cannot be undone.')) return;

    try {
      await deletePortal({ portalId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditComplete = (portalId: Id<"portals">) => {
    setShowBuilder(false);
    setEditingPortalId(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-main">Documentation Portals</h2>
                <p className="text-xs text-secondary">
                  Create and manage public documentation sites
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
          <div className="flex-1 overflow-y-auto p-6">
            {/* Create New Portal Button */}
            <button
              onClick={() => {
                setEditingPortalId(null);
                setShowBuilder(true);
              }}
              className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group mb-6"
            >
              <div className="flex items-center justify-center gap-3 text-secondary group-hover:text-primary">
                <Icons.Plus className="w-6 h-6" />
                <span className="font-medium">Create New Portal</span>
              </div>
            </button>

            {/* Portal List */}
            {portals && portals.length > 0 ? (
              <div className="space-y-4">
                {portals.map((portal) => (
                  <div
                    key={portal._id}
                    className="p-5 rounded-xl border border-border bg-background hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Logo/Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: portal.branding?.primaryColor || '#3B82F6',
                        }}
                      >
                        {portal.branding?.logo ? (
                          <img
                            src={portal.branding.logo}
                            alt={portal.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Icons.Book className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-main truncate">{portal.name}</h3>
                          {portal.isPublished ? (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded text-[10px] font-bold uppercase">
                              Published
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded text-[10px] font-bold uppercase">
                              Draft
                            </span>
                          )}
                          {portal.accessType === 'password' && (
                            <Icons.Lock className="w-3.5 h-3.5 text-secondary" />
                          )}
                          {portal.accessType === 'authenticated' && (
                            <Icons.Users className="w-3.5 h-3.5 text-secondary" />
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-secondary">
                          <a
                            href={`https://${portal.subdomain}.docusynth.io`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <Icons.Globe className="w-3.5 h-3.5" />
                            {portal.subdomain}.docusynth.io
                          </a>
                          {portal.customDomain && (
                            <>
                              <span className="opacity-50">|</span>
                              <a
                                href={`https://${portal.customDomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                              >
                                <Icons.ExternalLink className="w-3.5 h-3.5" />
                                {portal.customDomain}
                              </a>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-secondary">
                          <span>Created {formatDate(portal.createdAt)}</span>
                          <span>Updated {formatDate(portal.updatedAt)}</span>
                          {portal.publishedAt && (
                            <span>Published {formatDate(portal.publishedAt)}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setShowPreview(portal._id)}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                          title="Preview"
                        >
                          <Icons.Eye className="w-4 h-4 text-secondary" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPortalId(portal._id);
                            setShowBuilder(true);
                          }}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                          title="Settings"
                        >
                          <Icons.Settings className="w-4 h-4 text-secondary" />
                        </button>
                        <button
                          onClick={() => setShowContentManager(portal._id)}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                          title="Manage Content"
                        >
                          <Icons.FileText className="w-4 h-4 text-secondary" />
                        </button>
                        <button
                          onClick={() => setShowNavEditor(portal._id)}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                          title="Edit Navigation"
                        >
                          <Icons.Sidebar className="w-4 h-4 text-secondary" />
                        </button>

                        <div className="w-px h-6 bg-border mx-1" />

                        {portal.isPublished ? (
                          <button
                            onClick={() => handleUnpublish(portal._id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                          >
                            <Icons.EyeOff className="w-3.5 h-3.5" />
                            Unpublish
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(portal._id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors"
                          >
                            <Icons.Publish className="w-3.5 h-3.5" />
                            Publish
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(portal._id)}
                          className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Portal"
                        >
                          <Icons.Trash className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : portals ? (
              <div className="text-center py-16 text-secondary">
                <Icons.Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-main mb-2">No portals yet</h3>
                <p className="text-sm max-w-md mx-auto">
                  Create a documentation portal to share your docs with the world.
                  Customize branding, add documents, and publish.
                </p>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-8 h-8 mx-auto border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="mt-4 text-sm text-secondary">Loading portals...</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-black/5 dark:bg-black/20">
            <div className="text-sm text-secondary">
              {portals?.length || 0} portal{portals?.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:text-main transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBuilder && (
        <PortalBuilder
          portalId={editingPortalId || undefined}
          workspaceId={workspaceId}
          onClose={() => {
            setShowBuilder(false);
            setEditingPortalId(null);
          }}
          onSaved={handleEditComplete}
        />
      )}

      {showContentManager && (
        <PortalContentManager
          portalId={showContentManager}
          workspaceId={workspaceId}
          onClose={() => setShowContentManager(null)}
        />
      )}

      {showPreview && (
        <PortalPreview
          portalId={showPreview}
          onClose={() => setShowPreview(null)}
        />
      )}

      {showNavEditor && (
        <PortalNavEditor
          portalId={showNavEditor}
          onClose={() => setShowNavEditor(null)}
        />
      )}
    </>
  );
};

export default PortalManager;

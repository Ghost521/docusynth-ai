import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface PortalNavEditorProps {
  portalId: Id<"portals">;
  onClose: () => void;
}

interface NavItem {
  _id: Id<"portalNavItems">;
  label: string;
  externalUrl?: string;
  documentId?: Id<"portalDocuments">;
  icon?: string;
  position: number;
  parentId?: Id<"portalNavItems">;
  isExpanded: boolean;
}

const commonIcons = [
  '📚', '📖', '📝', '📋', '📁', '🔧', '⚙️', '🎯',
  '🚀', '💡', '🔍', '📊', '🎨', '🔗', '📌', '⭐',
];

const PortalNavEditor: React.FC<PortalNavEditorProps> = ({ portalId, onClose }) => {
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<NavItem | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Queries
  const navItems = useQuery(api.portals.listNavItems, { portalId });
  const portalDocs = useQuery(api.portals.listPortalDocuments, { portalId });

  // Mutations
  const createNavItem = useMutation(api.portals.createNavItem);
  const deleteNavItem = useMutation(api.portals.deleteNavItem);

  const handleAddExternalLink = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;

    try {
      await createNavItem({
        portalId,
        label: newLabel.trim(),
        externalUrl: newUrl.trim(),
        icon: newIcon || undefined,
      });
      setNewLabel('');
      setNewUrl('');
      setNewIcon('');
      setShowAddItem(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (itemId: Id<"portalNavItems">) => {
    if (!confirm('Remove this navigation item?')) return;

    try {
      await deleteNavItem({ navItemId: itemId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Sort items by position
  const sortedItems = [...(navItems || [])].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icons.Sidebar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">Navigation Editor</h2>
              <p className="text-xs text-secondary">
                Add external links and customize navigation
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
          {/* Published Documents */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-main mb-3 flex items-center gap-2">
              <Icons.FileText className="w-4 h-4 text-primary" />
              Published Documents
            </h3>
            <div className="space-y-2">
              {portalDocs?.filter((d) => !d.isSection && !d.isDraft).map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center gap-3 px-4 py-3 bg-background rounded-lg border border-border"
                >
                  <Icons.FileText className="w-4 h-4 text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-main text-sm truncate">
                      {doc.titleOverride || doc.documentTopic}
                    </div>
                    <div className="text-xs text-secondary font-mono">
                      /docs/{doc.slug}
                    </div>
                  </div>
                  <Icons.Check className="w-4 h-4 text-green-500" />
                </div>
              ))}
              {(!portalDocs || portalDocs.filter((d) => !d.isSection && !d.isDraft).length === 0) && (
                <div className="text-center py-4 text-secondary text-sm">
                  No documents published to this portal
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-main flex items-center gap-2">
                <Icons.ExternalLink className="w-4 h-4 text-primary" />
                External Links
              </h3>
              <button
                onClick={() => setShowAddItem(!showAddItem)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Icons.Plus className="w-3.5 h-3.5" />
                Add Link
              </button>
            </div>

            {showAddItem && (
              <div className="mb-4 p-4 bg-background rounded-lg border border-border">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowIconPicker(!showIconPicker)}
                        className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-surface-hover transition-colors"
                      >
                        {newIcon || '🔗'}
                      </button>
                      {showIconPicker && (
                        <div className="absolute top-full left-0 mt-2 p-2 bg-surface rounded-lg border border-border shadow-xl z-10 grid grid-cols-4 gap-1 w-40">
                          {commonIcons.map((icon) => (
                            <button
                              key={icon}
                              onClick={() => {
                                setNewIcon(icon);
                                setShowIconPicker(false);
                              }}
                              className="w-8 h-8 rounded hover:bg-surface-hover text-lg flex items-center justify-center"
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Link label"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setShowAddItem(false)}
                      className="px-3 py-1.5 text-sm text-secondary hover:text-main"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddExternalLink}
                      disabled={!newLabel.trim() || !newUrl.trim()}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
                    >
                      Add Link
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {sortedItems.map((item) => (
                <div
                  key={item._id}
                  className="group flex items-center gap-3 px-4 py-3 bg-background rounded-lg border border-border hover:bg-surface-hover transition-colors"
                >
                  <span className="text-lg">{item.icon || '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-main text-sm truncate">
                      {item.label}
                    </div>
                    {item.externalUrl && (
                      <div className="text-xs text-secondary truncate">
                        {item.externalUrl}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-surface rounded transition-colors"
                      title="Open link"
                    >
                      <Icons.ExternalLink className="w-3.5 h-3.5 text-secondary" />
                    </a>
                    <button
                      onClick={() => handleDeleteItem(item._id)}
                      className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                      title="Remove"
                    >
                      <Icons.Trash className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}

              {sortedItems.length === 0 && (
                <div className="text-center py-8 text-secondary text-sm">
                  <Icons.Link className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No external links added</p>
                  <p className="text-xs mt-1">
                    Add links to external resources like GitHub, support, etc.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-black/5 dark:bg-black/20">
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

export default PortalNavEditor;

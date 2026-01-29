import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { SmartRules, SmartRule, CollectionVisibility } from '../types';
import SmartCollectionRules from './SmartCollectionRules';

interface CollectionEditorProps {
  collectionId?: Id<"collections">;
  parentId?: Id<"collections">;
  workspaceId?: Id<"workspaces">;
  onSave: (collectionId: Id<"collections">) => void;
  onCancel: () => void;
}

const COLLECTION_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#64748b', // slate
];

const COLLECTION_ICONS = [
  'FolderStack',
  'FileText',
  'BookMarked',
  'Archive',
  'Star',
  'Heart',
  'Flag',
  'Tag',
  'Bookmark',
  'Folder',
  'Box',
  'Package',
  'Layers',
  'Grid',
  'List',
  'Database',
];

const CollectionEditor: React.FC<CollectionEditorProps> = ({
  collectionId,
  parentId: initialParentId,
  workspaceId,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('FolderStack');
  const [color, setColor] = useState('#6366f1');
  const [parentId, setParentId] = useState<Id<"collections"> | undefined>(initialParentId);
  const [isSmartCollection, setIsSmartCollection] = useState(false);
  const [smartRules, setSmartRules] = useState<SmartRules>({ logic: 'and', rules: [] });
  const [visibility, setVisibility] = useState<CollectionVisibility>('private');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingCollection = useQuery(
    api.collections.get,
    collectionId ? { id: collectionId } : 'skip'
  );

  const collections = useQuery(api.collections.list, {
    workspaceId,
    includeNested: false,
  });

  const createCollection = useMutation(api.collections.create);
  const updateCollection = useMutation(api.collections.update);

  // Load existing collection data
  useEffect(() => {
    if (existingCollection) {
      setName(existingCollection.name);
      setDescription(existingCollection.description || '');
      setIcon(existingCollection.icon || 'FolderStack');
      setColor(existingCollection.color || '#6366f1');
      setParentId(existingCollection.parentId);
      setIsSmartCollection(existingCollection.isSmartCollection);
      if (existingCollection.smartRules) {
        setSmartRules(existingCollection.smartRules as SmartRules);
      }
      setVisibility(existingCollection.visibility);
    }
  }, [existingCollection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Collection name is required');
      return;
    }

    if (isSmartCollection && smartRules.rules.length === 0) {
      setError('Smart collections require at least one rule');
      return;
    }

    setIsSaving(true);

    try {
      if (collectionId) {
        await updateCollection({
          id: collectionId,
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
          parentId,
          isSmartCollection,
          smartRules: isSmartCollection ? smartRules : undefined,
          visibility,
        });
        onSave(collectionId);
      } else {
        const newId = await createCollection({
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
          parentId,
          isSmartCollection,
          smartRules: isSmartCollection ? smartRules : undefined,
          visibility,
          workspaceId,
        });
        onSave(newId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save collection');
    } finally {
      setIsSaving(false);
    }
  };

  const availableParents = collections?.filter(
    (c) => c._id !== collectionId && !c.parentId
  ) || [];

  const renderIcon = (iconName: string, className: string = 'w-4 h-4') => {
    const IconComponent = (Icons as Record<string, React.FC<{ className?: string }>>)[iconName];
    return IconComponent ? <IconComponent className={className} /> : <Icons.FolderStack className={className} />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-main">
            {collectionId ? 'Edit Collection' : 'Create Collection'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-surface-hover text-secondary transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-main mb-2">
                Collection Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter collection name..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-main mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
              />
            </div>
          </div>

          {/* Icon & Color */}
          <div className="flex gap-4">
            {/* Icon Picker */}
            <div className="relative">
              <label className="block text-sm font-medium text-main mb-2">
                Icon
              </label>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-14 h-14 rounded-xl border border-border bg-surface-hover flex items-center justify-center text-white transition-all hover:scale-105"
                style={{ backgroundColor: color }}
              >
                {renderIcon(icon, 'w-6 h-6')}
              </button>

              {showIconPicker && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-surface rounded-xl border border-border shadow-xl z-10 grid grid-cols-4 gap-2 w-48">
                  {COLLECTION_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        setIcon(iconName);
                        setShowIconPicker(false);
                      }}
                      className={`p-2 rounded-lg transition-all ${
                        icon === iconName
                          ? 'bg-primary text-white'
                          : 'hover:bg-surface-hover text-secondary'
                      }`}
                    >
                      {renderIcon(iconName, 'w-5 h-5')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div className="relative flex-1">
              <label className="block text-sm font-medium text-main mb-2">
                Color
              </label>
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="h-14 w-full rounded-xl border border-border flex items-center gap-3 px-4 transition-all hover:border-primary/50"
              >
                <div
                  className="w-8 h-8 rounded-lg"
                  style={{ backgroundColor: color }}
                />
                <span className="text-secondary text-sm">{color}</span>
              </button>

              {showColorPicker && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-surface rounded-xl border border-border shadow-xl z-10 grid grid-cols-6 gap-2 w-64">
                  {COLLECTION_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setColor(c);
                        setShowColorPicker(false);
                      }}
                      className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                        color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Parent Collection */}
          <div>
            <label className="block text-sm font-medium text-main mb-2">
              Parent Collection
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value ? e.target.value as Id<"collections"> : undefined)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface-hover text-main focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            >
              <option value="">No parent (root level)</option>
              {availableParents.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Smart Collection Toggle */}
          <div className="p-4 rounded-xl border border-border bg-surface-hover">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Icons.Wand className="w-5 h-5 text-purple-500" />
                <div>
                  <span className="font-medium text-main">Smart Collection</span>
                  <p className="text-xs text-secondary mt-0.5">
                    Automatically populate based on rules
                  </p>
                </div>
              </div>
              <div
                onClick={() => setIsSmartCollection(!isSmartCollection)}
                className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  isSmartCollection ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${
                    isSmartCollection ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Smart Collection Rules */}
          {isSmartCollection && (
            <SmartCollectionRules
              rules={smartRules}
              onChange={setSmartRules}
            />
          )}

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-main mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'private', label: 'Private', icon: 'Lock', desc: 'Only you' },
                { value: 'workspace', label: 'Workspace', icon: 'Users', desc: 'Team members' },
                { value: 'public', label: 'Public', icon: 'Globe', desc: 'Anyone' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value as CollectionVisibility)}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    visibility === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {renderIcon(option.icon, 'w-4 h-4')}
                    <span className="font-medium text-main text-sm">{option.label}</span>
                  </div>
                  <p className="text-xs text-secondary">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl border border-border text-secondary hover:text-main hover:bg-surface-hover transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
            className="px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Icons.Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icons.Check className="w-4 h-4" />
                {collectionId ? 'Save Changes' : 'Create Collection'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionEditor;

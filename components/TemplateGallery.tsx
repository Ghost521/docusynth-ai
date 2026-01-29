import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  isSystemTemplate: boolean;
  userId?: string;
  createdAt: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string, name: string) => void;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'custom',
    content: '',
  });

  const categories = useQuery(api.templates.getCategories) as Category[] | undefined;
  const templates = useQuery(api.templates.list, {
    category: selectedCategory || undefined,
  }) as Template[] | undefined;

  const createTemplate = useMutation(api.templates.create);
  const deleteTemplate = useMutation(api.templates.remove);

  const filteredTemplates = templates?.filter((t) =>
    searchQuery
      ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const handleSelectTemplate = (template: Template) => {
    onSelectTemplate(template.content, template.name);
    onClose();
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) return;

    await createTemplate(newTemplate);
    setNewTemplate({ name: '', description: '', category: 'custom', content: '' });
    setShowCreateForm(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Delete this template?')) {
      await deleteTemplate({ templateId: templateId as Id<"templates"> });
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      Globe: <Icons.Globe className="w-4 h-4" />,
      Cpu: <Icons.Cpu className="w-4 h-4" />,
      Folder: <Icons.Folder className="w-4 h-4" />,
      GitHub: <Icons.GitHub className="w-4 h-4" />,
      Terminal: <Icons.Terminal className="w-4 h-4" />,
      Sparkles: <Icons.Sparkles className="w-4 h-4" />,
      Plus: <Icons.Plus className="w-4 h-4" />,
    };
    return iconMap[iconName] || <Icons.Folder className="w-4 h-4" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-hover/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Template Gallery</h2>
              <p className="text-xs text-secondary">
                Start with a pre-built documentation structure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors"
            >
              <Icons.Plus className="w-4 h-4" />
              Create Template
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5 text-secondary hover:text-main" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - Categories */}
          <div className="w-56 border-r border-border bg-surface-hover/10 p-4 overflow-y-auto shrink-0">
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <p className="text-[10px] text-secondary uppercase tracking-widest mb-2 px-2">
              Categories
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  selectedCategory === null
                    ? 'bg-primary/10 text-primary'
                    : 'text-secondary hover:bg-surface-hover'
                }`}
              >
                <Icons.Folder className="w-4 h-4" />
                All Templates
              </button>

              {categories?.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedCategory === category.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {getCategoryIcon(category.icon)}
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main - Templates Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {showCreateForm ? (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                <h3 className="text-lg font-bold text-main mb-4">
                  Create New Template
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest mb-1.5 block">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) =>
                        setNewTemplate({ ...newTemplate, name: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="My Custom Template"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest mb-1.5 block">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newTemplate.description}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          description: e.target.value,
                        })
                      }
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Brief description of this template"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest mb-1.5 block">
                      Category
                    </label>
                    <select
                      value={newTemplate.category}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          category: e.target.value,
                        })
                      }
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest mb-1.5 block">
                      Template Content
                    </label>
                    <textarea
                      value={newTemplate.content}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          content: e.target.value,
                        })
                      }
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[300px] resize-y"
                      placeholder="# {TOPIC}&#10;&#10;## Overview&#10;..."
                    />
                    <p className="text-[10px] text-secondary mt-1">
                      Use {'{TOPIC}'} as a placeholder for the documentation
                      subject.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-6 py-2.5 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTemplate}
                      disabled={!newTemplate.name || !newTemplate.content}
                      className="px-6 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Create Template
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {filteredTemplates?.length === 0 ? (
                  <div className="text-center py-12">
                    <Icons.Folder className="w-12 h-12 text-secondary/30 mx-auto mb-3" />
                    <p className="text-secondary">No templates found</p>
                    <p className="text-secondary/60 text-sm mt-1">
                      Try a different category or create a new template
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTemplates?.map((template) => (
                      <div
                        key={template._id}
                        className="group bg-background border border-border rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {template.isSystemTemplate ? (
                              <div className="p-1.5 bg-primary/10 rounded-lg">
                                <Icons.Sparkles className="w-4 h-4 text-primary" />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-secondary/10 rounded-lg">
                                <Icons.Folder className="w-4 h-4 text-secondary" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-main group-hover:text-primary transition-colors">
                                {template.name}
                              </h4>
                              <span className="text-[10px] text-secondary uppercase tracking-wider">
                                {template.category}
                              </span>
                            </div>
                          </div>

                          {!template.isSystemTemplate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template._id);
                              }}
                              className="p-1.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Icons.X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-secondary line-clamp-2 mb-3">
                          {template.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-secondary">
                            {template.content.split('\n').length} lines
                          </span>
                          <span className="text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            Use Template
                            <Icons.ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-hover/30 flex items-center justify-between text-xs text-secondary">
          <span>
            {filteredTemplates?.length || 0} template
            {(filteredTemplates?.length || 0) !== 1 ? 's' : ''} available
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Icons.Sparkles className="w-3 h-3 text-primary" />
              System
            </span>
            <span className="flex items-center gap-1">
              <Icons.Folder className="w-3 h-3" />
              Custom
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;

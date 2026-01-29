
import React, { useState, useEffect } from 'react';
import { GeneratedDoc, Project } from '../types';
import { Icons } from './Icon';

interface HistorySidebarProps {
  history: GeneratedDoc[];
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  onSelectDoc: (doc: GeneratedDoc) => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
  onMoveDoc: (doc: GeneratedDoc, e: React.MouseEvent) => void;
  onDropDoc?: (docId: string, projectId: string | undefined) => void;
  onReorderProjects?: (projects: Project[]) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onGenerateMCP: (project: Project, e: React.MouseEvent) => void;
  onExportProject: (project: Project, e: React.MouseEvent) => void;
  onClear: () => void;
  onExportAll: () => void;
  isOpen: boolean;
  onClose: () => void;
  recentSearches: string[];
  onReRunSearch: (query: string) => void;
  onClearRecentSearches: () => void;
  onGoHome: () => void;
  workspaceSwitcher?: React.ReactNode;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onSelectDoc,
  onDeleteDoc,
  onMoveDoc,
  onDropDoc,
  onReorderProjects,
  onDeleteProject,
  onGenerateMCP,
  onExportProject,
  onClear,
  onExportAll,
  isOpen,
  onClose,
  recentSearches,
  onReRunSearch,
  onClearRecentSearches,
  onGoHome,
  workspaceSwitcher
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: 'doc' | 'project' } | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | 'none' | null>(null);
  
  // Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterTime, setFilterTime] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getFilteredDocs = () => {
    let filtered = activeProjectId 
      ? history.filter(doc => doc.projectId === activeProjectId)
      : history;

    if (debouncedTerm) {
      filtered = filtered.filter(doc => 
        doc.topic.toLowerCase().includes(debouncedTerm.toLowerCase())
      );
    }

    if (filterVisibility !== 'all') {
      filtered = filtered.filter(doc => doc.visibility === filterVisibility);
    }

    if (filterTime !== 'all') {
        const now = Date.now();
        const oneDay = 86400000;
        let limit = 0;
        if (filterTime === 'today') limit = oneDay;
        else if (filterTime === 'week') limit = oneDay * 7;
        else if (filterTime === 'month') limit = oneDay * 30;
        
        filtered = filtered.filter(doc => (now - doc.createdAt) <= limit);
    }

    return filtered;
  };

  const getGroupedHistory = () => {
    const groups: Record<string, GeneratedDoc[]> = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const lastWeekStart = todayStart - 86400000 * 7;

    const filteredDocs = getFilteredDocs();

    filteredDocs.forEach(doc => {
      if (doc.createdAt >= todayStart) {
        groups['Today'].push(doc);
      } else if (doc.createdAt >= yesterdayStart) {
        groups['Yesterday'].push(doc);
      } else if (doc.createdAt >= lastWeekStart) {
        groups['Previous 7 Days'].push(doc);
      } else {
        groups['Older'].push(doc);
      }
    });

    return groups;
  };

  const groupedHistory = getGroupedHistory();
  const hasHistory = history.length > 0;
  const hasFilteredResults = Object.values(groupedHistory).some(group => group.length > 0);

  // --- Drag and Drop Logic ---

  // Document Dragging
  const handleDocDragStart = (e: React.DragEvent, docId: string) => {
    setDraggingItem({ id: docId, type: 'doc' });
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.setData('type', 'doc');
    e.dataTransfer.effectAllowed = 'move';
  };

  // Project Dragging
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggingItem({ id: projectId, type: 'project' });
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.setData('type', 'project');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setDragOverProjectId(null);
  };

  const handleDragOver = (e: React.DragEvent, targetProjectId: string | 'none') => {
    e.preventDefault();
    if (!draggingItem) return;

    if (draggingItem.type === 'doc') {
      // Allow dropping doc into any project (including 'none' aka All Docs)
      e.dataTransfer.dropEffect = 'move';
      if (dragOverProjectId !== targetProjectId) {
        setDragOverProjectId(targetProjectId);
      }
    } else if (draggingItem.type === 'project' && targetProjectId !== 'none') {
       // Allow reordering projects
       e.dataTransfer.dropEffect = 'move';
       if (dragOverProjectId !== targetProjectId) {
        setDragOverProjectId(targetProjectId);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetProjectId: string | undefined) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const sourceId = e.dataTransfer.getData('text/plain');

    if (type === 'doc' && onDropDoc) {
       onDropDoc(sourceId, targetProjectId);
    } else if (type === 'project' && targetProjectId && onReorderProjects) {
       if (sourceId === targetProjectId) return;
       
       const sourceIndex = projects.findIndex(p => p.id === sourceId);
       const targetIndex = projects.findIndex(p => p.id === targetProjectId);
       
       if (sourceIndex > -1 && targetIndex > -1) {
          const newProjects = [...projects];
          const [moved] = newProjects.splice(sourceIndex, 1);
          newProjects.splice(targetIndex, 0, moved);
          onReorderProjects(newProjects);
       }
    }
    handleDragEnd();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <div className={`
        fixed top-0 left-0 h-full w-72 bg-surface border-r border-border z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static flex flex-col
      `}>
        <div className="p-4 border-b border-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <button onClick={onGoHome} className="flex items-center gap-2 text-primary hover:scale-105 transition-transform">
                    <Icons.Cpu className="w-5 h-5" />
                    <h2 className="font-bold tracking-tight text-main">DocuSynth</h2>
                </button>
                <div className="flex items-center gap-3">
                    {hasHistory && (
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={onExportAll} 
                                className="text-[10px] text-secondary hover:text-primary transition-colors font-bold uppercase tracking-tighter"
                                title="Export All History as JSON"
                            >
                                Export
                            </button>
                            <button 
                                onClick={onClear} 
                                className="text-[10px] text-secondary hover:text-red-500 transition-colors font-bold uppercase tracking-tighter"
                                title="Clear All History"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                    <button onClick={onClose} className="lg:hidden text-secondary hover:text-main">
                        <Icons.X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Workspace Switcher */}
            {workspaceSwitcher && (
              <div className="pt-2">
                {workspaceSwitcher}
              </div>
            )}

            {/* Search Bar & Filter Toggle */}
            {hasHistory && (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Icons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-secondary pointer-events-none" />
                            <input 
                                type="text"
                                placeholder="Filter context..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-main placeholder:text-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border transition-all ${showFilters || filterVisibility !== 'all' || filterTime !== 'all' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-secondary hover:text-main'}`}
                            title="Filter History"
                        >
                            <Icons.Filter className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="p-3 bg-surface-hover/50 rounded-lg border border-border space-y-3 animate-fadeIn">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Visibility</label>
                                <div className="flex bg-background border border-border rounded-lg p-0.5">
                                    {['all', 'public', 'private'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setFilterVisibility(v as any)}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md capitalize transition-all ${filterVisibility === v ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-main'}`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Timeframe</label>
                                <select 
                                    value={filterTime}
                                    onChange={(e) => setFilterTime(e.target.value as any)}
                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-main outline-none focus:border-primary"
                                >
                                    <option value="all">Any Time</option>
                                    <option value="today">Past 24 Hours</option>
                                    <option value="week">Past Week</option>
                                    <option value="month">Past Month</option>
                                </select>
                            </div>
                            
                            {/* Reset Link */}
                             {(filterVisibility !== 'all' || filterTime !== 'all') && (
                                <button 
                                    onClick={() => { setFilterVisibility('all'); setFilterTime('all'); }}
                                    className="w-full text-center text-[10px] text-red-500 hover:underline pt-1"
                                >
                                    Reset Filters
                                </button>
                             )}
                        </div>
                    )}
                </div>
            )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Main Navigation */}
          <div className="p-4 space-y-1">
             <button
              onClick={onGoHome}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-hover transition-all group active:scale-[0.97] shadow-sm"
            >
              <Icons.Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              New Synthesis
            </button>
          </div>

          <div className="border-t border-border mx-4 my-2" />

          {/* Projects Section */}
          <div className="p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Projects</h3>
                <button 
                  onClick={onCreateProject}
                  className="p-1 rounded hover:bg-surface-hover text-secondary hover:text-primary transition-colors"
                  title="New Project"
                >
                  <Icons.Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <button 
                  onClick={() => onSelectProject(null)}
                  onDragOver={(e) => handleDragOver(e, 'none')}
                  onDragLeave={() => setDragOverProjectId(null)}
                  onDrop={(e) => handleDrop(e, undefined)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border ${
                    dragOverProjectId === 'none' 
                      ? 'bg-primary/20 border-primary scale-[1.02] shadow-lg' 
                      : activeProjectId === null 
                        ? 'bg-primary/10 text-primary border-primary/20 font-semibold' 
                        : 'text-secondary border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <Icons.Globe className="w-4 h-4" />
                  All Documents
                  <span className="ml-auto text-[10px] opacity-60 bg-surface-hover px-1.5 rounded">{history.length}</span>
                </button>
                
                {projects.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-[11px] text-secondary/60 leading-relaxed">
                      Organize docs into projects for focused AI context.
                    </p>
                  </div>
                )}
                {projects.map((project, idx) => (
                  <div 
                      key={project.id} 
                      className="group relative"
                  >
                    <button 
                      draggable
                      onDragStart={(e) => handleProjectDragStart(e, project.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectProject(project.id)}
                      onDragOver={(e) => handleDragOver(e, project.id)}
                      onDragLeave={() => setDragOverProjectId(null)}
                      onDrop={(e) => handleDrop(e, project.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border ${
                        dragOverProjectId === project.id 
                          ? draggingItem?.type === 'project' 
                             ? 'bg-surface-hover border-t-primary/50 border-x-transparent border-b-transparent' // Visual cue for reordering
                             : 'bg-primary/20 border-primary scale-[1.02] shadow-lg' // Visual cue for moving doc
                          : activeProjectId === project.id 
                            ? 'bg-primary/10 text-primary border-primary/20 font-semibold' 
                            : 'text-secondary border-transparent hover:bg-surface-hover'
                      } ${draggingItem?.id === project.id ? 'opacity-50' : ''}`}
                    >
                      <div className="relative pointer-events-none">
                        <Icons.Folder className="w-4 h-4" />
                        <div className="absolute -top-1 -right-1">
                          {project.visibility === 'public' ? <Icons.Globe className="w-2 h-2 text-primary" /> : <Icons.Lock className="w-2 h-2 text-secondary" />}
                        </div>
                      </div>
                      <span className="truncate pr-16 pointer-events-none">{project.name}</span>
                      <span className="ml-auto text-[10px] opacity-60 bg-surface-hover px-1.5 rounded pointer-events-none">
                        {history.filter(d => d.projectId === project.id).length}
                      </span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => onExportProject(project, e)}
                        className="p-1.5 text-secondary hover:text-primary bg-surface border border-transparent hover:border-border rounded transition-all"
                        title="Export as ZIP"
                      >
                        <Icons.Download className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => onGenerateMCP(project, e)}
                        className="p-1.5 text-secondary hover:text-primary bg-surface border border-transparent hover:border-border rounded transition-all"
                        title="Generate MCP Server"
                      >
                        <Icons.Server className="w-3 h-3" />
                      </button>
                      {project.id !== 'default' && (
                        <button 
                          onClick={(e) => onDeleteProject(project.id, e)}
                          className="p-1.5 text-secondary hover:text-red-500 bg-surface border border-transparent hover:border-border rounded transition-all"
                          title="Delete Project"
                        >
                          <Icons.Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </div>

          <div className="border-t border-border mx-4 my-2" />

          {/* Recent Searches Section */}
          {recentSearches.length > 0 && (
            <div className="p-4 animate-fadeIn">
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Recent Searches</h3>
                <button 
                  onClick={onClearRecentSearches}
                  className="text-[9px] font-bold text-secondary hover:text-red-500 uppercase tracking-tighter"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, idx) => (
                  <button
                    key={`${search}-${idx}`}
                    onClick={() => {
                      onReRunSearch(search);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-hover hover:bg-primary/10 border border-border hover:border-primary/30 rounded-lg text-xs text-secondary hover:text-primary transition-all max-w-full group"
                  >
                    <Icons.Search className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    <span className="truncate" title={search}>{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentSearches.length > 0 && <div className="border-t border-border mx-4 my-2" />}

          {/* History Section */}
          <div className="p-4">
            {!hasHistory ? (
                <div className="flex flex-col items-center text-center mt-8 px-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <Icons.FileText className="w-7 h-7 text-primary/60" />
                  </div>
                  <h4 className="text-sm font-bold text-main mb-1">No documents yet</h4>
                  <p className="text-[11px] text-secondary leading-relaxed mb-4">
                    Synthesize your first document to start building your AI knowledge base.
                  </p>
                  <button
                    onClick={onGoHome}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" />
                    New Synthesis
                  </button>
                </div>
            ) : !hasFilteredResults ? (
                <div className="flex flex-col items-center text-center mt-8 px-4">
                  <div className="w-12 h-12 bg-surface-hover rounded-xl flex items-center justify-center mb-3">
                    <Icons.Search className="w-6 h-6 text-secondary/40" />
                  </div>
                  <h4 className="text-sm font-bold text-main mb-1">No matches found</h4>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    Try adjusting your search or filters.
                  </p>
                </div>
            ) : (
                Object.entries(groupedHistory).map(([label, docs]) => {
                    if (docs.length === 0) return null;
                    
                    return (
                        <div key={label} className="mb-6">
                            <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3 ml-1">{label}</h3>
                            <div className="space-y-1.5">
                                {docs.map((doc, docIdx) => (
                                    <div
                                        key={doc.id}
                                        style={{ animationDelay: `${docIdx * 30}ms` }}
                                        draggable
                                        onDragStart={(e) => handleDocDragStart(e, doc.id)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => {
                                            onSelectDoc(doc);
                                            if (window.innerWidth < 1024) onClose();
                                        }}
                                        className={`group relative p-3 rounded-lg bg-surface-hover/50 hover:bg-surface-hover cursor-grab active:cursor-grabbing border border-transparent hover:border-border transition-all hover:shadow-sm animate-slideUp ${draggingItem?.id === doc.id ? 'opacity-30 border-primary' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                          <h3 
                                            className="text-sm font-medium text-main truncate pr-12"
                                            title={doc.topic}
                                          >
                                            {doc.topic}
                                          </h3>
                                          {doc.visibility === 'public' && <Icons.Globe className="w-3 h-3 text-primary shrink-0" />}
                                        </div>
                                        <div className="text-[10px] text-secondary mt-1 flex items-center justify-between">
                                          <span>
                                            {label === 'Today' 
                                                ? new Date(doc.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                                : new Date(doc.createdAt).toLocaleDateString()
                                            }
                                          </span>
                                          {activeProjectId === null && doc.projectId && (
                                            <span className="opacity-50 italic truncate max-w-[80px]">
                                              {projects.find(p => p.id === doc.projectId)?.name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="absolute top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => onMoveDoc(doc, e)}
                                            className="p-1 text-secondary hover:text-primary transition-colors"
                                            title="Move to Project"
                                          >
                                            <Icons.Folder className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => onDeleteDoc(doc.id, e)}
                                            className="p-1 text-secondary hover:text-red-400 transition-colors"
                                            title="Delete"
                                          >
                                            <Icons.Trash className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;

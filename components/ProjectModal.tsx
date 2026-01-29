
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icons } from './Icon';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string, visibility: 'public' | 'private') => void;
}

const MAX_NAME_LENGTH = 50;
const MAX_DESC_LENGTH = 1000;

const PRESETS = [
  { 
    id: 'github', 
    name: 'GitHub', 
    icon: Icons.GitHub, 
    color: 'hover:text-white hover:bg-zinc-900 dark:hover:bg-zinc-100 dark:hover:text-zinc-900',
    template: "Focus on GitHub Repository:\nURL: https://github.com/[owner]/[repo]\nBranch: main\nKey Files: README.md, package.json\nGoal: Analyze repository structure, core technologies, and architectural patterns."
  },
  { 
    id: 'framework', 
    name: 'Web Framework', 
    icon: Icons.Layout, 
    color: 'hover:text-white hover:bg-emerald-600',
    template: "Focus on Web Framework:\nFramework: [Name (e.g. Next.js, Remix, Astro)]\nVersion: [Latest]\nAreas: Routing, Data Fetching, Client/Server Components, Middleware\nGoal: Synthesize full-stack project architecture patterns."
  },
  { 
    id: 'database', 
    name: 'Database/ORM', 
    icon: Icons.Database, 
    color: 'hover:text-white hover:bg-indigo-600',
    template: "Focus on Database/ORM:\nLibrary: [Name (e.g. Prisma, Drizzle, Supabase)]\nDriver: [PostgreSQL/MySQL/etc]\nScope: Schema definitions, Migrations, Query patterns, Type safety\nRequirement: Extract type-safe database access patterns and relation handling."
  },
  { 
    id: 'cloud', 
    name: 'Cloud Services', 
    icon: Icons.Cloud, 
    color: 'hover:text-white hover:bg-sky-500',
    template: "Focus on Cloud Infrastructure:\nProvider: [AWS/Vercel/Google Cloud/Firebase]\nService: [Lambda/Edge/Auth/Storage]\nContext: Deployment configurations, SDK usage patterns, and IAM/security policies for serverless environments."
  },
  { 
    id: 'mobile', 
    name: 'Mobile Apps', 
    icon: Icons.Smartphone, 
    color: 'hover:text-white hover:bg-purple-600',
    template: "Focus on Mobile Development:\nPlatform: [React Native/Flutter/SwiftUI/Kotlin]\nFocus: Navigation, State Management, Native Modules, UI Components\nGoal: Context for building high-performance cross-platform or native mobile apps."
  },
  { 
    id: 'devops', 
    name: 'DevOps/IaC', 
    icon: Icons.Infinity, 
    color: 'hover:text-white hover:bg-cyan-600',
    template: "Focus on DevOps & Infrastructure:\nTool: [Terraform/Kubernetes/GitHub Actions/Docker]\nScope: CI/CD Pipelines, Resource provisioning, Orchestration\nContext: Gathering patterns for automated infrastructure as code."
  },
  { 
    id: 'ai', 
    name: 'AI/LLM Stack', 
    icon: Icons.Sparkles, 
    color: 'hover:text-white hover:bg-amber-500',
    template: "Focus on AI Engineering:\nLibrary: [LangChain/OpenAI SDK/LlamaIndex]\nComponents: Prompts, Vector Stores, Agents, RAG pipelines\nGoal: Synthesize implementation patterns for agentic workflows."
  },
  { 
    id: 'testing', 
    name: 'Testing/QA', 
    icon: Icons.Shield, 
    color: 'hover:text-white hover:bg-rose-500',
    template: "Focus on Testing Frameworks:\nTool: [Playwright/Cypress/Vitest/Jest]\nType: [E2E/Unit/Integration/Visual]\nContext: Gathering best practices for robust test suites and mocking strategies."
  },
  { 
    id: 'npm', 
    name: 'NPM/Package', 
    icon: Icons.Package, 
    color: 'hover:text-white hover:bg-red-600',
    template: "Focus on NPM Package:\nPackage Name: @[scope]/[name]\nVersion: latest\nRequirement: Extract API reference, peer dependencies, and common usage patterns for efficient coding."
  },
  { 
    id: 'gitlab', 
    name: 'GitLab', 
    icon: Icons.GitLab, 
    color: 'hover:text-white hover:bg-orange-600',
    template: "Focus on GitLab Project:\nURL: https://gitlab.com/[group]/[project]\nBranch: master\nContext: Private internal library research or GitLab-specific CI features."
  },
  { 
    id: 'bitbucket', 
    name: 'Bitbucket', 
    icon: Icons.Bitbucket, 
    color: 'hover:text-white hover:bg-blue-600',
    template: "Focus on Bitbucket Repo:\nURL: https://bitbucket.org/[workspace]/[repo]\nContext: Enterprise infrastructure context and pipeline definitions."
  },
  { 
    id: 'docs', 
    name: 'Meta Docs', 
    icon: Icons.FileText, 
    color: 'hover:text-white hover:bg-slate-700',
    template: "Focus on Documentation Tooling:\nTool: [Docusaurus/Astro Starlight/GitBook]\nGoal: Context for generating, formatting, and structuring technical documentation for human and AI consumption."
  }
];

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const validateGitHubUrl = (url: string) => {
    if (!url || url === 'https://github.com/') return false;
    const regex = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    return regex.test(url);
  };

  const isRepoUrlValid = useMemo(() => {
    if (activePreset === 'github') {
      return validateGitHubUrl(repoUrl);
    }
    return true;
  }, [activePreset, repoUrl]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setRepoUrl('');
      setVisibility('private');
      setActivePreset(null);
    }
  }, [isOpen]);

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.id);
    
    if (preset.id === 'github') {
      setName('GitHub: [owner]/[repo]');
      setRepoUrl('https://github.com/');
    } else {
      if (!name.trim() || name.startsWith('GitHub:') || name.includes(': New Project')) {
        setName(`${preset.name}: New Project`);
      }
    }
    
    setDescription(prev => prev.trim() ? `${prev}\n\n${preset.template}` : preset.template);
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (activePreset === 'github' && !validateGitHubUrl(repoUrl)) {
      return;
    }

    if (trimmedName && trimmedName.length <= MAX_NAME_LENGTH) {
      const fullDesc = repoUrl.trim() 
        ? `Primary Repository: ${repoUrl.trim()}\n\n${description.trim()}`
        : description.trim();
      onConfirm(trimmedName, fullDesc, visibility);
      onClose();
    }
  }, [name, description, repoUrl, activePreset, visibility, onConfirm, onClose]);

  if (!isOpen) return null;

  const isSubmitDisabled = !name.trim() || 
                           name.length > MAX_NAME_LENGTH || 
                           description.length > MAX_DESC_LENGTH ||
                           (activePreset === 'github' && !isRepoUrlValid);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" 
        onClick={onClose} 
      />
      
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleIn transition-all">
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <header className="flex items-center justify-between mb-6 sticky top-0 bg-surface z-10 pb-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Icons.FolderPlus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-main leading-tight">Create New Project</h3>
                  <p className="text-xs text-secondary mt-1">Specialized context for smarter AI agents.</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-2 text-secondary hover:text-main">
                <Icons.X className="w-5 h-5" />
              </button>
            </header>
            
            <div className="space-y-6">
              {/* Preset Gallery */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest px-1">Specialized Categories</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all ${
                        activePreset === preset.id 
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary' 
                          : `bg-background border-border text-secondary ${preset.color}`
                      }`}
                    >
                      <preset.icon className="w-4 h-4" />
                      <span className="text-[9px] font-bold text-center leading-tight">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                   {/* Project Name Field */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Project Name</label>
                      <span className={`text-[10px] font-mono ${name.length > MAX_NAME_LENGTH ? 'text-red-500' : 'text-secondary/50'}`}>
                        {name.length}/{MAX_NAME_LENGTH}
                      </span>
                    </div>
                    <input 
                      autoFocus
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH + 5))}
                      placeholder="e.g. Next.js 15 Commerce"
                      className={`w-full bg-background border rounded-xl px-4 py-3 text-sm text-main outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                        name.length > MAX_NAME_LENGTH ? 'border-red-500' : 'border-border focus:border-primary'
                      }`}
                      required
                    />
                  </div>

                  {/* Repository URL */}
                  {(activePreset === 'github' || repoUrl) && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-secondary uppercase tracking-widest">Source URL</label>
                          {activePreset === 'github' && repoUrl && repoUrl !== 'https://github.com/' && !isRepoUrlValid && (
                            <span className="text-[10px] text-red-500 font-bold">Invalid URL</span>
                          )}
                        </div>
                        <div className="relative">
                            <Icons.GitHub className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${!isRepoUrlValid && activePreset === 'github' && repoUrl !== 'https://github.com/' ? 'text-red-500' : 'text-secondary'}`} />
                            <input 
                              type="url" 
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/..."
                              className={`w-full bg-background border rounded-xl pl-10 pr-4 py-2.5 text-sm text-main outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                                !isRepoUrlValid && activePreset === 'github' && repoUrl !== 'https://github.com/' ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'
                              }`}
                            />
                        </div>
                      </div>
                  )}

                  {/* Visibility Settings */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">Project Visibility</label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                          visibility === 'private' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <Icons.Lock className="w-4 h-4" />
                        Private
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                          visibility === 'public' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <Icons.Globe className="w-4 h-4" />
                        Public
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Enhanced Description Field */}
                  <div className="space-y-1.5 flex flex-col h-full">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Synthesis Context</label>
                      <span className={`text-[10px] font-mono ${description.length > MAX_DESC_LENGTH ? 'text-red-500' : 'text-secondary/50'}`}>
                        {description.length}/{MAX_DESC_LENGTH}
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC_LENGTH + 20))}
                        placeholder="Detailed synthesis instructions..."
                        className={`w-full h-[220px] bg-background border rounded-xl px-4 py-3 text-xs font-mono text-main outline-none transition-all focus:ring-2 focus:ring-primary/20 resize-none ${
                          description.length > MAX_DESC_LENGTH ? 'border-red-500' : 'border-border focus:border-primary'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <footer className="p-4 bg-surface-hover/50 flex justify-end gap-3 border-t border-border sticky bottom-0 z-10">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-main hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitDisabled}
              className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-emerald-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale active:scale-95"
            >
              Create Project
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;

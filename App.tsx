
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from './convex/_generated/api';
import { Id } from './convex/_generated/dataModel';
import { Theme, DiscoveredLink, Project, GeneratedDoc } from './types';
import HistorySidebar from './components/HistorySidebar';
import MarkdownViewer from './components/MarkdownViewer';
import LinkSelectionModal from './components/LinkSelectionModal';
import BulkImportModal from './components/BulkImportModal';
import TaskProgressManager from './components/TaskProgressManager';
import ConfirmationModal from './components/ConfirmationModal';
import ProjectModal from './components/ProjectModal';
import MCPModal from './components/MCPModal';
import SettingsModal from './components/SettingsModal';
import MoveDocModal from './components/MoveDocModal';
import GitHubPushModal from './components/GitHubPushModal';
import PresetsGallery from './components/PresetsGallery';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Icons } from './components/Icon';
import Tooltip from './components/Tooltip';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
// Phase 2-5 Feature Components
import SearchModal from './components/SearchModal';
import DiffViewer from './components/DiffViewer';
import TemplateGallery from './components/TemplateGallery';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DocumentChat from './components/DocumentChat';
import StreamingDocViewer from './components/StreamingDocViewer';
import { useStreamingGeneration } from './hooks/useStreamingGeneration';
// Phase 3: Team Workspace Components
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import WorkspaceSettingsModal from './components/WorkspaceSettingsModal';
import CreateWorkspaceModal from './components/CreateWorkspaceModal';
// Phase 4: REST API & Webhooks Components
import APIKeysModal from './components/APIKeysModal';
import WebhooksModal from './components/WebhooksModal';
// Phase 5: Scheduled Updates Components
import ScheduleModal from './components/ScheduleModal';
// Phase 3: Comments Components
import CommentsPanel from './components/CommentsPanel';
// Phase 3: Collaborative Editing Components
import PresenceAvatars from './components/PresenceAvatars';
import { usePresence } from './hooks/usePresence';
// Phase 6: External Imports Component
import ImportModal from './components/ImportModal';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'search' | 'crawl' | 'github'>('search');
  const [isAdvancedCrawl, setIsAdvancedCrawl] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [inputError, setInputError] = useState(false);
  const [inputErrorMsg, setInputErrorMsg] = useState('');
  const [inputShake, setInputShake] = useState(false);

  const [currentDocId, setCurrentDocId] = useState<Id<"documents"> | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme State - only thing that stays in localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('docu_synth_theme') as Theme | null;
      if (saved) return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'dark';
  });

  // UI State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalTitle, setLinkModalTitle] = useState<string | undefined>(undefined);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [docToMove, setDocToMove] = useState<Id<"documents"> | null>(null);
  const [settingsTab, setSettingsTab] = useState<'local' | 'cloud' | 'ide' | 'shortcuts' | 'crawler'>('local');
  const [showTaskView, setShowTaskView] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);

  // MCP State
  const [showMCPModal, setShowMCPModal] = useState(false);
  const [mcpServerCode, setMcpServerCode] = useState('');
  const [mcpActiveProjectId, setMcpActiveProjectId] = useState<Id<"projects"> | null>(null);

  const [foundLinks, setFoundLinks] = useState<DiscoveredLink[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Phase 2-5 Feature State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ old: string; new: string; oldLabel?: string; newLabel?: string } | null>(null);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [useStreamingMode, setUseStreamingMode] = useState(true); // Enable streaming by default
  const [showStreamingView, setShowStreamingView] = useState(false);

  // Phase 3: Team Workspace State
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<Id<"workspaces"> | null>(null);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [showWorkspaceSettingsModal, setShowWorkspaceSettingsModal] = useState(false);
  const [workspaceToManage, setWorkspaceToManage] = useState<Id<"workspaces"> | null>(null);

  // Phase 4: REST API & Webhooks State
  const [showAPIKeysModal, setShowAPIKeysModal] = useState(false);
  const [showWebhooksModal, setShowWebhooksModal] = useState(false);

  // Phase 5: Scheduled Updates State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDocumentId, setScheduleDocumentId] = useState<Id<"documents"> | null>(null);

  // Phase 3: Comments State
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [commentSelectedText, setCommentSelectedText] = useState<string | undefined>();
  const [commentSelectionStart, setCommentSelectionStart] = useState<number | undefined>();
  const [commentSelectionEnd, setCommentSelectionEnd] = useState<number | undefined>();

  // Phase 6: External Imports State
  const [showImportModal, setShowImportModal] = useState(false);

  // Confirmation Modals State
  const [docToDelete, setDocToDelete] = useState<Id<"documents"> | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Id<"projects"> | null>(null);

  // ─── Convex Queries (reactive, real-time) ───
  const projects = useQuery(api.projects.list,
    currentWorkspaceId ? { workspaceId: currentWorkspaceId } : {}
  ) || [];
  const documents = useQuery(api.documents.list,
    activeProjectId
      ? { projectId: activeProjectId, workspaceId: currentWorkspaceId || undefined }
      : { workspaceId: currentWorkspaceId || undefined }
  ) || [];
  const currentDoc = useQuery(api.documents.get,
    currentDocId ? { id: currentDocId } : "skip"
  );
  const recentSearches = useQuery(api.recentSearches.list) || [];
  const userSettings = useQuery(api.userSettings.get);
  const crawlTasks = useQuery(api.crawlTasks.list) || [];

  // ─── Convex Mutations ───
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const reorderProjects = useMutation(api.projects.reorder);
  const createDocument = useMutation(api.documents.create);
  const updateDocContent = useMutation(api.documents.updateContent);
  const updateDocVisibility = useMutation(api.documents.updateVisibility);
  const moveDocToProject = useMutation(api.documents.moveToProject);
  const removeDocument = useMutation(api.documents.remove);
  const clearAllDocuments = useMutation(api.documents.clearAll);
  const revertVersion = useMutation(api.docVersions.revert);
  const upsertSettings = useMutation(api.userSettings.upsert);
  const updateSecretsSecure = useAction(api.userSettings.updateSecretsSecure);
  const addRecentSearch = useMutation(api.recentSearches.add);
  const clearRecentSearches = useMutation(api.recentSearches.clear);
  const createCrawlBatch = useMutation(api.crawlTasks.createBatch);
  const createCrawlTask = useMutation(api.crawlTasks.create);
  const clearCompletedTasks = useMutation(api.crawlTasks.clearCompleted);

  // ─── Convex Actions ───
  const generateDocAction = useAction(api.geminiActions.generateDocumentation);
  const discoverLinksAction = useAction(api.geminiActions.discoverLinks);
  const generateMCPAction = useAction(api.geminiActions.generateMCPServer);
  const summarizeAction = useAction(api.geminiActions.summarizeContent);

  // ─── Streaming Generation Hook ───
  const streaming = useStreamingGeneration({
    projectId: activeProjectId || undefined,
    autoSave: false,
    onComplete: (session) => {
      addToast('success', 'Synthesis Complete', `Documentation ready for use.`);
    },
    onError: (error) => {
      addToast('error', 'Generation Failed', error);
    },
  });

  // ─── Real-Time Presence Hook ───
  const presence = usePresence({
    documentId: currentDocId,
    enabled: !!currentDocId && !showStreamingView,
  });

  // Auto-detect GitHub URLs
  useEffect(() => {
    if (inputValue.toLowerCase().includes('github.com/')) {
      setMode('github');
    } else if (inputValue.startsWith('http')) {
      if (mode === 'search') setMode('crawl');
    } else {
      if (mode !== 'search' && !inputValue.startsWith('http') && inputValue.length > 0) setMode('search');
    }
  }, [inputValue]);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('docu_synth_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const addToast = useCallback((type: ToastMessage['type'], title: string, message: string) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // ─── Handlers ───

  const handleCreateProject = async (name: string, description: string, visibility: 'public' | 'private' | 'workspace') => {
    try {
      const id = await createProject({
        name,
        description,
        visibility: currentWorkspaceId ? 'workspace' : visibility,
        workspaceId: currentWorkspaceId || undefined,
      });
      setActiveProjectId(id);
      addToast('success', 'Project Created', `"${name}" is now your active project.`);
    } catch (e: any) {
      addToast('error', 'Error', e.message || 'Failed to create project.');
    }
  };

  const handleDeleteProjectTrigger = (id: Id<"projects">, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(id);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await removeProject({ id: projectToDelete });
      if (activeProjectId === projectToDelete) setActiveProjectId(null);
      addToast('info', 'Project Removed', 'Project folder deleted.');
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
    setProjectToDelete(null);
  };

  const handleReorderProjects = async (newProjects: any[]) => {
    try {
      await reorderProjects({ projectIds: newProjects.map((p: any) => p._id) });
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearAllDocuments({});
      setCurrentDocId(null);
      setActiveProjectId(null);
      addToast('info', 'App Reset', 'All data cleared.');
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleUpdateDocVisibility = async (docId: Id<"documents">, visibility: 'public' | 'private') => {
    try {
      await updateDocVisibility({ id: docId, visibility });
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleUpdateDocContent = async (docId: Id<"documents">, newContent: string) => {
    try {
      await updateDocContent({ id: docId, content: newContent, versionLabel: 'Manual Edit' });
      addToast('success', 'Document Saved', 'Manual edits applied and version history updated.');
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleRefreshDoc = useCallback(async (doc: any) => {
    if (isLoading) return;
    setIsLoading(true);
    setStatusMessage(`Refreshing knowledge for ${doc.topic}...`);
    try {
      // Create version snapshot before refresh
      await updateDocContent({
        id: doc._id,
        content: doc.content,
        versionLabel: 'Pre-Refresh Snapshot'
      });

      const isGitHub = doc.topic.toLowerCase().includes('github.com/');
      const result = await generateDocAction({
        topic: doc.topic,
        mode: isGitHub ? 'github' : 'search',
        projectId: doc.projectId,
      });

      // The action already creates the document, so update existing
      await updateDocContent({
        id: doc._id,
        content: result.content,
        versionLabel: 'Refresh Update',
      });

      addToast('success', 'Doc Refreshed', 'New version synthesized.');
    } catch (e: any) {
      addToast('error', 'Refresh Failed', e.message || 'Could not update documentation.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, addToast, generateDocAction, updateDocContent]);

  const handleRevertVersion = async (docId: Id<"documents">, versionId: Id<"docVersions">) => {
    try {
      await revertVersion({ documentId: docId, versionId });
      addToast('info', 'Doc Reverted', 'Document restored to historical state.');
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleMoveDoc = async (docId: Id<"documents">, projectId: Id<"projects"> | undefined) => {
    try {
      await moveDocToProject({ id: docId, projectId });
      const projectName = projectId ? projects.find((p: any) => p._id === projectId)?.name : "All Documents";
      addToast('success', 'Document Moved', `Documentation reassigned to "${projectName}".`);
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleGenerateMCP = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setStatusMessage(`Architecting MCP server...`);
    try {
      const result = await generateMCPAction({ projectId: project._id });
      setMcpServerCode(result.code);
      setMcpActiveProjectId(project._id);
      setShowMCPModal(true);
      addToast('success', 'MCP Server Ready', `Generated for ${project.name}.`);
    } catch (e: any) {
      addToast('error', 'MCP Generation Failed', e.message || 'Failed to synthesize code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportProject = async (project: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const projectDocs = documents.filter((d: any) => d.projectId === project._id);
    if (projectDocs.length === 0) {
      addToast('warning', 'Empty Project', 'No documents available to export.');
      return;
    }
    addToast('info', 'Exporting...', 'Generating ZIP archive.');
    try {
      const zip = new JSZip();
      const folderName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const folder = zip.folder(folderName);

      if (!folder) throw new Error("Failed to create zip folder");

      const usedNames = new Set<string>();

      projectDocs.forEach((doc: any) => {
        let baseName = doc.topic.replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_+|_+$/g, '');
        if (!baseName) baseName = `doc-${doc._id.substring(0, 8)}`;

        let fileName = `${baseName}.md`;
        let counter = 1;

        while (usedNames.has(fileName)) {
            fileName = `${baseName}_${counter}.md`;
            counter++;
        }

        usedNames.add(fileName);
        folder.file(fileName, doc.content);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}-docs.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('success', 'Export Complete', `Successfully downloaded ZIP archive.`);
    } catch (error) {
      console.error(error);
      addToast('error', 'Export Failed', 'An unexpected error occurred during compression.');
    }
  };

  const handleExportAll = () => {
    const data = { projects, documents, userSettings, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `docusynth-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    addToast('success', 'Backup Exported', 'Full state exported.');
  };

  const performGeneration = async (topic: string, generationMode: 'search' | 'crawl' | 'github') => {
    setShowTaskView(false);

    // Use streaming mode if enabled
    if (useStreamingMode) {
      setShowStreamingView(true);
      setCurrentDocId(null);
      streaming.reset();
      await streaming.startGeneration(topic, generationMode, userSettings?.preferredProvider);
      setInputValue('');
      return;
    }

    // Non-streaming fallback
    setIsLoading(true);
    setStatusMessage('Initializing Agent...');

    try {
      const result = await generateDocAction({
        topic,
        mode: generationMode,
        projectId: activeProjectId || undefined,
      });

      setCurrentDocId(result.documentId);
      setInputValue('');
      addToast('success', 'Synthesis Complete', `Documentation ready for use.`);
    } catch (error: any) {
      setStatusMessage('Error: Generation failed.');
      addToast('error', 'Generation Failed', error.message || 'API Error.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerInputError = (msg: string) => {
    setInputError(true);
    setInputErrorMsg(msg);
    setInputShake(true);
    setTimeout(() => setInputShake(false), 400);
    setTimeout(() => { setInputError(false); setInputErrorMsg(''); }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      triggerInputError('Please enter a topic, URL, or repository.');
      return;
    }
    if (mode === 'crawl' && !isValidUrl(trimmedInput)) {
      triggerInputError('Please provide a valid URL for crawling.');
      return;
    }
    if (mode === 'crawl' && isAdvancedCrawl) {
        await handleLinkDiscovery();
        return;
    }
    await performGeneration(trimmedInput, mode);
  };

  const handleAddToQueue = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;
    if (!isValidUrl(trimmedInput)) {
        addToast('error', 'Invalid URL', 'Only URLs can be queued for background crawling.');
        return;
    }

    try {
      await createCrawlTask({
        url: trimmedInput,
        title: trimmedInput,
        projectId: activeProjectId || undefined,
      });
      setShowTaskView(true);
      setInputValue('');
      addToast('success', 'Task Queued', 'URL added to background crawler.');
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleSelectPreset = async ({ mode: presetMode, value }: { mode: 'search' | 'crawl' | 'github', value: string }) => {
    setMode(presetMode);
    setInputValue(value);
    await performGeneration(value, presetMode);
  };

  const handleGoHome = () => {
    setCurrentDocId(null);
    setShowTaskView(false);
    setShowStreamingView(false);
    setInputValue('');
    setIsLoading(false);
    streaming.reset();
  };

  const handleSaveStreamingDoc = async () => {
    const docId = await streaming.saveDocument();
    if (docId) {
      setCurrentDocId(docId);
      setShowStreamingView(false);
      streaming.reset();
      addToast('success', 'Document Saved', 'Streaming document saved to your library.');
    }
  };

  const handleRetryStreaming = () => {
    if (streaming.status === 'error') {
      streaming.reset();
      setShowStreamingView(false);
    }
  };

  const isValidUrl = (url: string) => { try { new URL(url); return true; } catch (e) { return false; } };

  const handleLinkDiscovery = async () => {
    setIsLoading(true);
    setStatusMessage('Scanning Links...');
    try {
        const result = await discoverLinksAction({
          url: inputValue,
          maxPages: userSettings?.crawlMaxPages,
          depth: userSettings?.crawlDepth,
          excludePatterns: userSettings?.crawlExcludePatterns,
        });
        const links = result?.links ?? [];
        if (links.length === 0) {
          addToast('warning', 'No Links Found', 'Could not discover any links from that URL. Try a different page or check the URL.');
        }
        setFoundLinks(links);
        setLinkModalTitle(undefined);
        setShowLinkModal(true);
    } catch (error: any) {
      addToast('error', 'Scan Failed', error.message || 'Network error.');
    }
    finally { setIsLoading(false); }
  };

  const handleBulkImport = (urls: string[]) => {
    const discoveredLinks: DiscoveredLink[] = urls.map(url => ({
        url,
        title: url
    }));
    setFoundLinks(discoveredLinks);
    setLinkModalTitle("Bulk Import List");
    setShowLinkModal(true);
  };

  const startBatchCrawl = async (selectedLinks: DiscoveredLink[]) => {
    try {
      await createCrawlBatch({
        links: selectedLinks.map(l => ({ url: l.url, title: l.title })),
        projectId: activeProjectId || undefined,
      });
      setShowLinkModal(false);
      setShowTaskView(true);
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleClearCompletedTasks = async () => {
    try {
      await clearCompletedTasks({});
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleCopyCurrentDoc = useCallback(() => {
    if (!currentDoc) return;
    navigator.clipboard.writeText(currentDoc.content);
    addToast('success', 'Content Copied', 'Full document text is now in your clipboard.');
  }, [currentDoc, addToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K: Open search
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }

      // Cmd/Ctrl + H: Go home
      if (isMeta && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleGoHome();
      }

      // Cmd/Ctrl + R: Refresh doc
      if (isMeta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (currentDoc && !isLoading) {
          handleRefreshDoc(currentDoc);
        }
      }

      // Cmd/Ctrl + C: Copy doc (when no selection)
      if (isMeta && e.key.toLowerCase() === 'c') {
        const selection = window.getSelection()?.toString();
        if (!selection && currentDoc) {
          e.preventDefault();
          handleCopyCurrentDoc();
        }
      }

      // Cmd/Ctrl + D: Delete doc
      if (isMeta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (currentDocId) {
          setDocToDelete(currentDocId);
        }
      }

      // Cmd/Ctrl + J: Open chat
      if (isMeta && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setShowChat(true);
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (showSearchModal) setShowSearchModal(false);
        else if (showChat) setShowChat(false);
        else if (showAnalytics) setShowAnalytics(false);
        else if (showTemplateGallery) setShowTemplateGallery(false);
        else if (showDiffViewer) setShowDiffViewer(false);
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [currentDoc, currentDocId, isLoading, handleRefreshDoc, handleCopyCurrentDoc, showSearchModal, showChat, showAnalytics, showTemplateGallery, showDiffViewer]);

  const handleSaveSettings = async (settings: any, crawlOptions?: any) => {
    try {
      // Save non-secret settings
      await upsertSettings({
        ollamaEndpoint: settings.ollamaEndpoint,
        ollamaBaseModel: settings.ollamaBaseModel,
        tabnineEnabled: settings.tabnineEnabled,
        cursorRulesEnabled: settings.cursorRulesEnabled,
        claudeModelPreference: settings.claudeModelPreference,
        geminiModelPreference: settings.geminiModelPreference,
        openAiEnabled: settings.openAiEnabled,
        openAiModelPreference: settings.openAiModelPreference,
        customSystemInstruction: settings.customSystemInstruction,
        ...(crawlOptions ? {
          crawlMaxPages: crawlOptions.maxPages,
          crawlDepth: crawlOptions.depth,
          crawlDelay: crawlOptions.delay,
          crawlExcludePatterns: crawlOptions.excludePatterns,
        } : {}),
      });

      // Save secrets securely with encryption if provided
      const secrets: any = {};
      if (settings.githubToken !== undefined) secrets.githubToken = settings.githubToken;
      if (settings.claudeApiKey !== undefined) secrets.claudeApiKey = settings.claudeApiKey;
      if (settings.openAiApiKey !== undefined) secrets.openAiApiKey = settings.openAiApiKey;

      if (Object.keys(secrets).length > 0) {
        await updateSecretsSecure(secrets);
      }

      addToast('success', 'Settings Saved', 'Your preferences have been updated.');
    } catch (e: any) {
      addToast('error', 'Error', e.message || 'Failed to save settings.');
    }
  };

  const mcpProject = projects.find((p: any) => p._id === mcpActiveProjectId);

  const openSettings = (tab: typeof settingsTab = 'local') => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  const activeTasksCount = crawlTasks.filter((t: any) => t.status === 'pending' || t.status === 'processing').length;

  // Map Convex documents to the shape components expect
  const historyForSidebar = documents.map((doc: any) => ({
    ...doc,
    id: doc._id,
  }));

  const projectsForSidebar = projects.map((p: any) => ({
    ...p,
    id: p._id,
  }));

  const currentDocForViewer = currentDoc ? {
    ...currentDoc,
    id: currentDoc._id,
  } : null;

  const tasksForManager = crawlTasks.map((t: any) => ({
    ...t,
    id: t._id,
    docId: t.documentId,
  }));

  return (
    <div className="flex h-screen bg-background text-main overflow-hidden transition-colors duration-200">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ProjectModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} onConfirm={handleCreateProject} />
      <MCPModal isOpen={showMCPModal} onClose={() => setShowMCPModal(false)} projectName={mcpProject?.name || ''} serverCode={mcpServerCode} visibility={mcpProject?.visibility || 'private'} />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={userSettings || {
          ollamaEndpoint: 'http://localhost:11434',
          ollamaBaseModel: 'llama3',
          tabnineEnabled: false,
          cursorRulesEnabled: false,
          claudeModelPreference: 'claude-sonnet-4-20250514',
          geminiModelPreference: 'gemini-2.0-flash',
          openAiEnabled: false,
          openAiModelPreference: 'gpt-4o',
          crawlMaxPages: 20,
          crawlDepth: 1,
          crawlDelay: 1000,
          crawlExcludePatterns: 'login, signup, auth, pricing, terms, privacy',
          preferredProvider: 'gemini' as const,
          hasGithubToken: false,
          hasClaudeApiKey: false,
          hasOpenAiApiKey: false,
        }}
        onSave={handleSaveSettings}
        initialTab={settingsTab}
        onOpenAPIKeys={() => setShowAPIKeysModal(true)}
        onOpenWebhooks={() => setShowWebhooksModal(true)}
        onOpenImports={() => setShowImportModal(true)}
      />
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onImport={handleBulkImport}
      />

      {/* Phase 3: Team Workspace Modals */}
      {showCreateWorkspaceModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspaceModal(false)}
          onCreated={(workspaceId) => {
            setCurrentWorkspaceId(workspaceId);
            setShowCreateWorkspaceModal(false);
            addToast('success', 'Workspace Created', 'Your new team workspace is ready!');
          }}
        />
      )}
      {showWorkspaceSettingsModal && workspaceToManage && (
        <WorkspaceSettingsModal
          workspaceId={workspaceToManage}
          onClose={() => {
            setShowWorkspaceSettingsModal(false);
            setWorkspaceToManage(null);
          }}
          onDeleted={() => {
            setCurrentWorkspaceId(null);
            addToast('info', 'Workspace Deleted', 'Workspace has been removed.');
          }}
        />
      )}

      {/* Phase 4: REST API & Webhooks Modals */}
      {showAPIKeysModal && (
        <APIKeysModal onClose={() => setShowAPIKeysModal(false)} />
      )}
      {showWebhooksModal && (
        <WebhooksModal
          workspaceId={currentWorkspaceId || undefined}
          onClose={() => setShowWebhooksModal(false)}
        />
      )}

      {/* Phase 6: External Imports Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={activeProjectId || undefined}
        onImportComplete={(documentIds) => {
          if (documentIds.length > 0) {
            setCurrentDocId(documentIds[0]);
          }
          addToast('success', 'Import Complete', `Successfully imported ${documentIds.length} document${documentIds.length !== 1 ? 's' : ''}`);
        }}
      />

      {/* Phase 5: Scheduled Updates Modal */}
      {showScheduleModal && scheduleDocumentId && currentDoc && (
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleDocumentId(null);
          }}
          documentId={scheduleDocumentId}
          documentTopic={currentDoc.topic}
        />
      )}

      {/* Phase 3: Comments Panel */}
      {currentDoc && (
        <CommentsPanel
          documentId={currentDoc._id}
          isOpen={showCommentsPanel}
          onClose={() => {
            setShowCommentsPanel(false);
            setCommentSelectedText(undefined);
            setCommentSelectionStart(undefined);
            setCommentSelectionEnd(undefined);
          }}
          selectedText={commentSelectedText}
          selectionStart={commentSelectionStart}
          selectionEnd={commentSelectionEnd}
        />
      )}

      {/* Phase 2-5 Feature Modals */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectDoc={(docId) => {
          setCurrentDocId(docId);
          setShowSearchModal(false);
          setShowTaskView(false);
        }}
      />
      {showDiffViewer && diffVersions && (
        <DiffViewer
          oldContent={diffVersions.old}
          newContent={diffVersions.new}
          oldLabel={diffVersions.oldLabel}
          newLabel={diffVersions.newLabel}
          onClose={() => {
            setShowDiffViewer(false);
            setDiffVersions(null);
          }}
        />
      )}
      <TemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelectTemplate={(content, name) => {
          setInputValue(name.replace('{TOPIC}', ''));
          addToast('info', 'Template Selected', `Using "${name}" template. Enter your topic and synthesize.`);
        }}
      />
      <AnalyticsDashboard
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        workspaceId={currentWorkspaceId || undefined}
      />
      <DocumentChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        documentId={currentDocId || undefined}
        projectId={activeProjectId || undefined}
        documentTitle={currentDoc?.topic}
        projectName={projects.find((p: any) => p._id === activeProjectId)?.name}
        chatType={currentDocId ? "document" : activeProjectId ? "project" : "knowledge_base"}
        onDocumentSelect={(docId) => {
          setCurrentDocId(docId);
          setShowChat(false);
        }}
      />
      {docToMove && (
        <MoveDocModal
          isOpen={showMoveModal}
          onClose={() => { setShowMoveModal(false); setDocToMove(null); }}
          doc={documents.find((d: any) => d._id === docToMove)}
          projects={projectsForSidebar}
          onMove={(docId: string, projectId: string | undefined) => handleMoveDoc(docId as Id<"documents">, projectId as Id<"projects"> | undefined)}
        />
      )}

      {/* GitHub Push Modal */}
      {currentDoc && (
        <GitHubPushModal
          isOpen={showGitHubModal}
          onClose={() => setShowGitHubModal(false)}
          onOpenSettings={() => { setShowGitHubModal(false); openSettings('cloud'); }}
          documentId={currentDoc._id}
          defaultTopic={currentDoc.topic}
        />
      )}

      <ConfirmationModal isOpen={isClearHistoryModalOpen} title="Wipe Data?" message="Delete all documents and projects permanently?" confirmLabel="Clear Everything" onConfirm={handleClearHistory} onCancel={() => setIsClearHistoryModalOpen(false)} variant="danger" />
      <ConfirmationModal isOpen={!!docToDelete} title="Delete Doc?" message="Delete this document?" confirmLabel="Delete" onConfirm={async () => { if (docToDelete) { await removeDocument({ id: docToDelete }); if (currentDocId === docToDelete) setCurrentDocId(null); setDocToDelete(null); } }} onCancel={() => setDocToDelete(null)} variant="danger" />
      <ConfirmationModal isOpen={!!projectToDelete} title="Delete Project?" message="Remove project folder. Docs stay in history." confirmLabel="Delete Project" onConfirm={handleConfirmDeleteProject} onCancel={() => setProjectToDelete(null)} variant="danger" />

      <HistorySidebar
        history={historyForSidebar} projects={projectsForSidebar} activeProjectId={activeProjectId as string | null}
        onSelectProject={(id) => setActiveProjectId(id as Id<"projects"> | null)}
        onCreateProject={() => setShowProjectModal(true)}
        onSelectDoc={(doc) => { setCurrentDocId(doc._id || doc.id); setShowTaskView(false); }}
        onDeleteDoc={(id, e) => { e.stopPropagation(); setDocToDelete(id as Id<"documents">); }}
        onMoveDoc={(doc, e) => { e.stopPropagation(); setDocToMove(doc._id || doc.id); setShowMoveModal(true); }}
        onDropDoc={(docId, projectId) => handleMoveDoc(docId as Id<"documents">, projectId as Id<"projects"> | undefined)}
        onReorderProjects={handleReorderProjects}
        onDeleteProject={(id, e) => handleDeleteProjectTrigger(id as Id<"projects">, e)}
        onGenerateMCP={handleGenerateMCP}
        onExportProject={handleExportProject}
        onClear={() => setIsClearHistoryModalOpen(true)}
        onExportAll={handleExportAll} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        recentSearches={recentSearches.map((s: any) => s.query)}
        onReRunSearch={(q) => {
          setInputValue(q);
          const autoMode = q.toLowerCase().includes('github.com/') ? 'github' : (q.startsWith('http') ? 'crawl' : 'search');
          performGeneration(q, autoMode);
        }}
        onClearRecentSearches={() => clearRecentSearches({})}
        onGoHome={handleGoHome}
        workspaceSwitcher={
          <WorkspaceSwitcher
            currentWorkspaceId={currentWorkspaceId}
            onWorkspaceChange={(id) => {
              setCurrentWorkspaceId(id);
              setActiveProjectId(null);
              setCurrentDocId(null);
            }}
            onCreateWorkspace={() => setShowCreateWorkspaceModal(true)}
            onManageWorkspace={(id) => {
              setWorkspaceToManage(id);
              setShowWorkspaceSettingsModal(true);
            }}
          />
        }
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center px-6 bg-surface/80 backdrop-blur-md justify-between z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 -ml-2 text-secondary hover:text-main" aria-label="Open sidebar">
              <Icons.History className="w-5 h-5" />
            </button>
            <button onClick={handleGoHome} className="flex items-center gap-2.5 group transition-all">
              <div className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Icons.Cpu className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-main group-hover:text-primary transition-colors">DocuSynth</h1>
            </button>
          </div>
          <div className="flex items-center gap-3">
             {activeTasksCount > 0 && !showTaskView && (
               <button
                  onClick={() => setShowTaskView(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:border-primary/50 text-main rounded-xl text-xs font-bold transition-all animate-fadeIn shadow-sm"
               >
                 <div className="relative w-2 h-2">
                    <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-0 bg-primary rounded-full"></div>
                 </div>
                 {activeTasksCount} Tasks Running...
               </button>
             )}

             {(currentDoc || showTaskView) && (
               <button
                  onClick={handleGoHome}
                  className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
               >
                 <Icons.Plus className="w-3.5 h-3.5" />
                 New Synthesis
               </button>
             )}

             {activeProjectId && (
               <div className="hidden md:flex items-center gap-2 px-1.5 py-1 bg-primary/5 rounded-full border border-primary/10">
                 <div className="flex items-center gap-2 px-2">
                    <Icons.Folder className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        {projects.find((p: any) => p._id === activeProjectId)?.name}
                    </span>
                 </div>
                 <div className="h-3 w-px bg-primary/20"></div>
                 <button
                    onClick={(e) => {
                        const proj = projects.find((p: any) => p._id === activeProjectId);
                        if (proj) handleExportProject(proj, e);
                    }}
                    className="p-1 text-primary hover:text-emerald-700 hover:bg-primary/10 rounded-full transition-colors"
                    title="Export Project"
                 >
                    <Icons.Download className="w-3 h-3" />
                 </button>
                 <button onClick={() => setActiveProjectId(null)} className="text-primary hover:text-emerald-700 p-1 hover:bg-primary/10 rounded-full transition-colors" aria-label="Close project">
                    <Icons.X className="w-3 h-3" />
                 </button>
               </div>
             )}

             {/* Search Button */}
             <button
                onClick={() => setShowSearchModal(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:border-primary/50 rounded-xl text-xs text-secondary hover:text-main transition-all"
                title="Search Documents (⌘K)"
             >
                <Icons.Search className="w-4 h-4" />
                <span className="hidden lg:inline">Search</span>
                <kbd className="hidden lg:inline px-1.5 py-0.5 bg-surface border border-border rounded text-[9px] font-mono ml-1">⌘K</kbd>
             </button>

             {/* Chat Button */}
             <Tooltip label="AI Chat" shortcut="⌘J">
               <button
                  onClick={() => setShowChat(true)}
                  className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]"
                  aria-label="AI Chat"
               >
                  <Icons.Sparkles className="w-5 h-5" />
               </button>
             </Tooltip>

             {/* Templates Button */}
             <Tooltip label="Templates">
               <button
                  onClick={() => setShowTemplateGallery(true)}
                  className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]"
                  aria-label="Template Gallery"
               >
                  <Icons.Folder className="w-5 h-5" />
               </button>
             </Tooltip>

             {/* Analytics Button */}
             <Tooltip label="Analytics">
               <button
                  onClick={() => setShowAnalytics(true)}
                  className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]"
                  aria-label="Analytics Dashboard"
               >
                  <Icons.Chart className="w-5 h-5" />
               </button>
             </Tooltip>

             <Tooltip label="Shortcuts">
               <button
                  onClick={() => {
                      const shortcuts = `
Keyboard Shortcuts:
⌘/Ctrl + K : Search Documents
⌘/Ctrl + J : AI Chat
⌘/Ctrl + H : Return Home
⌘/Ctrl + R : Refresh Content
⌘/Ctrl + C : Copy Full Document
⌘/Ctrl + D : Delete Document
                      `;
                      addToast('info', 'Keyboard Shortcuts', shortcuts);
                  }}
                  className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]"
                  aria-label="View shortcuts"
               >
                  <Icons.Keyboard className="w-5 h-5" />
               </button>
             </Tooltip>

             <Tooltip label="Settings">
               <button onClick={() => openSettings('local')} className="p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]" aria-label="Settings"><Icons.Settings className="w-5 h-5" /></button>
             </Tooltip>
             <Tooltip label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
               <button onClick={toggleTheme} className="p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-all active:scale-[0.97]" aria-label="Toggle theme">
                  {theme === 'dark' ? <Icons.Sun className="w-5 h-5" /> : <Icons.Moon className="w-5 h-5" />}
               </button>
             </Tooltip>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background flex flex-col">
          <ErrorBoundary>
            {showLinkModal && <LinkSelectionModal links={foundLinks} onConfirm={startBatchCrawl} onCancel={() => setShowLinkModal(false)} baseUrl={inputValue} title={linkModalTitle} />}

            {showTaskView ? (
                <TaskProgressManager
                  tasks={tasksForManager}
                  onViewDoc={(id) => { setCurrentDocId(id as Id<"documents">); setShowTaskView(false); }}
                  onClose={() => setShowTaskView(false)}
                  crawlDelay={userSettings?.crawlDelay || 1000}
                  onClearCompleted={handleClearCompletedTasks}
                />
            ) : (
              <div className={`flex-1 flex flex-col ${!currentDoc && !isLoading && !showStreamingView ? 'items-center justify-center' : ''}`}>
                  {!currentDoc && !isLoading && !showStreamingView && (
                      <div className="w-full flex flex-col items-center p-6 animate-fadeIn max-w-5xl mx-auto pb-24">
                        <div className="text-center mb-12">
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary font-bold text-[11px] uppercase tracking-widest mb-6 shadow-sm shadow-primary/5">
                            <Icons.Sparkles className="w-3.5 h-3.5" />
                            Grounding AI Context
                          </div>
                          <h2 className="text-4xl lg:text-5xl font-extrabold text-main mb-5 tracking-tight leading-[1.1]">
                            Knowledge Synthesis
                          </h2>
                          <p className="text-secondary max-w-lg mx-auto text-base leading-relaxed">
                            Generate dense, up-to-date documentation context for LLMs and AI code editors. Ground your models in reality.
                          </p>
                        </div>

                        <div className="w-full max-w-2xl bg-surface border border-border p-8 rounded-3xl shadow-theme-lg">
                            <div className="flex justify-center mb-8">
                              <div className="relative inline-flex gap-1 p-1 bg-surface-hover/70 border border-border rounded-2xl">
                                <button onClick={() => setMode('search')} className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${mode === 'search' ? 'text-white' : 'text-main/60 hover:text-main'}`}><Icons.Search className="w-4 h-4" />Search</button>
                                <button onClick={() => setMode('crawl')} className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${mode === 'crawl' ? 'text-white' : 'text-main/60 hover:text-main'}`}><Icons.Globe className="w-4 h-4" />Crawl</button>
                                <button onClick={() => setMode('github')} className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${mode === 'github' ? 'text-white dark:text-zinc-900' : 'text-main/60 hover:text-main'}`}><Icons.GitHub className="w-4 h-4" />Repo</button>
                                {/* Sliding indicator */}
                                <div
                                  className={`absolute top-1 bottom-1 rounded-xl shadow-md transition-all duration-300 ease-out ${
                                    mode === 'github' ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-primary'
                                  }`}
                                  style={{
                                    left: mode === 'search' ? '4px' : mode === 'crawl' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 0px)',
                                    width: 'calc(33.33% - 4px)',
                                  }}
                                />
                              </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div className={`relative ${inputShake ? 'animate-shake' : ''}`}>
                                  <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => { setInputValue(e.target.value); if (inputError) { setInputError(false); setInputErrorMsg(''); } }}
                                    placeholder={mode === 'github' ? "Repository URL..." : mode === 'search' ? "Framework or library name..." : "Documentation root URL..."}
                                    className={`w-full bg-background border rounded-2xl py-4 pl-12 pr-40 text-main focus:outline-none focus:ring-4 transition-all text-base ${inputError ? 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500/20' : 'border-border focus:border-primary focus:ring-primary/20'}`}
                                    aria-label="Documentation source"
                                  />
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary">
                                      {mode === 'github' ? <Icons.GitHub className="w-5 h-5" /> : mode === 'search' ? <Icons.Search className="w-5 h-5" /> : <Icons.Globe className="w-5 h-5" />}
                                  </div>
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={handleAddToQueue}
                                      disabled={!inputValue.trim() || mode === 'search'}
                                      className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-secondary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Add to Background Queue"
                                    >
                                        <Icons.Plus className="w-4 h-4" />
                                    </button>
                                    <button type="submit" disabled={!inputValue.trim()} className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-[0.97]">
                                      Synthesize
                                    </button>
                                  </div>
                              </div>
                              {inputErrorMsg && (
                                <div className="flex items-center gap-2 px-2 animate-slideUp">
                                  <Icons.AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  <span className="text-xs text-red-500 font-medium">{inputErrorMsg}</span>
                                </div>
                              )}

                              {/* Streaming Toggle */}
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => setUseStreamingMode(!useStreamingMode)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                    useStreamingMode
                                      ? 'bg-primary/10 border-primary text-primary'
                                      : 'bg-surface-hover border-border text-secondary hover:text-main'
                                  }`}
                                  title="Toggle streaming mode for real-time document generation preview"
                                >
                                  {useStreamingMode ? <Icons.CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-current" />}
                                  Stream Mode
                                  <span className="text-[8px] ml-1 opacity-60">(Real-time Preview)</span>
                                </button>
                              </div>

                              {mode === 'crawl' && (
                                  <div className="flex justify-center items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setIsAdvancedCrawl(!isAdvancedCrawl)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${isAdvancedCrawl ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-hover border-border text-secondary hover:text-main'}`}
                                      >
                                        {isAdvancedCrawl ? <Icons.CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-current" />}
                                        Recursive Link Discovery
                                      </button>
                                      <div className="h-4 w-px bg-border mx-1"></div>
                                      <button
                                        type="button"
                                        onClick={() => setShowBulkImportModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border bg-surface-hover border-border text-secondary hover:text-main"
                                        title="Bulk Import URLs"
                                      >
                                        <Icons.CloudUpload className="w-3.5 h-3.5" />
                                        Bulk Import
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openSettings('crawler')}
                                        className="p-2 text-secondary hover:text-primary transition-colors"
                                        title="Crawler Settings"
                                      >
                                        <Icons.Settings className="w-4 h-4" />
                                      </button>
                                  </div>
                              )}
                            </form>
                        </div>

                        <PresetsGallery onSelect={handleSelectPreset} history={historyForSidebar} />
                      </div>
                  )}

                  {isLoading && !showStreamingView && (
                    <LoadingScreen message={statusMessage} />
                  )}

                  {showStreamingView && (streaming.status === 'pending' || streaming.status === 'streaming' || streaming.status === 'completed' || streaming.status === 'error') && (
                    <div className="flex-1 flex flex-col overflow-hidden p-6 h-full">
                      <StreamingDocViewer
                        content={streaming.content}
                        status={streaming.status}
                        progress={streaming.progress}
                        provider={streaming.provider}
                        model={streaming.model}
                        sources={streaming.sources}
                        error={streaming.error}
                        onCancel={() => {
                          streaming.cancelGeneration();
                          setShowStreamingView(false);
                        }}
                        onSave={handleSaveStreamingDoc}
                        onRetry={() => {
                          streaming.reset();
                          setShowStreamingView(false);
                        }}
                      />
                    </div>
                  )}

                  {currentDoc && !isLoading && !showStreamingView && (
                      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-8 h-full">
                          <div className="flex-1 h-full min-h-0 bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            <MarkdownViewer
                              doc={currentDocForViewer} integrationSettings={userSettings || {}}
                              onRefresh={() => handleRefreshDoc(currentDoc)}
                              onRevert={(docId, version) => handleRevertVersion(docId as Id<"documents">, version as any)}
                              onUpdateVisibility={(docId, vis) => handleUpdateDocVisibility(docId as Id<"documents">, vis)}
                              onUpdateContent={(docId, content) => handleUpdateDocContent(docId as Id<"documents">, content)}
                              onMove={() => { setDocToMove(currentDoc._id); setShowMoveModal(true); }}
                              onPushToGitHub={() => setShowGitHubModal(true)}
                              onOpenSchedule={() => { setScheduleDocumentId(currentDoc._id); setShowScheduleModal(true); }}
                              onOpenComments={(selectedText, start, end) => {
                                setCommentSelectedText(selectedText);
                                setCommentSelectionStart(start);
                                setCommentSelectionEnd(end);
                                setShowCommentsPanel(true);
                              }}
                              onEditingStateChange={(editing) => presence.setIsEditing(editing)}
                              collaborators={presence.presence.map(p => ({
                                userName: p.userName,
                                userColor: p.userColor,
                                isEditing: p.isEditing,
                              }))}
                            />
                          </div>
                          <aside className="w-full lg:w-72 flex flex-col gap-6 overflow-y-auto lg:h-full lg:sticky lg:top-0 pb-10 shrink-0">
                            {/* Real-time Presence */}
                            {presence.allPresence.length > 0 && (
                              <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
                                <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <Icons.Users className="w-3.5 h-3.5" /> Active Viewers
                                </h3>
                                <PresenceAvatars
                                  users={presence.allPresence.map(p => ({
                                    id: p.id,
                                    userId: p.userId,
                                    userName: p.userName,
                                    userImage: p.userImage,
                                    userColor: p.userColor,
                                    isEditing: p.isEditing,
                                    isCurrentUser: p.isCurrentUser,
                                  }))}
                                  maxDisplay={6}
                                  showEditingIndicator={true}
                                />
                              </div>
                            )}

                            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                                <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Icons.Info className="w-3.5 h-3.5" /> Sources
                                </h3>
                                {currentDoc.sources.length > 0 ? (
                                    <ul className="space-y-2">
                                    {currentDoc.sources.map((source: any, i: number) => (
                                        <li key={i}>
                                        <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-background border border-border text-[11px] font-bold text-primary hover:border-primary/60 hover:bg-surface-hover transition-all group">
                                            <span className="truncate">{source.title}</span>
                                            <Icons.ArrowUpToLine className="w-3 h-3 text-secondary opacity-0 group-hover:opacity-100 transition-opacity rotate-90 shrink-0" />
                                        </a>
                                        </li>
                                    ))}
                                    </ul>
                                ) : <p className="text-xs text-secondary italic">AI Synthesized context.</p>}
                            </div>

                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-main mb-2">How to Use</h3>
                                <p className="text-[11px] text-secondary leading-relaxed mb-4">
                                    Paste the contents of this file into your AI tool's project settings (like Cursor Rules or Claude Projects) to give it current knowledge.
                                </p>

                                <div className="space-y-2">
                                  <button onClick={() => setCurrentDocId(null)} className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.97]">
                                      <Icons.Plus className="w-3.5 h-3.5" />
                                      New Context
                                  </button>

                                  <div className="p-3 bg-surface/50 border border-border rounded-xl">
                                    <h4 className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-2">Quick Reference</h4>
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[10px] px-2 py-1.5 -mx-2 rounded-lg hover:bg-surface-hover transition-colors">
                                        <span className="text-secondary font-medium">Refresh</span>
                                        <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[8px] font-mono text-main font-bold">⌘R</kbd>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] px-2 py-1.5 -mx-2 rounded-lg hover:bg-surface-hover transition-colors">
                                        <span className="text-secondary font-medium">Copy All</span>
                                        <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[8px] font-mono text-main font-bold">⌘C</kbd>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] px-2 py-1.5 -mx-2 rounded-lg hover:bg-surface-hover transition-colors">
                                        <span className="text-secondary font-medium">Delete</span>
                                        <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[8px] font-mono text-main font-bold">⌘D</kbd>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            </div>
                          </aside>
                      </div>
                  )}
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default App;

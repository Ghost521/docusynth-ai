import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

type SourceType = 'notion' | 'confluence';
type TabType = 'connect' | 'browse' | 'jobs';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: Id<"projects">;
  onImportComplete?: (documentIds: Id<"documents">[]) => void;
}

interface NotionItem {
  id: string;
  type: string;
  title: string;
  icon: string | null;
  lastEditedTime: string;
  url: string;
  parentType: string;
  parentId: string;
}

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  description: string;
  type: string;
  url: string;
}

interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  status: string;
  lastUpdated: string;
  url: string;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onImportComplete,
}) => {
  const [sourceType, setSourceType] = useState<SourceType>('notion');
  const [activeTab, setActiveTab] = useState<TabType>('connect');
  const [selectedSourceId, setSelectedSourceId] = useState<Id<"importSources"> | null>(null);

  // Connection form state
  const [connectionName, setConnectionName] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [confluenceUrl, setConfluenceUrl] = useState('');
  const [confluenceEmail, setConfluenceEmail] = useState('');
  const [confluenceToken, setConfluenceToken] = useState('');

  // Browse state
  const [notionItems, setNotionItems] = useState<NotionItem[]>([]);
  const [notionCursor, setNotionCursor] = useState<string | undefined>();
  const [notionHasMore, setNotionHasMore] = useState(false);
  const [confluenceSpaces, setConfluenceSpaces] = useState<ConfluenceSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ConfluenceSpace | null>(null);
  const [confluencePages, setConfluencePages] = useState<ConfluencePage[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Loading states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Convex queries
  const sources = useQuery(api.imports.listSources, { sourceType }) || [];
  const jobs = useQuery(api.imports.listJobs, selectedSourceId ? { sourceId: selectedSourceId } : {}) || [];

  // Convex mutations
  const createSource = useMutation(api.imports.createSource);
  const updateCredentials = useMutation(api.imports.updateSourceCredentials);
  const deleteSource = useMutation(api.imports.deleteSource);
  const createJob = useMutation(api.imports.createJob);
  const cancelJob = useMutation(api.imports.cancelJob);

  // Convex actions
  const testNotionConnection = useAction(api.imports.testNotionConnection);
  const testConfluenceConnection = useAction(api.imports.testConfluenceConnection);
  const browseNotion = useAction(api.imports.browseNotion);
  const browseConfluenceSpaces = useAction(api.imports.browseConfluenceSpaces);
  const browseConfluencePages = useAction(api.imports.browseConfluencePages);
  const startImport = useAction(api.imports.startImport);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedItems(new Set());
      setTestResult(null);
      setNotionItems([]);
      setConfluenceSpaces([]);
      setConfluencePages([]);
      setSelectedSpace(null);
    }
  }, [isOpen]);

  // Auto-select first source if available
  useEffect(() => {
    if (sources.length > 0 && !selectedSourceId) {
      setSelectedSourceId(sources[0]._id);
    }
  }, [sources, selectedSourceId]);

  if (!isOpen) return null;

  const handleCreateSource = async () => {
    if (!connectionName.trim()) return;
    setIsConnecting(true);
    try {
      const id = await createSource({
        sourceType,
        name: connectionName,
      });
      setSelectedSourceId(id);
      setConnectionName('');
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedSourceId) return;
    setIsConnecting(true);
    try {
      if (sourceType === 'notion') {
        await updateCredentials({
          id: selectedSourceId,
          accessToken: notionToken,
        });
      } else {
        await updateCredentials({
          id: selectedSourceId,
          baseUrl: confluenceUrl,
          email: confluenceEmail,
          apiToken: confluenceToken,
        });
      }
      setNotionToken('');
      setConfluenceToken('');
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedSourceId) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = sourceType === 'notion'
        ? await testNotionConnection({ sourceId: selectedSourceId })
        : await testConfluenceConnection({ sourceId: selectedSourceId });

      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected as ${(result.user as any)?.name || (result.user as any)?.displayName}`
          : result.error || 'Connection failed',
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteSource = async (id: Id<"importSources">) => {
    try {
      await deleteSource({ id });
      if (selectedSourceId === id) {
        setSelectedSourceId(null);
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleBrowse = async () => {
    if (!selectedSourceId) return;
    setIsBrowsing(true);
    setActiveTab('browse');
    try {
      if (sourceType === 'notion') {
        const result = await browseNotion({ sourceId: selectedSourceId });
        setNotionItems(result.items);
        setNotionCursor(result.nextCursor);
        setNotionHasMore(result.hasMore);
      } else {
        const result = await browseConfluenceSpaces({ sourceId: selectedSourceId });
        setConfluenceSpaces(result.spaces);
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleLoadMoreNotion = async () => {
    if (!selectedSourceId || !notionCursor) return;
    setIsBrowsing(true);
    try {
      const result = await browseNotion({
        sourceId: selectedSourceId,
        cursor: notionCursor,
      });
      setNotionItems([...notionItems, ...result.items]);
      setNotionCursor(result.nextCursor);
      setNotionHasMore(result.hasMore);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSelectSpace = async (space: ConfluenceSpace) => {
    if (!selectedSourceId) return;
    setSelectedSpace(space);
    setIsBrowsing(true);
    try {
      const result = await browseConfluencePages({
        sourceId: selectedSourceId,
        spaceKey: space.key,
      });
      setConfluencePages(result.pages);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsBrowsing(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleStartImport = async () => {
    if (!selectedSourceId || selectedItems.size === 0) return;
    setIsImporting(true);
    try {
      const pageIds = Array.from(selectedItems);
      const pageTitles = pageIds.map(id => {
        if (sourceType === 'notion') {
          return notionItems.find(item => item.id === id)?.title || id;
        } else {
          return confluencePages.find(page => page.id === id)?.title || id;
        }
      });

      const jobId = await createJob({
        sourceId: selectedSourceId,
        projectId,
        importType: 'batch',
        sourcePageIds: pageIds,
        sourcePageTitles: pageTitles,
      });

      // Start the import
      const result = await startImport({ jobId });

      if (result.documentIds.length > 0 && onImportComplete) {
        onImportComplete(result.documentIds);
      }

      setSelectedItems(new Set());
      setActiveTab('jobs');
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelJob = async (jobId: Id<"importJobs">) => {
    try {
      await cancelJob({ id: jobId });
    } catch (error: any) {
      console.error(error);
    }
  };

  const selectedSource = sources.find(s => s._id === selectedSourceId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
        {/* Header */}
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Import className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main leading-tight">Import Documents</h2>
              <p className="text-xs text-secondary">Import from Notion or Confluence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-48 border-r border-border bg-surface-hover/10 p-4 space-y-4 shrink-0">
            {/* Source Type Toggle */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Source</label>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setSourceType('notion');
                    setSelectedSourceId(null);
                    setActiveTab('connect');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    sourceType === 'notion'
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icons.Notion className="w-4 h-4" />
                  Notion
                </button>
                <button
                  onClick={() => {
                    setSourceType('confluence');
                    setSelectedSourceId(null);
                    setActiveTab('connect');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    sourceType === 'confluence'
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icons.Confluence className="w-4 h-4" />
                  Confluence
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Actions</label>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('connect')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === 'connect'
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icons.Link className="w-4 h-4" />
                  Connect
                </button>
                <button
                  onClick={handleBrowse}
                  disabled={!selectedSource?.isActive}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === 'browse'
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Icons.FolderOpen className="w-4 h-4" />
                  Browse
                </button>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === 'jobs'
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icons.History className="w-4 h-4" />
                  Jobs
                  {jobs.filter(j => j.status === 'running' || j.status === 'pending').length > 0 && (
                    <span className="ml-auto text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">
                      {jobs.filter(j => j.status === 'running' || j.status === 'pending').length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Connected Sources */}
            {sources.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Connections</label>
                <div className="flex flex-col gap-1">
                  {sources.map(source => (
                    <button
                      key={source._id}
                      onClick={() => setSelectedSourceId(source._id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedSourceId === source._id
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'text-secondary hover:bg-surface-hover border border-transparent'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${source.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="truncate flex-1 text-left">{source.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-background">
            {/* Connect Tab */}
            {activeTab === 'connect' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Create New Connection */}
                {!selectedSource && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-main uppercase tracking-widest">
                      Create {sourceType === 'notion' ? 'Notion' : 'Confluence'} Connection
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                          Connection Name
                        </label>
                        <input
                          type="text"
                          value={connectionName}
                          onChange={(e) => setConnectionName(e.target.value)}
                          placeholder="My Workspace"
                          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                      <button
                        onClick={handleCreateSource}
                        disabled={!connectionName.trim() || isConnecting}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
                      >
                        {isConnecting ? 'Creating...' : 'Create Connection'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Configure Selected Source */}
                {selectedSource && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-main uppercase tracking-widest">
                        Configure: {selectedSource.name}
                      </h3>
                      <button
                        onClick={() => handleDeleteSource(selectedSource._id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Notion Credentials */}
                    {sourceType === 'notion' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-surface border border-border rounded-xl space-y-3">
                          <div className="flex items-start gap-3">
                            <Icons.Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div className="text-xs text-secondary">
                              <p className="font-medium text-main mb-1">How to get your Notion Integration Token:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-primary hover:underline">notion.so/my-integrations</a></li>
                                <li>Create a new integration</li>
                                <li>Copy the "Internal Integration Token"</li>
                                <li>Share the pages you want to import with your integration</li>
                              </ol>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                              Integration Token
                            </label>
                            {selectedSource.accessToken && (
                              <span className="text-[10px] text-green-500 font-bold">Configured</span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={notionToken}
                            onChange={(e) => setNotionToken(e.target.value)}
                            placeholder={selectedSource.accessToken ? '********' : 'secret_...'}
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {/* Confluence Credentials */}
                    {sourceType === 'confluence' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-surface border border-border rounded-xl space-y-3">
                          <div className="flex items-start gap-3">
                            <Icons.Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div className="text-xs text-secondary">
                              <p className="font-medium text-main mb-1">How to get your Confluence API Token:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="text-primary hover:underline">Atlassian API Tokens</a></li>
                                <li>Create a new API token</li>
                                <li>Enter your Confluence URL (e.g., https://your-domain.atlassian.net)</li>
                              </ol>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                            Confluence URL
                          </label>
                          <input
                            type="url"
                            value={confluenceUrl}
                            onChange={(e) => setConfluenceUrl(e.target.value)}
                            placeholder="https://your-domain.atlassian.net"
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                            Email
                          </label>
                          <input
                            type="email"
                            value={confluenceEmail}
                            onChange={(e) => setConfluenceEmail(e.target.value)}
                            placeholder="your-email@company.com"
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                              API Token
                            </label>
                            {selectedSource.apiToken && (
                              <span className="text-[10px] text-green-500 font-bold">Configured</span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={confluenceToken}
                            onChange={(e) => setConfluenceToken(e.target.value)}
                            placeholder={selectedSource.apiToken ? '********' : 'Your API token'}
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveCredentials}
                        disabled={isConnecting || (sourceType === 'notion' ? !notionToken : !confluenceToken)}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
                      >
                        {isConnecting ? 'Saving...' : 'Save Credentials'}
                      </button>
                      <button
                        onClick={handleTestConnection}
                        disabled={isTesting || !selectedSource.isActive}
                        className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                      <div className={`p-4 rounded-xl border ${
                        testResult.success
                          ? 'bg-green-500/10 border-green-500/30 text-green-600'
                          : 'bg-red-500/10 border-red-500/30 text-red-600'
                      }`}>
                        <div className="flex items-center gap-2">
                          {testResult.success ? (
                            <Icons.CheckCircle className="w-5 h-5" />
                          ) : (
                            <Icons.AlertTriangle className="w-5 h-5" />
                          )}
                          <span className="text-sm font-medium">{testResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Browse Tab */}
            {activeTab === 'browse' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest">
                    {sourceType === 'notion' ? 'Notion Pages' : selectedSpace ? `Pages in ${selectedSpace.name}` : 'Confluence Spaces'}
                  </h3>
                  {selectedSpace && (
                    <button
                      onClick={() => {
                        setSelectedSpace(null);
                        setConfluencePages([]);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Back to Spaces
                    </button>
                  )}
                </div>

                {isBrowsing && (notionItems.length === 0 && confluenceSpaces.length === 0 && confluencePages.length === 0) ? (
                  <div className="flex items-center justify-center py-12">
                    <Icons.Loader className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Notion Items */}
                    {sourceType === 'notion' && (
                      <div className="space-y-2">
                        {notionItems.map(item => (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedItems.has(item.id)
                                ? 'bg-primary/10 border-primary'
                                : 'bg-surface border-border hover:border-primary/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItemSelection(item.id)}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-lg">{item.icon || (item.type === 'database' ? '📊' : '📄')}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-main truncate">{item.title}</p>
                              <p className="text-[10px] text-secondary">
                                {item.type === 'database' ? 'Database' : 'Page'} • Last edited {new Date(item.lastEditedTime).toLocaleDateString()}
                              </p>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-secondary hover:text-primary"
                            >
                              <Icons.ExternalLink className="w-4 h-4" />
                            </a>
                          </label>
                        ))}
                        {notionHasMore && (
                          <button
                            onClick={handleLoadMoreNotion}
                            disabled={isBrowsing}
                            className="w-full py-2 text-sm text-primary hover:underline disabled:opacity-50"
                          >
                            {isBrowsing ? 'Loading...' : 'Load More'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Confluence Spaces */}
                    {sourceType === 'confluence' && !selectedSpace && (
                      <div className="space-y-2">
                        {confluenceSpaces.map(space => (
                          <button
                            key={space.id}
                            onClick={() => handleSelectSpace(space)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border bg-surface border-border hover:border-primary/50 text-left transition-all"
                          >
                            <Icons.Folder className="w-5 h-5 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-main">{space.name}</p>
                              <p className="text-[10px] text-secondary truncate">
                                {space.key} • {space.description || 'No description'}
                              </p>
                            </div>
                            <Icons.ChevronRight className="w-4 h-4 text-secondary" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Confluence Pages */}
                    {sourceType === 'confluence' && selectedSpace && (
                      <div className="space-y-2">
                        {confluencePages.map(page => (
                          <label
                            key={page.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedItems.has(page.id)
                                ? 'bg-primary/10 border-primary'
                                : 'bg-surface border-border hover:border-primary/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(page.id)}
                              onChange={() => toggleItemSelection(page.id)}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <Icons.FileText className="w-5 h-5 text-secondary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-main truncate">{page.title}</p>
                              <p className="text-[10px] text-secondary">
                                {page.lastUpdated ? `Last updated ${new Date(page.lastUpdated).toLocaleDateString()}` : 'Page'}
                              </p>
                            </div>
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-secondary hover:text-primary"
                            >
                              <Icons.ExternalLink className="w-4 h-4" />
                            </a>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Empty States */}
                    {sourceType === 'notion' && notionItems.length === 0 && !isBrowsing && (
                      <div className="text-center py-12 text-secondary">
                        <Icons.FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No pages found. Make sure you've shared pages with your integration.</p>
                      </div>
                    )}

                    {sourceType === 'confluence' && !selectedSpace && confluenceSpaces.length === 0 && !isBrowsing && (
                      <div className="text-center py-12 text-secondary">
                        <Icons.FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No spaces found. Check your Confluence connection.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-main uppercase tracking-widest">Import History</h3>

                {jobs.length === 0 ? (
                  <div className="text-center py-12 text-secondary">
                    <Icons.History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No import jobs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map(job => (
                      <div
                        key={job._id}
                        className="p-4 rounded-xl border bg-surface border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              job.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                              job.status === 'running' ? 'bg-blue-500/20 text-blue-600' :
                              job.status === 'failed' ? 'bg-red-500/20 text-red-600' :
                              job.status === 'cancelled' ? 'bg-gray-500/20 text-gray-600' :
                              'bg-yellow-500/20 text-yellow-600'
                            }`}>
                              {job.status}
                            </span>
                            <span className="text-xs text-secondary">
                              {job.sourceType} • {job.importType}
                            </span>
                          </div>
                          <span className="text-[10px] text-secondary">
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        {(job.status === 'running' || job.status === 'pending') && (
                          <div className="mb-2">
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${(job.processedItems / job.totalItems) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-secondary">
                            {job.successfulItems} of {job.totalItems} imported
                            {job.failedItems > 0 && (
                              <span className="text-red-500 ml-1">({job.failedItems} failed)</span>
                            )}
                          </span>
                          {(job.status === 'pending' || job.status === 'running') && (
                            <button
                              onClick={() => handleCancelJob(job._id)}
                              className="text-red-500 hover:text-red-600 font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {/* Errors */}
                        {job.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-red-500/10 rounded-lg">
                            <p className="text-[10px] text-red-600 font-medium mb-1">Errors:</p>
                            {job.errors.slice(0, 3).map((error, i) => (
                              <p key={i} className="text-[10px] text-red-500 truncate">
                                {error.pageTitle}: {error.error}
                              </p>
                            ))}
                            {job.errors.length > 3 && (
                              <p className="text-[10px] text-red-500">...and {job.errors.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 bg-surface-hover/30 border-t border-border flex items-center justify-between">
          <div className="text-xs text-secondary">
            {selectedItems.size > 0 && (
              <span>{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all"
            >
              Close
            </button>
            {activeTab === 'browse' && selectedItems.size > 0 && (
              <button
                onClick={handleStartImport}
                disabled={isImporting}
                className="px-6 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Icons.Loader className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Icons.Import className="w-4 h-4" />
                    Import {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ImportModal;

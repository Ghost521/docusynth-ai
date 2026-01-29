
import React, { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  documentId: Id<"documents">;
  defaultTopic: string;
}

const GitHubPushModal: React.FC<GitHubPushModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  documentId,
  defaultTopic,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [username, setUsername] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [newRepoDesc, setNewRepoDesc] = useState(`Documentation context for ${defaultTopic}`);

  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');

  const [path, setPath] = useState('');
  const [message, setMessage] = useState(`Update docs for ${defaultTopic}`);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checkTokenAction = useAction(api.githubActions.checkToken);
  const createRepoAction = useAction(api.githubActions.createRepo);
  const pushAction = useAction(api.githubActions.pushToGitHub);
  const checkRepoAction = useAction(api.githubActions.checkRepoExists);

  useEffect(() => {
    if (isOpen) {
      const slug = defaultTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setPath(`docs/${slug}.md`);
      setNewRepoName(`${slug}-docs`);
      setMessage(`Update docs for ${defaultTopic}`);
      setError(null);
      setSuccess(null);

      // Validate token via server
      checkTokenAction({}).then(result => {
        setHasToken(result.valid);
        if (result.valid && result.username) {
          setUsername(result.username);
          setOwner(result.username);
        }
      }).catch(() => {
        setHasToken(false);
      });
    } else {
      setError(null);
      setSuccess(null);
      setIsLoading(false);
    }
  }, [isOpen, defaultTopic]);

  const handlePush = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let targetOwner = owner;
      let targetRepo = repo;

      if (mode === 'new') {
        const newRepo = await createRepoAction({
          name: newRepoName,
          description: newRepoDesc,
          isPrivate,
        });
        targetOwner = newRepo.owner;
        targetRepo = newRepo.name;
      } else {
        if (!targetOwner || !targetRepo) {
          throw new Error("Owner and Repository name are required.");
        }
        const { exists } = await checkRepoAction({ owner: targetOwner, repo: targetRepo });
        if (!exists) {
          setError(`Repository "${targetOwner}/${targetRepo}" not found.`);
          setIsLoading(false);
          return;
        }
      }

      const result = await pushAction({
        documentId,
        owner: targetOwner,
        repo: targetRepo,
        path,
        message,
      });

      setSuccess(`Successfully pushed to ${targetOwner}/${targetRepo}`);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to push to GitHub.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 text-white rounded-lg">
              <Icons.GitHub className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Push to GitHub</h2>
              <p className="text-xs text-secondary mt-0.5">Sync documentation to a repository</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {hasToken === null ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-secondary">Checking GitHub token...</p>
            </div>
          ) : !hasToken ? (
            <div className="text-center py-8">
              <Icons.AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-main mb-2">GitHub Token Required</h3>
              <p className="text-sm text-secondary mb-6">You need to configure a Personal Access Token (PAT) with <code>repo</code> scope to use this feature.</p>
              <button onClick={onOpenSettings} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors">
                Open Settings
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex bg-surface-hover p-1 rounded-xl">
                <button onClick={() => setMode('existing')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'existing' ? 'bg-background shadow-sm text-main' : 'text-secondary hover:text-main'}`}>
                  Existing Repo
                </button>
                <button onClick={() => setMode('new')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'new' ? 'bg-background shadow-sm text-main' : 'text-secondary hover:text-main'}`}>
                  Create New Repo
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Owner</label>
                      <input type="text" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Username" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Repository</label>
                      <input type="text" value={repo} onChange={(e) => setRepo(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="repo-name" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">Repository Name</label>
                    <input type="text" value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="my-docs-repo" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">Description</label>
                    <input type="text" value={newRepoDesc} onChange={(e) => setNewRepoDesc(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Repo description" />
                  </div>
                  <div className="flex items-center gap-4 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} className="text-primary focus:ring-primary" /> Private
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} className="text-primary focus:ring-primary" /> Public
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">File Path</label>
                  <input type="text" value={path} onChange={(e) => setPath(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="docs/readme.md" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">Commit Message</label>
                  <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Update documentation" />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['docs: update context', 'feat: add documentation', 'chore: sync knowledge'].map(msg => (
                      <button key={msg} onClick={() => setMessage(msg)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-primary/10 text-secondary hover:text-primary border border-border hover:border-primary/30 transition-all font-medium">
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icons.AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {error.includes('not found') && mode === 'existing' && (
                    <button onClick={() => { setNewRepoName(repo); setMode('new'); setError(null); }} className="self-start px-3 py-1.5 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors shadow-sm flex items-center gap-1.5">
                      <Icons.Plus className="w-3.5 h-3.5" /> Create "{repo}" instead
                    </button>
                  )}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-500 flex items-center gap-2">
                  <Icons.CheckCircle className="w-4 h-4" /> {success}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all">Cancel</button>
          {hasToken && (
            <button onClick={handlePush} disabled={isLoading || (mode === 'new' && !newRepoName) || (mode === 'existing' && (!owner || !repo))} className="px-6 py-2.5 bg-zinc-900 text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
              {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icons.CloudUpload className="w-4 h-4" />}
              {mode === 'new' ? 'Create & Push' : 'Push File'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default GitHubPushModal;

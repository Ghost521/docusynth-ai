
import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icon';
import { GeneratedDoc, IntegrationSettings, DocVersion } from '../types';
import { checkOllamaConnection, pushToOllama, getTabnineContextSnippet, getCodeWhispererContextSnippet, getClaudeContextSnippet, getGeminiContextSnippet, getOpenAIContextSnippet } from '../services/localAiService';
import { summarizeContent } from '../services/geminiService';
import { convertToFormat, DocFormat } from '../services/langextract';
import VersionHistoryModal from './VersionHistoryModal';
import SummaryModal from './SummaryModal';

// Helper for Cursor Rules
const getCursorRulesSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}// Cursor Rule: ${topic}
// Add this content to your .cursorrules file or use it as a project-level instruction.

<rule_context>
${content}
</rule_context>

When writing code for ${topic}, strictly follow the best practices and architectural patterns defined in the rule_context above.`;
};

interface MarkdownViewerProps {
  doc: GeneratedDoc;
  integrationSettings: IntegrationSettings;
  onUpdateSettings: (settings: IntegrationSettings) => void;
  onRefresh: (doc: GeneratedDoc) => void;
  onRevert: (docId: string, version: DocVersion) => void;
  onUpdateVisibility: (docId: string, visibility: 'public' | 'private') => void;
  onUpdateContent: (docId: string, newContent: string) => void;
  onMove: () => void;
  onSaveSharedDoc?: () => void;
  onPushToGitHub: () => void;
  onOpenSchedule?: () => void;
  onOpenComments?: (selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
  // Presence callbacks
  onEditingStateChange?: (isEditing: boolean) => void;
  collaborators?: Array<{
    userName: string;
    userColor: string;
    isEditing: boolean;
  }>;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  doc,
  integrationSettings,
  onUpdateSettings,
  onRefresh,
  onRevert,
  onUpdateVisibility,
  onUpdateContent,
  onMove,
  onSaveSharedDoc,
  onPushToGitHub,
  onOpenSchedule,
  onOpenComments,
  onEditingStateChange,
  collaborators = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Format State
  const [format, setFormat] = useState<DocFormat>('markdown');
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  // Content State
  // sourceMarkdown acts as the "buffer" to store the clean Markdown version while viewing other formats
  const [sourceMarkdown, setSourceMarkdown] = useState(doc.content);
  const [editContent, setEditContent] = useState(doc.content);
  
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  // Summary State
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Text Selection State for Comments
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number } | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Notify parent when editing state changes
  useEffect(() => {
    onEditingStateChange?.(isEditing);
  }, [isEditing, onEditingStateChange]);

  // Check if others are editing
  const othersEditing = collaborators.filter(c => c.isEditing);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0 && onOpenComments) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Get position relative to the content container
      if (contentRef.current) {
        const containerRect = contentRef.current.getBoundingClientRect();
        setSelectedText(text);
        setSelectionPopup({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 10,
        });
      }
    } else {
      setSelectionPopup(null);
      setSelectedText('');
    }
  };

  const handleCommentOnSelection = () => {
    if (selectedText && onOpenComments) {
      onOpenComments(selectedText);
      setSelectionPopup(null);
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
    }
  };

  useEffect(() => {
    if (showIntegrations) {
      handleCheckOllama();
    }
  }, [showIntegrations, integrationSettings.ollamaEndpoint]);

  // Synchronize internal state when doc prop changes and reset summary/format
  useEffect(() => {
    setEditContent(doc.content);
    setSourceMarkdown(doc.content); // Reset buffer to the new document content
    setIsEditing(false);
    setSummary(null);
    detectFormat(doc.content);
  }, [doc.id, doc.content]);

  const detectFormat = (content: string) => {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) setFormat('json');
    else if (trimmed.startsWith('<')) setFormat('xml');
    else if (trimmed.startsWith('---') || (trimmed.includes(':') && !trimmed.includes('#'))) setFormat('yaml'); // Simple heuristic
    else setFormat('markdown');
  };

  const convertFormat = (targetFormat: DocFormat) => {
    if (format === targetFormat) return;

    // Determine the source content to convert from.
    // If we are currently in 'markdown' mode, the 'editContent' is the most up-to-date source (potentially edited by user).
    // If we are in other modes (JSON/XML), 'sourceMarkdown' holds the original markdown structure to prevent data loss/wrapping loops.
    let contentToTransform = sourceMarkdown;

    if (format === 'markdown') {
        contentToTransform = editContent;
        setSourceMarkdown(editContent); // Update buffer with latest edits
    }

    if (targetFormat === 'markdown') {
        // Switching back to markdown: Restore the clean source
        setEditContent(contentToTransform);
    } else {
        // Switching to a derived format: Convert FROM the source buffer
        try {
            const newContent = convertToFormat(contentToTransform, targetFormat, {
                topic: doc.topic,
                createdAt: doc.createdAt,
                sources: doc.sources,
                visibility: doc.visibility
            });
            setEditContent(newContent);
        } catch (e) {
            console.error("Conversion failed", e);
            alert("Could not convert content format. Please check the content structure.");
            return; // Abort format switch on error
        }
    }

    setFormat(targetFormat);
    setShowFormatMenu(false);
  };

  const handleCheckOllama = async () => {
    const isConnected = await checkOllamaConnection(integrationSettings.ollamaEndpoint);
    setOllamaStatus(isConnected ? 'connected' : 'error');
  };

  const handleCopy = () => {
    const prefix = integrationSettings.customSystemInstruction;
    const finalContent = prefix ? `${prefix}\n\n${editContent}` : editContent;
    navigator.clipboard.writeText(finalContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleVisibility = () => {
    const newVisibility = doc.visibility === 'public' ? 'private' : 'public';
    onUpdateVisibility(doc.id, newVisibility);
  };

  const handleShare = () => {
    const data = JSON.stringify({
      t: doc.topic,
      c: doc.content,
      s: doc.sources
    });
    
    const hash = btoa(String.fromCharCode(...new TextEncoder().encode(data)));
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${hash}`;
    
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    
    if (doc.visibility !== 'public') {
      onUpdateVisibility(doc.id, 'public');
    }
    
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handlePushToOllama = async () => {
    setIsPushing(true);
    setPushStatus('Creating Ollama model...');
    const modelName = `docusynth-${doc.topic.replace(/\s+/g, '-').toLowerCase()}`;
    const prefix = integrationSettings.customSystemInstruction;
    const finalContent = prefix ? `${prefix}\n\n${editContent}` : editContent;
    
    const result = await pushToOllama(
      integrationSettings.ollamaEndpoint,
      modelName,
      integrationSettings.ollamaBaseModel,
      finalContent
    );
    setPushStatus(result.message);
    setIsPushing(false);
    setTimeout(() => setPushStatus(null), 5000);
  };

  const handleSaveEdit = () => {
    onUpdateContent(doc.id, editContent);
    // If saving while in markdown mode, update the buffer too
    if (format === 'markdown') {
        setSourceMarkdown(editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(doc.content);
    setIsEditing(false);
    detectFormat(doc.content);
  };

  const handleSummarize = async () => {
    if (summary) {
        setShowSummaryModal(true);
        return;
    }
    setIsSummarizing(true);
    try {
        const result = await summarizeContent(doc.content, integrationSettings.geminiApiKey);
        setSummary(result);
        setShowSummaryModal(true);
    } catch (e) {
        console.error("Failed to summarize", e);
    } finally {
        setIsSummarizing(false);
    }
  };

  const isSharedDoc = doc.id.startsWith('shared-');

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden shadow-2xl transition-colors">
      <VersionHistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        doc={doc} 
        onRevert={(v) => {
          onRevert(doc.id, v);
          setShowHistory(false);
        }} 
      />
      {summary && (
        <SummaryModal 
            isOpen={showSummaryModal} 
            onClose={() => setShowSummaryModal(false)} 
            summary={summary}
            topic={doc.topic}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-black/5 dark:bg-black/20">
        <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
           <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
           <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
           
           <div className="ml-3 flex items-center gap-2">
             <div className="relative">
                <button 
                    onClick={() => setShowFormatMenu(!showFormatMenu)}
                    className="flex items-center gap-1 text-[10px] font-mono text-secondary hover:text-primary bg-surface border border-border px-1.5 py-0.5 rounded transition-colors"
                >
                    {format.toUpperCase()}
                    <Icons.ChevronDown className="w-3 h-3" />
                </button>
                
                {showFormatMenu && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
                        {(['markdown', 'json', 'yaml', 'xml', 'txt'] as DocFormat[]).map(f => (
                            <button
                                key={f}
                                onClick={() => convertFormat(f)}
                                className={`w-full text-left px-3 py-1.5 text-xs font-mono uppercase hover:bg-surface-hover ${format === f ? 'text-primary font-bold' : 'text-secondary'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
             </div>
             
             <span className="text-xs text-secondary font-mono truncate max-w-[120px]">{doc.topic.replace(/\s+/g, '_')}.{format === 'markdown' ? 'md' : format}</span>
           </div>
           
           {!isSharedDoc && (
             <div className="flex items-center gap-1.5 ml-2">
                <button 
                    onClick={toggleVisibility}
                    className={`px-2 py-0.5 rounded bg-surface border flex items-center gap-1.5 transition-all hover:brightness-110 active:scale-95 ${
                    doc.visibility === 'public' ? 'border-primary/50' : 'border-border'
                    }`}
                    title={`Switch to ${doc.visibility === 'public' ? 'Private' : 'Public'} mode`}
                >
                    {doc.visibility === 'public' ? <Icons.Globe className="w-3 h-3 text-primary" /> : <Icons.Lock className="w-3 h-3 text-secondary" />}
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${doc.visibility === 'public' ? 'text-primary' : 'text-secondary'}`}>
                    {doc.visibility}
                    </span>
                </button>
                
                <button 
                    onClick={onMove}
                    className="px-2 py-0.5 rounded bg-surface border border-border text-secondary hover:text-primary transition-all active:scale-95 flex items-center gap-1.5"
                    title="Organize / Move to Project"
                >
                    <Icons.Folder className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Organize</span>
                </button>
             </div>
           )}

           {isSharedDoc && (
             <div className="ml-2 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 flex items-center gap-1.5">
                <Icons.Globe className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Shared</span>
             </div>
           )}
        </div>
        <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button 
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-main transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-emerald-600 rounded-md transition-all shadow-md active:scale-95"
                >
                    <Icons.Check className="w-3.5 h-3.5" />
                    Save Changes
                </button>
              </div>
            ) : (
              <>
                {isSharedDoc && onSaveSharedDoc && (
                  <button 
                      onClick={onSaveSharedDoc}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-all shadow-md active:scale-95"
                      title="Save this documentation to your history"
                  >
                      <Icons.Download className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Import to My Docs</span>
                  </button>
                )}

                {/* Others editing indicator */}
                {othersEditing.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
                    <div className="flex -space-x-1">
                      {othersEditing.slice(0, 3).map((c, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full border border-white dark:border-gray-800"
                          style={{ backgroundColor: c.userColor }}
                          title={c.userName}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                      {othersEditing.length === 1
                        ? `${othersEditing[0].userName} is editing`
                        : `${othersEditing.length} people editing`}
                    </span>
                  </div>
                )}

                {!isSharedDoc && (
                  <>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-main bg-white/5 hover:bg-surface-hover rounded-md transition-colors"
                        title="Edit Content"
                    >
                        <Icons.Edit className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Edit</span>
                    </button>
                    <button 
                        onClick={handleShare}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          shareCopied ? 'bg-primary text-white shadow-lg' : 'text-secondary hover:text-main bg-white/5 hover:bg-surface-hover'
                        }`}
                        title="Generate and copy public share link"
                    >
                        <Icons.Share className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">{shareCopied ? 'Link Copied' : 'Share'}</span>
                    </button>
                  </>
                )}
                
                <div className="w-px h-4 bg-border mx-1" />
                
                {!isSharedDoc && (
                  <>
                    <button
                        onClick={onPushToGitHub}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-main bg-white/5 hover:bg-surface-hover rounded-md transition-colors"
                        title="Push to GitHub"
                    >
                        <Icons.GitHub className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Push</span>
                    </button>

                    {onOpenSchedule && (
                      <button
                          onClick={onOpenSchedule}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-main bg-white/5 hover:bg-surface-hover rounded-md transition-colors"
                          title="Schedule automatic updates"
                      >
                          <Icons.Clock className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Schedule</span>
                      </button>
                    )}

                    {onOpenComments && (
                      <button
                          onClick={() => onOpenComments()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-main bg-white/5 hover:bg-surface-hover rounded-md transition-colors"
                          title="View and add comments"
                      >
                          <Icons.MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Comments</span>
                      </button>
                    )}

                    <button
                        onClick={() => onRefresh(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-main bg-white/5 hover:bg-surface-hover rounded-md transition-colors"
                        title="Refresh (Synthesize Latest Updates)"
                    >
                        <Icons.Refresh className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Refresh</span>
                    </button>
                    <button 
                        onClick={() => setShowHistory(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showHistory ? 'bg-primary text-white' : 'text-secondary hover:text-main bg-white/5 hover:bg-surface-hover'}`}
                        title="Version History"
                    >
                        <Icons.History className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">History</span>
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                  </>
                )}

                <button 
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showSummaryModal ? 'bg-primary text-white' : 'text-secondary hover:text-main bg-white/5 hover:bg-surface-hover'}`}
                    title="Generate Executive Summary"
                >
                    {isSummarizing ? (
                        <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                        <Icons.AlignLeft className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden lg:inline">{isSummarizing ? 'Thinking...' : 'Summarize'}</span>
                </button>

                <button 
                    onClick={() => setShowIntegrations(!showIntegrations)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showIntegrations ? 'bg-primary text-white' : 'text-secondary hover:text-main bg-white/5 hover:bg-surface-hover'}`}
                    title="Direct Integrations"
                >
                    <Icons.Zap className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Integrate</span>
                </button>
                <button 
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        copied ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-primary/20 text-blue-600 dark:text-blue-400 hover:bg-primary/30'
                    }`}
                >
                    {copied ? <Icons.Check className="w-3.5 h-3.5" /> : <Icons.Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </>
            )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Integrations Overlay */}
        {showIntegrations && (
          <div className="absolute inset-x-0 top-0 z-20 bg-surface/95 backdrop-blur-md border-b border-border p-6 animate-fadeIn shadow-xl max-h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-main flex items-center gap-2">
                <Icons.Zap className="w-5 h-5 text-primary" />
                AI Tool Integrations
              </h3>
              <button onClick={() => setShowIntegrations(false)} className="text-secondary hover:text-main">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6">
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.Terminal className="w-5 h-5 text-main" />
                  </div>
                  <span className="font-bold">Cursor</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Generated specifically for .cursorrules files. Best for project-wide rules.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getCursorRulesSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('Cursor rule copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-surface hover:bg-surface-hover border border-border text-main rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy .cursorrules
                  </button>
                </div>
              </div>
              
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.Gemini className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-bold">Gemini</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Optimized for Gemini's long-context window. Perfect as a system instruction.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getGeminiContextSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('Gemini context copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy Context
                  </button>
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.MessageSquare className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="font-bold">Claude</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Optimized for Claude Projects. Wraps content in XML tags for reasoning.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getClaudeContextSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('Claude context copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/30 text-amber-700 dark:text-amber-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy Knowledge
                  </button>
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.Sparkles className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-bold">OpenAI</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Optimized context for OpenAI models and the Codex engine.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getOpenAIContextSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('OpenAI context copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 text-green-700 dark:text-green-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy Codex Prompt
                  </button>
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                      <Icons.Cpu className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold">Ollama</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-green-500' : ollamaStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                    <button onClick={handleCheckOllama} className="p-1 hover:bg-surface-hover rounded">
                      <Icons.Refresh className="w-3 h-3 text-secondary" />
                    </button>
                  </div>
                </div>
                <button 
                  disabled={ollamaStatus !== 'connected' || isPushing}
                  onClick={handlePushToOllama}
                  className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isPushing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Icons.ExternalLink className="w-3.5 h-3.5" />}
                  Push Model
                </button>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-bold">Tabnine</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Context for Tabnine's local chat integration.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getTabnineContextSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('Tabnine snippet copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-surface hover:bg-surface-hover border border-border text-main rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                    <Icons.Globe className="w-5 h-5 text-orange-500" />
                  </div>
                  <span className="font-bold">Amazon Q</span>
                </div>
                <p className="text-xs text-secondary mb-4 leading-relaxed">
                  Formatted for Amazon Q project instructions.
                </p>
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const snippet = getCodeWhispererContextSnippet(doc.topic, doc.content, integrationSettings.customSystemInstruction);
                      navigator.clipboard.writeText(snippet);
                      setPushStatus('Amazon Q snippet copied!');
                      setTimeout(() => setPushStatus(null), 3000);
                    }}
                    className="w-full py-2 bg-surface hover:bg-surface-hover border border-border text-main rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-[10px] text-secondary italic">
              <Icons.Info className="w-3 h-3" />
              Tip: Use these snippets to ground your AI tools with the absolute latest documentation context.
              {pushStatus && <span className="ml-auto font-bold text-primary animate-pulse">{pushStatus}</span>}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-background transition-colors">
          {isEditing ? (
            <div className="h-full w-full p-6 lg:p-8 animate-fadeIn flex flex-col">
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full bg-background border border-border rounded-xl p-6 text-sm font-mono text-main outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-inner"
                placeholder="Edit your documentation content here..."
                spellCheck={false}
              />
              <div className="mt-4 flex items-center gap-2 text-[10px] text-secondary italic">
                <Icons.Info className="w-3 h-3" />
                {format === 'markdown' ? 'Markdown changes will be rendered once saved.' : `Editing in ${format.toUpperCase()} mode. Ensure syntax is valid.`} A historical version will be preserved automatically.
              </div>
            </div>
          ) : (
            <div className="p-6 lg:p-8 relative" ref={contentRef} onMouseUp={handleTextSelection}>
              {/* Selection popup for commenting */}
              {selectionPopup && onOpenComments && (
                <div
                  className="absolute z-50 transform -translate-x-1/2 -translate-y-full"
                  style={{ left: selectionPopup.x, top: selectionPopup.y }}
                >
                  <button
                    onClick={handleCommentOnSelection}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icons.MessageSquare className="w-3.5 h-3.5" />
                    Comment
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-600" />
                </div>
              )}
              {format === 'markdown' ? (
                 <div className="prose prose-sm max-w-none font-mono dark:prose-invert">
                  <ReactMarkdown
                      components={{
                          h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6 pb-2 border-b border-border" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-xl font-bold text-blue-500 dark:text-blue-300 mt-8 mb-4" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-main mt-6 mb-3" {...props} />,
                          p: ({node, ...props}) => <p className="text-secondary leading-relaxed mb-4" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-4 text-secondary space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-4 text-secondary space-y-1" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-4 bg-primary/5 italic text-secondary" {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-500 hover:text-blue-400 underline underline-offset-4" target="_blank" rel="noopener noreferrer" {...props} />,
                          code: ({node, inline, className, children, ...props}: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isBlock = !inline;
                              const [isCodeCopied, setIsCodeCopied] = useState(false);

                              const handleCodeCopy = () => {
                                  navigator.clipboard.writeText(String(children));
                                  setIsCodeCopied(true);
                                  setTimeout(() => setIsCodeCopied(false), 2000);
                              };

                              if (isBlock) {
                                  return (
                                      <div className="relative group my-6 rounded-xl overflow-hidden border border-border shadow-sm">
                                          <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-white/10">
                                              <div className="flex items-center gap-2">
                                                  <div className="flex gap-1.5">
                                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                                                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                                                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                                                  </div>
                                                  <span className="text-[10px] text-zinc-400 font-sans uppercase tracking-wider ml-2">
                                                    {match ? match[1] : 'code'}
                                                  </span>
                                              </div>
                                              <button 
                                                  onClick={handleCodeCopy}
                                                  className="text-[10px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2 py-1 rounded"
                                              >
                                                  {isCodeCopied ? <Icons.Check className="w-3 h-3 text-green-400" /> : <Icons.Copy className="w-3.5 h-3.5" />}
                                                  {isCodeCopied ? 'Snippet Copied' : 'Copy Snippet'}
                                              </button>
                                          </div>
                                          <SyntaxHighlighter
                                              {...props}
                                              style={vscDarkPlus}
                                              language={match ? match[1] : 'text'}
                                              PreTag="div"
                                              customStyle={{ 
                                                  margin: 0, 
                                                  borderTopLeftRadius: 0,
                                                  borderTopRightRadius: 0,
                                                  borderBottomLeftRadius: '0.75rem',
                                                  borderBottomRightRadius: '0.75rem',
                                                  background: '#18181b', // Zinc 900
                                                  padding: '1.25rem',
                                                  fontSize: '0.85rem',
                                                  lineHeight: '1.6',
                                              }}
                                              codeTagProps={{
                                                  style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
                                              }}
                                          >
                                              {String(children).replace(/\n$/, '')}
                                          </SyntaxHighlighter>
                                      </div>
                                  );
                              }

                              return (
                                  <code className="bg-surface-hover text-orange-600 dark:text-orange-300 px-1.5 py-0.5 rounded text-sm font-mono border border-border/50" {...props}>
                                      {children}
                                  </code>
                              );
                          }
                      }}
                  >
                      {editContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="h-full rounded-xl overflow-hidden border border-border">
                    <SyntaxHighlighter
                        language={format}
                        style={vscDarkPlus}
                        customStyle={{ 
                            margin: 0, 
                            height: '100%',
                            background: '#18181b', 
                            padding: '1.5rem',
                            fontSize: '0.9rem',
                            lineHeight: '1.6',
                        }}
                        showLineNumbers={true}
                    >
                        {editContent}
                    </SyntaxHighlighter>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkdownViewer;

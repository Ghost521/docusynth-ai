
import React, { useState } from 'react';
import { Icons } from './Icon';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  serverCode: string;
  visibility: 'public' | 'private';
}

const MCPModal: React.FC<MCPModalProps> = ({ isOpen, onClose, projectName, serverCode, visibility }) => {
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [tab, setTab] = useState<'code' | 'setup'>('setup');

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const data = JSON.stringify({
      t: `${projectName} MCP Server`,
      c: `## ${projectName} MCP Server Implementation\n\n\`\`\`typescript\n${serverCode}\n\`\`\``,
      s: [{ title: 'DocuSynth MCP Architect', url: window.location.origin }]
    });
    
    const hash = btoa(String.fromCharCode(...new TextEncoder().encode(data)));
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${hash}`;
    
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleDownload = () => {
    const header = visibility === 'public' 
      ? `/** \n * SHARED PUBLICLY VIA DOCUSYNTH AI \n * Project: ${projectName} \n */\n\n`
      : "";
    const blob = new Blob([header + serverCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-mcp-server.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const configSnippet = `{
  "mcpServers": {
    "${projectName.toLowerCase().replace(/\s+/g, '-')}": {
      "command": "npx",
      "args": [
        "-y",
        "ts-node",
        "${projectName.toLowerCase().replace(/\s+/g, '-')}-mcp-server.ts"
      ]
    }
  }
}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col h-[85vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-surface-hover/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Icons.Server className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-main">MCP Server Generated</h2>
                <div className="px-2 py-0.5 rounded bg-surface border border-border flex items-center gap-1.5">
                  {visibility === 'public' ? <Icons.Globe className="w-3 h-3 text-primary" /> : <Icons.Lock className="w-3 h-3 text-secondary" />}
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-tighter">{visibility}</span>
                </div>
              </div>
              <p className="text-xs text-secondary mt-1">Exposing "{projectName}" context to AI Agents</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface px-6">
          <button 
            onClick={() => setTab('setup')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${tab === 'setup' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-main'}`}
          >
            Setup Guide
          </button>
          <button 
            onClick={() => setTab('code')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${tab === 'code' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-main'}`}
          >
            Server Code (TypeScript)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
          {tab === 'setup' ? (
            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
              <section>
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                  Prerequisites
                </h3>
                <div className="bg-surface p-4 rounded-xl border border-border">
                  <p className="text-sm text-secondary leading-relaxed">
                    Make sure you have <span className="font-bold text-main">Node.js</span> and <span className="font-bold text-main">npm</span> installed on your system.
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                  Install Dependencies
                </h3>
                <div className="relative group">
                  <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-xl">
                    npm install @modelcontextprotocol/sdk ts-node typescript
                  </SyntaxHighlighter>
                  <button 
                    onClick={() => handleCopy("npm install @modelcontextprotocol/sdk ts-node typescript")}
                    className="absolute top-3 right-3 p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                  Claude Desktop Configuration
                </h3>
                <p className="text-xs text-secondary mb-3 italic">Add this to your claude_desktop_config.json file</p>
                <div className="relative group">
                  <SyntaxHighlighter language="json" style={vscDarkPlus} className="rounded-xl max-h-[200px]">
                    {configSnippet}
                  </SyntaxHighlighter>
                  <button 
                    onClick={() => handleCopy(configSnippet)}
                    className="absolute top-3 right-3 p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy Snippet
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="relative animate-fadeIn h-full flex flex-col">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                  onClick={handleShare}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg ${shareCopied ? 'bg-primary text-white' : 'bg-surface-hover hover:bg-surface border border-border text-main'}`}
                >
                  <Icons.Share className="w-3.5 h-3.5" />
                  {shareCopied ? 'Link Copied' : 'Share Link'}
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all shadow-lg"
                >
                  <Icons.Download className="w-3.5 h-3.5" />
                  Download .ts
                </button>
                <button 
                  onClick={() => handleCopy(serverCode)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover border border-border text-main rounded-lg text-xs font-bold hover:bg-surface transition-all"
                >
                  {copied ? <Icons.Check className="w-3.5 h-3.5" /> : <Icons.Copy className="w-3.5 h-3.5" />}
                  Copy Code
                </button>
              </div>
              <SyntaxHighlighter 
                language="typescript" 
                style={vscDarkPlus} 
                className="flex-1 !m-0 !bg-[#18181b] rounded-xl border border-border overflow-auto custom-scrollbar"
                customStyle={{ padding: '2rem' }}
              >
                {serverCode}
              </SyntaxHighlighter>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-hover/30 border-t border-border flex justify-between items-center px-6">
          <div className="flex items-center gap-2 text-[10px] text-secondary">
            <Icons.Info className="w-3.5 h-3.5" />
            {visibility === 'public' ? 'This MCP server is marked as public and ready for distribution.' : 'This MCP server is private to your local environment.'}
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-surface hover:bg-surface-hover text-main rounded-lg text-sm font-bold border border-border transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCPModal;

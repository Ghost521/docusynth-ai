
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';

type AIProvider = 'gemini' | 'claude' | 'openai';

interface UserSettingsData {
  ollamaEndpoint: string;
  ollamaBaseModel: string;
  tabnineEnabled: boolean;
  cursorRulesEnabled: boolean;
  claudeModelPreference: string;
  geminiModelPreference: string;
  openAiEnabled: boolean;
  openAiModelPreference: string;
  customSystemInstruction?: string;
  crawlMaxPages: number;
  crawlDepth: number;
  crawlDelay: number;
  crawlExcludePatterns: string;
  preferredProvider: AIProvider;
  hasGithubToken: boolean;
  hasClaudeApiKey: boolean;
  hasOpenAiApiKey: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettingsData;
  onSave: (settings: any, crawlOptions?: any) => void;
  initialTab?: 'local' | 'cloud' | 'ide' | 'shortcuts' | 'crawler' | 'developer' | 'imports';
  onOpenAPIKeys?: () => void;
  onOpenWebhooks?: () => void;
  onOpenImports?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  initialTab = 'local',
  onOpenAPIKeys,
  onOpenWebhooks,
  onOpenImports
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'ide' | 'shortcuts' | 'crawler' | 'developer' | 'imports'>(initialTab);

  // Secret fields - only sent if user types a new value
  const [githubToken, setGithubToken] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');

  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showGithubKey, setShowGithubKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setGithubToken('');
      setClaudeApiKey('');
      setOpenAiApiKey('');
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, settings, initialTab]);

  if (!isOpen) return null;

  const handleSave = () => {
    const settingsToSave: any = {
      ollamaEndpoint: localSettings.ollamaEndpoint,
      ollamaBaseModel: localSettings.ollamaBaseModel,
      tabnineEnabled: localSettings.tabnineEnabled,
      cursorRulesEnabled: localSettings.cursorRulesEnabled,
      claudeModelPreference: localSettings.claudeModelPreference,
      geminiModelPreference: localSettings.geminiModelPreference,
      openAiEnabled: localSettings.openAiEnabled,
      openAiModelPreference: localSettings.openAiModelPreference,
      customSystemInstruction: localSettings.customSystemInstruction,
      preferredProvider: localSettings.preferredProvider,
    };

    // Only include secrets if user typed a new value
    if (githubToken) settingsToSave.githubToken = githubToken;
    if (claudeApiKey) settingsToSave.claudeApiKey = claudeApiKey;
    if (openAiApiKey) settingsToSave.openAiApiKey = openAiApiKey;

    const crawlOptions = {
      maxPages: localSettings.crawlMaxPages,
      depth: localSettings.crawlDepth,
      delay: localSettings.crawlDelay,
      excludePatterns: localSettings.crawlExcludePatterns,
    };

    onSave(settingsToSave, crawlOptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main leading-tight">Integrations & Settings</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-secondary">Configure your AI developer ecosystem</p>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-bold text-primary uppercase tracking-tighter">
                  <Icons.Shield className="w-2.5 h-2.5" />
                  Server Secured
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          <nav className="w-48 border-r border-border bg-surface-hover/10 p-4 space-y-1 shrink-0">
            <button onClick={() => setActiveTab('local')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'local' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Cpu className="w-4 h-4" /> Local AI
            </button>
            <button onClick={() => setActiveTab('cloud')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'cloud' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Globe className="w-4 h-4" /> Cloud APIs
            </button>
            <button onClick={() => setActiveTab('crawler')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'crawler' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Globe className="w-4 h-4" /> Crawler
            </button>
            <button onClick={() => setActiveTab('ide')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'ide' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Terminal className="w-4 h-4" /> IDE Tools
            </button>
            <button onClick={() => setActiveTab('shortcuts')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'shortcuts' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Keyboard className="w-4 h-4" /> Shortcuts
            </button>
            <button onClick={() => setActiveTab('developer')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'developer' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.Terminal className="w-4 h-4" /> Developer
            </button>
            <button onClick={() => setActiveTab('imports')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'imports' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-hover'}`}>
              <Icons.CloudUpload className="w-4 h-4" /> Imports
            </button>
          </nav>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-background">
            {activeTab === 'local' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Ollama Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">API Endpoint</label>
                      <input type="text" value={localSettings.ollamaEndpoint} onChange={(e) => setLocalSettings({...localSettings, ollamaEndpoint: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="http://localhost:11434" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Base Model</label>
                      <input type="text" value={localSettings.ollamaBaseModel} onChange={(e) => setLocalSettings({...localSettings, ollamaBaseModel: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="llama3" />
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Local Tooling</h3>
                  <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icons.Sparkles className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-main">Tabnine Support</p>
                        <p className="text-[10px] text-secondary">Enable context snippet generation for Tabnine Chat</p>
                      </div>
                    </div>
                    <button onClick={() => setLocalSettings({...localSettings, tabnineEnabled: !localSettings.tabnineEnabled})} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.tabnineEnabled ? 'bg-primary' : 'bg-border'}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.tabnineEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cloud' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Preferred AI Provider */}
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Preferred AI Provider</h3>
                  <p className="text-xs text-secondary mb-4">Select which AI provider to use for document generation. Gemini is recommended for best search grounding.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['gemini', 'claude', 'openai'] as const).map((provider) => {
                      const isAvailable = provider === 'gemini' ||
                        (provider === 'claude' && settings.hasClaudeApiKey) ||
                        (provider === 'openai' && settings.hasOpenAiApiKey);
                      const isSelected = localSettings.preferredProvider === provider;

                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => isAvailable && setLocalSettings({...localSettings, preferredProvider: provider})}
                          disabled={!isAvailable}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : isAvailable
                              ? 'border-border hover:border-primary/50 bg-surface'
                              : 'border-border/50 bg-surface/50 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={`text-2xl ${isSelected ? 'text-primary' : 'text-secondary'}`}>
                              {provider === 'gemini' && '✦'}
                              {provider === 'claude' && '◉'}
                              {provider === 'openai' && '◎'}
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-main'}`}>
                              {provider}
                            </span>
                            {provider === 'gemini' && (
                              <span className="text-[8px] text-green-500 font-bold uppercase">Search Grounding</span>
                            )}
                            {!isAvailable && (
                              <span className="text-[8px] text-red-400 font-bold uppercase">API Key Required</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-secondary mt-3 italic">
                    Note: Search-based generation (Search, Crawl, GitHub modes) always uses Gemini for real-time web grounding.
                    Other tasks like MCP generation can use your preferred provider.
                  </p>
                </div>

                {/* GitHub */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">GitHub Integration</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Personal Access Token (PAT)</label>
                        {settings.hasGithubToken && <span className="text-[10px] text-green-500 font-bold">Configured</span>}
                      </div>
                      <div className="relative">
                        <input type={showGithubKey ? "text" : "password"} value={githubToken} onChange={(e) => setGithubToken(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-12" placeholder={settings.hasGithubToken ? "••••••••  (leave blank to keep)" : "ghp_..."} />
                        <button onClick={() => setShowGithubKey(!showGithubKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main" type="button">
                          {showGithubKey ? <Icons.X className="w-4 h-4" /> : <Icons.Settings className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-secondary italic">Required scopes: <code>repo</code>. Stored securely on server.</p>
                    </div>
                  </div>
                </div>

                {/* Claude */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Anthropic / Claude</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Claude API Key</label>
                        {settings.hasClaudeApiKey && <span className="text-[10px] text-green-500 font-bold">Configured</span>}
                      </div>
                      <div className="relative">
                        <input type={showClaudeKey ? "text" : "password"} value={claudeApiKey} onChange={(e) => setClaudeApiKey(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-12" placeholder={settings.hasClaudeApiKey ? "••••••••  (leave blank to keep)" : "sk-ant-..."} />
                        <button onClick={() => setShowClaudeKey(!showClaudeKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main" type="button">
                          {showClaudeKey ? <Icons.X className="w-4 h-4" /> : <Icons.Settings className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Claude Preference</label>
                      <select value={localSettings.claudeModelPreference} onChange={(e) => setLocalSettings({...localSettings, claudeModelPreference: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                        <option value="claude-opus-4-20250514">Claude Opus 4</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Gemini */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Google / Gemini</h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Gemini API key is managed server-side. No client configuration needed.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Gemini Preference</label>
                      <select value={localSettings.geminiModelPreference} onChange={(e) => setLocalSettings({...localSettings, geminiModelPreference: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                        <option value="gemini-3-pro-preview">Gemini 3 Pro (Complex Reasoning)</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast Inference)</option>
                        <option value="gemini-2.5-flash-lite-latest">Gemini 2.5 Flash Lite</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* OpenAI */}
                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-main uppercase tracking-widest">OpenAI / Codex Integration</h3>
                    <button onClick={() => setLocalSettings({...localSettings, openAiEnabled: !localSettings.openAiEnabled})} className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.openAiEnabled ? 'bg-primary' : 'bg-border'}`}>
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.openAiEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {localSettings.openAiEnabled && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-secondary uppercase tracking-widest">OpenAI API Key</label>
                          {settings.hasOpenAiApiKey && <span className="text-[10px] text-green-500 font-bold">Configured</span>}
                        </div>
                        <div className="relative">
                          <input type={showOpenAiKey ? "text" : "password"} value={openAiApiKey} onChange={(e) => setOpenAiApiKey(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-12" placeholder={settings.hasOpenAiApiKey ? "••••••••  (leave blank to keep)" : "sk-..."} />
                          <button onClick={() => setShowOpenAiKey(!showOpenAiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main" type="button">
                            {showOpenAiKey ? <Icons.X className="w-4 h-4" /> : <Icons.Settings className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-secondary italic">Secrets are stored securely on the server, never in the browser.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">OpenAI Model Preference</label>
                        <select value={localSettings.openAiModelPreference} onChange={(e) => setLocalSettings({...localSettings, openAiModelPreference: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                          <option value="gpt-4-turbo">GPT-4 Turbo (Best for Code)</option>
                          <option value="gpt-4o">GPT-4o (Fastest Pro)</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'crawler' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Advanced Crawler Settings</h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Max Pages</label>
                        <input type="number" value={localSettings.crawlMaxPages} onChange={(e) => setLocalSettings({...localSettings, crawlMaxPages: parseInt(e.target.value) || 1})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" min="1" max="100" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Max Depth</label>
                        <input type="number" value={localSettings.crawlDepth} onChange={(e) => setLocalSettings({...localSettings, crawlDepth: parseInt(e.target.value) || 1})} className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" min="1" max="5" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Request Delay (ms)</label>
                        <span className="text-xs font-mono text-primary">{localSettings.crawlDelay}ms</span>
                      </div>
                      <input type="range" min="0" max="5000" step="100" value={localSettings.crawlDelay} onChange={(e) => setLocalSettings({...localSettings, crawlDelay: parseInt(e.target.value)})} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                      <p className="text-[10px] text-secondary italic">Higher delay prevents your IP from being flagged by CDNs.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">Exclude Patterns</label>
                      <textarea value={localSettings.crawlExcludePatterns} onChange={(e) => setLocalSettings({...localSettings, crawlExcludePatterns: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono" placeholder="login, signup, auth, pricing..." />
                      <p className="text-[10px] text-secondary italic">Comma-separated keywords to skip during link discovery.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ide' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Cursor AI Integration</h3>
                  <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icons.GitHub className="w-5 h-5 text-main" />
                      <div>
                        <p className="text-sm font-bold text-main">.cursorrules Output</p>
                        <p className="text-[10px] text-secondary">Generate optimized instructions for Cursor Rules</p>
                      </div>
                    </div>
                    <button onClick={() => setLocalSettings({...localSettings, cursorRulesEnabled: !localSettings.cursorRulesEnabled})} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.cursorRulesEnabled ? 'bg-primary' : 'bg-border'}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.cursorRulesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">System Instructions</h3>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">Custom Global Prefix</label>
                    <textarea value={localSettings.customSystemInstruction || ''} onChange={(e) => setLocalSettings({...localSettings, customSystemInstruction: e.target.value})} placeholder="Add custom text to be prepended to all LLM context files..." className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Keyboard Shortcuts</h3>
                <p className="text-xs text-secondary mb-6 leading-relaxed">Boost your workflow with these keyboard shortcuts.</p>
                <div className="space-y-4">
                  {[
                    ['Return Home', 'H'],
                    ['Refresh Content', 'R'],
                    ['Copy Full Context', 'C'],
                    ['Delete Current Item', 'D'],
                  ].map(([label, key]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                      <span className="text-sm font-medium text-main">{label}</span>
                      <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono shadow-sm">Ctrl</kbd>
                        <span className="text-secondary">+</span>
                        <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono shadow-sm">{key}</kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'developer' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">REST API</h3>
                  <p className="text-xs text-secondary mb-4 leading-relaxed">
                    Access DocuSynth programmatically via our REST API. Create API keys to authenticate your requests.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAPIKeys?.();
                    }}
                    className="flex items-center gap-3 w-full p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icons.Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-main">Manage API Keys</p>
                      <p className="text-[10px] text-secondary">Create, view, and revoke API keys for authentication</p>
                    </div>
                    <Icons.ArrowRight className="w-4 h-4 text-secondary" />
                  </button>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Webhooks</h3>
                  <p className="text-xs text-secondary mb-4 leading-relaxed">
                    Receive real-time notifications when events occur in DocuSynth. Set up webhooks to integrate with your workflows.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenWebhooks?.();
                    }}
                    className="flex items-center gap-3 w-full p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icons.Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-main">Configure Webhooks</p>
                      <p className="text-[10px] text-secondary">Set up endpoints to receive event notifications</p>
                    </div>
                    <Icons.ArrowRight className="w-4 h-4 text-secondary" />
                  </button>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">API Documentation</h3>
                  <div className="p-4 bg-surface border border-border rounded-xl">
                    <p className="text-xs text-secondary mb-3">Base URL for API requests:</p>
                    <code className="block bg-background p-3 rounded-lg text-sm font-mono text-main border border-border">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/api
                    </code>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-secondary uppercase tracking-widest">Available Endpoints</p>
                    <div className="space-y-1 text-xs font-mono text-secondary">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-600 rounded text-[10px] font-bold">GET</span>
                        <span>/api/documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-600 rounded text-[10px] font-bold">POST</span>
                        <span>/api/documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-600 rounded text-[10px] font-bold">GET</span>
                        <span>/api/projects</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-600 rounded text-[10px] font-bold">POST</span>
                        <span>/api/projects</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-600 rounded text-[10px] font-bold">POST</span>
                        <span>/api/generate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-600 rounded text-[10px] font-bold">GET</span>
                        <span>/api/workspaces</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'imports' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">External Imports</h3>
                  <p className="text-xs text-secondary mb-4 leading-relaxed">
                    Import documentation from external sources like Notion and Confluence. Connect your accounts and browse pages to import.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenImports?.();
                    }}
                    className="flex items-center gap-3 w-full p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icons.CloudUpload className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-main">Import from Notion / Confluence</p>
                      <p className="text-[10px] text-secondary">Connect accounts, browse pages, and import documentation</p>
                    </div>
                    <Icons.ArrowRight className="w-4 h-4 text-secondary" />
                  </button>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Supported Sources</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
                      <div className="p-2 bg-black rounded-lg">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.72c-.466.046-.56.28-.374.466l1.823 1.022zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.934l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933l3.222-.187z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-main">Notion</p>
                        <p className="text-[10px] text-secondary">Import pages, databases, and nested content</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
                      <div className="p-2 bg-blue-600 rounded-lg">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.377a.764.764 0 0 0 1.028-.382l2.36-5.453a.764.764 0 0 0-.382-1.012c-1.627-.759-4.53-2.114-6.988-3.294-5.942-2.853-10.89-2.396-14.73 5.052zm22.26-12.514c.248-.382.53-.875.763-1.245a.764.764 0 0 0-.255-1.04L18.673.404a.764.764 0 0 0-1.058.26c-.199.332-.454.763-.733 1.221-1.967 3.247-3.945 2.853-7.508 1.146L4.417.654a.764.764 0 0 0-1.028.382L1.029 6.49a.764.764 0 0 0 .382 1.012c1.627.759 4.53 2.114 6.988 3.294 5.942 2.853 10.89 2.396 14.73-5.052z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-main">Confluence</p>
                        <p className="text-[10px] text-secondary">Import spaces and pages from Atlassian Confluence</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-4">Features</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>Markdown conversion</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>Batch imports</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>Progress tracking</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>De-duplication</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>Nested page support</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <Icons.Check className="w-4 h-4 text-green-500" />
                      <span>Import history</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-end gap-3 px-6">
          <button onClick={onClose} className="px-6 py-2.5 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all">Cancel</button>
          <button onClick={handleSave} className="px-8 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2">
            <Icons.Check className="w-4 h-4" /> Save Configuration
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;

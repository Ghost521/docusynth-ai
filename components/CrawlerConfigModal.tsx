import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { Id } from '../convex/_generated/dataModel';
import {
  validateUrl,
  validatePattern,
  parsePatterns,
  getRecommendedSettings,
  estimateCrawlDuration,
  COMMON_EXCLUDE_PATTERNS,
  DOC_INCLUDE_PATTERNS,
} from '../services/contentExtractor';

interface CrawlerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: CrawlJobConfig) => Promise<void>;
  projects: Array<{ _id: Id<'projects'>; name: string }>;
  editingJob?: CrawlJobConfig & { _id: Id<'crawlJobs'> };
}

interface CrawlJobConfig {
  name: string;
  startUrl: string;
  projectId?: Id<'projects'>;
  includePatterns: string[];
  excludePatterns: string[];
  domainRestriction: 'same' | 'subdomains' | 'any';
  contentTypes: string[];
  maxPages: number;
  maxDepth: number;
  requestDelayMs: number;
  maxConcurrent: number;
  authType: 'none' | 'basic' | 'bearer' | 'cookie';
  authCredentials?: string;
  customHeaders?: string;
  scheduleEnabled: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  scheduleHour?: number;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
}

type SiteType = 'documentation' | 'api' | 'blog' | 'general' | 'custom';

const CrawlerConfigModal: React.FC<CrawlerConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projects,
  editingJob,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'filters' | 'auth' | 'schedule' | 'advanced'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteType, setSiteType] = useState<SiteType>('general');

  // Form state
  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [projectId, setProjectId] = useState<Id<'projects'> | ''>('');
  const [includePatterns, setIncludePatterns] = useState('');
  const [excludePatterns, setExcludePatterns] = useState(COMMON_EXCLUDE_PATTERNS.join(', '));
  const [domainRestriction, setDomainRestriction] = useState<'same' | 'subdomains' | 'any'>('same');
  const [contentTypes, setContentTypes] = useState<string[]>(['text/html']);
  const [maxPages, setMaxPages] = useState(50);
  const [maxDepth, setMaxDepth] = useState(3);
  const [requestDelayMs, setRequestDelayMs] = useState(1000);
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [authType, setAuthType] = useState<'none' | 'basic' | 'bearer' | 'cookie'>('none');
  const [authCredentials, setAuthCredentials] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleHour, setScheduleHour] = useState(0);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(0);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);

  // Validation state
  const [urlError, setUrlError] = useState('');
  const [patternErrors, setPatternErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        // Populate form with existing job data
        setName(editingJob.name);
        setStartUrl(editingJob.startUrl);
        setProjectId(editingJob.projectId || '');
        setIncludePatterns(editingJob.includePatterns.join(', '));
        setExcludePatterns(editingJob.excludePatterns.join(', '));
        setDomainRestriction(editingJob.domainRestriction);
        setContentTypes(editingJob.contentTypes);
        setMaxPages(editingJob.maxPages);
        setMaxDepth(editingJob.maxDepth);
        setRequestDelayMs(editingJob.requestDelayMs);
        setMaxConcurrent(editingJob.maxConcurrent);
        setAuthType(editingJob.authType);
        setAuthCredentials(editingJob.authCredentials || '');
        setCustomHeaders(editingJob.customHeaders || '');
        setScheduleEnabled(editingJob.scheduleEnabled);
        if (editingJob.scheduleFrequency) setScheduleFrequency(editingJob.scheduleFrequency);
        if (editingJob.scheduleHour !== undefined) setScheduleHour(editingJob.scheduleHour);
        if (editingJob.scheduleDayOfWeek !== undefined) setScheduleDayOfWeek(editingJob.scheduleDayOfWeek);
        if (editingJob.scheduleDayOfMonth !== undefined) setScheduleDayOfMonth(editingJob.scheduleDayOfMonth);
        setSiteType('custom');
      } else {
        // Reset to defaults
        setName('');
        setStartUrl('');
        setProjectId('');
        setSiteType('general');
        applyPreset('general');
      }
      setActiveTab('basic');
      setUrlError('');
      setPatternErrors([]);
    }
  }, [isOpen, editingJob]);

  // Apply preset settings based on site type
  const applyPreset = (type: SiteType) => {
    if (type === 'custom') return;

    const settings = getRecommendedSettings(type as 'documentation' | 'api' | 'blog' | 'general');
    setMaxPages(settings.maxPages);
    setMaxDepth(settings.maxDepth);
    setRequestDelayMs(settings.delayMs);
    setDomainRestriction(settings.domainRestriction);
    setIncludePatterns(settings.includePatterns.join(', '));
    setExcludePatterns(settings.excludePatterns.join(', '));
  };

  // Handle URL change with validation
  const handleUrlChange = (value: string) => {
    setStartUrl(value);
    if (value.trim()) {
      const result = validateUrl(value);
      if (!result.valid) {
        setUrlError(result.error || 'Invalid URL');
      } else {
        setUrlError('');
        // Auto-generate name if empty
        if (!name && result.domain) {
          setName(`${result.domain} Crawl`);
        }
      }
    } else {
      setUrlError('');
    }
  };

  // Validate patterns
  const validatePatterns = (patternsString: string): string[] => {
    const patterns = parsePatterns(patternsString);
    const errors: string[] = [];

    patterns.forEach((pattern, index) => {
      const result = validatePattern(pattern);
      if (!result.valid) {
        errors.push(`Pattern ${index + 1}: ${result.error}`);
      }
    });

    return errors;
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate URL
    const urlResult = validateUrl(startUrl);
    if (!urlResult.valid) {
      setUrlError(urlResult.error || 'Invalid URL');
      setActiveTab('basic');
      return;
    }

    // Validate patterns
    const includeErrors = validatePatterns(includePatterns);
    const excludeErrors = validatePatterns(excludePatterns);
    if (includeErrors.length > 0 || excludeErrors.length > 0) {
      setPatternErrors([...includeErrors, ...excludeErrors]);
      setActiveTab('filters');
      return;
    }

    // Validate custom headers JSON
    if (customHeaders.trim()) {
      try {
        JSON.parse(customHeaders);
      } catch {
        setActiveTab('auth');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const config: CrawlJobConfig = {
        name: name || `${urlResult.domain} Crawl`,
        startUrl: urlResult.normalized,
        projectId: projectId || undefined,
        includePatterns: parsePatterns(includePatterns),
        excludePatterns: parsePatterns(excludePatterns),
        domainRestriction,
        contentTypes,
        maxPages,
        maxDepth,
        requestDelayMs,
        maxConcurrent,
        authType,
        authCredentials: authCredentials || undefined,
        customHeaders: customHeaders || undefined,
        scheduleEnabled,
        scheduleFrequency: scheduleEnabled ? scheduleFrequency : undefined,
        scheduleHour: scheduleEnabled ? scheduleHour : undefined,
        scheduleDayOfWeek: scheduleEnabled && scheduleFrequency === 'weekly' ? scheduleDayOfWeek : undefined,
        scheduleDayOfMonth: scheduleEnabled && scheduleFrequency === 'monthly' ? scheduleDayOfMonth : undefined,
      };

      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save crawler config:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const estimatedDuration = estimateCrawlDuration(maxPages, requestDelayMs);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Spider className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main leading-tight">
                {editingJob ? 'Edit Crawl Job' : 'New Crawl Job'}
              </h2>
              <p className="text-xs text-secondary">Configure advanced web crawling settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface-hover/10">
          {[
            { id: 'basic', label: 'Basic', icon: Icons.Globe },
            { id: 'filters', label: 'URL Filters', icon: Icons.Filter },
            { id: 'auth', label: 'Authentication', icon: Icons.Lock },
            { id: 'schedule', label: 'Schedule', icon: Icons.Calendar },
            { id: 'advanced', label: 'Advanced', icon: Icons.Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-secondary hover:text-main hover:bg-surface-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-6 animate-fadeIn">
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Start URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={startUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    urlError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'
                  }`}
                  placeholder="https://docs.example.com"
                />
                {urlError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <Icons.AlertTriangle className="w-3 h-3" />
                    {urlError}
                  </p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Job Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="My Documentation Crawl"
                />
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Target Project (Optional)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value as Id<'projects'> | '')}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                  <option value="">No project (standalone)</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-secondary">
                  Generated documents will be added to this project
                </p>
              </div>

              {/* Site Type Preset */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Site Type (Quick Presets)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'documentation', label: 'Docs', icon: Icons.FileText },
                    { id: 'api', label: 'API', icon: Icons.Terminal },
                    { id: 'blog', label: 'Blog', icon: Icons.AlignLeft },
                    { id: 'general', label: 'General', icon: Icons.Globe },
                    { id: 'custom', label: 'Custom', icon: Icons.Settings },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSiteType(id as SiteType);
                        applyPreset(id as SiteType);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        siteType === id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-secondary hover:text-main'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    Max Pages
                  </label>
                  <input
                    type="number"
                    value={maxPages}
                    onChange={(e) => {
                      setMaxPages(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)));
                      setSiteType('custom');
                    }}
                    min={1}
                    max={500}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    Max Depth
                  </label>
                  <input
                    type="number"
                    value={maxDepth}
                    onChange={(e) => {
                      setMaxDepth(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)));
                      setSiteType('custom');
                    }}
                    min={1}
                    max={10}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Estimated Duration */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icons.Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-main">Estimated Duration</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{estimatedDuration}</span>
                </div>
                <p className="text-[10px] text-secondary mt-1">
                  Based on {maxPages} pages with {requestDelayMs}ms delay
                </p>
              </div>
            </div>
          )}

          {activeTab === 'filters' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Domain Restriction */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Domain Restriction
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'same', label: 'Same Domain', desc: 'Only crawl exact domain' },
                    { id: 'subdomains', label: 'Include Subdomains', desc: 'Allow *.example.com' },
                    { id: 'any', label: 'Any Domain', desc: 'Follow all links' },
                  ].map(({ id, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setDomainRestriction(id as typeof domainRestriction);
                        setSiteType('custom');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        domainRestriction === id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${domainRestriction === id ? 'text-primary' : 'text-main'}`}>
                        {label}
                      </p>
                      <p className="text-[10px] text-secondary">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Include Patterns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    Include Patterns (Regex)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIncludePatterns(DOC_INCLUDE_PATTERNS.join(', '))}
                    className="text-[10px] text-primary hover:text-primary-hover font-medium"
                  >
                    Load Doc Patterns
                  </button>
                </div>
                <textarea
                  value={includePatterns}
                  onChange={(e) => {
                    setIncludePatterns(e.target.value);
                    setSiteType('custom');
                  }}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono"
                  placeholder="/docs/, /api/, /guide/"
                />
                <p className="text-[10px] text-secondary">
                  Comma-separated regex patterns. URLs must match at least one pattern to be crawled.
                </p>
              </div>

              {/* Exclude Patterns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    Exclude Patterns (Regex)
                  </label>
                  <button
                    type="button"
                    onClick={() => setExcludePatterns(COMMON_EXCLUDE_PATTERNS.join(', '))}
                    className="text-[10px] text-primary hover:text-primary-hover font-medium"
                  >
                    Reset to Defaults
                  </button>
                </div>
                <textarea
                  value={excludePatterns}
                  onChange={(e) => {
                    setExcludePatterns(e.target.value);
                    setSiteType('custom');
                  }}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono"
                  placeholder="login, signup, auth"
                />
                <p className="text-[10px] text-secondary">
                  Comma-separated patterns. URLs matching any pattern will be skipped.
                </p>
              </div>

              {patternErrors.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm font-medium text-red-500 mb-2">Pattern Errors</p>
                  <ul className="text-xs text-red-400 space-y-1">
                    {patternErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Content Types */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Content Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {['text/html', 'application/pdf', 'text/plain', 'application/json'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setContentTypes((prev) =>
                          prev.includes(type)
                            ? prev.filter((t) => t !== type)
                            : [...prev, type]
                        );
                        setSiteType('custom');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        contentTypes.includes(type)
                          ? 'bg-primary text-white'
                          : 'bg-surface-hover text-secondary hover:text-main'
                      }`}
                    >
                      {type.split('/')[1].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Auth Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Authentication Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'none', label: 'None', desc: 'No authentication' },
                    { id: 'bearer', label: 'Bearer Token', desc: 'Authorization: Bearer xxx' },
                    { id: 'basic', label: 'Basic Auth', desc: 'username:password' },
                    { id: 'cookie', label: 'Cookie', desc: 'Custom cookie header' },
                  ].map(({ id, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAuthType(id as typeof authType)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        authType === id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${authType === id ? 'text-primary' : 'text-main'}`}>
                        {label}
                      </p>
                      <p className="text-[10px] text-secondary">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {authType !== 'none' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    {authType === 'bearer' && 'Bearer Token'}
                    {authType === 'basic' && 'Credentials (username:password)'}
                    {authType === 'cookie' && 'Cookie Value'}
                  </label>
                  <input
                    type="password"
                    value={authCredentials}
                    onChange={(e) => setAuthCredentials(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder={
                      authType === 'bearer' ? 'your-token-here' :
                      authType === 'basic' ? 'username:password' :
                      'session=abc123; auth=xyz'
                    }
                  />
                  <p className="text-[10px] text-secondary flex items-center gap-1">
                    <Icons.Lock className="w-3 h-3" />
                    Credentials are stored securely and never logged
                  </p>
                </div>
              )}

              {/* Custom Headers */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Custom Headers (JSON)
                </label>
                <textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono"
                  placeholder='{"X-Custom-Header": "value"}'
                />
                <p className="text-[10px] text-secondary">
                  Additional headers to send with each request
                </p>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Enable Scheduling */}
              <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <Icons.Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold text-main">Enable Scheduled Crawls</p>
                    <p className="text-[10px] text-secondary">Automatically re-run this crawl on a schedule</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    scheduleEnabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      scheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {scheduleEnabled && (
                <>
                  {/* Frequency */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                      Frequency
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'daily', label: 'Daily' },
                        { id: 'weekly', label: 'Weekly' },
                        { id: 'monthly', label: 'Monthly' },
                      ].map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setScheduleFrequency(id as typeof scheduleFrequency)}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            scheduleFrequency === id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 text-main'
                          }`}
                        >
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Day Selection */}
                  {scheduleFrequency === 'weekly' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                        Day of Week
                      </label>
                      <select
                        value={scheduleDayOfWeek}
                        onChange={(e) => setScheduleDayOfWeek(parseInt(e.target.value))}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                          (day, i) => (
                            <option key={i} value={i}>
                              {day}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}

                  {scheduleFrequency === 'monthly' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                        Day of Month
                      </label>
                      <select
                        value={scheduleDayOfMonth}
                        onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Hour */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                      Time (UTC)
                    </label>
                    <select
                      value={scheduleHour}
                      onChange={(e) => setScheduleHour(parseInt(e.target.value))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour.toString().padStart(2, '0')}:00 UTC
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Rate Limiting */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-main uppercase tracking-widest">Rate Limiting</h3>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                      Request Delay
                    </label>
                    <span className="text-xs font-mono text-primary">{requestDelayMs}ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={requestDelayMs}
                    onChange={(e) => {
                      setRequestDelayMs(parseInt(e.target.value));
                      setSiteType('custom');
                    }}
                    className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-[10px] text-secondary">
                    Delay between requests. Higher values are more polite but slower.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest">
                    Max Concurrent Requests
                  </label>
                  <input
                    type="number"
                    value={maxConcurrent}
                    onChange={(e) => setMaxConcurrent(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={5}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <p className="text-[10px] text-secondary">
                    Number of pages to fetch simultaneously. Be careful with high values.
                  </p>
                </div>
              </div>

              {/* Robots.txt Info */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Icons.Robot className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-main">Robots.txt Compliance</p>
                    <p className="text-[10px] text-secondary mt-1">
                      The crawler automatically respects robots.txt rules and crawl-delay directives.
                      URLs blocked by robots.txt will be skipped.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sitemap Info */}
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Icons.Sitemap className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-main">Sitemap Discovery</p>
                    <p className="text-[10px] text-secondary mt-1">
                      Sitemaps declared in robots.txt are automatically parsed to discover additional pages
                      and improve crawl coverage.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-between items-center px-6">
          <div className="text-xs text-secondary">
            {maxPages} pages max, {maxDepth} levels deep
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !startUrl.trim()}
              className="px-8 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4" />
                  {editingJob ? 'Save Changes' : 'Create Job'}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CrawlerConfigModal;

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface PortalBuilderProps {
  portalId?: Id<"portals">;
  workspaceId?: Id<"workspaces">;
  onClose: () => void;
  onSaved: (portalId: Id<"portals">) => void;
}

interface BrandingConfig {
  logo?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  faviconUrl?: string;
}

type ThemeType = 'light' | 'dark' | 'system' | 'custom';
type AccessType = 'public' | 'password' | 'authenticated';

const fontFamilies = [
  { name: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { name: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Source Code Pro', value: '"Source Code Pro", monospace' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const PortalBuilder: React.FC<PortalBuilderProps> = ({
  portalId,
  workspaceId,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'seo' | 'access' | 'code'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [branding, setBranding] = useState<BrandingConfig>({
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
    fontFamily: 'Inter, system-ui, sans-serif',
  });
  const [theme, setTheme] = useState<ThemeType>('system');
  const [customCss, setCustomCss] = useState('');
  const [customHeader, setCustomHeader] = useState('');
  const [customFooter, setCustomFooter] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [socialImage, setSocialImage] = useState('');
  const [analyticsId, setAnalyticsId] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('public');
  const [password, setPassword] = useState('');
  const [homepageContent, setHomepageContent] = useState('');
  const [showRecentUpdates, setShowRecentUpdates] = useState(true);
  const [showFeaturedDocs, setShowFeaturedDocs] = useState(true);

  // Queries
  const existingPortal = useQuery(
    api.portals.getPortal,
    portalId ? { portalId } : 'skip'
  );

  const subdomainAvailability = useQuery(
    api.portals.checkSubdomainAvailability,
    subdomain.length >= 3 && subdomain !== existingPortal?.subdomain
      ? { subdomain }
      : 'skip'
  );

  // Mutations
  const createPortal = useMutation(api.portals.createPortal);
  const updatePortal = useMutation(api.portals.updatePortal);

  // Load existing portal data
  useEffect(() => {
    if (existingPortal) {
      setName(existingPortal.name);
      setSubdomain(existingPortal.subdomain);
      setCustomDomain(existingPortal.customDomain || '');
      setBranding(existingPortal.branding);
      setTheme(existingPortal.theme);
      setCustomCss(existingPortal.customCss || '');
      setCustomHeader(existingPortal.customHeader || '');
      setCustomFooter(existingPortal.customFooter || '');
      setSeoTitle(existingPortal.seoTitle || '');
      setSeoDescription(existingPortal.seoDescription || '');
      setSocialImage(existingPortal.socialImage || '');
      setAnalyticsId(existingPortal.analyticsId || '');
      setAccessType(existingPortal.accessType);
      setHomepageContent(existingPortal.homepageContent || '');
      setShowRecentUpdates(existingPortal.showRecentUpdates);
      setShowFeaturedDocs(existingPortal.showFeaturedDocs);
    }
  }, [existingPortal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (portalId) {
        await updatePortal({
          portalId,
          name,
          customDomain: customDomain || undefined,
          branding,
          theme,
          customCss: customCss || undefined,
          customHeader: customHeader || undefined,
          customFooter: customFooter || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          socialImage: socialImage || undefined,
          analyticsId: analyticsId || undefined,
          accessType,
          password: accessType === 'password' ? password : undefined,
          homepageContent: homepageContent || undefined,
          showRecentUpdates,
          showFeaturedDocs,
        });
        onSaved(portalId);
      } else {
        const newPortalId = await createPortal({
          workspaceId,
          name,
          subdomain,
        });

        // Update with additional settings
        await updatePortal({
          portalId: newPortalId,
          branding,
          theme,
          customCss: customCss || undefined,
          customHeader: customHeader || undefined,
          customFooter: customFooter || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          socialImage: socialImage || undefined,
          analyticsId: analyticsId || undefined,
          accessType,
          password: accessType === 'password' ? password : undefined,
          homepageContent: homepageContent || undefined,
          showRecentUpdates,
          showFeaturedDocs,
        });

        onSaved(newPortalId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save portal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setBranding({ ...branding, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Icons.Settings },
    { id: 'branding', label: 'Branding', icon: Icons.Palette },
    { id: 'seo', label: 'SEO', icon: Icons.Globe },
    { id: 'access', label: 'Access', icon: Icons.Lock },
    { id: 'code', label: 'Custom Code', icon: Icons.Code },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icons.Book className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">
                {portalId ? 'Edit Portal' : 'Create Documentation Portal'}
              </h2>
              <p className="text-xs text-secondary">
                Configure your public documentation site
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-black/5 dark:bg-black/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-secondary hover:text-main hover:bg-surface-hover'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Portal Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Documentation"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Subdomain
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-docs"
                      className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                      disabled={!!portalId}
                    />
                    <span className="text-secondary text-sm">.docusynth.io</span>
                  </div>
                  {subdomainAvailability && (
                    <p className={`mt-1 text-xs ${subdomainAvailability.available ? 'text-green-500' : 'text-red-500'}`}>
                      {subdomainAvailability.available ? 'Available' : subdomainAvailability.reason}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="docs.yourcompany.com"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Point a CNAME record to portals.docusynth.io
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Homepage Content (Markdown)
                  </label>
                  <textarea
                    value={homepageContent}
                    onChange={(e) => setHomepageContent(e.target.value)}
                    placeholder="# Welcome to our documentation..."
                    rows={6}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRecentUpdates}
                      onChange={(e) => setShowRecentUpdates(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <span className="text-sm text-main">Show Recent Updates</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFeaturedDocs}
                      onChange={(e) => setShowFeaturedDocs(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <span className="text-sm text-main">Show Featured Docs</span>
                  </label>
                </div>
              </div>
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Logo
                  </label>
                  <div className="flex items-center gap-4">
                    {branding.logo ? (
                      <div className="w-16 h-16 rounded-lg border border-border overflow-hidden">
                        <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-secondary">
                        <Icons.Image className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover cursor-pointer transition-colors inline-block"
                      >
                        Upload Logo
                      </label>
                      {branding.logo && (
                        <button
                          type="button"
                          onClick={() => setBranding({ ...branding, logo: undefined })}
                          className="ml-2 text-xs text-red-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.primaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-main font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.accentColor}
                        onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                        className="w-10 h-10 rounded border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.accentColor}
                        onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-main font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Font Family
                  </label>
                  <select
                    value={branding.fontFamily}
                    onChange={(e) => setBranding({ ...branding, fontFamily: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {fontFamilies.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Theme
                  </label>
                  <div className="flex items-center gap-3">
                    {(['light', 'dark', 'system'] as ThemeType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                          theme === t
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-secondary hover:text-main hover:bg-surface-hover'
                        }`}
                      >
                        {t === 'light' && <Icons.Sun className="w-4 h-4" />}
                        {t === 'dark' && <Icons.Moon className="w-4 h-4" />}
                        {t === 'system' && <Icons.Monitor className="w-4 h-4" />}
                        <span className="text-sm font-medium capitalize">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Preview
                  </label>
                  <div
                    className="p-6 rounded-lg border border-border"
                    style={{ fontFamily: branding.fontFamily }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {branding.logo ? (
                        <img src={branding.logo} alt="Logo" className="h-8" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: branding.primaryColor }}
                        >
                          <Icons.Book className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <span className="font-bold text-main">{name || 'Documentation'}</span>
                    </div>
                    <h3 style={{ color: branding.primaryColor }} className="text-lg font-bold mb-2">
                      Sample Heading
                    </h3>
                    <p className="text-sm text-secondary mb-3">
                      This is how your documentation text will appear.
                    </p>
                    <button
                      type="button"
                      style={{ backgroundColor: branding.accentColor }}
                      className="px-4 py-2 text-white text-sm font-medium rounded-lg"
                    >
                      Sample Button
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SEO Tab */}
            {activeTab === 'seo' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder={name || 'Documentation'}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    {(seoTitle || name || 'Documentation').length}/60 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    SEO Description
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="A brief description of your documentation..."
                    rows={3}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    {seoDescription.length}/160 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Social Image URL
                  </label>
                  <input
                    type="url"
                    value={socialImage}
                    onChange={(e) => setSocialImage(e.target.value)}
                    placeholder="https://example.com/og-image.png"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Recommended size: 1200x630 pixels
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Google Analytics ID
                  </label>
                  <input
                    type="text"
                    value={analyticsId}
                    onChange={(e) => setAnalyticsId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Search Engine Preview */}
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Search Engine Preview
                  </label>
                  <div className="p-4 bg-background rounded-lg border border-border">
                    <div className="text-blue-600 dark:text-blue-400 text-lg hover:underline cursor-pointer">
                      {seoTitle || name || 'Documentation'}
                    </div>
                    <div className="text-green-700 dark:text-green-500 text-sm">
                      {subdomain ? `${subdomain}.docusynth.io` : 'your-docs.docusynth.io'}
                    </div>
                    <div className="text-secondary text-sm mt-1">
                      {seoDescription || 'Your documentation description will appear here...'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Access Tab */}
            {activeTab === 'access' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Access Control
                  </label>
                  <div className="space-y-3">
                    {([
                      { value: 'public', label: 'Public', description: 'Anyone can view your documentation', icon: Icons.Globe },
                      { value: 'password', label: 'Password Protected', description: 'Visitors need a password to access', icon: Icons.Lock },
                      { value: 'authenticated', label: 'Authenticated Only', description: 'Only logged-in users can access', icon: Icons.Users },
                    ] as const).map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                          accessType === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-surface-hover'
                        }`}
                      >
                        <input
                          type="radio"
                          name="accessType"
                          value={option.value}
                          checked={accessType === option.value}
                          onChange={(e) => setAccessType(e.target.value as AccessType)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          accessType === option.value ? 'bg-primary text-white' : 'bg-surface text-secondary'
                        }`}>
                          <option.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-main">{option.label}</div>
                          <div className="text-sm text-secondary">{option.description}</div>
                        </div>
                        {accessType === option.value && (
                          <Icons.Check className="w-5 h-5 text-primary" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {accessType === 'password' && (
                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Portal Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a secure password"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required={accessType === 'password'}
                    />
                    <p className="mt-1 text-xs text-secondary">
                      Share this password with users who need access
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Custom Code Tab */}
            {activeTab === 'code' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Custom CSS
                  </label>
                  <textarea
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder={`/* Custom CSS */\n.portal-header {\n  /* your styles */\n}`}
                    rows={8}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Custom Header HTML
                  </label>
                  <textarea
                    value={customHeader}
                    onChange={(e) => setCustomHeader(e.target.value)}
                    placeholder="<!-- Custom header HTML -->"
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Add custom scripts, meta tags, or tracking codes
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-main mb-2">
                    Custom Footer HTML
                  </label>
                  <textarea
                    value={customFooter}
                    onChange={(e) => setCustomFooter(e.target.value)}
                    placeholder="<!-- Custom footer HTML -->"
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-black/5 dark:bg-black/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-main transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name || (!portalId && (!subdomain || subdomainAvailability?.available === false))}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icons.Check className="w-4 h-4" />
                {portalId ? 'Save Changes' : 'Create Portal'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortalBuilder;

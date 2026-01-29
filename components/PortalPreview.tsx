import React, { useState, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface PortalPreviewProps {
  portalId: Id<"portals">;
  onClose: () => void;
}

type DeviceSize = 'mobile' | 'tablet' | 'desktop';

const deviceSizes: Record<DeviceSize, { width: number; height: number; label: string }> = {
  mobile: { width: 375, height: 667, label: 'Mobile' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  desktop: { width: 1280, height: 800, label: 'Desktop' },
};

const PortalPreview: React.FC<PortalPreviewProps> = ({ portalId, onClose }) => {
  const [device, setDevice] = useState<DeviceSize>('desktop');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [currentPath, setCurrentPath] = useState('/');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const portal = useQuery(api.portals.getPortal, { portalId });
  const portalDocs = useQuery(api.portals.listPortalDocuments, { portalId });
  const navigation = useQuery(api.portalContent.getNavigation, { portalId });

  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Build preview URL
  const previewUrl = portal?.subdomain
    ? `https://${portal.subdomain}.docusynth.io${currentPath}`
    : '#';

  // For local development, we'll render the preview content directly
  const renderPreviewContent = () => {
    if (!portal) return null;

    const { branding, theme: portalTheme } = portal;
    const isDark = previewTheme === 'dark';

    return (
      <div
        className={`h-full overflow-auto ${isDark ? 'bg-background text-white' : 'bg-white text-gray-900'}`}
        style={{ fontFamily: branding.fontFamily }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 border-b"
          style={{
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              <span className="font-bold">{portal.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: isDark ? '#374151' : '#f3f4f6',
                }}
              >
                <Icons.Search className="w-4 h-4 opacity-50" />
                <span className="text-sm opacity-50">Search docs...</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-xs rounded bg-white/10">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex">
          {/* Sidebar */}
          <aside
            className="w-64 shrink-0 border-r h-[calc(100vh-57px)] sticky top-[57px] overflow-y-auto"
            style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
          >
            <nav className="p-4 space-y-2">
              <button
                onClick={() => setCurrentPath('/')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPath === '/'
                    ? `text-white`
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={currentPath === '/' ? { backgroundColor: branding.primaryColor } : {}}
              >
                <Icons.Home className="w-4 h-4 inline mr-2" />
                Home
              </button>

              {navigation?.items.map((item) => (
                <div key={item.id}>
                  {item.type === 'section' ? (
                    <div className="pt-4 pb-2">
                      <span
                        className="px-3 text-xs font-bold uppercase tracking-wider"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        {item.title}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCurrentPath(`/docs/${item.slug}`)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        currentPath === `/docs/${item.slug}`
                          ? 'text-white'
                          : isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={
                        currentPath === `/docs/${item.slug}`
                          ? { backgroundColor: branding.primaryColor }
                          : {}
                      }
                    >
                      {item.icon && <span className="mr-2">{item.icon}</span>}
                      {item.title}
                    </button>
                  )}
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 p-8">
            {currentPath === '/' ? (
              <div className="max-w-3xl">
                <h1
                  className="text-4xl font-bold mb-4"
                  style={{ color: branding.primaryColor }}
                >
                  Welcome to {portal.name}
                </h1>
                {portal.homepageContent ? (
                  <div className="prose dark:prose-invert">
                    {portal.homepageContent}
                  </div>
                ) : (
                  <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                    This is the homepage of your documentation portal.
                    Configure the homepage content in the portal settings.
                  </p>
                )}

                {portal.showFeaturedDocs && portalDocs && portalDocs.length > 0 && (
                  <div className="mt-12">
                    <h2 className="text-2xl font-bold mb-6">Documentation</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {portalDocs.slice(0, 4).map((doc) => (
                        <button
                          key={doc._id}
                          onClick={() => setCurrentPath(`/docs/${doc.slug}`)}
                          className={`text-left p-4 rounded-xl border transition-colors ${
                            isDark
                              ? 'border-border hover:bg-gray-800'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${branding.primaryColor}20` }}
                            >
                              <Icons.FileText
                                className="w-5 h-5"
                                style={{ color: branding.primaryColor }}
                              />
                            </div>
                            <div>
                              <div className="font-medium">
                                {doc.titleOverride || doc.documentTopic}
                              </div>
                              <div
                                className={`text-sm mt-1 line-clamp-2 ${
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}
                              >
                                {doc.documentContent}...
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl">
                {/* Document content preview */}
                {portalDocs
                  ?.filter((d) => currentPath === `/docs/${d.slug}`)
                  .map((doc) => (
                    <div key={doc._id}>
                      <h1
                        className="text-3xl font-bold mb-6"
                        style={{ color: branding.primaryColor }}
                      >
                        {doc.titleOverride || doc.documentTopic}
                      </h1>
                      <div className={`prose ${isDark ? 'prose-invert' : ''}`}>
                        <p>{doc.documentContent}...</p>
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          [Full document content would be rendered here]
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </main>

          {/* Table of Contents */}
          {currentPath !== '/' && (
            <aside
              className="w-56 shrink-0 border-l h-[calc(100vh-57px)] sticky top-[57px] p-4 hidden xl:block"
              style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
              >
                On this page
              </h3>
              <nav className="space-y-2">
                <a
                  href="#"
                  className={`block text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Overview
                </a>
                <a
                  href="#"
                  className={`block text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Getting Started
                </a>
                <a
                  href="#"
                  className={`block text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Configuration
                </a>
              </nav>
            </aside>
          )}
        </div>

        {/* Custom CSS */}
        {portal.customCss && (
          <style dangerouslySetInnerHTML={{ __html: portal.customCss }} />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-300" />
          </button>

          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            {(Object.keys(deviceSizes) as DeviceSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setDevice(size)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  device === size
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {size === 'mobile' && <Icons.Smartphone className="w-4 h-4" />}
                {size === 'tablet' && <Icons.Tablet className="w-4 h-4" />}
                {size === 'desktop' && <Icons.Monitor className="w-4 h-4" />}
                {deviceSizes[size].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setPreviewTheme('light')}
              className={`p-1.5 rounded-md transition-colors ${
                previewTheme === 'light'
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icons.Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewTheme('dark')}
              className={`p-1.5 rounded-md transition-colors ${
                previewTheme === 'dark'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icons.Moon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg">
            <Icons.Globe className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 font-mono">
              {portal?.subdomain}.docusynth.io{currentPath}
            </span>
          </div>

          <button
            onClick={refreshPreview}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <Icons.Refresh className="w-5 h-5 text-gray-300" />
          </button>

          {portal?.isPublished ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
            >
              <Icons.ExternalLink className="w-4 h-4" />
              Open Live
            </a>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600/20 text-yellow-500 rounded-lg text-sm">
              <Icons.AlertCircle className="w-4 h-4" />
              Not Published
            </div>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-auto">
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={{
            width: device === 'desktop' ? '100%' : deviceSizes[device].width,
            maxWidth: deviceSizes[device].width,
            height: device === 'desktop' ? '100%' : deviceSizes[device].height,
            maxHeight: '100%',
          }}
        >
          {renderPreviewContent()}
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-border text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {deviceSizes[device].width} x {deviceSizes[device].height}px
          </span>
          <span>
            {portalDocs?.filter((d) => !d.isDraft && !d.isSection).length || 0} published pages
          </span>
        </div>
        <div>
          Last updated: {portal?.updatedAt ? new Date(portal.updatedAt).toLocaleString() : 'N/A'}
        </div>
      </div>
    </div>
  );
};

export default PortalPreview;

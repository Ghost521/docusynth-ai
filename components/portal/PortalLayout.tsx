import React, { useState, useEffect, ReactNode } from 'react';
import { Icons } from '../Icon';

interface PortalBranding {
  logo?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  faviconUrl?: string;
}

interface NavItem {
  id: string;
  type: 'document' | 'section';
  slug: string;
  title: string;
  description?: string;
  position: number;
  parentId?: string;
  icon?: string;
  children: NavItem[];
}

interface ExternalLink {
  id: string;
  label: string;
  url?: string;
  icon?: string;
  position: number;
}

interface PortalLayoutProps {
  portalName: string;
  branding: PortalBranding;
  theme: 'light' | 'dark' | 'system' | 'custom';
  customCss?: string;
  customHeader?: string;
  customFooter?: string;
  navigation: {
    items: NavItem[];
    externalLinks: ExternalLink[];
  };
  currentSlug?: string;
  onNavigate: (slug: string) => void;
  onSearch: (query: string) => void;
  children: ReactNode;
}

const PortalLayout: React.FC<PortalLayoutProps> = ({
  portalName,
  branding,
  theme,
  customCss,
  customHeader,
  customFooter,
  navigation,
  currentSlug,
  onNavigate,
  onSearch,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Handle theme
  useEffect(() => {
    if (theme === 'dark') {
      setIsDark(true);
    } else if (theme === 'light') {
      setIsDark(false);
    } else if (theme === 'system') {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(darkModeMediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      darkModeMediaQuery.addEventListener('change', handler);
      return () => darkModeMediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
      setShowSearch(false);
    }
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const isActive = currentSlug === item.slug;
    const hasChildren = item.children && item.children.length > 0;

    if (item.type === 'section') {
      return (
        <div key={item.id} className="mt-6 first:mt-0">
          <div
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.title}
          </div>
          {hasChildren && (
            <div className="mt-1 space-y-1">
              {item.children.map((child) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={item.id}>
        <button
          onClick={() => onNavigate(item.slug)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            isActive
              ? 'text-white font-medium'
              : isDark
              ? 'text-gray-300 hover:bg-gray-800'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{
            paddingLeft: `${12 + depth * 12}px`,
            ...(isActive ? { backgroundColor: branding.primaryColor } : {}),
          }}
        >
          {item.icon && <span>{item.icon}</span>}
          <span className="truncate">{item.title}</span>
        </button>
        {hasChildren && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen ${isDark ? 'bg-background text-white' : 'bg-white text-gray-900'}`}
      style={{ fontFamily: branding.fontFamily }}
    >
      {/* Custom header HTML */}
      {customHeader && (
        <div dangerouslySetInnerHTML={{ __html: customHeader }} />
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{
          backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? '#374151' : '#e5e7eb',
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-surface-hover"
            >
              <Icons.Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <button
              onClick={() => onNavigate('')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {branding.logo ? (
                <img src={branding.logo} alt={portalName} className="h-8" />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <Icons.Book className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-bold text-lg hidden sm:block">{portalName}</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
              }}
            >
              <Icons.Search className="w-4 h-4 opacity-50" />
              <span className="text-sm opacity-50 hidden sm:block">Search docs...</span>
              <kbd
                className="ml-2 px-1.5 py-0.5 text-xs rounded hidden sm:block"
                style={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                }}
              >
                Ctrl+K
              </kbd>
            </button>

            {/* Theme toggle */}
            {theme === 'system' && (
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                {isDark ? (
                  <Icons.Sun className="w-5 h-5" />
                ) : (
                  <Icons.Moon className="w-5 h-5" />
                )}
              </button>
            )}

            {/* External links */}
            {navigation.externalLinks.slice(0, 3).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
              >
                {link.icon && <span>{link.icon}</span>}
                {link.label}
                <Icons.ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Search Modal */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSearch(false)}
        >
          <div
            className="w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearchSubmit}>
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                <Icons.Search className="w-5 h-5 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="flex-1 bg-transparent text-lg outline-none placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: isDark ? '#374151' : '#f3f4f6',
                  }}
                >
                  ESC
                </button>
              </div>
            </form>
            <div className="p-4 text-sm text-center opacity-50">
              Type to search the documentation
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex max-w-screen-2xl mx-auto">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 lg:top-[57px] z-30 lg:z-0 w-64 h-screen lg:h-[calc(100vh-57px)] overflow-y-auto border-r transform transition-transform lg:transform-none ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{
            backgroundColor: isDark ? '#111827' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
          }}
        >
          {/* Mobile close button */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
            <span className="font-bold">{portalName}</span>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-surface-hover"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {/* Home link */}
            <button
              onClick={() => {
                onNavigate('');
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                !currentSlug
                  ? 'text-white'
                  : isDark
                  ? 'text-gray-300 hover:bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={!currentSlug ? { backgroundColor: branding.primaryColor } : {}}
            >
              <Icons.Home className="w-4 h-4" />
              Home
            </button>

            {/* Navigation items */}
            {navigation.items.map((item) => renderNavItem(item))}
          </nav>
        </aside>

        {/* Page Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Custom footer HTML */}
      {customFooter && (
        <div dangerouslySetInnerHTML={{ __html: customFooter }} />
      )}

      {/* Default Footer */}
      <footer
        className="border-t mt-16"
        style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm opacity-50">
              <span>Powered by</span>
              <a
                href="https://docusynth.io"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:opacity-70"
                style={{ color: branding.primaryColor }}
              >
                DocuSynth
              </a>
            </div>
            <div className="flex items-center gap-4">
              {navigation.externalLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm opacity-50 hover:opacity-100 transition-opacity"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Custom CSS */}
      {customCss && (
        <style dangerouslySetInnerHTML={{ __html: customCss }} />
      )}

      {/* Dynamic CSS variables */}
      <style>{`
        :root {
          --portal-primary: ${branding.primaryColor};
          --portal-accent: ${branding.accentColor};
        }
      `}</style>
    </div>
  );
};

export default PortalLayout;

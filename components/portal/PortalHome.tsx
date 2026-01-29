import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Icons } from '../Icon';

interface FeaturedDoc {
  slug: string;
  title: string;
  description?: string;
  icon?: string;
}

interface RecentUpdate {
  slug: string;
  title: string;
  description?: string;
  updatedAt: number;
  icon?: string;
}

interface PortalHomeProps {
  portalName: string;
  homepageContent?: string;
  showFeaturedDocs: boolean;
  showRecentUpdates: boolean;
  featuredDocs: FeaturedDoc[];
  recentUpdates: RecentUpdate[];
  primaryColor: string;
  accentColor: string;
  isDark: boolean;
  onNavigate: (slug: string) => void;
  onSearch: () => void;
}

const PortalHome: React.FC<PortalHomeProps> = ({
  portalName,
  homepageContent,
  showFeaturedDocs,
  showRecentUpdates,
  featuredDocs,
  recentUpdates,
  primaryColor,
  accentColor,
  isDark,
  onNavigate,
  onSearch,
}) => {
  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="px-8 py-12 max-w-5xl mx-auto">
      {/* Hero Section */}
      <header className="text-center mb-16">
        <h1
          className="text-5xl font-bold mb-4"
          style={{ color: primaryColor }}
        >
          {portalName}
        </h1>

        {homepageContent ? (
          <div
            className={`prose max-w-2xl mx-auto ${isDark ? 'prose-invert' : ''}`}
          >
            <ReactMarkdown
              components={{
                p: ({ node, ...props }) => (
                  <p
                    className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                    {...props}
                  />
                ),
              }}
            >
              {homepageContent.split('\n').slice(0, 3).join('\n')}
            </ReactMarkdown>
          </div>
        ) : (
          <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Welcome to our documentation. Search for topics or browse the navigation.
          </p>
        )}

        {/* Search Box */}
        <button
          onClick={onSearch}
          className={`mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-xl border transition-all hover:shadow-lg ${
            isDark
              ? 'bg-gray-800 border-border hover:border-gray-600'
              : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <Icons.Search
            className="w-5 h-5"
            style={{ color: primaryColor }}
          />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            Search documentation...
          </span>
          <kbd
            className="px-2 py-1 text-xs rounded ml-4"
            style={{
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              color: isDark ? '#9ca3af' : '#6b7280',
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      </header>

      {/* Featured Docs */}
      {showFeaturedDocs && featuredDocs.length > 0 && (
        <section className="mb-16">
          <h2
            className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Documentation
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredDocs.map((doc) => (
              <button
                key={doc.slug}
                onClick={() => onNavigate(doc.slug)}
                className={`text-left p-5 rounded-xl border transition-all hover:shadow-lg ${
                  isDark
                    ? 'bg-gray-800/50 border-border hover:bg-gray-800 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                    }}
                  >
                    {doc.icon || (
                      <Icons.FileText
                        className="w-6 h-6"
                        style={{ color: primaryColor }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p
                        className={`text-sm line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <Icons.ChevronRight
                    className="w-5 h-5 shrink-0 mt-1"
                    style={{ color: primaryColor }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent Updates */}
      {showRecentUpdates && recentUpdates.length > 0 && (
        <section className="mb-16">
          <h2
            className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Recent Updates
          </h2>
          <div
            className={`rounded-xl border divide-y ${
              isDark
                ? 'bg-gray-800/50 border-border divide-gray-700'
                : 'bg-white border-gray-200 divide-gray-100 shadow-sm'
            }`}
          >
            {recentUpdates.map((update) => (
              <button
                key={update.slug}
                onClick={() => onNavigate(update.slug)}
                className={`w-full text-left p-4 flex items-center gap-4 transition-colors ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${accentColor}15`,
                  }}
                >
                  {update.icon || (
                    <Icons.FileText
                      className="w-5 h-5"
                      style={{ color: accentColor }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}
                  >
                    {update.title}
                  </h4>
                  {update.description && (
                    <p
                      className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      {update.description}
                    </p>
                  )}
                </div>
                <span
                  className={`text-sm shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  {formatDate(update.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section>
        <h2
          className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Quick Links
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <button
            onClick={onSearch}
            className={`p-4 rounded-xl border text-left transition-all ${
              isDark
                ? 'border-border hover:bg-gray-800/50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icons.Search
              className="w-6 h-6 mb-2"
              style={{ color: primaryColor }}
            />
            <h4
              className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Search
            </h4>
            <p
              className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Find what you need quickly
            </p>
          </button>

          {featuredDocs[0] && (
            <button
              onClick={() => onNavigate(featuredDocs[0].slug)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isDark
                  ? 'border-border hover:bg-gray-800/50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icons.Book
                className="w-6 h-6 mb-2"
                style={{ color: accentColor }}
              />
              <h4
                className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                Getting Started
              </h4>
              <p
                className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Start with the basics
              </p>
            </button>
          )}

          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'border-border' : 'border-gray-200'
            }`}
          >
            <Icons.HelpCircle
              className="w-6 h-6 mb-2"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            />
            <h4
              className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Need Help?
            </h4>
            <p
              className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Check our support resources
            </p>
          </div>
        </div>
      </section>

      {/* Full Homepage Content (if longer) */}
      {homepageContent && homepageContent.split('\n').length > 3 && (
        <section className="mt-16 pt-16 border-t" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <div className={`prose max-w-none ${isDark ? 'prose-invert' : ''}`}>
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-3xl font-bold mb-4" style={{ color: primaryColor }} {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: primaryColor }} {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className={`text-xl font-semibold mt-6 mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`} {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className={`mb-4 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`} {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className={`list-disc list-outside ml-4 mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="underline" style={{ color: primaryColor }} {...props} />
                ),
              }}
            >
              {homepageContent}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
};

export default PortalHome;

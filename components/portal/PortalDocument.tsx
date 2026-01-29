import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from '../Icon';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocumentNavigation {
  prev?: {
    slug: string;
    title: string;
  };
  next?: {
    slug: string;
    title: string;
  };
}

interface PortalDocumentProps {
  title: string;
  content: string;
  sources?: Array<{ title: string; url: string }>;
  publishedAt?: number;
  updatedAt?: number;
  navigation?: DocumentNavigation;
  primaryColor: string;
  isDark: boolean;
  onNavigate: (slug: string) => void;
}

const PortalDocument: React.FC<PortalDocumentProps> = ({
  title,
  content,
  sources,
  publishedAt,
  updatedAt,
  navigation,
  primaryColor,
  isDark,
  onNavigate,
}) => {
  const [activeSection, setActiveSection] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  // Extract table of contents from markdown
  const tableOfContents = useMemo(() => {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const toc: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*|__/g, '').replace(/`/g, '');
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      toc.push({ id, text, level });
    }

    return toc;
  }, [content]);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    tableOfContents.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [tableOfContents]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="flex gap-8 px-8 py-12 max-w-6xl mx-auto">
      {/* Main Content */}
      <article className="flex-1 min-w-0">
        {/* Header */}
        <header className="mb-8">
          <h1
            className="text-4xl font-bold mb-4"
            style={{ color: primaryColor }}
          >
            {title}
          </h1>
          {(publishedAt || updatedAt) && (
            <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {updatedAt && (
                <span>Last updated: {formatDate(updatedAt)}</span>
              )}
            </div>
          )}
        </header>

        {/* Content */}
        <div className={`prose max-w-none ${isDark ? 'prose-invert' : ''}`}>
          <ReactMarkdown
            components={{
              h1: ({ node, children, ...props }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return (
                  <h1
                    id={id}
                    className="text-3xl font-bold mt-10 mb-4 scroll-mt-24"
                    style={{ color: primaryColor }}
                    {...props}
                  >
                    {children}
                  </h1>
                );
              },
              h2: ({ node, children, ...props }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return (
                  <h2
                    id={id}
                    className="text-2xl font-bold mt-8 mb-4 scroll-mt-24"
                    style={{ color: primaryColor }}
                    {...props}
                  >
                    {children}
                  </h2>
                );
              },
              h3: ({ node, children, ...props }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return (
                  <h3
                    id={id}
                    className={`text-xl font-semibold mt-6 mb-3 scroll-mt-24 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    {...props}
                  >
                    {children}
                  </h3>
                );
              },
              p: ({ node, ...props }) => (
                <p className={`mb-4 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`} {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className={`list-disc list-outside ml-4 mb-4 space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className={`list-decimal list-outside ml-4 mb-4 space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} {...props} />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className={`border-l-4 pl-4 py-2 my-4 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                  style={{ borderLeftColor: primaryColor }}
                  {...props}
                />
              ),
              a: ({ node, href, children, ...props }) => (
                <a
                  href={href}
                  target={href?.startsWith('http') ? '_blank' : undefined}
                  rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="underline underline-offset-4 hover:opacity-70 transition-opacity"
                  style={{ color: primaryColor }}
                  {...props}
                >
                  {children}
                </a>
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');
                const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

                if (!inline && match) {
                  return (
                    <div className="relative group my-6 rounded-xl overflow-hidden border" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                      <div
                        className="flex items-center justify-between px-4 py-2 border-b"
                        style={{
                          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                          borderColor: isDark ? '#374151' : '#e5e7eb',
                        }}
                      >
                        <span className={`text-xs font-mono uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {match[1]}
                        </span>
                        <button
                          onClick={() => handleCopy(codeContent, codeId)}
                          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                            copied === codeId
                              ? 'bg-green-500/20 text-green-500'
                              : isDark
                              ? 'hover:bg-gray-700 text-gray-400'
                              : 'hover:bg-gray-200 text-gray-500'
                          }`}
                        >
                          {copied === codeId ? (
                            <>
                              <Icons.Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Icons.Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <SyntaxHighlighter
                        style={isDark ? vscDarkPlus : vs}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: '1.25rem',
                          fontSize: '0.875rem',
                          backgroundColor: isDark ? '#111827' : '#ffffff',
                        }}
                        {...props}
                      >
                        {codeContent}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                return (
                  <code
                    className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                      isDark
                        ? 'bg-gray-800 text-orange-400'
                        : 'bg-gray-100 text-orange-600'
                    }`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-6">
                  <table
                    className={`min-w-full border-collapse ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    {...props}
                  />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th
                  className={`px-4 py-2 text-left font-semibold border-b ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                  }`}
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td
                  className={`px-4 py-2 border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}
                  {...props}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className={`mt-12 pt-8 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Sources
            </h3>
            <ul className="space-y-2">
              {sources.map((source, index) => (
                <li key={index}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                    style={{ color: primaryColor }}
                  >
                    <Icons.ExternalLink className="w-4 h-4" />
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation */}
        {navigation && (navigation.prev || navigation.next) && (
          <div
            className={`mt-12 pt-8 border-t flex items-center justify-between gap-4 ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            {navigation.prev ? (
              <button
                onClick={() => onNavigate(navigation.prev!.slug)}
                className={`flex-1 max-w-xs p-4 rounded-xl border text-left transition-colors ${
                  isDark
                    ? 'border-gray-700 hover:bg-gray-800'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Previous
                </div>
                <div className="flex items-center gap-2">
                  <Icons.ChevronLeft className="w-4 h-4" style={{ color: primaryColor }} />
                  <span className="font-medium" style={{ color: primaryColor }}>
                    {navigation.prev.title}
                  </span>
                </div>
              </button>
            ) : (
              <div />
            )}

            {navigation.next && (
              <button
                onClick={() => onNavigate(navigation.next!.slug)}
                className={`flex-1 max-w-xs p-4 rounded-xl border text-right transition-colors ${
                  isDark
                    ? 'border-gray-700 hover:bg-gray-800'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Next
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-medium" style={{ color: primaryColor }}>
                    {navigation.next.title}
                  </span>
                  <Icons.ChevronRight className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
              </button>
            )}
          </div>
        )}
      </article>

      {/* Table of Contents Sidebar */}
      {tableOfContents.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-24">
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-4 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              On this page
            </h4>
            <nav className="space-y-2">
              {tableOfContents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`block w-full text-left text-sm transition-colors ${
                    activeSection === item.id
                      ? ''
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  style={{
                    paddingLeft: `${(item.level - 1) * 12}px`,
                    color: activeSection === item.id ? primaryColor : undefined,
                    fontWeight: activeSection === item.id ? 500 : 400,
                  }}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
};

export default PortalDocument;

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icon';
import { StreamingStatus } from '../hooks/useStreamingGeneration';

interface StreamingDocViewerProps {
  content: string;
  status: StreamingStatus;
  progress: number;
  provider?: string | null;
  model?: string | null;
  sources?: Array<{ title: string; url: string }>;
  error?: string | null;
  onCancel?: () => void;
  onSave?: () => void;
  onRetry?: () => void;
}

const StreamingDocViewer: React.FC<StreamingDocViewerProps> = ({
  content,
  status,
  progress,
  provider,
  model,
  sources = [],
  error,
  onCancel,
  onSave,
  onRetry,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (status === 'streaming' && shouldAutoScrollRef.current && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, status]);

  // Detect if user has scrolled up
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldAutoScrollRef.current = isAtBottom;
    }
  };

  // Reset auto-scroll when streaming starts
  useEffect(() => {
    if (status === 'streaming') {
      shouldAutoScrollRef.current = true;
    }
  }, [status]);

  const renderStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-yellow-500">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold">Initializing...</span>
          </div>
        );
      case 'streaming':
        return (
          <div className="flex items-center gap-2 text-primary">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs font-bold">Generating...</span>
            <span className="text-xs text-secondary">{Math.round(progress)}%</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-500">
            <Icons.Check className="w-4 h-4" />
            <span className="text-xs font-bold">Completed</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-500">
            <Icons.X className="w-4 h-4" />
            <span className="text-xs font-bold">Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
        <div className="flex items-center gap-4">
          {renderStatusBadge()}
          {provider && model && (
            <span className="text-[10px] text-secondary">
              via {provider} ({model})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(status === 'pending' || status === 'streaming') && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          {status === 'completed' && onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1.5"
            >
              <Icons.Download className="w-3 h-3" />
              Save Document
            </button>
          )}
          {status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1.5"
            >
              <Icons.RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(status === 'pending' || status === 'streaming') && (
        <div className="h-1 bg-border">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6"
      >
        {status === 'pending' && !content && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-primary/10 rounded-full mb-4 animate-pulse">
              <Icons.Sparkles className="w-8 h-8 text-primary" />
            </div>
            <p className="text-secondary text-sm">Starting generation...</p>
            <p className="text-secondary/60 text-xs mt-1">This may take a moment</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-red-500/10 rounded-full mb-4">
              <Icons.X className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-500 text-sm font-bold">Generation Failed</p>
            <p className="text-secondary text-xs mt-1 max-w-md">{error}</p>
          </div>
        )}

        {content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match && !String(children).includes('\n');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !mt-2 !mb-2"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {status === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            )}
          </div>
        )}
      </div>

      {/* Footer with sources */}
      {status === 'completed' && sources.length > 0 && (
        <div className="p-4 border-t border-border bg-surface">
          <p className="text-[10px] text-secondary uppercase tracking-widest mb-2">
            Sources ({sources.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 5).map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary-hover underline truncate max-w-[200px]"
                title={source.title}
              >
                {source.title}
              </a>
            ))}
            {sources.length > 5 && (
              <span className="text-xs text-secondary">
                +{sources.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Character count during streaming */}
      {(status === 'streaming' || status === 'completed') && content && (
        <div className="px-4 py-2 border-t border-border bg-surface/50 flex items-center justify-between text-[10px] text-secondary">
          <span>
            {content.length.toLocaleString()} characters
            {status === 'streaming' && ' (streaming...)'}
          </span>
          <span>
            ~{Math.round(content.length / 4).toLocaleString()} tokens
          </span>
        </div>
      )}
    </div>
  );
};

export default StreamingDocViewer;

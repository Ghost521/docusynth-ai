import React, { useState } from "react";
import { Icons } from "./Icon";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Id } from "../convex/_generated/dataModel";

interface Source {
  documentId: Id<"documents">;
  documentTitle: string;
  snippet: string;
  relevanceScore: number;
}

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[];
  provider?: string;
  model?: string;
  tokensUsed?: number;
  rating?: "up" | "down";
  isRegenerated?: boolean;
  timestamp: number;
  onRate?: (rating: "up" | "down" | null) => void;
  onRegenerate?: () => void;
  onSourceClick?: (documentId: Id<"documents">) => void;
  onCopy?: () => void;
  isDark?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  sources,
  provider,
  model,
  tokensUsed,
  rating,
  isRegenerated,
  timestamp,
  onRate,
  onRegenerate,
  onSourceClick,
  onCopy,
  isDark = true,
}) => {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-3 shadow-md">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
          <p className="text-[10px] mt-2 opacity-60 text-right">
            {formatTime(timestamp)}
          </p>
        </div>
      </div>
    );
  }

  if (role === "system") {
    return (
      <div className="flex justify-center">
        <div className="bg-surface-hover/50 text-secondary text-xs px-4 py-2 rounded-full">
          {content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start group">
      <div className="max-w-[85%]">
        {/* Message bubble */}
        <div className="bg-background border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
          {/* Regenerated indicator */}
          {isRegenerated && (
            <div className="flex items-center gap-1 text-[10px] text-secondary mb-2">
              <Icons.RefreshCw className="w-3 h-3" />
              <span>Regenerated response</span>
            </div>
          )}

          {/* Content with markdown */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  return isInline ? (
                    <code
                      className="bg-surface-hover px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={isDark ? vscDarkPlus : vs}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: "0.5rem 0",
                        borderRadius: "0.5rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  );
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Sources section */}
          {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-xs text-secondary hover:text-main transition-colors"
              >
                <Icons.FileText className="w-3.5 h-3.5" />
                <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
                <Icons.ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showSources ? "rotate-180" : ""}`}
                />
              </button>

              {showSources && (
                <div className="mt-2 space-y-2">
                  {sources.map((source, i) => (
                    <button
                      key={i}
                      onClick={() => onSourceClick?.(source.documentId)}
                      className="w-full text-left p-2 bg-surface-hover/50 rounded-lg hover:bg-surface-hover transition-colors group/source"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-main truncate">
                          {source.documentTitle}
                        </span>
                        <span className="text-[10px] text-secondary">
                          {Math.round(source.relevanceScore * 100)}% match
                        </span>
                      </div>
                      <p className="text-[11px] text-secondary mt-1 line-clamp-2">
                        {source.snippet}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-primary mt-1 opacity-0 group-hover/source:opacity-100 transition-opacity">
                        <Icons.ExternalLink className="w-3 h-3" />
                        <span>View document</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Provider info */}
          {provider && (
            <p className="text-[10px] text-secondary mt-2">
              via {provider} ({model})
              {tokensUsed && ` - ${tokensUsed.toLocaleString()} tokens`}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
            title="Copy message"
          >
            {copied ? (
              <Icons.Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Icons.Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Regenerate */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
              title="Regenerate response"
            >
              <Icons.RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Rating buttons */}
          {onRate && (
            <>
              <button
                onClick={() => onRate(rating === "up" ? null : "up")}
                className={`p-1.5 rounded-lg transition-colors ${
                  rating === "up"
                    ? "text-green-500 bg-green-500/10"
                    : "text-secondary hover:text-main hover:bg-surface-hover"
                }`}
                title="Helpful"
              >
                <Icons.TrendUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRate(rating === "down" ? null : "down")}
                className={`p-1.5 rounded-lg transition-colors ${
                  rating === "down"
                    ? "text-red-500 bg-red-500/10"
                    : "text-secondary hover:text-main hover:bg-surface-hover"
                }`}
                title="Not helpful"
              >
                <Icons.TrendDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Timestamp */}
          <span className="text-[10px] text-secondary ml-2">
            {formatTime(timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;

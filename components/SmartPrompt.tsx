import React, { useState, useEffect, useCallback } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { useStalenessScore, DocumentSuggestion } from '../hooks/useSuggestions';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type PromptType = 'stale' | 'related' | 'new_content' | 'update_available';

export interface SmartPromptData {
  id: string;
  type: PromptType;
  title: string;
  message: string;
  documentId?: Id<'documents'>;
  actionLabel?: string;
  secondaryActionLabel?: string;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
}

interface SmartPromptProps {
  /** Current document being viewed */
  currentDocumentId?: Id<'documents'>;
  /** List of suggestions to show as prompts */
  suggestions?: DocumentSuggestion[];
  /** Callback when action is clicked */
  onAction?: (prompt: SmartPromptData, action: 'primary' | 'secondary' | 'dismiss' | 'snooze') => void;
  /** Callback when a document is selected */
  onSelectDocument?: (documentId: Id<'documents'>) => void;
  /** Position of prompts */
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  /** Maximum prompts to show at once */
  maxPrompts?: number;
}

// ═══════════════════════════════════════════════════════════════
// Single Prompt Component
// ═══════════════════════════════════════════════════════════════

interface PromptToastProps {
  prompt: SmartPromptData;
  onAction: (action: 'primary' | 'secondary' | 'dismiss' | 'snooze') => void;
  onClose: () => void;
}

const PromptToast: React.FC<PromptToastProps> = ({ prompt, onAction, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  // Auto-dismiss after 10 seconds if not hovered
  useEffect(() => {
    if (isHovered) return;

    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [isHovered, handleClose]);

  const getIcon = () => {
    switch (prompt.type) {
      case 'stale':
        return <Icons.AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'related':
        return <Icons.Sparkles className="w-5 h-5 text-purple-500" />;
      case 'new_content':
        return <Icons.Bell className="w-5 h-5 text-blue-500" />;
      case 'update_available':
        return <Icons.Refresh className="w-5 h-5 text-green-500" />;
      default:
        return <Icons.Info className="w-5 h-5 text-primary" />;
    }
  };

  const getBorderColor = () => {
    switch (prompt.priority) {
      case 'high':
        return 'border-l-amber-500';
      case 'medium':
        return 'border-l-blue-500';
      default:
        return 'border-l-border';
    }
  };

  return (
    <div
      className={`
        w-80 bg-surface border border-border rounded-lg shadow-lg overflow-hidden
        border-l-4 ${getBorderColor()}
        transform transition-all duration-200
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-main line-clamp-1">{prompt.title}</h4>
          <p className="text-xs text-secondary mt-0.5 line-clamp-2">{prompt.message}</p>
        </div>
        <button
          onClick={() => {
            onAction('dismiss');
            handleClose();
          }}
          className="shrink-0 p-1 rounded hover:bg-surface-hover text-secondary hover:text-main transition-colors"
        >
          <Icons.X className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {prompt.actionLabel && (
          <button
            onClick={() => {
              onAction('primary');
              handleClose();
            }}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            {prompt.actionLabel}
          </button>
        )}
        {prompt.secondaryActionLabel && (
          <button
            onClick={() => {
              onAction('secondary');
              handleClose();
            }}
            className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-main border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            {prompt.secondaryActionLabel}
          </button>
        )}
        <button
          onClick={() => {
            onAction('snooze');
            handleClose();
          }}
          className="p-1.5 text-secondary hover:text-main border border-border rounded-lg hover:bg-surface-hover transition-colors"
          title="Remind me later"
        >
          <Icons.Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {!isHovered && (
        <div className="h-0.5 bg-surface-hover">
          <div
            className="h-full bg-primary/30 transition-all duration-[10000ms] ease-linear"
            style={{ width: '0%', animation: 'shrink 10s linear forwards' }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Staleness Alert Component
// ═══════════════════════════════════════════════════════════════

interface StalenessAlertProps {
  documentId: Id<'documents'>;
  documentTitle: string;
  onRefresh: () => void;
  onDismiss: () => void;
}

export const StalenessAlert: React.FC<StalenessAlertProps> = ({
  documentId,
  documentTitle,
  onRefresh,
  onDismiss,
}) => {
  const { score, daysSinceUpdate, reasons, shouldUpdate, isLoading } = useStalenessScore(documentId);

  if (isLoading || !shouldUpdate) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <Icons.AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">
          This document may be outdated
        </h4>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          Last updated {daysSinceUpdate} days ago. {reasons[0]}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
          >
            Refresh Content
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1 text-xs text-amber-700 dark:text-amber-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

const SmartPrompt: React.FC<SmartPromptProps> = ({
  currentDocumentId,
  suggestions = [],
  onAction,
  onSelectDocument,
  position = 'bottom-right',
  maxPrompts = 3,
}) => {
  const [prompts, setPrompts] = useState<SmartPromptData[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozedIds, setSnoozedIds] = useState<Map<string, number>>(new Map());

  // Convert suggestions to prompts
  useEffect(() => {
    const now = Date.now();
    const newPrompts: SmartPromptData[] = [];

    for (const suggestion of suggestions) {
      const promptId = `${suggestion.documentId}-${suggestion.suggestionType}`;

      // Skip if dismissed
      if (dismissedIds.has(promptId)) continue;

      // Skip if snoozed and not yet expired
      const snoozedUntil = snoozedIds.get(promptId);
      if (snoozedUntil && snoozedUntil > now) continue;

      let prompt: SmartPromptData | null = null;

      switch (suggestion.suggestionType) {
        case 'stale':
          prompt = {
            id: promptId,
            type: 'stale',
            title: 'Document may need review',
            message: suggestion.reason,
            documentId: suggestion.documentId,
            actionLabel: 'Review Now',
            secondaryActionLabel: 'Ignore',
            timestamp: now,
            priority: 'medium',
          };
          break;
        case 'related':
        case 'context':
          prompt = {
            id: promptId,
            type: 'related',
            title: 'Related document found',
            message: `"${suggestion.topic}" - ${suggestion.reason}`,
            documentId: suggestion.documentId,
            actionLabel: 'View',
            timestamp: now,
            priority: 'low',
          };
          break;
      }

      if (prompt) {
        newPrompts.push(prompt);
      }
    }

    // Sort by priority and limit
    const sortedPrompts = newPrompts
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, maxPrompts);

    setPrompts(sortedPrompts);
  }, [suggestions, dismissedIds, snoozedIds, maxPrompts]);

  const handleAction = useCallback(
    (prompt: SmartPromptData, action: 'primary' | 'secondary' | 'dismiss' | 'snooze') => {
      switch (action) {
        case 'dismiss':
        case 'secondary':
          setDismissedIds((prev) => new Set([...prev, prompt.id]));
          break;
        case 'snooze':
          // Snooze for 1 hour
          setSnoozedIds((prev) => new Map([...prev, [prompt.id, Date.now() + 60 * 60 * 1000]]));
          break;
        case 'primary':
          if (prompt.documentId && onSelectDocument) {
            onSelectDocument(prompt.documentId);
          }
          break;
      }

      onAction?.(prompt, action);
    },
    [onAction, onSelectDocument]
  );

  const handleClose = useCallback((promptId: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== promptId));
  }, []);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 space-y-2`}>
      {prompts.map((prompt) => (
        <PromptToast
          key={prompt.id}
          prompt={prompt}
          onAction={(action) => handleAction(prompt, action)}
          onClose={() => handleClose(prompt.id)}
        />
      ))}
    </div>
  );
};

export default SmartPrompt;

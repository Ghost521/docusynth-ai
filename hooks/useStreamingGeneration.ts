import { useState, useCallback, useEffect, useRef } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

export type StreamingStatus = 'idle' | 'pending' | 'streaming' | 'completed' | 'error';

interface StreamingSession {
  id: Id<"streamingSessions">;
  topic: string;
  content: string;
  status: StreamingStatus;
  provider?: string | null;
  model?: string | null;
  sources?: Array<{ title: string; url: string }>;
  error?: string | null;
  startedAt: number;
  completedAt?: number | null;
}

interface UseStreamingGenerationOptions {
  onComplete?: (session: StreamingSession) => void;
  onError?: (error: string) => void;
  autoSave?: boolean;
  projectId?: Id<"projects">;
}

interface UseStreamingGenerationReturn {
  status: StreamingStatus;
  content: string;
  sources: Array<{ title: string; url: string }>;
  error: string | null;
  provider: string | null;
  model: string | null;
  progress: number; // Estimated progress 0-100
  startGeneration: (
    topic: string,
    mode: 'search' | 'crawl' | 'github',
    preferredProvider?: 'gemini' | 'claude' | 'openai'
  ) => Promise<void>;
  cancelGeneration: () => void;
  saveDocument: () => Promise<Id<"documents"> | null>;
  reset: () => void;
}

export function useStreamingGeneration(
  options: UseStreamingGenerationOptions = {}
): UseStreamingGenerationReturn {
  const { onComplete, onError, autoSave = false, projectId } = options;

  const [sessionId, setSessionId] = useState<Id<"streamingSessions"> | null>(null);
  const [localStatus, setLocalStatus] = useState<StreamingStatus>('idle');
  const [localContent, setLocalContent] = useState('');
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const startStreamingAction = useAction(api.streaming.startStreamingGeneration);
  const saveSessionAction = useAction(api.streaming.saveStreamingSession);

  // Query the streaming session for real-time updates
  const session = useQuery(
    api.streaming.getSession,
    sessionId ? { sessionId } : "skip"
  );

  // Track if we've already triggered onComplete
  const completedRef = useRef(false);

  // Update local state when session changes
  useEffect(() => {
    if (session) {
      setLocalContent(session.content);
      setSources(session.sources || []);
      setProvider(session.provider ?? null);
      setModel(session.model ?? null);

      if (session.status === 'pending' || session.status === 'streaming') {
        setLocalStatus(session.status);
      } else if (session.status === 'completed') {
        setLocalStatus('completed');
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(session as StreamingSession);

          if (autoSave && sessionId) {
            saveSessionAction({ sessionId, projectId })
              .catch(console.error);
          }
        }
      } else if (session.status === 'error') {
        setLocalStatus('error');
        setError(session.error ?? 'Unknown error');
        onError?.(session.error ?? 'Unknown error');
      }
    }
  }, [session, onComplete, onError, autoSave, sessionId, projectId, saveSessionAction]);

  const startGeneration = useCallback(async (
    topic: string,
    mode: 'search' | 'crawl' | 'github',
    preferredProvider?: 'gemini' | 'claude' | 'openai'
  ) => {
    // Reset state
    setLocalContent('');
    setSources([]);
    setError(null);
    setProvider(null);
    setModel(null);
    setLocalStatus('pending');
    completedRef.current = false;
    setStartTime(Date.now());

    try {
      const result = await startStreamingAction({
        topic,
        mode,
        projectId,
        preferredProvider,
      });

      setSessionId(result.sessionId);
    } catch (err: any) {
      setLocalStatus('error');
      setError(err.message || 'Failed to start generation');
      onError?.(err.message || 'Failed to start generation');
    }
  }, [startStreamingAction, projectId, onError]);

  const cancelGeneration = useCallback(() => {
    // Currently we can't actually cancel a running action
    // But we can stop displaying updates by clearing the session ID
    setSessionId(null);
    setLocalStatus('idle');
    setLocalContent('');
    setSources([]);
    setError(null);
  }, []);

  const saveDocument = useCallback(async (): Promise<Id<"documents"> | null> => {
    if (!sessionId || localStatus !== 'completed') {
      return null;
    }

    try {
      const result = await saveSessionAction({ sessionId, projectId });
      return result.documentId;
    } catch (err: any) {
      setError(err.message || 'Failed to save document');
      return null;
    }
  }, [sessionId, localStatus, saveSessionAction, projectId]);

  const reset = useCallback(() => {
    setSessionId(null);
    setLocalStatus('idle');
    setLocalContent('');
    setSources([]);
    setError(null);
    setProvider(null);
    setModel(null);
    setStartTime(null);
    completedRef.current = false;
  }, []);

  // Estimate progress based on content length and time
  // This is a rough heuristic since we don't know total length
  const progress = useCallback(() => {
    if (localStatus === 'idle') return 0;
    if (localStatus === 'completed') return 100;
    if (localStatus === 'error') return 0;

    // Estimate based on typical document length (~20k chars) and time (~60s)
    const contentProgress = Math.min((localContent.length / 20000) * 100, 90);
    const timeProgress = startTime
      ? Math.min(((Date.now() - startTime) / 60000) * 100, 90)
      : 0;

    // Use the higher of the two estimates, capped at 90%
    return Math.max(contentProgress, timeProgress);
  }, [localStatus, localContent.length, startTime]);

  return {
    status: localStatus,
    content: localContent,
    sources,
    error,
    provider,
    model,
    progress: progress(),
    startGeneration,
    cancelGeneration,
    saveDocument,
    reset,
  };
}

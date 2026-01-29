import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface UseCollaborativeEditingOptions {
  documentId: Id<"documents"> | null;
  initialContent: string;
  sessionId: string;
  baseVersion: number;
  onConflict?: (currentContent: string, currentVersion: number) => void;
  onSaveComplete?: () => void;
  debounceMs?: number;
}

interface CollaborativeEditingState {
  content: string;
  localVersion: number;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  conflictContent: string | null;
}

export function useCollaborativeEditing({
  documentId,
  initialContent,
  sessionId,
  baseVersion,
  onConflict,
  onSaveComplete,
  debounceMs = 1000,
}: UseCollaborativeEditingOptions) {
  const [state, setState] = useState<CollaborativeEditingState>({
    content: initialContent,
    localVersion: baseVersion,
    isSaving: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    conflictContent: null,
  });

  const applyEdit = useMutation(api.presence.applyEdit);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const pendingContent = useRef<string | null>(null);

  // Reset state when document changes
  useEffect(() => {
    setState({
      content: initialContent,
      localVersion: baseVersion,
      isSaving: false,
      hasUnsavedChanges: false,
      lastSavedAt: null,
      conflictContent: null,
    });
  }, [documentId, initialContent, baseVersion]);

  // Save content to server
  const saveContent = useCallback(
    async (content: string) => {
      if (!documentId) return;

      setState((prev) => ({ ...prev, isSaving: true }));

      try {
        const result = await applyEdit({
          documentId,
          content,
          baseVersion: state.localVersion,
          sessionId,
        });

        if (result.conflict) {
          // Handle conflict
          setState((prev) => ({
            ...prev,
            isSaving: false,
            conflictContent: result.currentContent || null,
          }));
          onConflict?.(result.currentContent || "", result.currentVersion || 0);
        } else {
          // Success
          setState((prev) => ({
            ...prev,
            isSaving: false,
            hasUnsavedChanges: false,
            localVersion: result.newVersion || prev.localVersion + 1,
            lastSavedAt: Date.now(),
            conflictContent: null,
          }));
          onSaveComplete?.();
        }
      } catch (error) {
        console.error("Failed to save:", error);
        setState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [documentId, state.localVersion, sessionId, applyEdit, onConflict, onSaveComplete]
  );

  // Debounced save
  const debouncedSave = useCallback(
    (content: string) => {
      pendingContent.current = content;

      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }

      saveTimeout.current = setTimeout(() => {
        if (pendingContent.current !== null) {
          saveContent(pendingContent.current);
          pendingContent.current = null;
        }
      }, debounceMs);
    },
    [saveContent, debounceMs]
  );

  // Update content locally
  const setContent = useCallback(
    (newContent: string) => {
      setState((prev) => ({
        ...prev,
        content: newContent,
        hasUnsavedChanges: true,
      }));
      debouncedSave(newContent);
    },
    [debouncedSave]
  );

  // Force immediate save
  const saveNow = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    if (state.hasUnsavedChanges) {
      saveContent(state.content);
    }
  }, [state.hasUnsavedChanges, state.content, saveContent]);

  // Resolve conflict by accepting server version
  const acceptServerVersion = useCallback(
    (serverContent: string, serverVersion: number) => {
      setState((prev) => ({
        ...prev,
        content: serverContent,
        localVersion: serverVersion,
        hasUnsavedChanges: false,
        conflictContent: null,
      }));
    },
    []
  );

  // Resolve conflict by keeping local version (will overwrite server)
  const keepLocalVersion = useCallback(() => {
    setState((prev) => ({ ...prev, conflictContent: null }));
    saveContent(state.content);
  }, [state.content, saveContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, []);

  return {
    content: state.content,
    setContent,
    isSaving: state.isSaving,
    hasUnsavedChanges: state.hasUnsavedChanges,
    lastSavedAt: state.lastSavedAt,
    hasConflict: state.conflictContent !== null,
    conflictContent: state.conflictContent,
    saveNow,
    acceptServerVersion,
    keepLocalVersion,
    localVersion: state.localVersion,
  };
}

import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { v4 as uuidv4 } from "uuid";

// Generate a unique session ID for this browser tab
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("docusynth_session_id");
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem("docusynth_session_id", sessionId);
  }
  return sessionId;
};

interface UsePresenceOptions {
  documentId: Id<"documents"> | null;
  enabled?: boolean;
}

interface PresenceUser {
  id: Id<"documentPresence">;
  sessionId: string;
  userId: string;
  userName: string;
  userImage?: string;
  userColor: string;
  cursorPosition?: number;
  selectionStart?: number;
  selectionEnd?: number;
  isEditing: boolean;
  isCurrentUser: boolean;
}

export function usePresence({ documentId, enabled = true }: UsePresenceOptions) {
  const sessionId = useRef(getSessionId());
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const isJoined = useRef(false);

  const joinDocument = useMutation(api.presence.joinDocument);
  const leaveDocument = useMutation(api.presence.leaveDocument);
  const updateCursor = useMutation(api.presence.updateCursor);
  const updateEditingState = useMutation(api.presence.updateEditingState);
  const heartbeat = useMutation(api.presence.heartbeat);

  // Get presence for the document
  const presence = useQuery(
    api.presence.getDocumentPresence,
    documentId && enabled ? { documentId } : "skip"
  ) as PresenceUser[] | undefined;

  // Get collab state
  const collabState = useQuery(
    api.presence.getCollabState,
    documentId && enabled ? { documentId } : "skip"
  );

  // Join document when it changes
  useEffect(() => {
    if (!documentId || !enabled) {
      isJoined.current = false;
      return;
    }

    const join = async () => {
      try {
        await joinDocument({ documentId, sessionId: sessionId.current });
        isJoined.current = true;
      } catch (error) {
        console.error("Failed to join document:", error);
      }
    };

    join();

    // Start heartbeat
    heartbeatInterval.current = setInterval(() => {
      if (isJoined.current) {
        heartbeat({ sessionId: sessionId.current }).catch(console.error);
      }
    }, 10000); // Every 10 seconds

    // Leave on cleanup
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (isJoined.current) {
        leaveDocument({ sessionId: sessionId.current }).catch(console.error);
        isJoined.current = false;
      }
    };
  }, [documentId, enabled, joinDocument, leaveDocument, heartbeat]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isJoined.current) {
        // Page hidden - send heartbeat to keep presence but could mark as away
        heartbeat({ sessionId: sessionId.current }).catch(console.error);
      }
    };

    const handleBeforeUnload = () => {
      if (isJoined.current) {
        // Use sendBeacon for reliable cleanup on page close
        // Note: This won't work with Convex mutations directly,
        // but the heartbeat timeout will clean up stale presence
        isJoined.current = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [heartbeat]);

  // Update cursor position
  const setCursorPosition = useCallback(
    (position?: number, selectionStart?: number, selectionEnd?: number) => {
      if (!isJoined.current) return;
      updateCursor({
        sessionId: sessionId.current,
        cursorPosition: position,
        selectionStart,
        selectionEnd,
      }).catch(console.error);
    },
    [updateCursor]
  );

  // Update editing state
  const setIsEditing = useCallback(
    (editing: boolean) => {
      if (!isJoined.current) return;
      updateEditingState({
        sessionId: sessionId.current,
        isEditing: editing,
      }).catch(console.error);
    },
    [updateEditingState]
  );

  // Get other users (excluding current user)
  const otherUsers = presence?.filter((p) => !p.isCurrentUser) || [];
  const currentUser = presence?.find((p) => p.isCurrentUser);

  return {
    presence: otherUsers,
    currentUser,
    allPresence: presence || [],
    collabState,
    sessionId: sessionId.current,
    setCursorPosition,
    setIsEditing,
    isConnected: isJoined.current,
  };
}

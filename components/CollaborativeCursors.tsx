import React from "react";

interface PresenceUser {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  cursorPosition?: number;
  selectionStart?: number;
  selectionEnd?: number;
  isEditing: boolean;
}

interface CollaborativeCursorsProps {
  users: PresenceUser[];
  content: string;
  containerRef: React.RefObject<HTMLElement>;
}

// Component to render a single cursor
function CollaboratorCursor({
  user,
  position,
}: {
  user: PresenceUser;
  position: { top: number; left: number };
}) {
  return (
    <div
      className="absolute pointer-events-none z-40 transition-all duration-75"
      style={{
        top: position.top,
        left: position.left,
        transform: "translateY(-2px)",
      }}
    >
      {/* Cursor line */}
      <div
        className="w-0.5 h-5 animate-pulse"
        style={{ backgroundColor: user.userColor }}
      />
      {/* Name tag */}
      <div
        className="absolute top-0 left-0 -translate-y-full px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
        style={{ backgroundColor: user.userColor }}
      >
        {user.userName}
      </div>
    </div>
  );
}

// Component to render a selection highlight
function CollaboratorSelection({
  user,
  rects,
}: {
  user: PresenceUser;
  rects: DOMRect[];
}) {
  return (
    <>
      {rects.map((rect, i) => (
        <div
          key={i}
          className="absolute pointer-events-none z-30"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: user.userColor,
            opacity: 0.2,
          }}
        />
      ))}
    </>
  );
}

export default function CollaborativeCursors({
  users,
  content,
  containerRef,
}: CollaborativeCursorsProps) {
  // Note: This is a simplified implementation.
  // For production, you'd need to:
  // 1. Map character positions to actual DOM positions
  // 2. Handle text reflow and wrapping
  // 3. Update positions on scroll/resize

  // Filter users with cursor positions
  const usersWithCursors = users.filter(
    (u) => u.cursorPosition !== undefined && u.cursorPosition !== null
  );

  if (usersWithCursors.length === 0 || !containerRef.current) {
    return null;
  }

  // For now, show a simple indicator that other users have cursors
  // A full implementation would require a rich text editor or
  // complex DOM position calculations
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Show editing indicators as floating badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {usersWithCursors.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs text-white shadow-lg animate-pulse"
            style={{ backgroundColor: user.userColor }}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="font-medium">{user.userName}</span>
            {user.isEditing && <span className="opacity-75">typing...</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility hook to track cursor position in a textarea/contenteditable
export function useCursorTracking(
  ref: React.RefObject<HTMLTextAreaElement | HTMLDivElement>,
  onCursorChange: (position?: number, selectionStart?: number, selectionEnd?: number) => void
) {
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleSelectionChange = () => {
      if (element instanceof HTMLTextAreaElement) {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        if (start === end) {
          onCursorChange(start);
        } else {
          onCursorChange(undefined, start, end);
        }
      }
    };

    const handleKeyUp = handleSelectionChange;
    const handleMouseUp = handleSelectionChange;
    const handleFocus = handleSelectionChange;

    element.addEventListener("keyup", handleKeyUp);
    element.addEventListener("mouseup", handleMouseUp);
    element.addEventListener("focus", handleFocus);

    // Also listen for selection changes on the document
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      element.removeEventListener("keyup", handleKeyUp);
      element.removeEventListener("mouseup", handleMouseUp);
      element.removeEventListener("focus", handleFocus);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [ref, onCursorChange]);
}

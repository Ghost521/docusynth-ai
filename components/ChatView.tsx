import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";
import DocumentChat from "./DocumentChat";
import ChatSidebar from "./ChatSidebar";
import ChatContextPanel from "./ChatContextPanel";

interface ChatViewProps {
  initialConversationId?: Id<"chatConversations">;
  documentId?: Id<"documents">;
  projectId?: Id<"projects">;
  onClose?: () => void;
  onDocumentSelect?: (documentId: Id<"documents">) => void;
  isFullPage?: boolean;
}

/**
 * Full-featured chat view with sidebar, main chat area, and context panel.
 * Can be used as a full-page view or embedded in a panel.
 */
const ChatView: React.FC<ChatViewProps> = ({
  initialConversationId,
  documentId,
  projectId,
  onClose,
  onDocumentSelect,
  isFullPage = true,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"chatConversations"> | undefined>(
    initialConversationId
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(true);
  const [chatKey, setChatKey] = useState(0); // Force re-mount on new conversation

  // Get selected conversation details
  const conversation = useQuery(
    api.chatConversations.getConversation,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );

  const contextStats = useQuery(
    api.chatConversations.getContextStats,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );

  // Handle selecting a conversation
  const handleSelectConversation = (id: Id<"chatConversations">) => {
    setSelectedConversationId(id);
    setChatKey((prev) => prev + 1);
  };

  // Handle creating a new conversation
  const handleNewConversation = () => {
    setSelectedConversationId(undefined);
    setChatKey((prev) => prev + 1);
  };

  // Handle document click from chat
  const handleDocumentClick = (docId: Id<"documents">) => {
    onDocumentSelect?.(docId);
  };

  return (
    <div className={`flex h-full bg-background ${isFullPage ? "min-h-screen" : ""}`}>
      {/* Sidebar */}
      <ChatSidebar
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        projectId={projectId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-main">
                {conversation?.title || "Knowledge Base Chat"}
              </h1>
              <p className="text-xs text-secondary">
                {conversation?.type === "document"
                  ? "Document Q&A"
                  : conversation?.type === "project"
                  ? "Project Chat"
                  : "Search across all your documents"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Context panel toggle */}
            <button
              onClick={() => setContextPanelCollapsed(!contextPanelCollapsed)}
              className={`p-2 rounded-lg transition-colors ${
                !contextPanelCollapsed
                  ? "text-primary bg-primary/10"
                  : "text-secondary hover:text-main hover:bg-surface-hover"
              }`}
              title="Toggle context panel"
            >
              <Icons.Layers className="w-5 h-5" />
            </button>

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <DocumentChat
            key={chatKey}
            isOpen={true}
            onClose={() => {}}
            documentId={conversation?.documentIds?.[0]}
            projectId={conversation?.projectId || projectId}
            documentTitle={conversation?.documents?.[0]?.topic}
            chatType={
              conversation?.type || (documentId ? "document" : projectId ? "project" : "knowledge_base")
            }
            onDocumentSelect={handleDocumentClick}
            mode="panel"
          />
        </div>
      </div>

      {/* Context panel */}
      {!contextPanelCollapsed && selectedConversationId && (
        <ChatContextPanel
          conversationId={selectedConversationId}
          documents={conversation?.documents || []}
          stats={contextStats}
          onDocumentClick={handleDocumentClick}
          isCollapsed={false}
          onToggleCollapse={() => setContextPanelCollapsed(true)}
        />
      )}
    </div>
  );
};

export default ChatView;

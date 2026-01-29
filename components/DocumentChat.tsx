import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChatContextPanel from "./ChatContextPanel";
import { SourceCitationList } from "./SourceCitation";

// ===============================================================
// Types
// ===============================================================

interface ChatMessageType {
  _id: Id<"chatMessages">;
  conversationId: Id<"chatConversations">;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Array<{
    documentId: Id<"documents">;
    documentTitle: string;
    snippet: string;
    relevanceScore: number;
  }>;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  rating?: "up" | "down";
  isRegenerated: boolean;
  createdAt: number;
}

interface DocumentChatProps {
  documentId?: Id<"documents">;
  projectId?: Id<"projects">;
  documentTitle?: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  onDocumentSelect?: (documentId: Id<"documents">) => void;
  mode?: "modal" | "panel" | "fullscreen";
  chatType?: "document" | "project" | "knowledge_base" | "general";
}

// ===============================================================
// Component
// ===============================================================

const DocumentChat: React.FC<DocumentChatProps> = ({
  documentId,
  projectId,
  documentTitle,
  projectName,
  isOpen,
  onClose,
  onDocumentSelect,
  mode = "modal",
  chatType,
}) => {
  // State
  const [conversationId, setConversationId] = useState<Id<"chatConversations"> | undefined>();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine chat type
  const effectiveChatType = chatType || (documentId ? "document" : projectId ? "project" : "knowledge_base");

  // Queries
  const conversation = useQuery(
    api.chatConversations.getConversation,
    conversationId ? { conversationId } : "skip"
  );

  const contextStats = useQuery(
    api.chatConversations.getContextStats,
    conversationId ? { conversationId } : "skip"
  );

  // Mutations
  const createConversationMutation = useMutation(api.chatConversations.createConversation);
  const rateMessageMutation = useMutation(api.chatConversations.rateMessage);
  const addDocumentMutation = useMutation(api.chatConversations.addDocumentToContext);
  const removeDocumentMutation = useMutation(api.chatConversations.removeDocumentFromContext);

  // Actions
  const sendMessageAction = useAction(api.chatConversations.sendMessage);
  const regenerateAction = useAction(api.chatConversations.regenerateResponse);
  const getSuggestionsAction = useAction(api.chatConversations.getSuggestedQuestions);
  const exportAction = useAction(api.chatConversations.exportConversation);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversation?.messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Sync messages from query
  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation?.messages]);

  // Clear messages when context changes
  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    loadSuggestions();
  }, [documentId, projectId]);

  // Load suggestions
  const loadSuggestions = useCallback(async () => {
    try {
      const suggestions = await getSuggestionsAction({
        conversationId,
        documentId,
        projectId,
      });
      setSuggestedQuestions(suggestions || []);
    } catch (err) {
      // Use default suggestions
      setSuggestedQuestions([
        documentId ? "What are the key features?" : projectId ? "Summarize this project" : "What topics can I explore?",
        documentId ? "Show me a code example" : projectId ? "How do these docs relate?" : "Find documents about...",
        documentId ? "What are the best practices?" : projectId ? "What patterns are used?" : "Compare concepts in my docs",
        documentId ? "Explain this section" : projectId ? "What's missing?" : "Suggest related reading",
      ]);
    }
  }, [conversationId, documentId, projectId, getSuggestionsAction]);

  // Handle submit
  const handleSubmit = async (message: string) => {
    if (!message.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      // Create conversation if needed
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        activeConversationId = await createConversationMutation({
          title: documentTitle
            ? `Chat: ${documentTitle}`
            : projectName
            ? `Chat: ${projectName}`
            : "New Chat",
          documentIds: documentId ? [documentId] : [],
          projectId,
          type: effectiveChatType,
        });
        setConversationId(activeConversationId);
      }

      // Optimistic update for user message
      const optimisticUserMessage: ChatMessageType = {
        _id: `temp-${Date.now()}` as any,
        conversationId: activeConversationId,
        userId: "",
        role: "user",
        content: message.trim(),
        isRegenerated: false,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, optimisticUserMessage]);

      // Send message
      const result = await sendMessageAction({
        conversationId: activeConversationId,
        message: message.trim(),
        useSemanticSearch: effectiveChatType === "knowledge_base",
      });

      // The query will update with the actual messages
      // Refresh suggestions after response
      setTimeout(loadSuggestions, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      // Remove optimistic message
      setMessages((prev) => prev.filter((m) => !m._id.toString().startsWith("temp-")));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle regenerate
  const handleRegenerate = async (messageId: Id<"chatMessages">) => {
    if (!conversationId) return;

    setIsLoading(true);
    setError(null);

    try {
      await regenerateAction({ messageId });
    } catch (err: any) {
      setError(err.message || "Failed to regenerate response");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle rate message
  const handleRateMessage = async (messageId: Id<"chatMessages">, rating: "up" | "down" | null) => {
    try {
      await rateMessageMutation({ messageId, rating });
    } catch (err: any) {
      console.error("Failed to rate message:", err);
    }
  };

  // Handle export
  const handleExport = async (format: "markdown" | "json" | "text") => {
    if (!conversationId) return;

    try {
      const content = await exportAction({ conversationId, format });
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-export.${format === "markdown" ? "md" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to export conversation");
    }
  };

  // Handle clear chat
  const handleClearChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    loadSuggestions();
  };

  // Handle document click
  const handleDocumentClick = (docId: Id<"documents">) => {
    onDocumentSelect?.(docId);
  };

  // Handle add document
  const handleAddDocument = async (docId: Id<"documents">) => {
    if (!conversationId) return;
    try {
      await addDocumentMutation({ conversationId, documentId: docId });
    } catch (err: any) {
      setError(err.message || "Failed to add document");
    }
  };

  // Handle remove document
  const handleRemoveDocument = async (docId: Id<"documents">) => {
    if (!conversationId) return;
    try {
      await removeDocumentMutation({ conversationId, documentId: docId });
    } catch (err: any) {
      setError(err.message || "Failed to remove document");
    }
  };

  // Get title
  const getTitle = () => {
    if (documentTitle) return `Chat: ${documentTitle}`;
    if (projectName) return `Chat: ${projectName} Project`;
    if (effectiveChatType === "knowledge_base") return "Knowledge Base Chat";
    return "AI Assistant";
  };

  // Get subtitle
  const getSubtitle = () => {
    switch (effectiveChatType) {
      case "document":
        return "Ask questions about this document";
      case "project":
        return "Ask questions about all project docs";
      case "knowledge_base":
        return "Search and chat across all your documents";
      default:
        return "General AI assistant with web search";
    }
  };

  if (!isOpen) return null;

  // Render content
  const renderContent = () => (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">{getTitle()}</h2>
              <p className="text-[10px] text-secondary">{getSubtitle()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Context panel toggle */}
            {conversationId && (
              <button
                onClick={() => setShowContextPanel(!showContextPanel)}
                className={`p-2 rounded-lg transition-colors ${
                  showContextPanel
                    ? "text-primary bg-primary/10"
                    : "text-secondary hover:text-main hover:bg-surface-hover"
                }`}
                title="Toggle context panel"
              >
                <Icons.Layers className="w-4 h-4" />
              </button>
            )}

            {/* Export */}
            {conversationId && messages.length > 0 && (
              <div className="relative group">
                <button
                  className="p-2 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
                  title="Export conversation"
                >
                  <Icons.Download className="w-4 h-4" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-20 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full px-3 py-1.5 text-xs text-left text-secondary hover:text-main hover:bg-surface-hover"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => handleExport("json")}
                    className="w-full px-3 py-1.5 text-xs text-left text-secondary hover:text-main hover:bg-surface-hover"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport("text")}
                    className="w-full px-3 py-1.5 text-xs text-left text-secondary hover:text-main hover:bg-surface-hover"
                  >
                    Plain Text
                  </button>
                </div>
              </div>
            )}

            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-2 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
                title="Clear chat"
              >
                <Icons.Trash className="w-4 h-4" />
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5 text-secondary hover:text-main" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Icons.Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-main mb-2">Start a Conversation</h3>
              <p className="text-sm text-secondary mb-6 max-w-md">{getSubtitle()}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(suggestion)}
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-secondary hover:text-main hover:border-primary/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message._id}
              role={message.role}
              content={message.content}
              sources={message.sources}
              provider={message.provider}
              model={message.model}
              tokensUsed={message.tokensUsed}
              rating={message.rating}
              isRegenerated={message.isRegenerated}
              timestamp={message.createdAt}
              onRate={
                message.role === "assistant"
                  ? (rating) => handleRateMessage(message._id, rating)
                  : undefined
              }
              onRegenerate={
                message.role === "assistant"
                  ? () => handleRegenerate(message._id)
                  : undefined
              }
              onSourceClick={handleDocumentClick}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-background border border-border rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
                <Icons.AlertTriangle className="w-4 h-4" />
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 p-1 hover:bg-red-500/10 rounded"
                >
                  <Icons.X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder={
            effectiveChatType === "knowledge_base"
              ? "Search and ask across all your documents..."
              : "Ask a question..."
          }
          suggestedQuestions={messages.length === 0 ? [] : suggestedQuestions}
          showTokenCount={!!conversationId}
        />
      </div>

      {/* Context panel */}
      {showContextPanel && conversationId && (
        <ChatContextPanel
          conversationId={conversationId}
          documents={conversation?.documents || []}
          stats={contextStats}
          onRemoveDocument={handleRemoveDocument}
          onDocumentClick={handleDocumentClick}
        />
      )}
    </div>
  );

  // Render based on mode
  if (mode === "panel") {
    return (
      <div className="h-full bg-surface border-l border-border">{renderContent()}</div>
    );
  }

  if (mode === "fullscreen") {
    return (
      <div className="fixed inset-0 z-[100] bg-background">{renderContent()}</div>
    );
  }

  // Modal mode (default)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {renderContent()}
      </div>
    </div>
  );
};

export default DocumentChat;

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// ===============================================================
// Types
// ===============================================================

export interface ChatMessage {
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
  ratingFeedback?: string;
  isRegenerated: boolean;
  regeneratedFrom?: Id<"chatMessages">;
  createdAt: number;
}

export interface ChatConversation {
  _id: Id<"chatConversations">;
  userId: string;
  title: string;
  documentIds: Id<"documents">[];
  projectId?: Id<"projects">;
  type: "document" | "project" | "knowledge_base" | "general";
  messageCount: number;
  lastMessageAt: number;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ContextStats {
  documentCount: number;
  messageCount: number;
  estimatedTokens: {
    documents: number;
    messages: number;
    total: number;
  };
  maxTokens: number;
  utilizationPercent: number;
}

export type ChatType = "document" | "project" | "knowledge_base" | "general";

interface UseChatOptions {
  conversationId?: Id<"chatConversations">;
  documentId?: Id<"documents">;
  projectId?: Id<"projects">;
  type?: ChatType;
  autoScroll?: boolean;
}

interface UseChatReturn {
  // State
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  contextStats: ContextStats | null;
  suggestedQuestions: string[];

  // Actions
  sendMessage: (content: string) => Promise<void>;
  regenerateMessage: (messageId: Id<"chatMessages">) => Promise<void>;
  rateMessage: (messageId: Id<"chatMessages">, rating: "up" | "down" | null, feedback?: string) => Promise<void>;
  createConversation: (options?: { title?: string; documentIds?: Id<"documents">[]; projectId?: Id<"projects">; type?: ChatType }) => Promise<Id<"chatConversations">>;
  updateConversation: (updates: { title?: string; isPinned?: boolean; isArchived?: boolean }) => Promise<void>;
  deleteConversation: () => Promise<void>;
  addDocument: (documentId: Id<"documents">) => Promise<void>;
  removeDocument: (documentId: Id<"documents">) => Promise<void>;
  clearError: () => void;
  exportConversation: (format: "markdown" | "json" | "text") => Promise<string>;
  refreshSuggestions: () => Promise<void>;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

// ===============================================================
// Hook Implementation
// ===============================================================

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    conversationId: initialConversationId,
    documentId,
    projectId,
    type = "general",
    autoScroll = true,
  } = options;

  // State
  const [conversationId, setConversationId] = useState<Id<"chatConversations"> | undefined>(initialConversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const updateConversationMutation = useMutation(api.chatConversations.updateConversation);
  const deleteConversationMutation = useMutation(api.chatConversations.deleteConversation);
  const addDocumentMutation = useMutation(api.chatConversations.addDocumentToContext);
  const removeDocumentMutation = useMutation(api.chatConversations.removeDocumentFromContext);
  const rateMessageMutation = useMutation(api.chatConversations.rateMessage);

  // Actions
  const sendMessageAction = useAction(api.chatConversations.sendMessage);
  const regenerateAction = useAction(api.chatConversations.regenerateResponse);
  const getSuggestionsAction = useAction(api.chatConversations.getSuggestedQuestions);
  const exportAction = useAction(api.chatConversations.exportConversation);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, autoScroll]);

  // Load suggestions when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadSuggestions();
    }
  }, [conversationId, documentId, projectId]);

  // Helper to load suggestions
  const loadSuggestions = useCallback(async () => {
    try {
      const suggestions = await getSuggestionsAction({
        conversationId,
        documentId,
        projectId,
      });
      setSuggestedQuestions(suggestions || []);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
      setSuggestedQuestions([
        "What are the key features?",
        "Can you show me an example?",
        "What are the best practices?",
        "How do I get started?",
      ]);
    }
  }, [conversationId, documentId, projectId, getSuggestionsAction]);

  // Create conversation
  const createConversation = useCallback(async (opts?: {
    title?: string;
    documentIds?: Id<"documents">[];
    projectId?: Id<"projects">;
    type?: ChatType;
  }) => {
    try {
      setError(null);
      const newConversationId = await createConversationMutation({
        title: opts?.title,
        documentIds: opts?.documentIds || (documentId ? [documentId] : []),
        projectId: opts?.projectId || projectId,
        type: opts?.type || type,
      });
      setConversationId(newConversationId);
      return newConversationId;
    } catch (err: any) {
      setError(err.message || "Failed to create conversation");
      throw err;
    }
  }, [createConversationMutation, documentId, projectId, type]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    setIsSending(true);

    try {
      // Create conversation if needed
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        activeConversationId = await createConversation();
      }

      // Send the message
      await sendMessageAction({
        conversationId: activeConversationId,
        message: content.trim(),
        useSemanticSearch: type === "knowledge_base",
      });

      // Refresh suggestions after response
      setTimeout(loadSuggestions, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [conversationId, createConversation, sendMessageAction, type, loadSuggestions]);

  // Regenerate message
  const regenerateMessage = useCallback(async (messageId: Id<"chatMessages">) => {
    if (!conversationId) return;

    setError(null);
    setIsSending(true);

    try {
      await regenerateAction({ messageId });
    } catch (err: any) {
      setError(err.message || "Failed to regenerate response");
    } finally {
      setIsSending(false);
    }
  }, [conversationId, regenerateAction]);

  // Rate message
  const rateMessage = useCallback(async (
    messageId: Id<"chatMessages">,
    rating: "up" | "down" | null,
    feedback?: string
  ) => {
    try {
      await rateMessageMutation({ messageId, rating, feedback });
    } catch (err: any) {
      setError(err.message || "Failed to rate message");
    }
  }, [rateMessageMutation]);

  // Update conversation
  const updateConversation = useCallback(async (updates: {
    title?: string;
    isPinned?: boolean;
    isArchived?: boolean;
  }) => {
    if (!conversationId) return;

    try {
      await updateConversationMutation({ conversationId, ...updates });
    } catch (err: any) {
      setError(err.message || "Failed to update conversation");
    }
  }, [conversationId, updateConversationMutation]);

  // Delete conversation
  const deleteConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      await deleteConversationMutation({ conversationId });
      setConversationId(undefined);
    } catch (err: any) {
      setError(err.message || "Failed to delete conversation");
    }
  }, [conversationId, deleteConversationMutation]);

  // Add document to context
  const addDocument = useCallback(async (docId: Id<"documents">) => {
    if (!conversationId) return;

    try {
      await addDocumentMutation({ conversationId, documentId: docId });
    } catch (err: any) {
      setError(err.message || "Failed to add document");
    }
  }, [conversationId, addDocumentMutation]);

  // Remove document from context
  const removeDocument = useCallback(async (docId: Id<"documents">) => {
    if (!conversationId) return;

    try {
      await removeDocumentMutation({ conversationId, documentId: docId });
    } catch (err: any) {
      setError(err.message || "Failed to remove document");
    }
  }, [conversationId, removeDocumentMutation]);

  // Export conversation
  const exportConversation = useCallback(async (format: "markdown" | "json" | "text") => {
    if (!conversationId) throw new Error("No conversation to export");

    try {
      return await exportAction({ conversationId, format });
    } catch (err: any) {
      setError(err.message || "Failed to export conversation");
      throw err;
    }
  }, [conversationId, exportAction]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    await loadSuggestions();
  }, [loadSuggestions]);

  return {
    // State
    conversation: conversation || null,
    messages: conversation?.messages || [],
    isLoading: conversation === undefined && !!conversationId,
    isSending,
    error,
    contextStats: contextStats || null,
    suggestedQuestions,

    // Actions
    sendMessage,
    regenerateMessage,
    rateMessage,
    createConversation,
    updateConversation,
    deleteConversation,
    addDocument,
    removeDocument,
    clearError,
    exportConversation,
    refreshSuggestions,

    // Refs
    messagesEndRef,
  };
}

export default useChat;

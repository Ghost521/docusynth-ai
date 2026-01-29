import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface ChatConversation {
  _id: Id<"chatConversations">;
  title: string;
  type: "document" | "project" | "knowledge_base" | "general";
  messageCount: number;
  lastMessageAt: number;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: number;
}

interface ChatSidebarProps {
  selectedConversationId?: Id<"chatConversations">;
  onSelectConversation: (id: Id<"chatConversations">) => void;
  onNewConversation: () => void;
  projectId?: Id<"projects">;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  projectId,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"chatConversations"> | null>(null);

  // Fetch conversations
  const conversations = useQuery(api.chatConversations.listConversations, {
    limit: 50,
    includeArchived: showArchived,
    projectId,
  });

  // Mutations
  const updateConversation = useMutation(api.chatConversations.updateConversation);
  const deleteConversation = useMutation(api.chatConversations.deleteConversation);

  // Filter conversations by search
  const filteredConversations = conversations?.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by pinned/unpinned
  const pinnedConversations = filteredConversations?.filter((c) => c.isPinned) || [];
  const unpinnedConversations = filteredConversations?.filter((c) => !c.isPinned) || [];

  const handlePin = async (conversationId: Id<"chatConversations">, isPinned: boolean) => {
    await updateConversation({ conversationId, isPinned: !isPinned });
  };

  const handleArchive = async (conversationId: Id<"chatConversations">) => {
    await updateConversation({ conversationId, isArchived: true });
  };

  const handleDelete = async (conversationId: Id<"chatConversations">) => {
    await deleteConversation({ conversationId });
    setDeleteConfirmId(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getTypeIcon = (type: ChatConversation["type"]) => {
    switch (type) {
      case "document":
        return <Icons.FileText className="w-3.5 h-3.5" />;
      case "project":
        return <Icons.Folder className="w-3.5 h-3.5" />;
      case "knowledge_base":
        return <Icons.Database className="w-3.5 h-3.5" />;
      default:
        return <Icons.MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full border-r border-border bg-surface flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <Icons.ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          title="New conversation"
        >
          <Icons.Plus className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-y-auto py-2 space-y-1">
          {conversations?.slice(0, 10).map((conv) => (
            <button
              key={conv._id}
              onClick={() => onSelectConversation(conv._id)}
              className={`p-2 rounded-lg transition-colors ${
                selectedConversationId === conv._id
                  ? "bg-primary/10 text-primary"
                  : "text-secondary hover:text-main hover:bg-surface-hover"
              }`}
              title={conv.title}
            >
              {getTypeIcon(conv.type)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 h-full border-r border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-main">Conversations</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="New conversation"
            >
              <Icons.Plus className="w-4 h-4" />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
                title="Collapse sidebar"
              >
                <Icons.ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Icons.Loader className="w-5 h-5 text-secondary animate-spin" />
          </div>
        ) : filteredConversations?.length === 0 ? (
          <div className="text-center py-8">
            <Icons.MessageSquare className="w-8 h-8 text-secondary/30 mx-auto mb-2" />
            <p className="text-sm text-secondary">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
            <button
              onClick={onNewConversation}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Pinned section */}
            {pinnedConversations.length > 0 && (
              <>
                <p className="text-[10px] text-secondary uppercase tracking-wider px-2 py-1">
                  Pinned
                </p>
                {pinnedConversations.map((conv) => (
                  <ConversationItem
                    key={conv._id}
                    conversation={conv}
                    isSelected={selectedConversationId === conv._id}
                    onSelect={() => onSelectConversation(conv._id)}
                    onPin={() => handlePin(conv._id, conv.isPinned)}
                    onArchive={() => handleArchive(conv._id)}
                    onDelete={() => setDeleteConfirmId(conv._id)}
                    deleteConfirmId={deleteConfirmId}
                    onConfirmDelete={() => handleDelete(conv._id)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    formatDate={formatDate}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </>
            )}

            {/* Recent section */}
            {unpinnedConversations.length > 0 && (
              <>
                {pinnedConversations.length > 0 && (
                  <p className="text-[10px] text-secondary uppercase tracking-wider px-2 py-1 mt-3">
                    Recent
                  </p>
                )}
                {unpinnedConversations.map((conv) => (
                  <ConversationItem
                    key={conv._id}
                    conversation={conv}
                    isSelected={selectedConversationId === conv._id}
                    onSelect={() => onSelectConversation(conv._id)}
                    onPin={() => handlePin(conv._id, conv.isPinned)}
                    onArchive={() => handleArchive(conv._id)}
                    onDelete={() => setDeleteConfirmId(conv._id)}
                    deleteConfirmId={deleteConfirmId}
                    onConfirmDelete={() => handleDelete(conv._id)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    formatDate={formatDate}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
        >
          <Icons.Archive className="w-3.5 h-3.5" />
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>
    </div>
  );
};

// Conversation item component
interface ConversationItemProps {
  conversation: ChatConversation;
  isSelected: boolean;
  onSelect: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  deleteConfirmId: Id<"chatConversations"> | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  formatDate: (ts: number) => string;
  getTypeIcon: (type: ChatConversation["type"]) => React.ReactNode;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  onPin,
  onArchive,
  onDelete,
  deleteConfirmId,
  onConfirmDelete,
  onCancelDelete,
  formatDate,
  getTypeIcon,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isDeleting = deleteConfirmId === conversation._id;

  return (
    <div
      className={`group relative rounded-lg transition-colors ${
        isSelected
          ? "bg-primary/10"
          : "hover:bg-surface-hover"
      }`}
    >
      {isDeleting ? (
        <div className="flex items-center justify-between p-2">
          <span className="text-xs text-secondary">Delete?</span>
          <div className="flex gap-1">
            <button
              onClick={onConfirmDelete}
              className="px-2 py-1 text-[10px] bg-red-500 text-white rounded"
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              className="px-2 py-1 text-[10px] bg-surface-hover text-secondary rounded"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={onSelect}
            className="w-full text-left p-2"
          >
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 ${isSelected ? "text-primary" : "text-secondary"}`}>
                {getTypeIcon(conversation.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm truncate ${
                      isSelected ? "text-primary font-medium" : "text-main"
                    }`}
                  >
                    {conversation.title}
                  </span>
                  {conversation.isPinned && (
                    <Icons.Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-secondary mt-0.5">
                  <span>{conversation.messageCount} messages</span>
                  <span>-</span>
                  <span>{formatDate(conversation.lastMessageAt)}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Menu button */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-secondary hover:text-main hover:bg-background rounded transition-colors"
            >
              <Icons.MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPin();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary hover:text-main hover:bg-surface-hover"
                  >
                    <Icons.Zap className="w-3.5 h-3.5" />
                    {conversation.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary hover:text-main hover:bg-surface-hover"
                  >
                    <Icons.Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10"
                  >
                    <Icons.Trash className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ChatSidebar;

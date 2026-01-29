import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface CommentsPanelProps {
  documentId: Id<"documents">;
  isOpen: boolean;
  onClose: () => void;
  onSelectComment?: (selectionStart?: number, selectionEnd?: number) => void;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

interface Comment {
  _id: Id<"documentComments">;
  documentId: Id<"documents">;
  userId: string;
  content: string;
  status: "open" | "resolved" | "wontfix";
  selectionStart?: number;
  selectionEnd?: number;
  selectedText?: string;
  lineNumber?: number;
  authorName: string;
  authorImage?: string;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  resolvedBy?: string;
  resolvedAt?: number;
  replies?: Reply[];
}

interface Reply {
  _id: Id<"commentReplies">;
  commentId: Id<"documentComments">;
  userId: string;
  content: string;
  authorName: string;
  authorImage?: string;
  createdAt: number;
  updatedAt: number;
}

export default function CommentsPanel({
  documentId,
  isOpen,
  onClose,
  onSelectComment,
  selectedText,
  selectionStart,
  selectionEnd,
}: CommentsPanelProps) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [expandedCommentId, setExpandedCommentId] = useState<Id<"documentComments"> | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<Id<"documentComments"> | null>(null);
  const [editContent, setEditContent] = useState("");
  const newCommentRef = useRef<HTMLTextAreaElement>(null);

  const comments = useQuery(
    api.comments.listByDocument,
    isOpen ? { documentId, includeReplies: true } : "skip"
  ) as Comment[] | undefined;

  const commentCount = useQuery(
    api.comments.getCount,
    isOpen ? { documentId } : "skip"
  );

  const createComment = useMutation(api.comments.create);
  const updateComment = useMutation(api.comments.update);
  const resolveComment = useMutation(api.comments.resolve);
  const reopenComment = useMutation(api.comments.reopen);
  const removeComment = useMutation(api.comments.remove);
  const addReply = useMutation(api.comments.addReply);
  const removeReply = useMutation(api.comments.removeReply);

  // Focus new comment input when there's selected text
  useEffect(() => {
    if (selectedText && newCommentRef.current) {
      newCommentRef.current.focus();
    }
  }, [selectedText]);

  if (!isOpen) return null;

  const filteredComments = comments?.filter((c) => {
    if (filter === "all") return true;
    if (filter === "open") return c.status === "open";
    return c.status === "resolved" || c.status === "wontfix";
  });

  const handleCreateComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment({
        documentId,
        content: newComment.trim(),
        selectedText,
        selectionStart,
        selectionEnd,
      });
      setNewComment("");
    } catch (error) {
      console.error("Failed to create comment:", error);
    }
  };

  const handleResolve = async (commentId: Id<"documentComments">, status: "resolved" | "wontfix") => {
    try {
      await resolveComment({ commentId, status });
    } catch (error) {
      console.error("Failed to resolve comment:", error);
    }
  };

  const handleReopen = async (commentId: Id<"documentComments">) => {
    try {
      await reopenComment({ commentId });
    } catch (error) {
      console.error("Failed to reopen comment:", error);
    }
  };

  const handleDelete = async (commentId: Id<"documentComments">) => {
    if (!confirm("Delete this comment and all its replies?")) return;
    try {
      await removeComment({ commentId });
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const handleAddReply = async (commentId: Id<"documentComments">) => {
    if (!replyContent.trim()) return;

    try {
      await addReply({ commentId, content: replyContent.trim() });
      setReplyContent("");
    } catch (error) {
      console.error("Failed to add reply:", error);
    }
  };

  const handleDeleteReply = async (replyId: Id<"commentReplies">) => {
    if (!confirm("Delete this reply?")) return;
    try {
      await removeReply({ replyId });
    } catch (error) {
      console.error("Failed to delete reply:", error);
    }
  };

  const handleUpdateComment = async (commentId: Id<"documentComments">) => {
    if (!editContent.trim()) return;

    try {
      await updateComment({ commentId, content: editContent.trim() });
      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      console.error("Failed to update comment:", error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Icons.MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Comments</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {commentCount?.open || 0} open, {commentCount?.resolved || 0} resolved
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Icons.X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "all" && commentCount && ` (${commentCount.total})`}
            {f === "open" && commentCount && ` (${commentCount.open})`}
            {f === "resolved" && commentCount && ` (${commentCount.resolved})`}
          </button>
        ))}
      </div>

      {/* New Comment Input */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        {selectedText && (
          <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium mb-1">
              Commenting on selected text:
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 italic line-clamp-2">
              "{selectedText}"
            </p>
          </div>
        )}
        <textarea
          ref={newCommentRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={selectedText ? "Add a comment on this selection..." : "Add a comment..."}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={2}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCreateComment}
            disabled={!newComment.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Comment
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {!filteredComments || filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
            <Icons.MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs mt-1 text-center">
              Select text in the document and add a comment, or add a general comment above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredComments.map((comment) => (
              <div
                key={comment._id}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  comment.status !== "open" ? "opacity-60" : ""
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-start gap-2">
                  {comment.authorImage ? (
                    <img
                      src={comment.authorImage}
                      alt={comment.authorName}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <Icons.User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {comment.authorName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(comment.createdAt)}
                      </span>
                      {comment.status !== "open" && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            comment.status === "resolved"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {comment.status === "resolved" ? "Resolved" : "Won't Fix"}
                        </span>
                      )}
                    </div>

                    {/* Selected Text Reference */}
                    {comment.selectedText && (
                      <button
                        onClick={() =>
                          onSelectComment?.(comment.selectionStart, comment.selectionEnd)
                        }
                        className="mt-1 mb-2 p-1.5 w-full text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <span className="italic line-clamp-1">"{comment.selectedText}"</span>
                      </button>
                    )}

                    {/* Comment Content */}
                    {editingCommentId === comment._id ? (
                      <div className="mt-1">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleUpdateComment(comment._id)}
                            className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditContent("");
                            }}
                            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    )}

                    {/* Comment Actions */}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setExpandedCommentId(
                          expandedCommentId === comment._id ? null : comment._id
                        )}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {comment.replyCount > 0
                          ? `${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`
                          : "Reply"}
                      </button>
                      {comment.status === "open" ? (
                        <>
                          <button
                            onClick={() => handleResolve(comment._id, "resolved")}
                            className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleResolve(comment._id, "wontfix")}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            Won't Fix
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleReopen(comment._id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingCommentId(comment._id);
                          setEditContent(comment.content);
                        }}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(comment._id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Replies */}
                    {expandedCommentId === comment._id && (
                      <div className="mt-3 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-3">
                        {comment.replies?.map((reply) => (
                          <div key={reply._id} className="flex items-start gap-2">
                            {reply.authorImage ? (
                              <img
                                src={reply.authorImage}
                                alt={reply.authorName}
                                className="w-5 h-5 rounded-full"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                <Icons.User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                  {reply.authorName}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatTime(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                                {reply.content}
                              </p>
                              <button
                                onClick={() => handleDeleteReply(reply._id)}
                                className="text-[10px] text-red-500 hover:text-red-700 mt-1"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Reply Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddReply(comment._id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddReply(comment._id)}
                            disabled={!replyContent.trim()}
                            className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

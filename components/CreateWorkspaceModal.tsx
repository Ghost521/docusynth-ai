import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Icons } from "./Icon";
import type { Id } from "../convex/_generated/dataModel";

interface CreateWorkspaceModalProps {
  onClose: () => void;
  onCreated: (workspaceId: Id<"workspaces">) => void;
}

export default function CreateWorkspaceModal({
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createWorkspace = useMutation(api.workspaces.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(result.workspaceId);
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-md animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Icons.Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Workspace</h2>
              <p className="text-sm text-gray-400">Start collaborating with your team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Workspace Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering Team"
              className="w-full px-4 py-2 bg-gray-800 border border-border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Plan Info */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">Free Plan</span>
            </div>
            <ul className="text-sm text-gray-400 space-y-1">
              <li className="flex items-center gap-2">
                <Icons.Check className="w-4 h-4 text-green-400" />
                Up to 3 team members
              </li>
              <li className="flex items-center gap-2">
                <Icons.Check className="w-4 h-4 text-green-400" />
                Unlimited documents
              </li>
              <li className="flex items-center gap-2">
                <Icons.Check className="w-4 h-4 text-green-400" />
                Version history
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Icons.Plus className="w-4 h-4" />
                  Create Workspace
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Icons } from "./Icon";
import {
  getConflictingChanges,
  resolveConflict,
  PendingChange,
  ConflictResolution,
} from "../services/syncService";

// ===============================================================
// Types
// ===============================================================

interface ConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  conflictId?: string;
  onResolved?: () => void;
}

// ===============================================================
// Component
// ===============================================================

export function ConflictResolver({
  isOpen,
  onClose,
  conflictId,
  onResolved,
}: ConflictResolverProps): JSX.Element | null {
  // State
  const [conflicts, setConflicts] = useState<PendingChange[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<PendingChange | null>(null);
  const [resolution, setResolution] = useState<ConflictResolution>("keep_server");
  const [isResolving, setIsResolving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load conflicts
  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen]);

  // Select specific conflict if provided
  useEffect(() => {
    if (conflictId && conflicts.length > 0) {
      const conflict = conflicts.find((c) => c.id === conflictId);
      if (conflict) {
        setSelectedConflict(conflict);
      }
    }
  }, [conflictId, conflicts]);

  const loadConflicts = async () => {
    setIsLoading(true);
    try {
      const conflictingChanges = await getConflictingChanges();
      setConflicts(conflictingChanges);
      if (conflictingChanges.length > 0 && !selectedConflict) {
        setSelectedConflict(conflictingChanges[0]);
      }
    } catch (error) {
      console.error("Failed to load conflicts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resolve
  const handleResolve = async () => {
    if (!selectedConflict) return;

    setIsResolving(true);
    try {
      await resolveConflict(selectedConflict.id, resolution);

      // Remove from list
      const remaining = conflicts.filter((c) => c.id !== selectedConflict.id);
      setConflicts(remaining);

      if (remaining.length > 0) {
        setSelectedConflict(remaining[0]);
      } else {
        setSelectedConflict(null);
        onResolved?.();
        onClose();
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
    } finally {
      setIsResolving(false);
    }
  };

  // Handle resolve all with same resolution
  const handleResolveAll = async () => {
    if (!confirm(`Apply "${resolution.replace(/_/g, " ")}" to all ${conflicts.length} conflicts?`)) {
      return;
    }

    setIsResolving(true);
    try {
      for (const conflict of conflicts) {
        await resolveConflict(conflict.id, resolution);
      }
      setConflicts([]);
      setSelectedConflict(null);
      onResolved?.();
      onClose();
    } catch (error) {
      console.error("Failed to resolve all conflicts:", error);
      await loadConflicts();
    } finally {
      setIsResolving(false);
    }
  };

  if (!isOpen) return null;

  const conflictData = selectedConflict?.conflictData;
  const localContent = conflictData?.localVersion?.content as string | undefined;
  const serverContent = conflictData?.serverVersion?.content as string | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-surface border border-border rounded-xl shadow-xl animate-fadeIn overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Icons.GitMerge className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">Resolve Conflicts</h2>
              <p className="text-sm text-secondary">
                {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} to resolve
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary hover:text-main hover:bg-surface-hover transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Icons.Loader className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Icons.CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
            <p className="text-main font-medium">No conflicts!</p>
            <p className="text-sm text-secondary mt-1">
              All changes have been resolved
            </p>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Conflict List Sidebar */}
              {conflicts.length > 1 && (
                <div className="w-64 border-r border-border bg-background overflow-y-auto">
                  <div className="p-2">
                    {conflicts.map((conflict) => (
                      <button
                        key={conflict.id}
                        onClick={() => setSelectedConflict(conflict)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedConflict?.id === conflict.id
                            ? "bg-purple-500/10 border border-purple-500/30"
                            : "hover:bg-surface-hover"
                        }`}
                      >
                        <p className="font-medium text-main text-sm truncate">
                          {(conflict.payload as any)?.topic || "Document"}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          {conflict.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-secondary">
                          {new Date(conflict.timestamp).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Diff View */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedConflict && (
                  <div className="space-y-6">
                    {/* Conflict Info */}
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <div className="flex items-start gap-3">
                        <Icons.AlertTriangle className="w-5 h-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-main">
                            Conflict Detected
                          </p>
                          <p className="text-sm text-secondary mt-1">
                            This document was modified both locally and on the server.
                            Choose how to resolve the conflict.
                          </p>
                          {conflictData?.conflictedFields && (
                            <p className="text-xs text-purple-500 mt-2">
                              Conflicted fields: {conflictData.conflictedFields.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Side by Side Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Local Version */}
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 bg-amber-500/10 border-b border-border">
                          <div className="flex items-center gap-2">
                            <Icons.Smartphone className="w-4 h-4 text-amber-500" />
                            <span className="font-medium text-main">Local Changes</span>
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            {new Date(selectedConflict.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 bg-background max-h-64 overflow-y-auto">
                          {localContent ? (
                            <pre className="text-sm text-main whitespace-pre-wrap font-mono">
                              {localContent.slice(0, 2000)}
                              {localContent.length > 2000 && "..."}
                            </pre>
                          ) : (
                            <p className="text-sm text-secondary italic">
                              No content preview available
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Server Version */}
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 bg-blue-500/10 border-b border-border">
                          <div className="flex items-center gap-2">
                            <Icons.Cloud className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-main">Server Version</span>
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            {conflictData?.detectedAt
                              ? new Date(conflictData.detectedAt).toLocaleString()
                              : "Unknown"}
                          </p>
                        </div>
                        <div className="p-4 bg-background max-h-64 overflow-y-auto">
                          {serverContent ? (
                            <pre className="text-sm text-main whitespace-pre-wrap font-mono">
                              {serverContent.slice(0, 2000)}
                              {serverContent.length > 2000 && "..."}
                            </pre>
                          ) : (
                            <p className="text-sm text-secondary italic">
                              No content preview available
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Options */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-main">
                        Choose Resolution
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Keep Local */}
                        <button
                          onClick={() => setResolution("keep_local")}
                          className={`p-4 rounded-lg border transition-all ${
                            resolution === "keep_local"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-surface-hover"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                resolution === "keep_local"
                                  ? "border-primary bg-primary"
                                  : "border-secondary"
                              }`}
                            />
                            <span className="font-medium text-main">Keep Local</span>
                          </div>
                          <p className="text-xs text-secondary">
                            Overwrite server with your local changes
                          </p>
                        </button>

                        {/* Keep Server */}
                        <button
                          onClick={() => setResolution("keep_server")}
                          className={`p-4 rounded-lg border transition-all ${
                            resolution === "keep_server"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-surface-hover"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                resolution === "keep_server"
                                  ? "border-primary bg-primary"
                                  : "border-secondary"
                              }`}
                            />
                            <span className="font-medium text-main">Keep Server</span>
                          </div>
                          <p className="text-xs text-secondary">
                            Discard local changes and use server version
                          </p>
                        </button>

                        {/* Merge */}
                        <button
                          onClick={() => setResolution("merge")}
                          className={`p-4 rounded-lg border transition-all ${
                            resolution === "merge"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-surface-hover"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                resolution === "merge"
                                  ? "border-primary bg-primary"
                                  : "border-secondary"
                              }`}
                            />
                            <span className="font-medium text-main">Merge</span>
                          </div>
                          <p className="text-xs text-secondary">
                            Combine both versions (local takes precedence)
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-background flex justify-between items-center shrink-0">
              <div>
                {conflicts.length > 1 && (
                  <button
                    onClick={handleResolveAll}
                    disabled={isResolving}
                    className="px-4 py-2 text-sm text-secondary hover:text-main transition-colors disabled:opacity-50"
                  >
                    Apply to all ({conflicts.length})
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isResolving || !selectedConflict}
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isResolving ? (
                    <>
                      <Icons.Loader className="w-4 h-4 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    <>
                      <Icons.Check className="w-4 h-4" />
                      Resolve Conflict
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ConflictResolver;

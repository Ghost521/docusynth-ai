"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as Icons from "./Icon";

interface APIKeysModalProps {
  onClose: () => void;
}

export default function APIKeysModal({ onClose }: APIKeysModalProps) {
  const keys = useQuery(api.apiKeys.list) || [];
  const scopes = useQuery(api.apiKeys.getScopes) || [];
  const usageStats = useQuery(api.apiKeys.getUsageStats, { days: 7 });

  const createKey = useAction(api.apiKeys.create);
  const updateKey = useMutation(api.apiKeys.update);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyExpiresDays, setNewKeyExpiresDays] = useState<number | null>(null);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(1000);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setError("Please enter a name for the API key");
      return;
    }
    if (newKeyScopes.length === 0) {
      setError("Please select at least one scope");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const result = await createKey({
        name: newKeyName.trim(),
        scopes: newKeyScopes,
        expiresInDays: newKeyExpiresDays || undefined,
        rateLimit: newKeyRateLimit,
      });
      setCreatedKey(result.key);
      setNewKeyName("");
      setNewKeyScopes([]);
      setNewKeyExpiresDays(null);
      setNewKeyRateLimit(1000);
    } catch (err: any) {
      setError(err.message || "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: Id<"apiKeys">) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }
    try {
      await revokeKey({ keyId });
    } catch (err: any) {
      setError(err.message || "Failed to revoke API key");
    }
  };

  const handleToggleActive = async (keyId: Id<"apiKeys">, isActive: boolean) => {
    try {
      await updateKey({ keyId, isActive: !isActive });
    } catch (err: any) {
      setError(err.message || "Failed to update API key");
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icons.Key className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-main">API Keys</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-60px)]">
          {/* Error message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Created key display */}
          {createdKey && (
            <div className="mx-4 mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Icons.Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-800 dark:text-green-200">API Key Created</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                Make sure to copy your API key now. You won't be able to see it again!
              </p>
              <div className="flex items-center gap-2 bg-surface p-2 rounded border border-green-200 dark:border-green-700">
                <code className="flex-1 text-sm font-mono text-main break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className="p-1.5 hover:bg-surface-hover rounded"
                  title="Copy to clipboard"
                >
                  <Icons.Copy className="w-4 h-4 text-secondary" />
                </button>
              </div>
              <button
                onClick={() => {
                  setCreatedKey(null);
                  setShowCreateForm(false);
                }}
                className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Done
              </button>
            </div>
          )}

          {/* Usage Stats */}
          {usageStats && (
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium text-secondary mb-3">Usage (Last 7 Days)</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-surface-hover/50 p-3 rounded-lg">
                  <div className="text-2xl font-semibold text-main">
                    {usageStats.totalRequests}
                  </div>
                  <div className="text-xs text-secondary">Total Requests</div>
                </div>
                <div className="bg-gray-50 dark:bg-surface-hover/50 p-3 rounded-lg">
                  <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {usageStats.successfulRequests}
                  </div>
                  <div className="text-xs text-secondary">Successful</div>
                </div>
                <div className="bg-gray-50 dark:bg-surface-hover/50 p-3 rounded-lg">
                  <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                    {usageStats.failedRequests}
                  </div>
                  <div className="text-xs text-secondary">Failed</div>
                </div>
                <div className="bg-gray-50 dark:bg-surface-hover/50 p-3 rounded-lg">
                  <div className="text-2xl font-semibold text-main">
                    {usageStats.avgResponseTime}ms
                  </div>
                  <div className="text-xs text-secondary">Avg Response</div>
                </div>
              </div>
            </div>
          )}

          {/* Create new key button */}
          {!showCreateForm && !createdKey && (
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Icons.Plus className="w-4 h-4" />
                Create API Key
              </button>
            </div>
          )}

          {/* Create form */}
          {showCreateForm && !createdKey && (
            <div className="p-4 border-b border-border space-y-4">
              <h3 className="font-medium text-main">Create New API Key</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My API Key"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {scopes.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-2 p-2 border border-border rounded-lg cursor-pointer hover:bg-surface-hover/50"
                    >
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-border focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-main">
                          {scope.id}
                        </div>
                        <div className="text-xs text-secondary">
                          {scope.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Expiration
                </label>
                <select
                  value={newKeyExpiresDays || "never"}
                  onChange={(e) =>
                    setNewKeyExpiresDays(e.target.value === "never" ? null : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="never">Never expires</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Rate Limit (requests/hour)
                </label>
                <input
                  type="number"
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Key"}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-secondary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Keys list */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-secondary mb-3">Your API Keys</h3>
            {keys.length === 0 ? (
              <p className="text-secondary text-sm">No API keys created yet.</p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key._id}
                    className={`p-4 border rounded-lg ${
                      key.isActive
                        ? "border-border"
                        : "border-border opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-main">{key.name}</span>
                        {!key.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-surface-hover text-secondary text-xs rounded">
                            Disabled
                          </span>
                        )}
                        {key.expiresAt && key.expiresAt < Date.now() && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(key._id, key.isActive)}
                          className={`px-3 py-1 text-sm rounded ${
                            key.isActive
                              ? "bg-gray-100 dark:bg-surface-hover text-secondary hover:bg-gray-200 dark:hover:bg-gray-600"
                              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"
                          }`}
                        >
                          {key.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleRevoke(key._id)}
                          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-secondary">
                      <span className="font-mono">{key.keyPrefix}...</span>
                      <span>Rate: {key.rateLimit}/hr</span>
                      {key.lastUsedAt && (
                        <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      {key.expiresAt && (
                        <span>
                          Expires: {new Date(key.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* API Documentation Link */}
          <div className="p-4 border-t border-border">
            <h3 className="text-sm font-medium text-secondary mb-2">Using the API</h3>
            <p className="text-sm text-secondary mb-2">
              Include your API key in the request header:
            </p>
            <code className="block bg-gray-100 dark:bg-surface-hover p-3 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
              X-API-Key: ds_your_api_key_here
            </code>
            <p className="text-sm text-secondary mt-2">
              Or use the Authorization header:
            </p>
            <code className="block bg-gray-100 dark:bg-surface-hover p-3 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
              Authorization: Bearer ds_your_api_key_here
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

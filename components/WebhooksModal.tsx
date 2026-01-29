"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as Icons from "./Icon";

interface WebhooksModalProps {
  workspaceId?: Id<"workspaces">;
  onClose: () => void;
}

export default function WebhooksModal({ workspaceId, onClose }: WebhooksModalProps) {
  const webhooks = useQuery(api.webhooks.list, { workspaceId }) || [];
  const events = useQuery(api.webhooks.getEvents) || [];

  const createWebhook = useMutation(api.webhooks.create);
  const updateWebhook = useMutation(api.webhooks.update);
  const removeWebhook = useMutation(api.webhooks.remove);
  const regenerateSecret = useMutation(api.webhooks.regenerateSecret);
  const testWebhook = useAction(api.webhooks.test);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ webhookId: string; success: boolean; message: string } | null>(null);

  const handleCreate = async () => {
    if (!newWebhookName.trim()) {
      setError("Please enter a name for the webhook");
      return;
    }
    if (!newWebhookUrl.trim()) {
      setError("Please enter a URL for the webhook");
      return;
    }
    if (newWebhookEvents.length === 0) {
      setError("Please select at least one event");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const result = await createWebhook({
        name: newWebhookName.trim(),
        url: newWebhookUrl.trim(),
        events: newWebhookEvents,
        workspaceId,
      });
      setCreatedSecret(result.secret);
      setNewWebhookName("");
      setNewWebhookUrl("");
      setNewWebhookEvents([]);
    } catch (err: any) {
      setError(err.message || "Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (webhookId: Id<"webhooks">) => {
    if (!confirm("Are you sure you want to delete this webhook? This action cannot be undone.")) {
      return;
    }
    try {
      await removeWebhook({ webhookId });
    } catch (err: any) {
      setError(err.message || "Failed to delete webhook");
    }
  };

  const handleToggleActive = async (webhookId: Id<"webhooks">, isActive: boolean) => {
    try {
      await updateWebhook({ webhookId, isActive: !isActive });
    } catch (err: any) {
      setError(err.message || "Failed to update webhook");
    }
  };

  const handleRegenerateSecret = async (webhookId: Id<"webhooks">) => {
    if (!confirm("Are you sure you want to regenerate the secret? The old secret will stop working immediately.")) {
      return;
    }
    try {
      const result = await regenerateSecret({ webhookId });
      setCreatedSecret(result.secret);
      setExpandedWebhook(webhookId);
    } catch (err: any) {
      setError(err.message || "Failed to regenerate secret");
    }
  };

  const handleTest = async (webhookId: Id<"webhooks">) => {
    setTestingWebhook(webhookId);
    setTestResult(null);
    try {
      const result = await testWebhook({ webhookId });
      setTestResult({
        webhookId,
        success: result.success,
        message: result.success
          ? `Test successful! Response time: ${result.responseTimeMs}ms`
          : `Test failed: ${result.error}`,
      });
    } catch (err: any) {
      setTestResult({
        webhookId,
        success: false,
        message: err.message || "Test failed",
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Group events by category
  const eventCategories = events.reduce((acc, event) => {
    const [category] = event.id.split(".");
    if (!acc[category]) acc[category] = [];
    acc[category].push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icons.Link className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

          {/* Created secret display */}
          {createdSecret && (
            <div className="mx-4 mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Icons.Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-800 dark:text-green-200">Webhook Secret</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                Use this secret to verify webhook signatures. Store it securely!
              </p>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700">
                <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white break-all">
                  {createdSecret}
                </code>
                <button
                  onClick={() => copyToClipboard(createdSecret)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Copy to clipboard"
                >
                  <Icons.Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <button
                onClick={() => {
                  setCreatedSecret(null);
                  setShowCreateForm(false);
                }}
                className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Done
              </button>
            </div>
          )}

          {/* Create new webhook button */}
          {!showCreateForm && !createdSecret && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Icons.Plus className="w-4 h-4" />
                Create Webhook
              </button>
            </div>
          )}

          {/* Create form */}
          {showCreateForm && !createdSecret && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Create New Webhook</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="My Webhook"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Events to Subscribe
                </label>
                <div className="space-y-4">
                  {Object.entries(eventCategories).map(([category, categoryEvents]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 capitalize">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {categoryEvents.map((event) => (
                          <label
                            key={event.id}
                            className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <input
                              type="checkbox"
                              checked={newWebhookEvents.includes(event.id)}
                              onChange={() => toggleEvent(event.id)}
                              className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                {event.id}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {event.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Webhook"}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Webhooks list */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Your Webhooks</h3>
            {webhooks.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No webhooks created yet.</p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook._id}
                    className={`border rounded-lg ${
                      webhook.isActive
                        ? "border-gray-200 dark:border-gray-700"
                        : "border-gray-200 dark:border-gray-700 opacity-60"
                    }`}
                  >
                    {/* Main row */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedWebhook(expandedWebhook === webhook._id ? null : webhook._id)
                            }
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <Icons.ChevronRight
                              className={`w-4 h-4 text-gray-500 transition-transform ${
                                expandedWebhook === webhook._id ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {webhook.name}
                          </span>
                          {!webhook.isActive && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTest(webhook._id)}
                            disabled={testingWebhook === webhook._id}
                            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                          >
                            {testingWebhook === webhook._id ? "Testing..." : "Test"}
                          </button>
                          <button
                            onClick={() => handleToggleActive(webhook._id, webhook.isActive)}
                            className={`px-3 py-1 text-sm rounded ${
                              webhook.isActive
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"
                            }`}
                          >
                            {webhook.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleDelete(webhook._id)}
                            className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Test result */}
                      {testResult && testResult.webhookId === webhook._id && (
                        <div
                          className={`mt-2 p-2 rounded text-sm ${
                            testResult.success
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {testResult.message}
                        </div>
                      )}

                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {webhook.url}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded font-mono"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedWebhook === webhook._id && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 mt-2 pt-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Secret (partial)
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm font-mono text-gray-900 dark:text-white">
                                {webhook.secret}
                              </code>
                              <button
                                onClick={() => handleRegenerateSecret(webhook._id)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Regenerate
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Created
                            </label>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {new Date(webhook.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Last Updated
                            </label>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {new Date(webhook.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook Signature Verification */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verifying Webhook Signatures
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Each webhook request includes a signature header for verification:
            </p>
            <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
              X-Webhook-Signature: t=1234567890,v1=abc123...
            </code>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Verify by computing HMAC-SHA256 of <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"timestamp.payload"}</code> with your secret.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

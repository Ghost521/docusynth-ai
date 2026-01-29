import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface AlertPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: Id<"documents"> | null; // null = global preferences
  documentTopic?: string;
}

type CheckFrequency = "hourly" | "every_6_hours" | "daily" | "weekly";

const FREQUENCY_LABELS: Record<CheckFrequency, string> = {
  hourly: "Every hour",
  every_6_hours: "Every 6 hours",
  daily: "Daily",
  weekly: "Weekly",
};

export default function AlertPreferencesModal({
  isOpen,
  onClose,
  documentId = null,
  documentTopic,
}: AlertPreferencesModalProps) {
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyWebhook, setNotifyWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifySlack, setNotifySlack] = useState(false);
  const [notifyDiscord, setNotifyDiscord] = useState(false);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const [minSignificance, setMinSignificance] = useState(20);
  const [checkFrequency, setCheckFrequency] = useState<CheckFrequency>("daily");
  const [isSaving, setIsSaving] = useState(false);

  const preferences = useQuery(api.alerts.getPreferences, {
    documentId: documentId || undefined,
  });

  const updatePreferences = useMutation(api.alerts.updatePreferences);

  // Load existing preferences
  useEffect(() => {
    if (preferences) {
      setNotifyInApp(preferences.notifyInApp);
      setNotifyEmail(preferences.notifyEmail);
      setNotifyWebhook(preferences.notifyWebhook);
      setWebhookUrl(preferences.webhookUrl || "");
      setNotifySlack(preferences.notifySlack);
      setNotifyDiscord(preferences.notifyDiscord);
      setAutoRegenerate(preferences.autoRegenerate);
      setMinSignificance(preferences.minSignificance);
      setCheckFrequency(preferences.checkFrequency);
    }
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        documentId,
        notifyInApp,
        notifyEmail,
        notifyWebhook,
        webhookUrl: notifyWebhook && webhookUrl ? webhookUrl : null,
        notifySlack,
        notifyDiscord,
        autoRegenerate,
        minSignificance,
        checkFrequency,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Icons.Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">
                Alert Preferences
              </h2>
              <p className="text-sm text-secondary truncate max-w-xs">
                {documentId
                  ? documentTopic || "Document settings"
                  : "Global default settings"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Notification Channels */}
          <div>
            <h3 className="text-sm font-semibold text-main mb-3">
              Notification Channels
            </h3>
            <div className="space-y-3">
              {/* In-app notifications */}
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer hover:bg-surface-hover">
                <div className="flex items-center gap-3">
                  <Icons.Bell className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-main">
                      In-app notifications
                    </p>
                    <p className="text-xs text-secondary">
                      Show alerts in the alerts panel
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyInApp}
                  onChange={(e) => setNotifyInApp(e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                />
              </label>

              {/* Email notifications */}
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer hover:bg-surface-hover">
                <div className="flex items-center gap-3">
                  <Icons.Mail className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-main">
                      Email notifications
                    </p>
                    <p className="text-xs text-secondary">
                      Send alerts to your email
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                />
              </label>

              {/* Webhook notifications */}
              <div className="p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Icons.Webhook className="w-5 h-5 text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-main">
                        Webhook notifications
                      </p>
                      <p className="text-xs text-secondary">
                        Send alerts to a webhook URL
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyWebhook}
                    onChange={(e) => setNotifyWebhook(e.target.checked)}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
                {notifyWebhook && (
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-webhook-url.com/alerts"
                    className="mt-3 w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                )}
              </div>

              {/* Slack notifications */}
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer hover:bg-surface-hover">
                <div className="flex items-center gap-3">
                  <Icons.Slack className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-main">
                      Slack notifications
                    </p>
                    <p className="text-xs text-secondary">
                      Send alerts via Slack bot
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifySlack}
                  onChange={(e) => setNotifySlack(e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                />
              </label>

              {/* Discord notifications */}
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer hover:bg-surface-hover">
                <div className="flex items-center gap-3">
                  <Icons.Discord className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-main">
                      Discord notifications
                    </p>
                    <p className="text-xs text-secondary">
                      Send alerts via Discord bot
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyDiscord}
                  onChange={(e) => setNotifyDiscord(e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                />
              </label>
            </div>
          </div>

          {/* Check Frequency */}
          <div>
            <h3 className="text-sm font-semibold text-main mb-3">
              Check Frequency
            </h3>
            <select
              value={checkFrequency}
              onChange={(e) => setCheckFrequency(e.target.value as CheckFrequency)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-main focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-secondary">
              How often to check sources for changes
            </p>
          </div>

          {/* Significance Threshold */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-main">
                Minimum Significance
              </h3>
              <span className="text-sm font-mono text-orange-600 dark:text-orange-400">
                {minSignificance}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={minSignificance}
              onChange={(e) => setMinSignificance(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-surface-hover rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between mt-1 text-xs text-secondary">
              <span>All changes</span>
              <span>Major only</span>
            </div>
            <p className="mt-2 text-xs text-secondary">
              Only alert for changes with significance above this threshold
            </p>
          </div>

          {/* Auto-regenerate */}
          <div>
            <h3 className="text-sm font-semibold text-main mb-3">
              Automatic Actions
            </h3>
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer hover:bg-surface-hover">
              <div className="flex items-center gap-3">
                <Icons.Refresh className="w-5 h-5 text-secondary" />
                <div>
                  <p className="text-sm font-medium text-main">
                    Auto-regenerate documents
                  </p>
                  <p className="text-xs text-secondary">
                    Automatically update documents when sources change
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoRegenerate}
                onChange={(e) => setAutoRegenerate(e.target.checked)}
                className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
              />
            </label>
            {autoRegenerate && (
              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icons.AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Auto-regeneration will create new document versions when changes
                    meet your significance threshold. Previous versions are preserved.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-hover rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <Icons.Loader className="w-4 h-4 animate-spin" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Icons } from "./Icon";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: Id<"documents">;
  documentTopic: string;
}

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ScheduleModal({
  isOpen,
  onClose,
  documentId,
  documentTopic,
}: ScheduleModalProps) {
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourOfDay, setHourOfDay] = useState(9); // 9 AM UTC
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const schedule = useQuery(api.schedules.getByDocument, { documentId });
  const runHistory = useQuery(
    api.schedules.getRunHistory,
    schedule ? { scheduleId: schedule._id, limit: 10 } : "skip"
  );

  const createSchedule = useMutation(api.schedules.create);
  const updateSchedule = useMutation(api.schedules.update);
  const removeSchedule = useMutation(api.schedules.remove);
  const triggerNow = useMutation(api.schedules.triggerNow);

  // Reset form when schedule loads
  useEffect(() => {
    if (schedule) {
      setFrequency(schedule.frequency);
      setDayOfWeek(schedule.dayOfWeek ?? 1);
      setDayOfMonth(schedule.dayOfMonth ?? 1);
      setHourOfDay(schedule.hourOfDay);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [schedule]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      if (schedule) {
        await updateSchedule({
          scheduleId: schedule._id,
          frequency,
          dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : undefined,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
          hourOfDay,
        });
      } else {
        await createSchedule({
          documentId,
          frequency,
          dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : undefined,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
          hourOfDay,
        });
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save schedule:", error);
    }
  };

  const handleToggleActive = async () => {
    if (!schedule) return;
    await updateSchedule({
      scheduleId: schedule._id,
      isActive: !schedule.isActive,
    });
  };

  const handleDelete = async () => {
    if (!schedule) return;
    if (confirm("Are you sure you want to delete this schedule?")) {
      await removeSchedule({ scheduleId: schedule._id });
    }
  };

  const handleTriggerNow = async () => {
    if (!schedule) return;
    await triggerNow({ scheduleId: schedule._id });
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "running":
        return "text-blue-500";
      case "skipped":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  const getFrequencyDescription = () => {
    switch (frequency) {
      case "daily":
        return `Every day at ${hourOfDay}:00 UTC`;
      case "weekly":
        return `Every ${DAYS_OF_WEEK[dayOfWeek]} at ${hourOfDay}:00 UTC`;
      case "biweekly":
        return `Every other ${DAYS_OF_WEEK[dayOfWeek]} at ${hourOfDay}:00 UTC`;
      case "monthly":
        return `On day ${dayOfMonth} of each month at ${hourOfDay}:00 UTC`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Icons.Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">
                Scheduled Updates
              </h2>
              <p className="text-sm text-secondary truncate max-w-xs">
                {documentTopic}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              onClick={() => setShowHistory(false)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                !showHistory
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "text-secondary hover:bg-surface-hover"
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setShowHistory(true)}
              disabled={!schedule}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showHistory
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "text-secondary hover:bg-surface-hover"
              } ${!schedule ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              History
            </button>
          </div>

          {!showHistory ? (
            <>
              {/* Current Schedule Status */}
              {schedule && !isEditing && (
                <div className="bg-gray-50 dark:bg-surface-hover/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">
                      Status
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        schedule.isActive
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-600 text-secondary"
                      }`}
                    >
                      {schedule.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">
                      Schedule
                    </span>
                    <span className="text-sm text-secondary">
                      {getFrequencyDescription()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">
                      Next Run
                    </span>
                    <span className="text-sm text-secondary">
                      {formatDate(schedule.nextRunAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">
                      Last Run
                    </span>
                    <span className="text-sm text-secondary">
                      {formatDate(schedule.lastRunAt)}
                      {schedule.lastRunStatus && (
                        <span className={`ml-2 ${getStatusColor(schedule.lastRunStatus)}`}>
                          ({schedule.lastRunStatus})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">
                      Statistics
                    </span>
                    <span className="text-sm text-secondary">
                      {schedule.successfulRuns}/{schedule.totalRuns} successful
                    </span>
                  </div>
                </div>
              )}

              {/* Schedule Form */}
              {(isEditing || !schedule) && (
                <div className="space-y-4">
                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Frequency
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-main focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Day of Week (for weekly/biweekly) */}
                  {(frequency === "weekly" || frequency === "biweekly") && (
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Day of Week
                      </label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-main focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={day} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Day of Month (for monthly) */}
                  {frequency === "monthly" && (
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Day of Month
                      </label>
                      <select
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-main focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-secondary">
                        Days 29-31 may be skipped in shorter months
                      </p>
                    </div>
                  )}

                  {/* Hour of Day */}
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Time (UTC)
                    </label>
                    <select
                      value={hourOfDay}
                      onChange={(e) => setHourOfDay(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-main focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {HOURS.map((hour) => (
                        <option key={hour} value={hour}>
                          {hour.toString().padStart(2, "0")}:00 UTC
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preview */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      <Icons.Info className="w-4 h-4 inline mr-1" />
                      {getFrequencyDescription()}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {schedule && !isEditing ? (
                  <>
                    <button
                      onClick={handleToggleActive}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        schedule.isActive
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                      }`}
                    >
                      {schedule.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-surface-hover text-secondary rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleTriggerNow}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    {schedule && (
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-surface-hover text-secondary rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {schedule ? "Save Changes" : "Create Schedule"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {runHistory && runHistory.length > 0 ? (
                runHistory.map((run) => (
                  <div
                    key={run._id}
                    className="bg-gray-50 dark:bg-surface-hover/50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${getStatusColor(run.status)}`}>
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                      <span className="text-xs text-secondary">
                        {formatDate(run.startedAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-secondary">
                      <div>Duration: {formatDuration(run.durationMs)}</div>
                      <div>
                        Content:{" "}
                        {run.contentChanged === true
                          ? "Changed"
                          : run.contentChanged === false
                          ? "No change"
                          : "-"}
                      </div>
                      {run.provider && (
                        <div>
                          Provider: {run.provider}/{run.model}
                        </div>
                      )}
                      {run.tokensUsed && <div>Tokens: {run.tokensUsed.toLocaleString()}</div>}
                    </div>
                    {run.errorMessage && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                        {run.errorMessage}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-secondary">
                  <Icons.Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No run history yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

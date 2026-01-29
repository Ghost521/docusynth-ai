import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

interface Alert {
  _id: Id<"budgetAlerts">;
  budgetId: Id<"budgets">;
  budgetName: string;
  budgetScope: string;
  budgetAmount: number;
  threshold: number;
  currentSpend: number;
  utilization: number;
  triggeredAt: number;
  dismissed: boolean;
}

interface CostAlertBannerProps {
  alerts: Alert[];
  onManageBudgets?: () => void;
}

const CostAlertBanner: React.FC<CostAlertBannerProps> = ({
  alerts,
  onManageBudgets,
}) => {
  const [dismissedLocally, setDismissedLocally] = useState<Set<string>>(new Set());
  const dismissAlert = useMutation(api.budgets.dismissAlert);
  const dismissAllAlerts = useMutation(api.budgets.dismissAllAlerts);

  const formatCost = (cost: number): string => {
    if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleDismiss = async (alertId: Id<"budgetAlerts">) => {
    setDismissedLocally(prev => new Set(prev).add(alertId));
    try {
      await dismissAlert({ alertId });
    } catch (error) {
      setDismissedLocally(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const handleDismissAll = async () => {
    const budgetIds = new Set(alerts.map(a => a.budgetId));
    const locallyDismissed = new Set(alerts.map(a => a._id));
    setDismissedLocally(prev => new Set([...prev, ...locallyDismissed]));

    try {
      for (const budgetId of budgetIds) {
        await dismissAllAlerts({ budgetId });
      }
    } catch (error) {
      setDismissedLocally(new Set());
    }
  };

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(a => !dismissedLocally.has(a._id));

  if (visibleAlerts.length === 0) return null;

  // Get the most severe alert for the banner color
  const maxUtilization = Math.max(...visibleAlerts.map(a => a.utilization));
  const isExceeded = maxUtilization >= 100;
  const isCritical = maxUtilization >= 80;

  return (
    <div className={`px-6 py-3 ${
      isExceeded
        ? 'bg-red-500/10 border-b border-red-500/20'
        : isCritical
        ? 'bg-amber-500/10 border-b border-amber-500/20'
        : 'bg-yellow-500/10 border-b border-yellow-500/20'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-1.5 rounded-full ${
            isExceeded ? 'bg-red-500/20' : isCritical ? 'bg-amber-500/20' : 'bg-yellow-500/20'
          }`}>
            <Icons.AlertTriangle className={`w-4 h-4 ${
              isExceeded ? 'text-red-500' : isCritical ? 'text-amber-500' : 'text-yellow-600'
            }`} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`text-sm font-bold ${
                isExceeded ? 'text-red-600 dark:text-red-400' :
                isCritical ? 'text-amber-600 dark:text-amber-400' :
                'text-yellow-700 dark:text-yellow-400'
              }`}>
                {isExceeded
                  ? 'Budget Exceeded'
                  : isCritical
                  ? 'Budget Alert: Critical'
                  : 'Budget Alert: Warning'}
              </h4>
              <span className="text-xs text-secondary">
                {visibleAlerts.length} alert{visibleAlerts.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Alert List */}
            <div className="mt-1.5 space-y-1">
              {visibleAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert._id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-main">{alert.budgetName}</span>
                    <span className="text-secondary">
                      {formatCost(alert.currentSpend)} / {formatCost(alert.budgetAmount)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      alert.utilization >= 100
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                        : alert.utilization >= 80
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {alert.utilization.toFixed(0)}%
                    </span>
                    <span className="text-secondary">{formatTimeAgo(alert.triggeredAt)}</span>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert._id)}
                    className="p-1 text-secondary hover:text-main rounded transition-colors"
                    title="Dismiss"
                  >
                    <Icons.X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {visibleAlerts.length > 3 && (
                <span className="text-xs text-secondary">
                  +{visibleAlerts.length - 3} more alerts
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onManageBudgets && (
            <button
              onClick={onManageBudgets}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-main hover:bg-surface-hover transition-colors"
            >
              Manage Budgets
            </button>
          )}
          {visibleAlerts.length > 1 && (
            <button
              onClick={handleDismissAll}
              className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-main transition-colors"
            >
              Dismiss All
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostAlertBanner;

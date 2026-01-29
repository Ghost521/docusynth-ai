import React from 'react';
import { Icons } from './Icon';

interface BudgetData {
  _id: string;
  name: string;
  scope: string;
  period: string;
  amount: number;
  currentSpend: number;
  currency: string;
  hardLimit: boolean;
  rollover: boolean;
  isActive: boolean;
  utilization: number;
  daysRemaining: number;
  projectedSpend: number;
  onTrackToExceed: boolean;
  status?: 'healthy' | 'warning' | 'critical' | 'exceeded';
}

interface BudgetStatusCardProps {
  budget: BudgetData;
  compact?: boolean;
  onClick?: () => void;
}

const BudgetStatusCard: React.FC<BudgetStatusCardProps> = ({
  budget,
  compact = false,
  onClick,
}) => {
  const formatCost = (cost: number): string => {
    if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(2)}`;
  };

  const getStatusColor = () => {
    if (budget.utilization >= 100) return 'red';
    if (budget.utilization >= 80) return 'amber';
    if (budget.utilization >= 50) return 'yellow';
    return 'emerald';
  };

  const getStatusBg = () => {
    const color = getStatusColor();
    return {
      emerald: 'bg-emerald-500',
      yellow: 'bg-yellow-500',
      amber: 'bg-amber-500',
      red: 'bg-red-500',
    }[color];
  };

  const getStatusText = () => {
    if (budget.utilization >= 100) return 'Exceeded';
    if (budget.utilization >= 80) return 'Critical';
    if (budget.utilization >= 50) return 'Warning';
    return 'Healthy';
  };

  const getStatusIcon = () => {
    if (budget.utilization >= 100) {
      return <Icons.AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (budget.utilization >= 80) {
      return <Icons.AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
    return <Icons.CheckCircle className="w-4 h-4 text-emerald-500" />;
  };

  const remaining = Math.max(0, budget.amount - budget.currentSpend);
  const progressPercentage = Math.min(budget.utilization, 100);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`p-3 bg-background border border-border rounded-lg ${
          onClick ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-main truncate">{budget.name}</span>
          {getStatusIcon()}
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusBg()} transition-all duration-500`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-secondary">
            {formatCost(budget.currentSpend)} / {formatCost(budget.amount)}
          </span>
          <span className="text-[10px] text-secondary">
            {budget.utilization.toFixed(0)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-background border border-border rounded-xl p-5 ${
        onClick ? 'cursor-pointer hover:border-emerald-500/30 transition-colors' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-main truncate pr-8">{budget.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-secondary capitalize">{budget.period}</span>
            <span className="text-secondary">|</span>
            <span className="text-xs text-secondary capitalize">{budget.scope}</span>
            {budget.hardLimit && (
              <>
                <span className="text-secondary">|</span>
                <span className="text-xs text-red-500 font-medium">Hard Limit</span>
              </>
            )}
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-xs font-bold ${
          budget.utilization >= 100 ? 'bg-red-500/10 text-red-500' :
          budget.utilization >= 80 ? 'bg-amber-500/10 text-amber-500' :
          budget.utilization >= 50 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
          'bg-emerald-500/10 text-emerald-500'
        }`}>
          {getStatusText()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusBg()} transition-all duration-500 rounded-full`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Spent */}
        <div className="text-center">
          <p className="text-lg font-bold text-main">
            {formatCost(budget.currentSpend)}
          </p>
          <p className="text-[10px] text-secondary uppercase tracking-wider">
            Spent
          </p>
        </div>

        {/* Budget */}
        <div className="text-center border-x border-border">
          <p className="text-lg font-bold text-main">
            {formatCost(budget.amount)}
          </p>
          <p className="text-[10px] text-secondary uppercase tracking-wider">
            Budget
          </p>
        </div>

        {/* Remaining */}
        <div className="text-center">
          <p className={`text-lg font-bold ${
            remaining <= 0 ? 'text-red-500' : 'text-emerald-500'
          }`}>
            {formatCost(remaining)}
          </p>
          <p className="text-[10px] text-secondary uppercase tracking-wider">
            Remaining
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icons.Clock className="w-3.5 h-3.5 text-secondary" />
          <span className="text-xs text-secondary">
            {budget.daysRemaining} days left
          </span>
        </div>

        {budget.onTrackToExceed && (
          <div className="flex items-center gap-1.5">
            <Icons.TrendUp className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-amber-500">
              Projected: {formatCost(budget.projectedSpend)}
            </span>
          </div>
        )}
      </div>

      {/* Rollover Badge */}
      {budget.rollover && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-500">
          <Icons.RefreshCw className="w-3.5 h-3.5" />
          <span>Unused budget rolls over</span>
        </div>
      )}
    </div>
  );
};

export default BudgetStatusCard;

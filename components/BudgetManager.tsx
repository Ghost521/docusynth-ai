import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import BudgetStatusCard from './BudgetStatusCard';

interface BudgetManagerProps {
  workspaceId?: Id<"workspaces">;
}

interface BudgetFormData {
  name: string;
  scope: 'workspace' | 'project' | 'user';
  scopeId?: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly';
  currency: string;
  alertThresholds: number[];
  hardLimit: boolean;
  rollover: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

const DEFAULT_FORM_DATA: BudgetFormData = {
  name: '',
  scope: 'user',
  amount: 100,
  period: 'monthly',
  currency: 'USD',
  alertThresholds: [50, 80, 100],
  hardLimit: false,
  rollover: false,
  notifyEmail: true,
  notifyInApp: true,
};

const BudgetManager: React.FC<BudgetManagerProps> = ({ workspaceId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<Id<"budgets"> | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(DEFAULT_FORM_DATA);
  const [error, setError] = useState<string | null>(null);

  // Queries
  const budgets = useQuery(api.budgets.listBudgets, {
    workspaceId,
    includeInactive: true,
  });

  // Mutations
  const createBudget = useMutation(api.budgets.createBudget);
  const updateBudget = useMutation(api.budgets.updateBudget);
  const deleteBudget = useMutation(api.budgets.deleteBudget);
  const resetBudgetSpend = useMutation(api.budgets.resetBudgetSpend);

  // Handlers
  const handleCreateClick = () => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      scope: workspaceId ? 'workspace' : 'user',
      scopeId: workspaceId || undefined,
    });
    setIsCreating(true);
    setEditingBudgetId(null);
    setError(null);
  };

  const handleEditClick = (budget: any) => {
    setFormData({
      name: budget.name,
      scope: budget.scope,
      scopeId: budget.scopeId,
      amount: budget.amount,
      period: budget.period,
      currency: budget.currency,
      alertThresholds: budget.alertThresholds,
      hardLimit: budget.hardLimit,
      rollover: budget.rollover,
      notifyEmail: budget.notifyEmail ?? true,
      notifyInApp: budget.notifyInApp ?? true,
    });
    setEditingBudgetId(budget._id);
    setIsCreating(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingBudgetId(null);
    setFormData(DEFAULT_FORM_DATA);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingBudgetId) {
        await updateBudget({
          budgetId: editingBudgetId,
          name: formData.name,
          amount: formData.amount,
          alertThresholds: formData.alertThresholds,
          hardLimit: formData.hardLimit,
          rollover: formData.rollover,
          notifyEmail: formData.notifyEmail,
          notifyInApp: formData.notifyInApp,
        });
      } else {
        await createBudget({
          name: formData.name,
          scope: formData.scope,
          scopeId: formData.scopeId,
          amount: formData.amount,
          period: formData.period,
          currency: formData.currency,
          alertThresholds: formData.alertThresholds,
          hardLimit: formData.hardLimit,
          rollover: formData.rollover,
          notifyEmail: formData.notifyEmail,
          notifyInApp: formData.notifyInApp,
        });
      }

      handleCancel();
    } catch (err: any) {
      setError(err.message || 'Failed to save budget');
    }
  };

  const handleDelete = async (budgetId: Id<"budgets">) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    try {
      await deleteBudget({ budgetId });
    } catch (err: any) {
      setError(err.message || 'Failed to delete budget');
    }
  };

  const handleReset = async (budgetId: Id<"budgets">) => {
    if (!confirm('Are you sure you want to reset the current spend for this budget?')) return;

    try {
      await resetBudgetSpend({ budgetId });
    } catch (err: any) {
      setError(err.message || 'Failed to reset budget');
    }
  };

  const handleToggleActive = async (budget: any) => {
    try {
      await updateBudget({
        budgetId: budget._id,
        isActive: !budget.isActive,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update budget');
    }
  };

  const handleThresholdChange = (index: number, value: number) => {
    const newThresholds = [...formData.alertThresholds];
    newThresholds[index] = value;
    setFormData({ ...formData, alertThresholds: newThresholds.sort((a, b) => a - b) });
  };

  const addThreshold = () => {
    const maxThreshold = Math.max(...formData.alertThresholds, 0);
    const newThreshold = Math.min(maxThreshold + 10, 100);
    if (!formData.alertThresholds.includes(newThreshold)) {
      setFormData({
        ...formData,
        alertThresholds: [...formData.alertThresholds, newThreshold].sort((a, b) => a - b),
      });
    }
  };

  const removeThreshold = (index: number) => {
    if (formData.alertThresholds.length > 1) {
      const newThresholds = formData.alertThresholds.filter((_, i) => i !== index);
      setFormData({ ...formData, alertThresholds: newThresholds });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-main">Budget Management</h3>
          <p className="text-xs text-secondary">
            Set spending limits and receive alerts when approaching thresholds
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Create Budget
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-background border border-border rounded-xl p-6">
          <h4 className="text-base font-bold text-main mb-4">
            {editingBudgetId ? 'Edit Budget' : 'Create New Budget'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                Budget Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly AI Spend"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-main placeholder-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>

            {/* Scope and Amount Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Scope */}
              {!editingBudgetId && (
                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                    Scope
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="user">Personal</option>
                    {workspaceId && <option value="workspace">Workspace</option>}
                    <option value="project">Project</option>
                  </select>
                </div>
              )}

              {/* Period */}
              {!editingBudgetId && (
                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                    Period
                  </label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                  Budget Amount ($)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>

            {/* Alert Thresholds */}
            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                Alert Thresholds (%)
              </label>
              <div className="flex flex-wrap gap-2">
                {formData.alertThresholds.map((threshold, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => handleThresholdChange(index, parseInt(e.target.value) || 0)}
                      min="1"
                      max="100"
                      className="w-16 px-2 py-1 bg-surface border border-border rounded text-sm text-main text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <span className="text-secondary text-xs">%</span>
                    {formData.alertThresholds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeThreshold(index)}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <Icons.X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addThreshold}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                >
                  <Icons.Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Hard Limit */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hardLimit}
                  onChange={(e) => setFormData({ ...formData, hardLimit: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-main">Hard Limit</span>
              </label>

              {/* Rollover */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rollover}
                  onChange={(e) => setFormData({ ...formData, rollover: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-main">Rollover Unused</span>
              </label>

              {/* Email Notifications */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyEmail}
                  onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-main">Email Alerts</span>
              </label>

              {/* In-App Notifications */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyInApp}
                  onChange={(e) => setFormData({ ...formData, notifyInApp: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-main">In-App Alerts</span>
              </label>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Icons.Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold mb-1">Options Explained:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Hard Limit:</strong> Block AI requests when budget is exceeded</li>
                    <li><strong>Rollover:</strong> Unused budget carries over to the next period</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-secondary hover:text-main transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors"
              >
                {editingBudgetId ? 'Update Budget' : 'Create Budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget List */}
      {budgets && budgets.length > 0 ? (
        <div className="space-y-4">
          {/* Active Budgets */}
          <div>
            <h4 className="text-sm font-bold text-main mb-3">Active Budgets</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets
                .filter(b => b.isActive)
                .map((budget) => (
                  <div key={budget._id} className="relative">
                    <BudgetStatusCard budget={budget} />
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(budget)}
                        className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded transition-colors"
                        title="Edit budget"
                      >
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReset(budget._id)}
                        className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded transition-colors"
                        title="Reset current spend"
                      >
                        <Icons.RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(budget)}
                        className="p-1.5 text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                        title="Pause budget"
                      >
                        <Icons.Pause className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(budget._id)}
                        className="p-1.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete budget"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Inactive Budgets */}
          {budgets.some(b => !b.isActive) && (
            <div>
              <h4 className="text-sm font-bold text-secondary mb-3">Paused Budgets</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgets
                  .filter(b => !b.isActive)
                  .map((budget) => (
                    <div key={budget._id} className="relative opacity-60">
                      <BudgetStatusCard budget={budget} />
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(budget)}
                          className="p-1.5 text-secondary hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                          title="Resume budget"
                        >
                          <Icons.Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(budget._id)}
                          className="p-1.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete budget"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        !isCreating && (
          <div className="text-center py-12 bg-background border border-border rounded-xl">
            <Icons.Wallet className="w-12 h-12 text-secondary mx-auto mb-3" />
            <h3 className="text-base font-bold text-main mb-1">No Budgets Yet</h3>
            <p className="text-sm text-secondary mb-4">
              Create a budget to track and control your AI spending
            </p>
            <button
              onClick={handleCreateClick}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors"
            >
              Create Your First Budget
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default BudgetManager;

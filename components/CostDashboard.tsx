import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { LineChart, BarChart, DonutChart } from './AnalyticsChart';
import AnalyticsCard, { AnalyticsCardGroup } from './AnalyticsCard';
import BudgetManager from './BudgetManager';
import BudgetStatusCard from './BudgetStatusCard';
import CostAlertBanner from './CostAlertBanner';
import UsageTable from './UsageTable';
import CostOptimizationTips from './CostOptimizationTips';

type TimeRange = '24h' | '7d' | '30d' | '90d';
type ActiveTab = 'overview' | 'providers' | 'budgets' | 'usage' | 'optimize';

interface CostDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: Id<"workspaces">;
}

const CostDashboard: React.FC<CostDashboardProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data from Convex
  const usageSummary = useQuery(api.costs.getUsageSummary, {
    scope: workspaceId ? 'workspace' : 'user',
    scopeId: workspaceId || undefined,
    timeRange,
  });

  const costsByProvider = useQuery(api.costs.getCostsByProvider, {
    timeRange,
    workspaceId,
  });

  const costsByProject = useQuery(api.costs.getCostsByProject, {
    timeRange,
    workspaceId,
  });

  const costTrends = useQuery(api.costs.getCostTrends, {
    scope: workspaceId ? 'workspace' : 'user',
    scopeId: workspaceId || undefined,
    timeRange,
  });

  const topCostDrivers = useQuery(api.costs.getTopCostDrivers, {
    scope: workspaceId ? 'workspace' : 'user',
    scopeId: workspaceId || undefined,
    limit: 10,
    timeRange,
  });

  const budgets = useQuery(api.budgets.listBudgets, {
    workspaceId,
  });

  const alerts = useQuery(api.budgets.getBudgetAlerts, {
    workspaceId,
    includeDismissed: false,
    limit: 5,
  });

  const pricing = useQuery(api.costs.getPricing, {});

  // Helper functions
  const formatCost = (cost: number): string => {
    if (cost >= 1000) {
      return `$${(cost / 1000).toFixed(2)}K`;
    }
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`;
    }
    if (cost >= 0.01) {
      return `$${cost.toFixed(2)}`;
    }
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toLocaleString();
  };

  const formatPercent = (value: number): string => {
    if (value >= 0) return `+${value.toFixed(1)}%`;
    return `${value.toFixed(1)}%`;
  };

  // Export handler
  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/costs/export?format=${format}&timeRange=${timeRange}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cost-report-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
    setIsExporting(false);
  };

  // Prepare chart data
  const trendChartData = useMemo(() => {
    if (!costTrends?.trends) return [];
    return costTrends.trends.map(d => ({
      date: d.date,
      value: d.cost,
      label: formatCost(d.cost),
    }));
  }, [costTrends]);

  const providerChartData = useMemo(() => {
    if (!costsByProvider?.providers) return [];
    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
    return costsByProvider.providers.map((p, i) => ({
      label: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
      value: p.cost,
      color: colors[i % colors.length],
    }));
  }, [costsByProvider]);

  const projectChartData = useMemo(() => {
    if (!costsByProject?.projects) return [];
    return costsByProject.projects.slice(0, 5).map(p => ({
      label: p.projectName,
      value: p.cost,
    }));
  }, [costsByProject]);

  const operationChartData = useMemo(() => {
    if (!topCostDrivers?.byOperation) return [];
    return topCostDrivers.byOperation.slice(0, 5).map(op => ({
      label: op.operation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: op.cost,
    }));
  }, [topCostDrivers]);

  // Loading state
  const isLoading = !usageSummary || !costsByProvider || !costTrends;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-hover/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Icons.DollarSign className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Cost Management</h2>
              <p className="text-xs text-secondary">
                Track AI usage costs and manage budgets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
              {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    timeRange === range
                      ? 'bg-emerald-500 text-white'
                      : 'text-secondary hover:text-main'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-secondary hover:text-main transition-colors"
                disabled={isExporting}
              >
                <Icons.Download className="w-4 h-4" />
                Export
                <Icons.ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-32">
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-3 py-2 text-xs text-left text-main hover:bg-surface-hover transition-colors"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-3 py-2 text-xs text-left text-main hover:bg-surface-hover transition-colors"
                >
                  Export as CSV
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5 text-secondary hover:text-main" />
            </button>
          </div>
        </div>

        {/* Alert Banner */}
        {alerts && alerts.length > 0 && (
          <CostAlertBanner alerts={alerts} />
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-surface-hover/10">
          {[
            { id: 'overview' as ActiveTab, label: 'Overview', icon: <Icons.PieChart className="w-4 h-4" /> },
            { id: 'providers' as ActiveTab, label: 'Providers', icon: <Icons.Cpu className="w-4 h-4" /> },
            { id: 'budgets' as ActiveTab, label: 'Budgets', icon: <Icons.Wallet className="w-4 h-4" /> },
            { id: 'usage' as ActiveTab, label: 'Usage Log', icon: <Icons.Receipt className="w-4 h-4" /> },
            { id: 'optimize' as ActiveTab, label: 'Optimize', icon: <Icons.Lightbulb className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-secondary hover:text-main hover:bg-surface-hover'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <Icons.Loader className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm text-secondary">Loading cost data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  {/* Key Metrics */}
                  <AnalyticsCardGroup columns={4}>
                    <AnalyticsCard
                      title="Total Spend"
                      value={formatCost(usageSummary?.totalCost || 0)}
                      subtitle={timeRange === '24h' ? 'today' :
                               timeRange === '7d' ? 'this week' :
                               timeRange === '30d' ? 'this month' : 'last 90 days'}
                      icon={<Icons.DollarSign className="w-4 h-4" />}
                      iconColor="text-emerald-500"
                      trend={usageSummary?.costTrend !== undefined ? {
                        value: usageSummary.costTrend,
                        isPositive: usageSummary.costTrend <= 0,
                      } : undefined}
                      sparklineData={trendChartData.slice(-7).map(d => d.value)}
                    />
                    <AnalyticsCard
                      title="Total Tokens"
                      value={formatTokens(usageSummary?.totalTokens || 0)}
                      subtitle={`${formatTokens(usageSummary?.totalInputTokens || 0)} in / ${formatTokens(usageSummary?.totalOutputTokens || 0)} out`}
                      icon={<Icons.Cpu className="w-4 h-4" />}
                      iconColor="text-blue-500"
                    />
                    <AnalyticsCard
                      title="Requests"
                      value={usageSummary?.requestCount || 0}
                      subtitle={`${formatCost(usageSummary?.avgCostPerRequest || 0)} avg/request`}
                      icon={<Icons.Activity className="w-4 h-4" />}
                      iconColor="text-purple-500"
                    />
                    <AnalyticsCard
                      title="Projected Monthly"
                      value={formatCost(usageSummary?.projectedMonthlyCost || 0)}
                      subtitle={`${formatCost(usageSummary?.dailyAvgCost || 0)}/day avg`}
                      icon={<Icons.TrendUp className="w-4 h-4" />}
                      iconColor="text-amber-500"
                    />
                  </AnalyticsCardGroup>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cost Trend */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <LineChart
                        data={trendChartData}
                        title="Cost Trend"
                        height={200}
                        showArea
                        color="#10b981"
                        formatValue={(v) => formatCost(v)}
                      />
                    </div>

                    {/* Provider Distribution */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <DonutChart
                        data={providerChartData}
                        title="Cost by Provider"
                        size={160}
                        centerValue={formatCost(usageSummary?.totalCost || 0)}
                        centerLabel="Total"
                        showPercentages
                      />
                    </div>
                  </div>

                  {/* Budget Status Cards */}
                  {budgets && budgets.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-main">Active Budgets</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {budgets.slice(0, 3).map((budget) => (
                          <BudgetStatusCard key={budget._id} budget={budget} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Cost Drivers */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* By Operation */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Top Operations by Cost</h3>
                      {operationChartData.length > 0 ? (
                        <BarChart
                          data={operationChartData}
                          horizontal
                          height={180}
                          formatValue={(v) => formatCost(v)}
                        />
                      ) : (
                        <div className="h-40 flex items-center justify-center text-secondary text-sm">
                          No usage data yet
                        </div>
                      )}
                    </div>

                    {/* By Project */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Top Projects by Cost</h3>
                      {projectChartData.length > 0 ? (
                        <BarChart
                          data={projectChartData}
                          horizontal
                          height={180}
                          formatValue={(v) => formatCost(v)}
                        />
                      ) : (
                        <div className="h-40 flex items-center justify-center text-secondary text-sm">
                          No project data yet
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Providers Tab */}
              {activeTab === 'providers' && (
                <>
                  {/* Provider Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {costsByProvider?.providers.map((provider) => (
                      <div
                        key={provider.provider}
                        className="bg-background border border-border rounded-xl p-5"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${
                            provider.provider === 'openai' ? 'bg-emerald-500/10' :
                            provider.provider === 'anthropic' || provider.provider === 'claude' ? 'bg-amber-500/10' :
                            'bg-blue-500/10'
                          }`}>
                            <Icons.Cpu className={`w-5 h-5 ${
                              provider.provider === 'openai' ? 'text-emerald-500' :
                              provider.provider === 'anthropic' || provider.provider === 'claude' ? 'text-amber-500' :
                              'text-blue-500'
                            }`} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-main capitalize">
                              {provider.provider}
                            </h3>
                            <p className="text-xs text-secondary">
                              {provider.requests} requests
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-secondary">Total Cost</span>
                            <span className="text-sm font-bold text-main">
                              {formatCost(provider.cost)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-secondary">Total Tokens</span>
                            <span className="text-sm font-medium text-main">
                              {formatTokens(provider.tokens)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-secondary">Avg Cost/Request</span>
                            <span className="text-sm font-medium text-main">
                              {formatCost(provider.requests > 0 ? provider.cost / provider.requests : 0)}
                            </span>
                          </div>
                        </div>

                        {/* Model Breakdown */}
                        {Object.keys(provider.models).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-xs font-bold text-secondary mb-2 uppercase tracking-wider">
                              Models
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(provider.models)
                                .sort(([, a], [, b]) => b.cost - a.cost)
                                .slice(0, 3)
                                .map(([model, stats]) => (
                                  <div
                                    key={model}
                                    className="flex justify-between items-center text-xs"
                                  >
                                    <span className="text-secondary truncate max-w-32">
                                      {model}
                                    </span>
                                    <span className="text-main font-medium">
                                      {formatCost(stats.cost)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pricing Reference */}
                  {pricing && (
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Pricing Reference</h3>
                      <p className="text-xs text-secondary mb-4">
                        Prices per 1 million tokens (approximate)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(pricing).map(([provider, models]) => (
                          <div key={provider} className="space-y-2">
                            <h4 className="text-xs font-bold text-main uppercase tracking-wider">
                              {provider}
                            </h4>
                            {models.slice(0, 3).map((model) => (
                              <div
                                key={model.model}
                                className="flex justify-between items-center text-xs bg-surface p-2 rounded"
                              >
                                <span className="text-secondary truncate max-w-24">
                                  {model.model}
                                </span>
                                <span className="text-main">
                                  ${(model.inputPer1M / 100).toFixed(2)} / ${(model.outputPer1M / 100).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Budgets Tab */}
              {activeTab === 'budgets' && (
                <BudgetManager workspaceId={workspaceId} />
              )}

              {/* Usage Log Tab */}
              {activeTab === 'usage' && (
                <UsageTable
                  workspaceId={workspaceId}
                  timeRange={timeRange}
                />
              )}

              {/* Optimize Tab */}
              {activeTab === 'optimize' && (
                <CostOptimizationTips
                  usageSummary={usageSummary}
                  costsByProvider={costsByProvider}
                  topCostDrivers={topCostDrivers}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-hover/30 flex items-center justify-between text-xs text-secondary">
          <span>
            Data from {timeRange === '24h' ? 'last 24 hours' :
                       timeRange === '7d' ? 'last 7 days' :
                       timeRange === '30d' ? 'last 30 days' : 'last 90 days'}
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CostDashboard;

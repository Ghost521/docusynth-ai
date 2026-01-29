import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import AnalyticsCard, { AnalyticsCardGroup } from './AnalyticsCard';
import { LineChart, BarChart, DonutChart, StackedBarChart } from './AnalyticsChart';

type TimeRange = '24h' | '7d' | '30d' | '90d';
type ActiveTab = 'overview' | 'documents' | 'performance' | 'api';

// Type definitions for analytics data
interface ProviderStats {
  [provider: string]: {
    totalCalls: number;
    totalTokens: number;
    avgTokensPerCall: number;
    models: Record<string, number>;
    lastUsed: number;
  };
}

interface ResponseTimeStats {
  [eventType: string]: {
    avg: number;
    count: number;
  };
}

interface ErrorByFeature {
  [eventType: string]: {
    total: number;
    errors: number;
    rate: number;
  };
}

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: Id<"workspaces">;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data from Convex
  const overview = useQuery(api.analytics.getOverview, {
    timeRange,
    workspaceId,
  });

  const documentStats = useQuery(api.analytics.getDocumentStats, {
    timeRange,
    workspaceId,
  });

  const performanceMetrics = useQuery(api.analytics.getPerformanceMetrics, {
    timeRange,
    workspaceId,
  });

  const apiUsage = useQuery(api.analytics.getApiUsage, {
    timeRange,
    workspaceId,
  });

  const topContent = useQuery(api.analytics.getTopContent, {
    timeRange,
    limit: 10,
    workspaceId,
  });

  const recentActivity = useQuery(api.analytics.getRecentActivity, {
    limit: 15,
  });

  const providerStats = useQuery(api.analytics.getProviderStats);

  const exportData = useQuery(api.analytics.exportData, {
    timeRange,
    format: 'json',
  });

  // Export handlers
  const handleExportJSON = () => {
    if (!exportData?.data) return;
    const blob = new Blob([JSON.stringify(exportData.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    // Trigger CSV export query
    const csvData = await fetch(`/api/analytics/export?format=csv&timeRange=${timeRange}`);
    if (csvData.ok) {
      const text = await csvData.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setIsExporting(false);
  };

  // Helper functions
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const formatEventType = (type: string): string => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getEventIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'document_generated':
        return <Icons.Sparkles className="w-4 h-4 text-primary" />;
      case 'document_viewed':
        return <Icons.Search className="w-4 h-4 text-blue-500" />;
      case 'document_exported':
        return <Icons.Download className="w-4 h-4 text-green-500" />;
      case 'document_refreshed':
        return <Icons.Refresh className="w-4 h-4 text-cyan-500" />;
      case 'mcp_generated':
        return <Icons.Cpu className="w-4 h-4 text-purple-500" />;
      case 'crawl_completed':
        return <Icons.Globe className="w-4 h-4 text-orange-500" />;
      case 'api_call':
        return <Icons.Key className="w-4 h-4 text-amber-500" />;
      case 'webhook_delivered':
        return <Icons.Webhook className="w-4 h-4 text-pink-500" />;
      case 'bot_command':
        return <Icons.Terminal className="w-4 h-4 text-indigo-500" />;
      case 'import_completed':
        return <Icons.Import className="w-4 h-4 text-teal-500" />;
      default:
        return <Icons.Info className="w-4 h-4 text-secondary" />;
    }
  };

  // Prepare chart data
  const documentChartData = useMemo(() => {
    if (!documentStats?.byDay) return [];
    return documentStats.byDay.map(d => ({
      date: d.date,
      value: d.generated,
      label: `${d.generated} documents`,
    }));
  }, [documentStats]);

  const modeChartData = useMemo(() => {
    if (!overview?.byMode) return [];
    return [
      { label: 'Search', value: overview.byMode.search, color: '#10b981' },
      { label: 'Crawl', value: overview.byMode.crawl, color: '#3b82f6' },
      { label: 'GitHub', value: overview.byMode.github, color: '#6366f1' },
      { label: 'MCP', value: overview.byMode.mcp, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [overview]);

  const apiChartData = useMemo(() => {
    if (!apiUsage?.byDay) return [];
    return apiUsage.byDay.map(d => ({
      date: d.date,
      apiCalls: d.apiCalls,
      webhooks: d.webhooks,
      botCommands: d.botCommands,
    }));
  }, [apiUsage]);

  const providerChartData = useMemo(() => {
    if (!providerStats) return [];
    const stats = providerStats as ProviderStats;
    return Object.entries(stats).map(([provider, providerData]) => ({
      label: provider.charAt(0).toUpperCase() + provider.slice(1),
      value: providerData.totalCalls,
      color: provider === 'gemini' ? '#3b82f6' :
             provider === 'claude' ? '#f59e0b' :
             provider === 'openai' ? '#10b981' : '#8b5cf6',
    }));
  }, [providerStats]);

  const timeDistributionData = useMemo(() => {
    if (!documentStats?.timeDistribution) return [];
    return [
      { label: 'Fast (<5s)', value: documentStats.timeDistribution.fast, color: '#10b981' },
      { label: 'Medium (5-15s)', value: documentStats.timeDistribution.medium, color: '#f59e0b' },
      { label: 'Slow (15-30s)', value: documentStats.timeDistribution.slow, color: '#ef4444' },
      { label: 'Very Slow (>30s)', value: documentStats.timeDistribution.verySlow, color: '#991b1b' },
    ].filter(d => d.value > 0);
  }, [documentStats]);

  // Loading state
  const isLoading = !overview || !documentStats || !performanceMetrics || !apiUsage;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-hover/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Chart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Analytics Dashboard</h2>
              <p className="text-xs text-secondary">
                Track your documentation generation activity and performance
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
                      ? 'bg-primary text-white'
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
                  onClick={handleExportJSON}
                  className="w-full px-3 py-2 text-xs text-left text-main hover:bg-surface-hover transition-colors"
                >
                  Export as JSON
                </button>
                <button
                  onClick={handleExportCSV}
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-surface-hover/10">
          {[
            { id: 'overview' as ActiveTab, label: 'Overview', icon: <Icons.BarChart className="w-4 h-4" /> },
            { id: 'documents' as ActiveTab, label: 'Documents', icon: <Icons.FileText className="w-4 h-4" /> },
            { id: 'performance' as ActiveTab, label: 'Performance', icon: <Icons.Activity className="w-4 h-4" /> },
            { id: 'api' as ActiveTab, label: 'API & Integrations', icon: <Icons.Key className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
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
                <Icons.Loader className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-secondary">Loading analytics data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  {/* Key Metrics Cards */}
                  <AnalyticsCardGroup columns={4}>
                    <AnalyticsCard
                      title="Documents Generated"
                      value={overview?.totalDocuments || 0}
                      subtitle="total"
                      icon={<Icons.Sparkles className="w-4 h-4" />}
                      iconColor="text-primary"
                      trend={overview?.documentsTrend !== undefined ? {
                        value: overview.documentsTrend,
                        isPositive: overview.documentsTrend >= 0,
                      } : undefined}
                      sparklineData={documentChartData.slice(-7).map(d => d.value)}
                    />
                    <AnalyticsCard
                      title="Success Rate"
                      value={`${(overview?.successRate || 0).toFixed(1)}%`}
                      subtitle={`${overview?.successfulDocs || 0} successful`}
                      icon={<Icons.CheckCircle className="w-4 h-4" />}
                      iconColor="text-emerald-500"
                    />
                    <AnalyticsCard
                      title="Tokens Used"
                      value={formatNumber(overview?.totalTokens || 0)}
                      subtitle="total tokens"
                      icon={<Icons.Cpu className="w-4 h-4" />}
                      iconColor="text-purple-500"
                      trend={overview?.tokensTrend !== undefined ? {
                        value: overview.tokensTrend,
                        isPositive: overview.tokensTrend >= 0,
                      } : undefined}
                    />
                    <AnalyticsCard
                      title="Avg Generation Time"
                      value={formatDuration(overview?.avgGenerationTime || 0)}
                      subtitle="per document"
                      icon={<Icons.Clock className="w-4 h-4" />}
                      iconColor="text-amber-500"
                    />
                  </AnalyticsCardGroup>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Generation Trend */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <LineChart
                        data={documentChartData}
                        title="Document Generation Trend"
                        height={200}
                        showArea
                        color="#10b981"
                        formatValue={(v) => v.toString()}
                      />
                    </div>

                    {/* Generation Mode Distribution */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <DonutChart
                        data={modeChartData}
                        title="Generation by Mode"
                        size={160}
                        centerValue={overview?.totalDocuments || 0}
                        centerLabel="Total"
                        showPercentages
                      />
                    </div>
                  </div>

                  {/* Provider Usage & Recent Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Provider Usage */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Provider Usage</h3>
                      {providerChartData.length > 0 ? (
                        <BarChart
                          data={providerChartData}
                          horizontal
                          height={150}
                          formatValue={(v) => `${v} calls`}
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-secondary text-sm">
                          No provider data yet
                        </div>
                      )}
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Recent Activity</h3>
                      {recentActivity && recentActivity.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {recentActivity.slice(0, 8).map((event) => (
                            <div
                              key={event._id}
                              className="flex items-center justify-between py-2 border-b border-border last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-surface rounded-lg">
                                  {getEventIcon(event.eventType)}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-main">
                                    {formatEventType(event.eventType)}
                                  </p>
                                  {event.provider && (
                                    <p className="text-[10px] text-secondary">
                                      via {event.provider}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-secondary">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-32 flex items-center justify-center text-secondary text-sm">
                          No recent activity
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <>
                  {/* Document Stats Cards */}
                  <AnalyticsCardGroup columns={4}>
                    <AnalyticsCard
                      title="Generated"
                      value={documentStats?.total.generated || 0}
                      icon={<Icons.Sparkles className="w-4 h-4" />}
                      iconColor="text-primary"
                      compact
                    />
                    <AnalyticsCard
                      title="Refreshed"
                      value={documentStats?.total.refreshed || 0}
                      icon={<Icons.Refresh className="w-4 h-4" />}
                      iconColor="text-cyan-500"
                      compact
                    />
                    <AnalyticsCard
                      title="Exported"
                      value={documentStats?.total.exported || 0}
                      icon={<Icons.Download className="w-4 h-4" />}
                      iconColor="text-green-500"
                      compact
                    />
                    <AnalyticsCard
                      title="Viewed"
                      value={documentStats?.total.viewed || 0}
                      icon={<Icons.Search className="w-4 h-4" />}
                      iconColor="text-blue-500"
                      compact
                    />
                  </AnalyticsCardGroup>

                  {/* Document Activity Chart */}
                  <div className="bg-background border border-border rounded-xl p-5">
                    <StackedBarChart
                      data={documentStats?.byDay.map(d => ({
                        date: d.date,
                        generated: d.generated,
                        refreshed: d.refreshed,
                        exported: d.exported,
                      })) || []}
                      series={[
                        { key: 'generated', label: 'Generated', color: '#10b981' },
                        { key: 'refreshed', label: 'Refreshed', color: '#06b6d4' },
                        { key: 'exported', label: 'Exported', color: '#8b5cf6' },
                      ]}
                      height={200}
                      title="Daily Document Activity"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Mode Distribution */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <BarChart
                        data={[
                          { label: 'Search', value: documentStats?.byMode.search || 0, color: '#10b981' },
                          { label: 'Crawl', value: documentStats?.byMode.crawl || 0, color: '#3b82f6' },
                          { label: 'GitHub', value: documentStats?.byMode.github || 0, color: '#6366f1' },
                          { label: 'MCP', value: documentStats?.byMode.mcp || 0, color: '#f59e0b' },
                        ]}
                        title="Documents by Generation Mode"
                        height={180}
                      />
                    </div>

                    {/* Generation Time Distribution */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <DonutChart
                        data={timeDistributionData}
                        title="Generation Time Distribution"
                        size={140}
                        showPercentages
                      />
                    </div>
                  </div>

                  {/* Word Stats */}
                  <div className="bg-background border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-main mb-4">Content Statistics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-surface rounded-lg">
                        <p className="text-2xl font-bold text-main">
                          {formatNumber(documentStats?.wordStats.avg || 0)}
                        </p>
                        <p className="text-[10px] text-secondary uppercase tracking-wider">
                          Avg Words/Doc
                        </p>
                      </div>
                      <div className="text-center p-4 bg-surface rounded-lg">
                        <p className="text-2xl font-bold text-main">
                          {formatNumber(documentStats?.wordStats.max || 0)}
                        </p>
                        <p className="text-[10px] text-secondary uppercase tracking-wider">
                          Longest Doc
                        </p>
                      </div>
                      <div className="text-center p-4 bg-surface rounded-lg">
                        <p className="text-2xl font-bold text-main">
                          {`${(documentStats?.successRate || 0).toFixed(1)}%`}
                        </p>
                        <p className="text-[10px] text-secondary uppercase tracking-wider">
                          Success Rate
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Top Topics */}
                  {topContent?.topTopics && topContent.topTopics.length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Most Generated Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {topContent.topTopics.map((topic, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 bg-surface border border-border rounded-lg"
                          >
                            <span className="text-xs font-medium text-main">{topic.topic}</span>
                            <span className="ml-2 text-[10px] text-secondary">
                              {topic.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <>
                  {/* Performance Metrics Cards */}
                  <AnalyticsCardGroup columns={4}>
                    <AnalyticsCard
                      title="Avg Response Time"
                      value={formatDuration(performanceMetrics?.responseTime.avg || 0)}
                      icon={<Icons.Clock className="w-4 h-4" />}
                      iconColor="text-blue-500"
                    />
                    <AnalyticsCard
                      title="P50 Latency"
                      value={formatDuration(performanceMetrics?.responseTime.p50 || 0)}
                      subtitle="median"
                      icon={<Icons.Gauge className="w-4 h-4" />}
                      iconColor="text-emerald-500"
                    />
                    <AnalyticsCard
                      title="P95 Latency"
                      value={formatDuration(performanceMetrics?.responseTime.p95 || 0)}
                      icon={<Icons.Gauge className="w-4 h-4" />}
                      iconColor="text-amber-500"
                    />
                    <AnalyticsCard
                      title="Error Rate"
                      value={`${(performanceMetrics?.errorRate.overall || 0).toFixed(2)}%`}
                      subtitle={`${performanceMetrics?.totalErrors || 0} errors`}
                      icon={<Icons.AlertTriangle className="w-4 h-4" />}
                      iconColor={performanceMetrics?.errorRate.overall && performanceMetrics.errorRate.overall > 5 ? 'text-red-500' : 'text-emerald-500'}
                    />
                  </AnalyticsCardGroup>

                  {/* Response Time by Feature */}
                  <div className="bg-background border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-main mb-4">Response Time by Feature</h3>
                    {performanceMetrics?.responseTimeByType && Object.keys(performanceMetrics.responseTimeByType).length > 0 ? (
                      <BarChart
                        data={Object.entries(performanceMetrics.responseTimeByType as ResponseTimeStats)
                          .filter(([_, stats]) => stats.count > 0)
                          .sort(([, a], [, b]) => b.avg - a.avg)
                          .slice(0, 10)
                          .map(([type, stats]) => ({
                            label: formatEventType(type),
                            value: stats.avg,
                          }))}
                        horizontal
                        height={200}
                        formatValue={(v) => formatDuration(v)}
                      />
                    ) : (
                      <div className="h-48 flex items-center justify-center text-secondary text-sm">
                        No performance data available
                      </div>
                    )}
                  </div>

                  {/* Error Rates by Feature */}
                  <div className="bg-background border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-main mb-4">Error Rates by Feature</h3>
                    {performanceMetrics?.errorRate.byFeature && Object.keys(performanceMetrics.errorRate.byFeature).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(performanceMetrics.errorRate.byFeature as ErrorByFeature)
                          .filter(([_, stats]) => stats.total > 0)
                          .sort(([, a], [, b]) => b.rate - a.rate)
                          .slice(0, 8)
                          .map(([type, stats]) => (
                            <div key={type}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-main font-medium">
                                  {formatEventType(type)}
                                </span>
                                <span className="text-xs text-secondary">
                                  {stats.errors}/{stats.total} ({stats.rate.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="h-2 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(stats.rate, 1)}%`,
                                    backgroundColor: stats.rate > 10 ? '#ef4444' :
                                                    stats.rate > 5 ? '#f59e0b' : '#10b981',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-secondary text-sm">
                        No error data available
                      </div>
                    )}
                  </div>

                  {/* Error Types */}
                  {performanceMetrics?.errorRate.byType && Object.keys(performanceMetrics.errorRate.byType).length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Error Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(performanceMetrics.errorRate.byType as Record<string, number>)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([type, count]) => (
                            <div
                              key={type}
                              className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                            >
                              <span className="text-xs font-medium text-red-500">{type}</span>
                              <span className="ml-2 text-[10px] text-red-400">
                                {count}x
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* API & Integrations Tab */}
              {activeTab === 'api' && (
                <>
                  {/* API Stats Cards */}
                  <AnalyticsCardGroup columns={4}>
                    <AnalyticsCard
                      title="API Calls"
                      value={apiUsage?.total.apiCalls || 0}
                      icon={<Icons.Key className="w-4 h-4" />}
                      iconColor="text-amber-500"
                      trend={overview?.apiCallsTrend !== undefined ? {
                        value: overview.apiCallsTrend,
                        isPositive: overview.apiCallsTrend >= 0,
                      } : undefined}
                    />
                    <AnalyticsCard
                      title="Webhooks"
                      value={apiUsage?.total.webhooks || 0}
                      subtitle={`${(apiUsage?.webhookSuccessRate || 0).toFixed(0)}% success`}
                      icon={<Icons.Webhook className="w-4 h-4" />}
                      iconColor="text-pink-500"
                    />
                    <AnalyticsCard
                      title="Bot Commands"
                      value={apiUsage?.total.botCommands || 0}
                      icon={<Icons.Terminal className="w-4 h-4" />}
                      iconColor="text-indigo-500"
                    />
                    <AnalyticsCard
                      title="Imports"
                      value={apiUsage?.total.imports || 0}
                      icon={<Icons.Import className="w-4 h-4" />}
                      iconColor="text-teal-500"
                    />
                  </AnalyticsCardGroup>

                  {/* API Usage Chart */}
                  <div className="bg-background border border-border rounded-xl p-5">
                    <StackedBarChart
                      data={apiChartData}
                      series={[
                        { key: 'apiCalls', label: 'API Calls', color: '#f59e0b' },
                        { key: 'webhooks', label: 'Webhooks', color: '#ec4899' },
                        { key: 'botCommands', label: 'Bot Commands', color: '#6366f1' },
                      ]}
                      height={200}
                      title="Daily API & Integration Activity"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Webhook Success Rate */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Webhook Delivery</h3>
                      <div className="flex items-center justify-center">
                        <div className="relative w-32 h-32">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="12"
                              className="text-border"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={apiUsage?.webhookSuccessRate && apiUsage.webhookSuccessRate >= 95 ? '#10b981' : '#f59e0b'}
                              strokeWidth="12"
                              strokeDasharray={`${(apiUsage?.webhookSuccessRate || 0) * 2.51} 251`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-main">
                              {(apiUsage?.webhookSuccessRate || 0).toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-secondary">Success</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Import Sources */}
                    <div className="bg-background border border-border rounded-xl p-5">
                      <h3 className="text-sm font-bold text-main mb-4">Import Sources</h3>
                      {apiUsage?.importsBySource && Object.keys(apiUsage.importsBySource).length > 0 ? (
                        <DonutChart
                          data={Object.entries(apiUsage.importsBySource as Record<string, number>).map(([source, count]) => ({
                            label: source.charAt(0).toUpperCase() + source.slice(1),
                            value: count as number,
                          }))}
                          size={140}
                          showPercentages
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-secondary text-sm">
                          No import data available
                        </div>
                      )}
                    </div>
                  </div>
                </>
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

export default AnalyticsDashboard;

import React, { useMemo } from 'react';
import { Icons } from './Icon';

interface UsageSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  avgCostPerRequest: number;
  projectedMonthlyCost: number;
}

interface ProviderData {
  provider: string;
  cost: number;
  tokens: number;
  requests: number;
  models: Record<string, { cost: number; tokens: number; requests: number }>;
}

interface CostsByProvider {
  providers: ProviderData[];
  totalCost: number;
}

interface OperationData {
  operation: string;
  cost: number;
  tokens: number;
  requests: number;
  avgCost: number;
}

interface TopCostDrivers {
  byOperation: OperationData[];
  topRequests: Array<{
    id: string;
    operation: string;
    provider: string;
    model: string;
    cost: number;
    tokens: number;
    timestamp: number;
  }>;
  totalCost: number;
}

interface CostOptimizationTipsProps {
  usageSummary?: UsageSummary | null;
  costsByProvider?: CostsByProvider | null;
  topCostDrivers?: TopCostDrivers | null;
}

interface Tip {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  savings?: string;
  actionable: boolean;
  category: 'provider' | 'model' | 'usage' | 'caching' | 'general';
}

const CostOptimizationTips: React.FC<CostOptimizationTipsProps> = ({
  usageSummary,
  costsByProvider,
  topCostDrivers,
}) => {
  const formatCost = (cost: number): string => {
    if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(0)}%`;
  };

  // Generate optimization tips based on usage data
  const tips = useMemo<Tip[]>(() => {
    const generatedTips: Tip[] = [];

    if (!usageSummary || !costsByProvider) {
      return generatedTips;
    }

    // Tip 1: Consider cheaper models
    const expensiveProviders = costsByProvider.providers.filter(
      p => p.provider === 'openai' && p.cost > 0
    );

    if (expensiveProviders.length > 0) {
      const openaiCost = expensiveProviders.reduce((sum, p) => sum + p.cost, 0);
      const potentialSavings = openaiCost * 0.7; // Gemini can be ~70% cheaper

      if (openaiCost > 1) {
        generatedTips.push({
          id: 'switch-to-gemini',
          title: 'Consider Gemini for Search-Based Tasks',
          description: `You've spent ${formatCost(openaiCost)} on OpenAI. For search-grounded documentation, Gemini 2.0 Flash offers comparable quality at significantly lower cost.`,
          impact: potentialSavings > 10 ? 'high' : 'medium',
          savings: `Up to ${formatCost(potentialSavings)} savings`,
          actionable: true,
          category: 'provider',
        });
      }
    }

    // Tip 2: Use smaller models for simple tasks
    if (costsByProvider.providers.some(p => {
      const hasExpensiveModels = Object.keys(p.models).some(m =>
        m.includes('gpt-4') || m.includes('opus') || m.includes('pro')
      );
      return hasExpensiveModels;
    })) {
      generatedTips.push({
        id: 'use-smaller-models',
        title: 'Use Smaller Models for Simple Tasks',
        description: 'Premium models (GPT-4, Claude Opus) are best for complex reasoning. For simpler tasks like formatting or basic summarization, try GPT-4o-mini, Claude Haiku, or Gemini Flash.',
        impact: 'high',
        savings: 'Up to 90% on eligible tasks',
        actionable: true,
        category: 'model',
      });
    }

    // Tip 3: High token usage
    const avgTokensPerRequest = usageSummary.requestCount > 0
      ? usageSummary.totalTokens / usageSummary.requestCount
      : 0;

    if (avgTokensPerRequest > 10000) {
      generatedTips.push({
        id: 'reduce-tokens',
        title: 'Optimize Token Usage',
        description: `Your average request uses ${Math.round(avgTokensPerRequest).toLocaleString()} tokens. Consider using more concise prompts or implementing chunking for large documents.`,
        impact: 'medium',
        actionable: true,
        category: 'usage',
      });
    }

    // Tip 4: Output heavy usage
    const outputRatio = usageSummary.totalOutputTokens / (usageSummary.totalInputTokens || 1);
    if (outputRatio > 3) {
      generatedTips.push({
        id: 'optimize-output',
        title: 'Output Token Optimization',
        description: 'Your output tokens are significantly higher than input. Consider asking for more concise responses or implementing response length limits.',
        impact: 'medium',
        actionable: true,
        category: 'usage',
      });
    }

    // Tip 5: Caching opportunity
    if (usageSummary.requestCount > 50) {
      generatedTips.push({
        id: 'enable-caching',
        title: 'Enable Response Caching',
        description: 'With over 50 requests, you could benefit from caching similar queries. Consider enabling document caching to avoid regenerating unchanged content.',
        impact: 'medium',
        savings: 'Up to 30% on repeated queries',
        actionable: true,
        category: 'caching',
      });
    }

    // Tip 6: High cost operations
    if (topCostDrivers?.byOperation) {
      const topOp = topCostDrivers.byOperation[0];
      if (topOp && topOp.cost > usageSummary.totalCost * 0.4) {
        const operationName = topOp.operation.replace(/_/g, ' ');
        generatedTips.push({
          id: 'high-cost-operation',
          title: `Review "${operationName}" Usage`,
          description: `This operation accounts for ${formatPercent((topOp.cost / usageSummary.totalCost) * 100)} of your total spend. Consider if all uses are necessary or if cheaper alternatives exist.`,
          impact: 'high',
          actionable: true,
          category: 'usage',
        });
      }
    }

    // Tip 7: Single expensive provider
    if (costsByProvider.providers.length === 1 && usageSummary.totalCost > 5) {
      generatedTips.push({
        id: 'diversify-providers',
        title: 'Diversify AI Providers',
        description: 'Using a single provider may not be cost-optimal. Different providers excel at different tasks. Consider using Gemini for search, Claude for analysis, and OpenAI for code.',
        impact: 'medium',
        actionable: true,
        category: 'provider',
      });
    }

    // General tips if we don't have specific recommendations
    if (generatedTips.length < 3) {
      generatedTips.push({
        id: 'batch-requests',
        title: 'Batch Similar Requests',
        description: 'Combine multiple similar requests into batch operations when possible to reduce API overhead and potentially get volume discounts.',
        impact: 'low',
        actionable: true,
        category: 'general',
      });

      generatedTips.push({
        id: 'monitor-regularly',
        title: 'Set Up Budget Alerts',
        description: 'Configure budget alerts at 50%, 80%, and 100% thresholds to stay informed about spending before it becomes a problem.',
        impact: 'low',
        actionable: true,
        category: 'general',
      });
    }

    return generatedTips;
  }, [usageSummary, costsByProvider, topCostDrivers]);

  const getImpactColor = (impact: Tip['impact']) => {
    switch (impact) {
      case 'high': return 'text-emerald-500 bg-emerald-500/10';
      case 'medium': return 'text-amber-500 bg-amber-500/10';
      case 'low': return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getCategoryIcon = (category: Tip['category']) => {
    switch (category) {
      case 'provider': return <Icons.Cpu className="w-4 h-4" />;
      case 'model': return <Icons.Sparkles className="w-4 h-4" />;
      case 'usage': return <Icons.Activity className="w-4 h-4" />;
      case 'caching': return <Icons.Database className="w-4 h-4" />;
      case 'general': return <Icons.Lightbulb className="w-4 h-4" />;
    }
  };

  // Cost comparison table data
  const comparisonData = useMemo(() => {
    return [
      { task: 'Search-grounded docs', recommended: 'Gemini 2.0 Flash', costPer1K: '$0.00004' },
      { task: 'Complex analysis', recommended: 'Claude Sonnet 4', costPer1K: '$0.018' },
      { task: 'Code generation', recommended: 'GPT-4o-mini', costPer1K: '$0.00075' },
      { task: 'Simple formatting', recommended: 'Gemini Flash', costPer1K: '$0.00004' },
      { task: 'Long documents', recommended: 'Gemini 1.5 Pro', costPer1K: '$0.00625' },
    ];
  }, []);

  if (!usageSummary) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icons.Loader className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <Icons.Lightbulb className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-main mb-1">
              Cost Optimization Insights
            </h3>
            <p className="text-sm text-secondary">
              Based on your usage patterns, we've identified {tips.length} potential optimizations
              that could help reduce your AI costs.
            </p>
          </div>
        </div>
      </div>

      {/* Tips Grid */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-main">Recommendations</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="bg-background border border-border rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${getImpactColor(tip.impact)}`}>
                    {getCategoryIcon(tip.category)}
                  </div>
                  <h5 className="text-sm font-bold text-main">{tip.title}</h5>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getImpactColor(tip.impact)}`}>
                  {tip.impact}
                </span>
              </div>

              <p className="text-xs text-secondary mb-3">{tip.description}</p>

              {tip.savings && (
                <div className="flex items-center gap-2 text-xs">
                  <Icons.TrendDown className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {tip.savings}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cost Comparison Table */}
      <div className="bg-background border border-border rounded-xl p-5">
        <h4 className="text-sm font-bold text-main mb-4">Model Selection Guide</h4>
        <p className="text-xs text-secondary mb-4">
          Choose the right model for each task to optimize costs without sacrificing quality.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase tracking-wider">
                  Task Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase tracking-wider">
                  Recommended Model
                </th>
                <th className="px-3 py-2 text-right text-xs font-bold text-secondary uppercase tracking-wider">
                  Cost per 1K Tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-surface-hover/30 transition-colors"
                >
                  <td className="px-3 py-2.5 text-sm text-main">{row.task}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {row.recommended}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">
                    {row.costPer1K}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-background border border-border rounded-xl p-5">
        <h4 className="text-sm font-bold text-main mb-4">Quick Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg hover:border-emerald-500/30 transition-colors text-left">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Icons.Settings className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <span className="text-sm font-medium text-main block">
                Configure Defaults
              </span>
              <span className="text-xs text-secondary">
                Set cost-efficient model defaults
              </span>
            </div>
          </button>

          <button className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg hover:border-emerald-500/30 transition-colors text-left">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Icons.Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <span className="text-sm font-medium text-main block">
                Create Budget
              </span>
              <span className="text-xs text-secondary">
                Set spending limits
              </span>
            </div>
          </button>

          <button className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg hover:border-emerald-500/30 transition-colors text-left">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Icons.Bell className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <span className="text-sm font-medium text-main block">
                Set Alerts
              </span>
              <span className="text-xs text-secondary">
                Get notified on thresholds
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Icons.Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-bold mb-1">Cost Optimization Best Practices</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use Gemini 2.0 Flash for search-grounded documentation (best value)</li>
              <li>Reserve premium models (GPT-4, Claude Opus) for complex reasoning tasks</li>
              <li>Enable caching to avoid regenerating unchanged content</li>
              <li>Set budget alerts to prevent unexpected charges</li>
              <li>Review usage weekly to identify optimization opportunities</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostOptimizationTips;

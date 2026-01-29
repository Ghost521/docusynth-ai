/**
 * Pricing Service
 * Provider pricing tables and cost calculation utilities
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'gemini' | 'claude';
export type Currency = 'USD' | 'EUR' | 'GBP';

// Pricing per 1 million tokens (in cents for precision)
export interface ModelPricing {
  inputPer1M: number; // cents per 1M input tokens
  outputPer1M: number; // cents per 1M output tokens
}

export interface ProviderPricing {
  [model: string]: ModelPricing;
}

// Default pricing tables (prices in cents per 1M tokens)
// Last updated: January 2025
export const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  openai: {
    'gpt-4o': { inputPer1M: 250, outputPer1M: 1000 }, // $2.50 / $10.00
    'gpt-4o-mini': { inputPer1M: 15, outputPer1M: 60 }, // $0.15 / $0.60
    'gpt-4-turbo': { inputPer1M: 1000, outputPer1M: 3000 }, // $10.00 / $30.00
    'gpt-4': { inputPer1M: 3000, outputPer1M: 6000 }, // $30.00 / $60.00
    'gpt-3.5-turbo': { inputPer1M: 50, outputPer1M: 150 }, // $0.50 / $1.50
    'o1-preview': { inputPer1M: 1500, outputPer1M: 6000 }, // $15.00 / $60.00
    'o1-mini': { inputPer1M: 300, outputPer1M: 1200 }, // $3.00 / $12.00
  },
  anthropic: {
    'claude-opus-4-20250514': { inputPer1M: 1500, outputPer1M: 7500 }, // $15.00 / $75.00
    'claude-sonnet-4-20250514': { inputPer1M: 300, outputPer1M: 1500 }, // $3.00 / $15.00
    'claude-3-5-sonnet-20241022': { inputPer1M: 300, outputPer1M: 1500 }, // $3.00 / $15.00
    'claude-3-5-haiku-20241022': { inputPer1M: 100, outputPer1M: 500 }, // $1.00 / $5.00
    'claude-3-opus': { inputPer1M: 1500, outputPer1M: 7500 }, // $15.00 / $75.00
    'claude-3-sonnet': { inputPer1M: 300, outputPer1M: 1500 }, // $3.00 / $15.00
    'claude-3-haiku': { inputPer1M: 25, outputPer1M: 125 }, // $0.25 / $1.25
  },
  google: {
    'gemini-2.0-flash': { inputPer1M: 10, outputPer1M: 40 }, // $0.10 / $0.40
    'gemini-2.5-pro-preview-05-06': { inputPer1M: 125, outputPer1M: 250 }, // $1.25 / $2.50
    'gemini-1.5-pro': { inputPer1M: 125, outputPer1M: 500 }, // $1.25 / $5.00
    'gemini-1.5-flash': { inputPer1M: 8, outputPer1M: 30 }, // $0.075 / $0.30
    'gemini-1.0-pro': { inputPer1M: 50, outputPer1M: 150 }, // $0.50 / $1.50
  },
};

// Alias mappings for backward compatibility
export const PROVIDER_ALIASES: Record<string, string> = {
  gemini: 'google',
  claude: 'anthropic',
};

// Currency conversion rates (relative to USD)
export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

/**
 * Calculate cost for a given number of tokens
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model: string
): number {
  // Resolve provider alias
  const resolvedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();
  const providerPricing = PROVIDER_PRICING[resolvedProvider];

  if (!providerPricing) {
    // Return estimate based on average pricing if provider not found
    const avgInputPrice = 100; // 1 dollar per 1M tokens average
    const avgOutputPrice = 300;
    return (inputTokens * avgInputPrice + outputTokens * avgOutputPrice) / 1_000_000 / 100;
  }

  // Find model pricing (exact match or partial match)
  let modelPricing = providerPricing[model];

  if (!modelPricing) {
    // Try partial match
    const modelKey = Object.keys(providerPricing).find(
      key => model.toLowerCase().includes(key.toLowerCase()) ||
             key.toLowerCase().includes(model.toLowerCase())
    );
    modelPricing = modelKey ? providerPricing[modelKey] : null;
  }

  if (!modelPricing) {
    // Use default/first model for provider
    const defaultModel = Object.keys(providerPricing)[0];
    modelPricing = providerPricing[defaultModel];
  }

  // Calculate cost in dollars
  const inputCost = (inputTokens * modelPricing.inputPer1M) / 1_000_000;
  const outputCost = (outputTokens * modelPricing.outputPer1M) / 1_000_000;

  return (inputCost + outputCost) / 100; // Convert cents to dollars
}

/**
 * Estimate cost for total tokens (rough estimate assuming 50/50 input/output split)
 */
export function estimateCostForTokens(
  totalTokens: number,
  provider: string,
  model: string
): number {
  const inputTokens = Math.floor(totalTokens * 0.4);
  const outputTokens = Math.floor(totalTokens * 0.6);
  return calculateCost(inputTokens, outputTokens, provider, model);
}

/**
 * Format cost for display
 */
export function formatCost(
  cost: number,
  currency: Currency = 'USD',
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  const { minimumFractionDigits = 2, maximumFractionDigits = 4 } = options;

  // Convert to target currency
  const convertedCost = cost * CURRENCY_RATES[currency];
  const symbol = CURRENCY_SYMBOLS[currency];

  // Format based on magnitude
  if (convertedCost < 0.01) {
    return `${symbol}${convertedCost.toFixed(maximumFractionDigits)}`;
  }

  return `${symbol}${convertedCost.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
}

/**
 * Format cost with abbreviation for large numbers
 */
export function formatCostCompact(cost: number, currency: Currency = 'USD'): string {
  const convertedCost = cost * CURRENCY_RATES[currency];
  const symbol = CURRENCY_SYMBOLS[currency];

  if (convertedCost >= 1000000) {
    return `${symbol}${(convertedCost / 1000000).toFixed(1)}M`;
  }
  if (convertedCost >= 1000) {
    return `${symbol}${(convertedCost / 1000).toFixed(1)}K`;
  }
  if (convertedCost >= 1) {
    return `${symbol}${convertedCost.toFixed(2)}`;
  }
  if (convertedCost >= 0.01) {
    return `${symbol}${convertedCost.toFixed(2)}`;
  }
  return `${symbol}${convertedCost.toFixed(4)}`;
}

/**
 * Get pricing info for a specific provider and model
 */
export function getModelPricing(provider: string, model: string): ModelPricing | null {
  const resolvedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();
  const providerPricing = PROVIDER_PRICING[resolvedProvider];

  if (!providerPricing) return null;

  return providerPricing[model] || null;
}

/**
 * Get all available models for a provider
 */
export function getProviderModels(provider: string): string[] {
  const resolvedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();
  const providerPricing = PROVIDER_PRICING[resolvedProvider];

  if (!providerPricing) return [];

  return Object.keys(providerPricing);
}

/**
 * Calculate savings from caching
 */
export function calculateCacheSavings(
  cachedRequests: number,
  avgInputTokens: number,
  avgOutputTokens: number,
  provider: string,
  model: string
): number {
  return cachedRequests * calculateCost(avgInputTokens, avgOutputTokens, provider, model);
}

/**
 * Get cost comparison across providers for same token count
 */
export function getCostComparison(
  inputTokens: number,
  outputTokens: number
): Array<{ provider: string; model: string; cost: number }> {
  const comparisons: Array<{ provider: string; model: string; cost: number }> = [];

  for (const [provider, models] of Object.entries(PROVIDER_PRICING)) {
    for (const [model] of Object.entries(models)) {
      const cost = calculateCost(inputTokens, outputTokens, provider, model);
      comparisons.push({ provider, model, cost });
    }
  }

  return comparisons.sort((a, b) => a.cost - b.cost);
}

/**
 * Calculate projected monthly cost based on daily usage
 */
export function projectMonthlyCost(
  dailyCost: number,
  daysInMonth: number = 30
): number {
  return dailyCost * daysInMonth;
}

/**
 * Calculate budget utilization percentage
 */
export function calculateBudgetUtilization(
  spent: number,
  budget: number
): number {
  if (budget <= 0) return 0;
  return Math.min((spent / budget) * 100, 100);
}

/**
 * Get budget status based on utilization
 */
export function getBudgetStatus(
  utilization: number
): 'healthy' | 'warning' | 'critical' | 'exceeded' {
  if (utilization >= 100) return 'exceeded';
  if (utilization >= 80) return 'critical';
  if (utilization >= 50) return 'warning';
  return 'healthy';
}

/**
 * Get color for budget status
 */
export function getBudgetStatusColor(status: ReturnType<typeof getBudgetStatus>): string {
  switch (status) {
    case 'healthy': return '#10b981'; // green
    case 'warning': return '#f59e0b'; // amber
    case 'critical': return '#ef4444'; // red
    case 'exceeded': return '#991b1b'; // dark red
    default: return '#6b7280'; // gray
  }
}

/**
 * Estimate remaining days until budget exhaustion
 */
export function estimateDaysUntilBudgetExhausted(
  currentSpend: number,
  budget: number,
  daysElapsed: number
): number | null {
  if (daysElapsed <= 0 || currentSpend <= 0) return null;

  const dailyRate = currentSpend / daysElapsed;
  const remaining = budget - currentSpend;

  if (remaining <= 0) return 0;

  return Math.ceil(remaining / dailyRate);
}

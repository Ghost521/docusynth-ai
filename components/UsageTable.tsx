import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';

type SortField = 'timestamp' | 'cost' | 'totalTokens' | 'provider' | 'operation';
type SortOrder = 'asc' | 'desc';
type TimeRange = '24h' | '7d' | '30d' | '90d';

interface UsageTableProps {
  workspaceId?: Id<"workspaces">;
  projectId?: Id<"projects">;
  timeRange: TimeRange;
}

const UsageTable: React.FC<UsageTableProps> = ({
  workspaceId,
  projectId,
  timeRange,
}) => {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterOperation, setFilterOperation] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Fetch usage records
  const usageData = useQuery(api.costs.getUsageRecords, {
    workspaceId,
    projectId,
    timeRange,
    provider: filterProvider || undefined,
    operation: filterOperation || undefined,
    limit: 100, // Get more to handle client-side pagination
  });

  // Fetch provider list for filter
  const costsByProvider = useQuery(api.costs.getCostsByProvider, {
    timeRange,
    workspaceId,
  });

  // Format helpers
  const formatCost = (cost: number): string => {
    if (cost >= 1) return `$${cost.toFixed(4)}`;
    if (cost >= 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(6)}`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toLocaleString();
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatOperation = (operation: string): string => {
    return operation
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get unique operations for filter
  const uniqueOperations = useMemo(() => {
    if (!usageData?.records) return [];
    const ops = new Set(usageData.records.map(r => r.operation));
    return Array.from(ops).sort();
  }, [usageData]);

  // Sort and filter records
  const sortedRecords = useMemo(() => {
    if (!usageData?.records) return [];

    let records = [...usageData.records];

    // Sort
    records.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'cost':
          comparison = a.cost - b.cost;
          break;
        case 'totalTokens':
          comparison = a.totalTokens - b.totalTokens;
          break;
        case 'provider':
          comparison = a.provider.localeCompare(b.provider);
          break;
        case 'operation':
          comparison = a.operation.localeCompare(b.operation);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return records;
  }, [usageData, sortField, sortOrder]);

  // Paginate
  const paginatedRecords = useMemo(() => {
    const start = page * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, page]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(0);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!sortedRecords.length) return;

    const headers = ['Date', 'Provider', 'Model', 'Operation', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost'];
    const rows = sortedRecords.map(r => [
      new Date(r.timestamp).toISOString(),
      r.provider,
      r.model,
      r.operation,
      r.inputTokens.toString(),
      r.outputTokens.toString(),
      r.totalTokens.toString(),
      r.cost.toFixed(6),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-log-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sort indicator
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <Icons.ArrowDownUp className="w-3 h-3 text-secondary" />;
    }
    return sortOrder === 'asc'
      ? <Icons.ChevronUp className="w-3 h-3 text-emerald-500" />
      : <Icons.ChevronDown className="w-3 h-3 text-emerald-500" />;
  };

  const isLoading = !usageData;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Provider Filter */}
          <div className="relative">
            <select
              value={filterProvider}
              onChange={(e) => {
                setFilterProvider(e.target.value);
                setPage(0);
              }}
              className="appearance-none pl-8 pr-8 py-2 bg-background border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">All Providers</option>
              {costsByProvider?.providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.provider.charAt(0).toUpperCase() + p.provider.slice(1)}
                </option>
              ))}
            </select>
            <Icons.Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          </div>

          {/* Operation Filter */}
          <div className="relative">
            <select
              value={filterOperation}
              onChange={(e) => {
                setFilterOperation(e.target.value);
                setPage(0);
              }}
              className="appearance-none pl-8 pr-8 py-2 bg-background border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">All Operations</option>
              {uniqueOperations.map((op) => (
                <option key={op} value={op}>
                  {formatOperation(op)}
                </option>
              ))}
            </select>
            <Icons.Cpu className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportCSV}
          disabled={!sortedRecords.length}
          className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <Icons.Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Icons.Loader className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Icons.Receipt className="w-12 h-12 text-secondary mb-3" />
            <h3 className="text-base font-bold text-main mb-1">No Usage Data</h3>
            <p className="text-sm text-secondary">
              {filterProvider || filterOperation
                ? 'No records match your filters'
                : 'No AI usage recorded in this time period'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50">
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('timestamp')}
                        className="flex items-center gap-1 text-xs font-bold text-secondary uppercase tracking-wider hover:text-main transition-colors"
                      >
                        Date
                        <SortIcon field="timestamp" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('provider')}
                        className="flex items-center gap-1 text-xs font-bold text-secondary uppercase tracking-wider hover:text-main transition-colors"
                      >
                        Provider
                        <SortIcon field="provider" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                        Model
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('operation')}
                        className="flex items-center gap-1 text-xs font-bold text-secondary uppercase tracking-wider hover:text-main transition-colors"
                      >
                        Operation
                        <SortIcon field="operation" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('totalTokens')}
                        className="flex items-center gap-1 text-xs font-bold text-secondary uppercase tracking-wider hover:text-main transition-colors ml-auto"
                      >
                        Tokens
                        <SortIcon field="totalTokens" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('cost')}
                        className="flex items-center gap-1 text-xs font-bold text-secondary uppercase tracking-wider hover:text-main transition-colors ml-auto"
                      >
                        Cost
                        <SortIcon field="cost" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr
                      key={record._id}
                      className="border-b border-border last:border-0 hover:bg-surface-hover/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm text-main">
                          {formatTimestamp(record.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            record.provider === 'openai' ? 'bg-emerald-500' :
                            record.provider === 'anthropic' || record.provider === 'claude' ? 'bg-amber-500' :
                            'bg-blue-500'
                          }`} />
                          <span className="text-sm text-main capitalize">
                            {record.provider}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-secondary truncate max-w-32 block">
                          {record.model}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-main">
                          {formatOperation(record.operation)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-main">
                            {formatTokens(record.totalTokens)}
                          </span>
                          <span className="text-[10px] text-secondary">
                            {formatTokens(record.inputTokens)} in / {formatTokens(record.outputTokens)} out
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCost(record.cost)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-secondary">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sortedRecords.length)} of {sortedRecords.length} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded border border-border text-secondary hover:text-main hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icons.ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-main">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded border border-border text-secondary hover:text-main hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icons.ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary Footer */}
      {sortedRecords.length > 0 && (
        <div className="flex items-center justify-between text-xs text-secondary bg-surface-hover/30 px-4 py-2 rounded-lg">
          <span>
            Total: {formatTokens(sortedRecords.reduce((sum, r) => sum + r.totalTokens, 0))} tokens
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            Total Cost: {formatCost(sortedRecords.reduce((sum, r) => sum + r.cost, 0))}
          </span>
        </div>
      )}
    </div>
  );
};

export default UsageTable;

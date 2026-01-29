import React from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';

interface EmbeddingStatsProps {
  className?: string;
  compact?: boolean;
}

const EmbeddingStats: React.FC<EmbeddingStatsProps> = ({
  className = '',
  compact = false,
}) => {
  const stats = useQuery(api.vectorSearch.getEmbeddingStats);
  const regenerateAll = useAction(api.embeddings.regenerateAllEmbeddings);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const handleRegenerate = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateAll();
      console.log('Regeneration queued:', result);
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!stats) {
    return (
      <div className={`${className} flex items-center gap-2 text-secondary text-xs`}>
        <div className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        Loading stats...
      </div>
    );
  }

  const percentIndexed = stats.totalDocuments > 0
    ? Math.round((stats.indexed / stats.totalDocuments) * 100)
    : 0;

  if (compact) {
    return (
      <div className={`${className} flex items-center gap-3 text-xs`}>
        <div className="flex items-center gap-1.5">
          <Icons.Database className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-main font-medium">{stats.indexed}</span>
          <span className="text-secondary">indexed</span>
        </div>
        {stats.queued > 0 && (
          <div className="flex items-center gap-1.5 text-amber-500">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            <span>{stats.queued} pending</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} bg-surface border border-border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icons.Database className="w-4 h-4 text-purple-500" />
          <h3 className="font-medium text-sm text-main">Semantic Search Index</h3>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] text-secondary hover:text-main hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <Icons.RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? 'Queuing...' : 'Re-index All'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-secondary">Index Progress</span>
          <span className="text-main font-medium">{percentIndexed}%</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
            style={{ width: `${percentIndexed}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Icons.CheckCircle className="w-4 h-4 text-green-500" />}
          label="Indexed"
          value={stats.indexed}
          subtext={`${stats.totalChunks} chunks`}
        />
        <StatCard
          icon={<Icons.Clock className="w-4 h-4 text-amber-500" />}
          label="Pending"
          value={stats.pending + stats.queued}
          subtext="in queue"
          highlight={stats.pending + stats.queued > 0}
        />
        <StatCard
          icon={<Icons.AlertTriangle className="w-4 h-4 text-red-500" />}
          label="Failed"
          value={stats.failed}
          subtext="errors"
          highlight={stats.failed > 0}
        />
        <StatCard
          icon={<Icons.FileText className="w-4 h-4 text-secondary" />}
          label="Total"
          value={stats.totalDocuments}
          subtext="documents"
        />
      </div>

      {/* Status message */}
      {stats.queued > 0 && (
        <div className="mt-4 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            <span>
              {stats.queued} document{stats.queued !== 1 ? 's' : ''} waiting to be indexed...
            </span>
          </div>
        </div>
      )}

      {stats.failed > 0 && (
        <div className="mt-4 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-red-600">
            <Icons.AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {stats.failed} document{stats.failed !== 1 ? 's' : ''} failed to index.
              Try re-indexing to retry.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, highlight }) => (
  <div className={`p-2 rounded-lg ${highlight ? 'bg-surface-hover/50' : 'bg-background'}`}>
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-[10px] text-secondary uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold text-main">{value}</span>
      <span className="text-[10px] text-secondary">{subtext}</span>
    </div>
  </div>
);

export default EmbeddingStats;

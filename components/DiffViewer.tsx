import React, { useState, useMemo } from 'react';
import { Icons } from './Icon';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
  onClose: () => void;
}

// Simple diff algorithm using longest common subsequence
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Build LCS matrix
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const diff: DiffLine[] = [];
  let i = m;
  let j = n;
  let oldLineNum = m;
  let newLineNum = n;

  const tempDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempDiff.unshift({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      i--;
      j--;
      oldLineNum--;
      newLineNum--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempDiff.unshift({
        type: 'added',
        content: newLines[j - 1],
        newLineNumber: newLineNum,
      });
      j--;
      newLineNum--;
    } else if (i > 0) {
      tempDiff.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
      });
      i--;
      oldLineNum--;
    }
  }

  return tempDiff;
}

// Compute diff statistics
function computeStats(diff: DiffLine[]): { added: number; removed: number; unchanged: number } {
  return diff.reduce(
    (acc, line) => {
      if (line.type === 'added') acc.added++;
      else if (line.type === 'removed') acc.removed++;
      else if (line.type === 'unchanged') acc.unchanged++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  oldContent,
  newContent,
  oldLabel = 'Previous Version',
  newLabel = 'Current Version',
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [showUnchanged, setShowUnchanged] = useState(true);

  const diff = useMemo(
    () => computeDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const stats = useMemo(() => computeStats(diff), [diff]);

  const filteredDiff = useMemo(() => {
    if (showUnchanged) return diff;

    // Group changes with context (3 lines before/after)
    const contextLines = 3;
    const result: DiffLine[] = [];
    const changeIndices = new Set<number>();

    diff.forEach((line, i) => {
      if (line.type !== 'unchanged') {
        for (let j = Math.max(0, i - contextLines); j <= Math.min(diff.length - 1, i + contextLines); j++) {
          changeIndices.add(j);
        }
      }
    });

    let lastIncluded = -1;
    diff.forEach((line, i) => {
      if (changeIndices.has(i)) {
        if (lastIncluded !== -1 && i - lastIncluded > 1) {
          result.push({
            type: 'header',
            content: `... ${i - lastIncluded - 1} unchanged lines ...`,
          });
        }
        result.push(line);
        lastIncluded = i;
      }
    });

    return result;
  }, [diff, showUnchanged]);

  const renderUnifiedView = () => (
    <div className="font-mono text-xs overflow-x-auto">
      {filteredDiff.map((line, i) => (
        <div
          key={i}
          className={`flex ${
            line.type === 'added'
              ? 'bg-green-500/10'
              : line.type === 'removed'
              ? 'bg-red-500/10'
              : line.type === 'header'
              ? 'bg-blue-500/5 text-blue-400 italic justify-center py-1'
              : 'bg-transparent'
          }`}
        >
          {line.type !== 'header' && (
            <>
              <div className="w-12 text-right pr-2 text-secondary/50 select-none shrink-0 border-r border-border">
                {line.oldLineNumber || ''}
              </div>
              <div className="w-12 text-right pr-2 text-secondary/50 select-none shrink-0 border-r border-border">
                {line.newLineNumber || ''}
              </div>
              <div className="w-6 text-center select-none shrink-0">
                {line.type === 'added' && (
                  <span className="text-green-500">+</span>
                )}
                {line.type === 'removed' && (
                  <span className="text-red-500">-</span>
                )}
              </div>
            </>
          )}
          <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
            {line.content}
          </pre>
        </div>
      ))}
    </div>
  );

  const renderSplitView = () => {
    // Pair up removed and added lines for side-by-side view
    const oldLines: (DiffLine | null)[] = [];
    const newLines: (DiffLine | null)[] = [];

    let i = 0;
    while (i < filteredDiff.length) {
      const line = filteredDiff[i];

      if (line.type === 'unchanged' || line.type === 'header') {
        oldLines.push(line);
        newLines.push(line);
        i++;
      } else if (line.type === 'removed') {
        // Look ahead for corresponding added line
        let j = i + 1;
        while (j < filteredDiff.length && filteredDiff[j].type === 'removed') {
          j++;
        }
        // Pair removed with added
        let removedCount = j - i;
        let addedCount = 0;
        let k = j;
        while (k < filteredDiff.length && filteredDiff[k].type === 'added') {
          k++;
          addedCount++;
        }

        // Add paired lines
        const maxPairs = Math.max(removedCount, addedCount);
        for (let p = 0; p < maxPairs; p++) {
          oldLines.push(p < removedCount ? filteredDiff[i + p] : null);
          newLines.push(p < addedCount ? filteredDiff[j + p] : null);
        }

        i = k;
      } else if (line.type === 'added') {
        oldLines.push(null);
        newLines.push(line);
        i++;
      }
    }

    return (
      <div className="flex font-mono text-xs">
        {/* Old version */}
        <div className="flex-1 border-r border-border overflow-x-auto">
          <div className="sticky top-0 bg-surface-hover px-3 py-2 text-secondary text-[10px] uppercase tracking-widest border-b border-border">
            {oldLabel}
          </div>
          {oldLines.map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line?.type === 'removed'
                  ? 'bg-red-500/10'
                  : line?.type === 'header'
                  ? 'bg-blue-500/5 text-blue-400 italic justify-center py-1'
                  : !line
                  ? 'bg-secondary/5'
                  : ''
              }`}
            >
              {line?.type !== 'header' && (
                <div className="w-10 text-right pr-2 text-secondary/50 select-none shrink-0 border-r border-border">
                  {line?.oldLineNumber || ''}
                </div>
              )}
              <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5 min-h-[1.5em]">
                {line?.content ?? ''}
              </pre>
            </div>
          ))}
        </div>

        {/* New version */}
        <div className="flex-1 overflow-x-auto">
          <div className="sticky top-0 bg-surface-hover px-3 py-2 text-secondary text-[10px] uppercase tracking-widest border-b border-border">
            {newLabel}
          </div>
          {newLines.map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line?.type === 'added'
                  ? 'bg-green-500/10'
                  : line?.type === 'header'
                  ? 'bg-blue-500/5 text-blue-400 italic justify-center py-1'
                  : !line
                  ? 'bg-secondary/5'
                  : ''
              }`}
            >
              {line?.type !== 'header' && (
                <div className="w-10 text-right pr-2 text-secondary/50 select-none shrink-0 border-r border-border">
                  {line?.newLineNumber || ''}
                </div>
              )}
              <pre className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5 min-h-[1.5em]">
                {line?.content ?? ''}
              </pre>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icons.History className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-main">Version Diff</h2>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-500">
                <span className="font-bold">+{stats.added}</span> added
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <span className="font-bold">-{stats.removed}</span> removed
              </span>
              <span className="flex items-center gap-1 text-secondary">
                <span className="font-bold">{stats.unchanged}</span> unchanged
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-primary text-white'
                    : 'text-secondary hover:text-main'
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewMode === 'split'
                    ? 'bg-primary text-white'
                    : 'text-secondary hover:text-main'
                }`}
              >
                Split
              </button>
            </div>

            {/* Show unchanged toggle */}
            <button
              onClick={() => setShowUnchanged(!showUnchanged)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                showUnchanged
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-secondary hover:text-main'
              }`}
            >
              {showUnchanged ? (
                <Icons.CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-current" />
              )}
              Show All
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5 text-secondary hover:text-main" />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto bg-background">
          {viewMode === 'unified' ? renderUnifiedView() : renderSplitView()}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center justify-between text-[10px] text-secondary">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500/20 rounded" /> Added
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500/20 rounded" /> Removed
            </span>
          </div>
          <span>{filteredDiff.length} lines shown</span>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;

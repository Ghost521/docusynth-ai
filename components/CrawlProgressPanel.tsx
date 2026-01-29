import React, { useState } from 'react';
import { Icons } from './Icon';
import { Id } from '../convex/_generated/dataModel';
import {
  formatDuration,
  formatNumber,
  formatRelativeTime,
  getStatusColor,
  getStatusBgColor,
  getStatusLabel,
  canPauseJob,
  canResumeJob,
  canCancelJob,
  CrawlJobStatus,
} from '../services/contentExtractor';

interface CrawlJob {
  _id: Id<'crawlJobs'>;
  name: string;
  startUrl: string;
  status: CrawlJobStatus;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesSuccessful: number;
  pagesFailed: number;
  pagesSkipped: number;
  totalWords: number;
  totalLinks: number;
  maxPages: number;
  startedAt?: number;
  lastActivityAt?: number;
  lastError?: string;
  errorCount: number;
}

interface CrawlJobStatus {
  status: CrawlJobStatus;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesSuccessful: number;
  pagesFailed: number;
  pagesSkipped: number;
  queuePending: number;
  queueProcessing: number;
  totalWords: number;
  totalLinks: number;
  speed: number;
  lastError?: string;
  errorCount: number;
  startedAt?: number;
  lastActivityAt?: number;
}

interface QueueItem {
  _id: Id<'crawlQueue'>;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  depth: number;
  priority: number;
  errorMessage?: string;
  skipReason?: string;
}

interface CrawlProgressPanelProps {
  job: CrawlJob;
  jobStatus?: CrawlJobStatus;
  queueItems?: QueueItem[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onGenerateDoc: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

const CrawlProgressPanel: React.FC<CrawlProgressPanelProps> = ({
  job,
  jobStatus,
  queueItems = [],
  onPause,
  onResume,
  onCancel,
  onGenerateDoc,
  onClose,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'queue' | 'errors'>('progress');
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Use jobStatus if available, otherwise fall back to job data
  const status = jobStatus || {
    status: job.status,
    pagesDiscovered: job.pagesDiscovered,
    pagesCrawled: job.pagesCrawled,
    pagesSuccessful: job.pagesSuccessful,
    pagesFailed: job.pagesFailed,
    pagesSkipped: job.pagesSkipped,
    queuePending: 0,
    queueProcessing: 0,
    totalWords: job.totalWords,
    totalLinks: job.totalLinks,
    speed: 0,
    lastError: job.lastError,
    errorCount: job.errorCount,
    startedAt: job.startedAt,
    lastActivityAt: job.lastActivityAt,
  };

  const progress = Math.round((status.pagesCrawled / job.maxPages) * 100) || 0;
  const isRunning = job.status === 'running' || job.status === 'queued';
  const isCompleted = job.status === 'completed';
  const isPaused = job.status === 'paused';

  // Filter queue items by status
  const pendingItems = queueItems.filter((item) => item.status === 'pending');
  const processingItems = queueItems.filter((item) => item.status === 'processing');
  const failedItems = queueItems.filter((item) => item.status === 'failed');
  const skippedItems = queueItems.filter((item) => item.status === 'skipped');

  // Calculate elapsed time
  const elapsedMs = status.startedAt
    ? (status.lastActivityAt || Date.now()) - status.startedAt
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface/50 backdrop-blur-sm p-4 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        <div className="bg-surface border border-border rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border bg-surface">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${getStatusBgColor(job.status)}`}>
                  <Icons.Spider className={`w-6 h-6 ${getStatusColor(job.status)} ${isRunning ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-main">{job.name}</h2>
                  <p className="text-sm text-secondary font-mono truncate max-w-md">{job.startUrl}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${getStatusBgColor(job.status)} ${getStatusColor(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                    {isRunning && status.speed > 0 && (
                      <span className="text-xs text-secondary flex items-center gap-1">
                        <Icons.Activity className="w-3 h-3" />
                        {status.speed} pages/min
                      </span>
                    )}
                    {status.startedAt && (
                      <span className="text-xs text-secondary flex items-center gap-1">
                        <Icons.Clock className="w-3 h-3" />
                        {formatDuration(elapsedMs)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Control Buttons */}
                {canPauseJob(job.status) && (
                  <button
                    onClick={onPause}
                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-secondary hover:text-main"
                    title="Pause"
                  >
                    <Icons.Pause className="w-5 h-5" />
                  </button>
                )}
                {canResumeJob(job.status) && (
                  <button
                    onClick={onResume}
                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-secondary hover:text-primary"
                    title="Resume"
                  >
                    <Icons.Play className="w-5 h-5" />
                  </button>
                )}
                {canCancelJob(job.status) && (
                  <button
                    onClick={onCancel}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-secondary hover:text-red-500"
                    title="Cancel"
                  >
                    <Icons.StopCircle className="w-5 h-5" />
                  </button>
                )}
                <div className="w-px h-6 bg-border mx-1" />
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover hover:bg-primary/10 text-secondary hover:text-primary rounded-lg text-sm font-bold transition-colors"
                >
                  <Icons.ChevronDown className="w-4 h-4" />
                  Minimize
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 bg-surface-hover/30 border-b border-border">
            <div className="flex justify-between text-xs font-medium mb-2 text-secondary">
              <span>Progress</span>
              <span>
                {status.pagesCrawled} / {job.maxPages} pages ({progress}%)
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  job.status === 'failed' ? 'bg-red-500' :
                  job.status === 'paused' ? 'bg-orange-500' :
                  job.status === 'completed' ? 'bg-green-500' :
                  'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-5 gap-4 mt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-main">{formatNumber(status.pagesSuccessful)}</p>
                <p className="text-[10px] text-green-500 uppercase tracking-wider">Successful</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-main">{formatNumber(status.pagesFailed)}</p>
                <p className="text-[10px] text-red-500 uppercase tracking-wider">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-main">{formatNumber(status.pagesSkipped)}</p>
                <p className="text-[10px] text-secondary uppercase tracking-wider">Skipped</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-main">{formatNumber(status.totalWords)}</p>
                <p className="text-[10px] text-secondary uppercase tracking-wider">Words</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-main">{formatNumber(status.totalLinks)}</p>
                <p className="text-[10px] text-secondary uppercase tracking-wider">Links</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: 'progress', label: 'Live Feed', icon: Icons.Activity },
              { id: 'queue', label: `Queue (${status.queuePending})`, icon: Icons.ListTree },
              { id: 'errors', label: `Errors (${status.errorCount})`, icon: Icons.AlertTriangle },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-secondary hover:text-main hover:bg-surface-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-background/50">
            {activeTab === 'progress' && (
              <div className="space-y-3 animate-fadeIn">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Icons.Loader className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : processingItems.length === 0 && !isRunning ? (
                  <div className="flex flex-col items-center justify-center py-8 text-secondary">
                    {isCompleted ? (
                      <>
                        <Icons.CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                        <p className="text-main font-medium">Crawl Complete</p>
                        <p className="text-sm">{status.pagesSuccessful} pages crawled successfully</p>
                      </>
                    ) : isPaused ? (
                      <>
                        <Icons.Pause className="w-12 h-12 text-orange-500 mb-3" />
                        <p className="text-main font-medium">Crawl Paused</p>
                        <p className="text-sm">Click Resume to continue</p>
                      </>
                    ) : (
                      <>
                        <Icons.Spider className="w-12 h-12 text-secondary/50 mb-3" />
                        <p className="text-sm">Waiting to start...</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Currently Processing */}
                    {processingItems.map((item) => (
                      <div
                        key={item._id}
                        className="p-4 rounded-lg border border-primary/30 bg-primary/5 animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                          <span className="text-sm font-medium text-main">Processing</span>
                        </div>
                        <p className="text-xs font-mono text-secondary truncate mt-2">{item.url}</p>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-secondary">
                          <span>Depth: {item.depth}</span>
                          <span>Priority: {item.priority}</span>
                        </div>
                      </div>
                    ))}

                    {/* Recent Activity */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-secondary uppercase tracking-widest px-1">
                        Queue Preview
                      </p>
                      {pendingItems.slice(0, 5).map((item) => (
                        <div
                          key={item._id}
                          className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-secondary/50" />
                            <span className="text-xs font-mono text-secondary truncate">
                              {item.url}
                            </span>
                          </div>
                          <span className="text-[10px] text-secondary shrink-0 ml-2">
                            P:{item.priority}
                          </span>
                        </div>
                      ))}
                      {pendingItems.length > 5 && (
                        <p className="text-xs text-secondary text-center py-2">
                          +{pendingItems.length - 5} more in queue
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="space-y-2 animate-fadeIn">
                {pendingItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-secondary">
                    <Icons.CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm">Queue is empty</p>
                  </div>
                ) : (
                  pendingItems.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-secondary/50" />
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-secondary truncate">{item.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-secondary">D:{item.depth}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          P:{item.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="space-y-3 animate-fadeIn">
                {status.lastError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icons.AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-500">Latest Error</p>
                        <p className="text-xs text-secondary mt-1">{status.lastError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {failedItems.length === 0 && skippedItems.length === 0 && !status.lastError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-secondary">
                    <Icons.CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm">No errors so far</p>
                  </div>
                ) : (
                  <>
                    {/* Failed Items */}
                    {failedItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest px-1">
                          Failed ({failedItems.length})
                        </p>
                        {failedItems.slice(0, 10).map((item) => (
                          <div
                            key={item._id}
                            className="p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                          >
                            <p className="text-xs font-mono text-secondary truncate">{item.url}</p>
                            {item.errorMessage && (
                              <p className="text-[10px] text-red-400 mt-1">{item.errorMessage}</p>
                            )}
                          </div>
                        ))}
                        {failedItems.length > 10 && (
                          <button
                            onClick={() => setShowErrorDetails(!showErrorDetails)}
                            className="text-xs text-primary hover:text-primary-hover font-medium"
                          >
                            {showErrorDetails ? 'Show less' : `Show all ${failedItems.length} errors`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Skipped Items */}
                    {skippedItems.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-xs font-bold text-secondary uppercase tracking-widest px-1">
                          Skipped ({skippedItems.length})
                        </p>
                        {skippedItems.slice(0, 5).map((item) => (
                          <div
                            key={item._id}
                            className="p-3 rounded-lg border border-border bg-surface"
                          >
                            <p className="text-xs font-mono text-secondary truncate">{item.url}</p>
                            {item.skipReason && (
                              <p className="text-[10px] text-secondary/60 mt-1">{item.skipReason}</p>
                            )}
                          </div>
                        ))}
                        {skippedItems.length > 5 && (
                          <p className="text-xs text-secondary text-center">
                            +{skippedItems.length - 5} more skipped
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {isCompleted && status.pagesSuccessful > 0 && (
            <div className="p-4 border-t border-border bg-surface-hover/30 flex justify-end">
              <button
                onClick={onGenerateDoc}
                className="px-6 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Icons.FileText className="w-4 h-4" />
                Generate Documentation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrawlProgressPanel;

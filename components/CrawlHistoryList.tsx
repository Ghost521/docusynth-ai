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
  canStartJob,
  isTerminalStatus,
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
  maxDepth: number;
  domainRestriction: 'same' | 'subdomains' | 'any';
  scheduleEnabled: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  errorCount: number;
}

interface CrawlRunHistory {
  _id: Id<'crawlRunHistory'>;
  runNumber: number;
  pagesSuccessful: number;
  pagesFailed: number;
  pagesChanged: number;
  pagesNew: number;
  totalWords: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

interface CrawlHistoryListProps {
  jobs: CrawlJob[];
  onSelectJob: (jobId: Id<'crawlJobs'>) => void;
  onStartJob: (jobId: Id<'crawlJobs'>) => void;
  onDeleteJob: (jobId: Id<'crawlJobs'>) => void;
  onEditJob: (jobId: Id<'crawlJobs'>) => void;
  onCreateJob: () => void;
  selectedJobId?: Id<'crawlJobs'>;
  isLoading?: boolean;
}

const CrawlHistoryList: React.FC<CrawlHistoryListProps> = ({
  jobs,
  onSelectJob,
  onStartJob,
  onDeleteJob,
  onEditJob,
  onCreateJob,
  selectedJobId,
  isLoading,
}) => {
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'scheduled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<Id<'crawlJobs'> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Id<'crawlJobs'> | null>(null);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!job.name.toLowerCase().includes(query) && !job.startUrl.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    switch (filter) {
      case 'running':
        return job.status === 'running' || job.status === 'queued' || job.status === 'paused';
      case 'completed':
        return job.status === 'completed';
      case 'scheduled':
        return job.scheduleEnabled;
      default:
        return true;
    }
  });

  // Group jobs by status for summary
  const runningCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const scheduledCount = jobs.filter((j) => j.scheduleEnabled).length;

  const handleDeleteClick = (jobId: Id<'crawlJobs'>, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(jobId);
  };

  const handleConfirmDelete = (jobId: Id<'crawlJobs'>) => {
    onDeleteJob(jobId);
    setConfirmDelete(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border bg-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.Spider className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Web Crawler</h2>
              <p className="text-xs text-secondary">Advanced documentation crawling</p>
            </div>
          </div>
          <button
            onClick={onCreateJob}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            <Icons.Plus className="w-4 h-4" />
            New Crawl
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search crawl jobs..."
            className="w-full bg-surface-hover border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'all', label: 'All', count: jobs.length },
            { id: 'running', label: 'Running', count: runningCount },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'scheduled', label: 'Scheduled', count: scheduledCount },
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === id
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-secondary hover:text-main'
              }`}
            >
              {label}
              <span className={`ml-1.5 ${filter === id ? 'text-white/70' : 'text-secondary/50'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Icons.Loader className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-secondary">
            <Icons.Spider className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-main font-medium">No crawl jobs found</p>
            <p className="text-sm mt-1">
              {searchQuery ? 'Try a different search term' : 'Create your first crawl job to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateJob}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-colors"
              >
                <Icons.Plus className="w-4 h-4" />
                Create Crawl Job
              </button>
            )}
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job._id}
              onClick={() => onSelectJob(job._id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedJobId === job._id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:border-primary/50 hover:bg-surface-hover'
              }`}
            >
              {/* Job Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${getStatusBgColor(job.status)}`}>
                    <Icons.Globe className={`w-4 h-4 ${getStatusColor(job.status)}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-main truncate">{job.name}</h3>
                    <p className="text-xs font-mono text-secondary truncate">{job.startUrl}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {job.scheduleEnabled && (
                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-medium flex items-center gap-1">
                      <Icons.Repeat className="w-3 h-3" />
                      {job.scheduleFrequency}
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2 py-1 rounded ${getStatusBgColor(job.status)} ${getStatusColor(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>
                </div>
              </div>

              {/* Progress Bar (for running/completed jobs) */}
              {(job.status === 'running' || job.status === 'completed' || job.pagesCrawled > 0) && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-secondary mb-1">
                    <span>{job.pagesCrawled} / {job.maxPages} pages</span>
                    <span>{Math.round((job.pagesCrawled / job.maxPages) * 100)}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        job.status === 'completed' ? 'bg-green-500' :
                        job.status === 'failed' ? 'bg-red-500' :
                        'bg-primary'
                      }`}
                      style={{ width: `${(job.pagesCrawled / job.maxPages) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-secondary">
                <span className="flex items-center gap-1">
                  <Icons.FileText className="w-3 h-3" />
                  {formatNumber(job.pagesSuccessful)} pages
                </span>
                <span className="flex items-center gap-1">
                  <Icons.Hash className="w-3 h-3" />
                  {formatNumber(job.totalWords)} words
                </span>
                {job.errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Icons.AlertTriangle className="w-3 h-3" />
                    {job.errorCount} errors
                  </span>
                )}
                <span className="flex items-center gap-1 ml-auto">
                  <Icons.Clock className="w-3 h-3" />
                  {formatRelativeTime(job.createdAt)}
                </span>
              </div>

              {/* Expanded Details */}
              {expandedJobId === job._id && (
                <div className="mt-4 pt-4 border-t border-border animate-fadeIn">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-secondary">Domain Restriction</p>
                      <p className="text-main font-medium capitalize">{job.domainRestriction}</p>
                    </div>
                    <div>
                      <p className="text-secondary">Max Depth</p>
                      <p className="text-main font-medium">{job.maxDepth} levels</p>
                    </div>
                    <div>
                      <p className="text-secondary">Total Links</p>
                      <p className="text-main font-medium">{formatNumber(job.totalLinks)}</p>
                    </div>
                  </div>

                  {job.completedAt && job.startedAt && (
                    <div className="mt-3 p-2 bg-surface-hover rounded-lg">
                      <p className="text-[10px] text-secondary">
                        Completed in {formatDuration(job.completedAt - job.startedAt)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedJobId(expandedJobId === job._id ? null : job._id);
                  }}
                  className="text-xs text-secondary hover:text-main transition-colors flex items-center gap-1"
                >
                  {expandedJobId === job._id ? (
                    <>
                      <Icons.ChevronUp className="w-3 h-3" />
                      Less Details
                    </>
                  ) : (
                    <>
                      <Icons.ChevronDown className="w-3 h-3" />
                      More Details
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  {canStartJob(job.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartJob(job._id);
                      }}
                      className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors text-secondary hover:text-primary"
                      title="Start Crawl"
                    >
                      <Icons.Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditJob(job._id);
                    }}
                    className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors text-secondary hover:text-main"
                    title="Edit"
                  >
                    <Icons.Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(job._id, e)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-secondary hover:text-red-500"
                    title="Delete"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {confirmDelete === job._id && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fadeIn">
                  <p className="text-xs text-red-500 font-medium">Delete this crawl job and all its data?</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmDelete(job._id);
                      }}
                      className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(null);
                      }}
                      className="px-3 py-1 bg-surface-hover text-secondary text-xs font-bold rounded-lg hover:text-main transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Footer */}
      {jobs.length > 0 && (
        <div className="p-4 border-t border-border bg-surface-hover/30">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>{jobs.length} crawl job{jobs.length !== 1 ? 's' : ''}</span>
            <span>
              {formatNumber(jobs.reduce((sum, j) => sum + j.pagesSuccessful, 0))} total pages crawled
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawlHistoryList;

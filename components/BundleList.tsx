import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { BundleFormat, BundleStatus } from '../types';

interface BundleListProps {
  collectionId?: Id<"collections">;
  onGenerateNew?: () => void;
}

const FORMAT_ICONS: Record<BundleFormat, string> = {
  zip: 'FileArchive',
  pdf: 'FilePdf',
  markdown: 'FileText',
};

const STATUS_STYLES: Record<BundleStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', label: 'Pending' },
  processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', label: 'Processing' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', label: 'Completed' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'Failed' },
};

const BundleList: React.FC<BundleListProps> = ({
  collectionId,
  onGenerateNew,
}) => {
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [shareSettings, setShareSettings] = useState({
    expiresInDays: 7,
    maxDownloads: 0,
    password: '',
  });
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  const bundles = useQuery(api.bundles.list, collectionId ? { collectionId } : {});
  const deleteBundle = useMutation(api.bundles.remove);
  const createShareLink = useMutation(api.bundles.createShareLink);
  const revokeShareLink = useMutation(api.bundles.revokeShareLink);

  const handleDelete = async (bundleId: Id<"bundles">) => {
    if (confirm('Delete this bundle? This cannot be undone.')) {
      await deleteBundle({ id: bundleId });
    }
  };

  const handleCreateShareLink = async (bundleId: Id<"bundles">) => {
    try {
      const result = await createShareLink({
        bundleId,
        expiresInDays: shareSettings.expiresInDays > 0 ? shareSettings.expiresInDays : undefined,
        maxDownloads: shareSettings.maxDownloads > 0 ? shareSettings.maxDownloads : undefined,
        password: shareSettings.password || undefined,
      });

      const shareUrl = `${window.location.origin}/share/${result.token}`;
      setCreatedShareLink(shareUrl);
    } catch (error) {
      console.error('Failed to create share link:', error);
    }
  };

  const handleRevokeShareLink = async (shareId: Id<"bundleShares">) => {
    if (confirm('Revoke this share link? It will no longer work.')) {
      await revokeShareLink({ shareId });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderIcon = (iconName: string, className: string = 'w-4 h-4') => {
    const IconComponent = (Icons as Record<string, React.FC<{ className?: string }>>)[iconName];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  if (bundles === undefined) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-20 bg-surface-hover rounded-xl" />
        <div className="h-20 bg-surface-hover rounded-xl" />
        <div className="h-20 bg-surface-hover rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
          <Icons.Package className="w-4 h-4" />
          Generated Bundles
        </h3>
        {onGenerateNew && (
          <button
            onClick={onGenerateNew}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm"
          >
            <Icons.Plus className="w-4 h-4" />
            New Bundle
          </button>
        )}
      </div>

      {/* Bundle List */}
      {bundles.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <Icons.Package className="w-12 h-12 mx-auto text-secondary/30 mb-4" />
          <p className="text-secondary mb-4">No bundles generated yet</p>
          {onGenerateNew && (
            <button
              onClick={onGenerateNew}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Generate First Bundle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => {
            const status = STATUS_STYLES[bundle.status];
            const isExpanded = expandedBundleId === bundle._id;

            return (
              <div
                key={bundle._id}
                className="border border-border rounded-xl overflow-hidden transition-all"
              >
                {/* Main Row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => setExpandedBundleId(isExpanded ? null : bundle._id)}
                >
                  {/* Format Icon */}
                  <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center text-primary">
                    {renderIcon(FORMAT_ICONS[bundle.format], 'w-5 h-5')}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-main">
                        {bundle.format.toUpperCase()} Bundle
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-secondary mt-1">
                      <span>{formatDate(bundle.createdAt)}</span>
                      <span>{formatFileSize(bundle.fileSize)}</span>
                      {bundle.totalDownloads && bundle.totalDownloads > 0 && (
                        <span className="flex items-center gap-1">
                          <Icons.Download className="w-3 h-3" />
                          {bundle.totalDownloads}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress (if processing) */}
                  {bundle.status === 'processing' && (
                    <div className="w-24">
                      <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${bundle.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-secondary">{bundle.progress}%</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {bundle.status === 'completed' && bundle.downloadUrl && (
                      <a
                        href={bundle.downloadUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Icons.Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShareModal(bundle._id);
                      }}
                      className="p-2 text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Share"
                    >
                      <Icons.Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bundle._id);
                      }}
                      className="p-2 text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                    <Icons.ChevronDown
                      className={`w-4 h-4 text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border bg-surface-hover/50">
                    <div className="pt-4 grid grid-cols-2 gap-4 text-sm">
                      {/* Options */}
                      <div>
                        <h4 className="font-medium text-main mb-2">Options</h4>
                        <ul className="space-y-1 text-secondary">
                          <li className="flex items-center gap-2">
                            {bundle.options.includeToc ? (
                              <Icons.CheckSquare className="w-4 h-4 text-green-500" />
                            ) : (
                              <Icons.Square className="w-4 h-4" />
                            )}
                            Table of Contents
                          </li>
                          <li className="flex items-center gap-2">
                            {bundle.options.includeMetadata ? (
                              <Icons.CheckSquare className="w-4 h-4 text-green-500" />
                            ) : (
                              <Icons.Square className="w-4 h-4" />
                            )}
                            Include Metadata
                          </li>
                          <li className="flex items-center gap-2">
                            {bundle.options.pageBreaks ? (
                              <Icons.CheckSquare className="w-4 h-4 text-green-500" />
                            ) : (
                              <Icons.Square className="w-4 h-4" />
                            )}
                            Page Breaks
                          </li>
                        </ul>
                      </div>

                      {/* Branding */}
                      {bundle.options.brandingTitle && (
                        <div>
                          <h4 className="font-medium text-main mb-2">Branding</h4>
                          <p className="text-secondary">{bundle.options.brandingTitle}</p>
                          {bundle.options.brandingColors && (
                            <div className="flex items-center gap-2 mt-2">
                              <div
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: bundle.options.brandingColors.primary }}
                                title="Primary"
                              />
                              <div
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: bundle.options.brandingColors.secondary }}
                                title="Secondary"
                              />
                              <div
                                className="w-6 h-6 rounded border border-border"
                                style={{ backgroundColor: bundle.options.brandingColors.background }}
                                title="Background"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error */}
                      {bundle.error && (
                        <div className="col-span-2">
                          <h4 className="font-medium text-red-500 mb-2">Error</h4>
                          <p className="text-red-400 text-sm">{bundle.error}</p>
                        </div>
                      )}

                      {/* Shares */}
                      {bundle.shareCount && bundle.shareCount > 0 && (
                        <div className="col-span-2">
                          <h4 className="font-medium text-main mb-2">Active Share Links</h4>
                          <p className="text-secondary">{bundle.shareCount} active link(s)</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-main">Create Share Link</h3>
              <button
                onClick={() => {
                  setShowShareModal(null);
                  setCreatedShareLink(null);
                  setShareSettings({ expiresInDays: 7, maxDownloads: 0, password: '' });
                }}
                className="p-2 rounded-lg hover:bg-surface-hover text-secondary"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {createdShareLink ? (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium mb-2">
                      Share link created!
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={createdShareLink}
                        readOnly
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(createdShareLink)}
                        className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                      >
                        <Icons.Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowShareModal(null);
                      setCreatedShareLink(null);
                      setShareSettings({ expiresInDays: 7, maxDownloads: 0, password: '' });
                    }}
                    className="w-full py-2.5 rounded-xl bg-surface-hover text-main hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Link Expiration
                    </label>
                    <select
                      value={shareSettings.expiresInDays}
                      onChange={(e) => setShareSettings(s => ({ ...s, expiresInDays: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main"
                    >
                      <option value={1}>1 day</option>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                      <option value={0}>Never expires</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Download Limit (optional)
                    </label>
                    <input
                      type="number"
                      value={shareSettings.maxDownloads || ''}
                      onChange={(e) => setShareSettings(s => ({ ...s, maxDownloads: Number(e.target.value) || 0 }))}
                      placeholder="Unlimited"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Password Protection (optional)
                    </label>
                    <input
                      type="password"
                      value={shareSettings.password}
                      onChange={(e) => setShareSettings(s => ({ ...s, password: e.target.value }))}
                      placeholder="Leave empty for no password"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50"
                    />
                  </div>

                  <button
                    onClick={() => handleCreateShareLink(showShareModal as Id<"bundles">)}
                    className="w-full py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.Share2 className="w-4 h-4" />
                    Create Share Link
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleList;

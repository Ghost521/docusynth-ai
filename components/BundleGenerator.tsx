import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Icons } from './Icon';
import { BundleFormat, BundleOptions, BundleBrandingColors } from '../types';
import {
  generateZipBundle,
  generateCombinedMarkdown,
  generatePdfHtml,
  downloadBlob,
  downloadText,
  BundleDocument,
  CollectionInfo,
} from '../services/bundleService';

interface BundleGeneratorProps {
  collectionId: Id<"collections">;
  onClose: () => void;
  onGenerated?: (bundleId: Id<"bundles">) => void;
}

const FORMAT_OPTIONS: { value: BundleFormat; label: string; icon: string; description: string }[] = [
  { value: 'zip', label: 'ZIP Archive', icon: 'FileArchive', description: 'All documents as separate files' },
  { value: 'pdf', label: 'PDF Document', icon: 'FilePdf', description: 'Single formatted PDF file' },
  { value: 'markdown', label: 'Combined Markdown', icon: 'FileText', description: 'Single markdown file' },
];

const DEFAULT_COLORS: BundleBrandingColors = {
  primary: '#6366f1',
  secondary: '#64748b',
  background: '#ffffff',
};

const BundleGenerator: React.FC<BundleGeneratorProps> = ({
  collectionId,
  onClose,
  onGenerated,
}) => {
  const [format, setFormat] = useState<BundleFormat>('zip');
  const [options, setOptions] = useState<BundleOptions>({
    includeToc: true,
    includeMetadata: true,
    pageBreaks: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedBundleId, setGeneratedBundleId] = useState<Id<"bundles"> | null>(null);

  const collection = useQuery(api.collections.get, { id: collectionId });
  const createBundle = useMutation(api.bundles.create);
  const updateBundleStatus = useMutation(api.bundles.updateStatus);

  const handleOptionsChange = (key: keyof BundleOptions, value: any) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (colorKey: keyof BundleBrandingColors, value: string) => {
    setOptions((prev) => ({
      ...prev,
      brandingColors: {
        ...DEFAULT_COLORS,
        ...prev.brandingColors,
        [colorKey]: value,
      },
    }));
  };

  const handleGenerate = async () => {
    if (!collection || !collection.documents) return;

    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      // Create bundle record
      const bundleId = await createBundle({
        collectionId,
        format,
        options,
      });

      setProgress(10);

      // Prepare documents
      const documents: BundleDocument[] = collection.documents.map((doc, index) => ({
        topic: doc.topic,
        content: doc.content,
        sources: doc.sources || [],
        createdAt: doc.createdAt,
        position: index,
      }));

      const collectionInfo: CollectionInfo = {
        name: collection.name,
        description: collection.description,
      };

      setProgress(30);

      let blob: Blob;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'zip':
          setProgress(50);
          blob = await generateZipBundle(collectionInfo, documents, options);
          filename = `${sanitizeFilename(collection.name)}.zip`;
          mimeType = 'application/zip';
          break;

        case 'markdown':
          setProgress(50);
          const markdown = generateCombinedMarkdown(collectionInfo, documents, options);
          blob = new Blob([markdown], { type: 'text/markdown' });
          filename = `${sanitizeFilename(collection.name)}.md`;
          mimeType = 'text/markdown';
          break;

        case 'pdf':
          setProgress(50);
          const html = generatePdfHtml(collectionInfo, documents, options);
          // For PDF, we generate HTML that can be printed/saved as PDF
          blob = new Blob([html], { type: 'text/html' });
          filename = `${sanitizeFilename(collection.name)}.html`;
          mimeType = 'text/html';
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      setProgress(80);

      // Update bundle status
      await updateBundleStatus({
        id: bundleId,
        status: 'completed',
        progress: 100,
        fileSize: blob.size,
      });

      setProgress(100);

      // Download the file
      downloadBlob(blob, filename);

      setGeneratedBundleId(bundleId);
      onGenerated?.(bundleId);

    } catch (err) {
      console.error('Bundle generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate bundle');
    } finally {
      setIsGenerating(false);
    }
  };

  const sanitizeFilename = (name: string): string => {
    return name
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50);
  };

  if (!collection) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface rounded-2xl p-8 animate-pulse">
          <div className="h-6 bg-surface-hover rounded w-48 mb-4" />
          <div className="h-32 bg-surface-hover rounded" />
        </div>
      </div>
    );
  }

  const documents = collection.documents || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: collection.color }}
            >
              <Icons.Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Generate Bundle</h2>
              <p className="text-sm text-secondary">{collection.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-secondary transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Document Preview */}
          <div>
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
              Documents to Include ({documents.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2 p-3 rounded-xl border border-border bg-surface-hover">
              {documents.map((doc, index) => (
                <div key={doc._id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-secondary">
                    {index + 1}
                  </span>
                  <span className="text-main truncate">{doc.topic}</span>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-secondary text-sm text-center py-4">
                  No documents in this collection
                </p>
              )}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
              Output Format
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const IconComponent = (Icons as Record<string, React.FC<{ className?: string }>>)[opt.icon];
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      format === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {IconComponent && <IconComponent className="w-5 h-5 text-primary" />}
                      <span className="font-medium text-main text-sm">{opt.label}</span>
                    </div>
                    <p className="text-xs text-secondary">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
              Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <Icons.ListOrdered className="w-5 h-5 text-secondary" />
                  <div>
                    <span className="font-medium text-main text-sm">Include Table of Contents</span>
                    <p className="text-xs text-secondary">Add navigation links at the start</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={options.includeToc}
                  onChange={(e) => handleOptionsChange('includeToc', e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <Icons.Info className="w-5 h-5 text-secondary" />
                  <div>
                    <span className="font-medium text-main text-sm">Include Metadata</span>
                    <p className="text-xs text-secondary">Show dates and source links</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={options.includeMetadata}
                  onChange={(e) => handleOptionsChange('includeMetadata', e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
              </label>

              {(format === 'pdf' || format === 'markdown') && (
                <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <Icons.FileText className="w-5 h-5 text-secondary" />
                    <div>
                      <span className="font-medium text-main text-sm">Page Breaks</span>
                      <p className="text-xs text-secondary">Start each document on a new page</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.pageBreaks}
                    onChange={(e) => handleOptionsChange('pageBreaks', e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Branding */}
          <div>
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
              Branding (Optional)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-main mb-2">
                  Custom Title
                </label>
                <input
                  type="text"
                  value={options.brandingTitle || ''}
                  onChange={(e) => handleOptionsChange('brandingTitle', e.target.value || undefined)}
                  placeholder={collection.name}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-hover text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              {format === 'pdf' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={options.brandingColors?.primary || DEFAULT_COLORS.primary}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={options.brandingColors?.primary || DEFAULT_COLORS.primary}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-hover text-main text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={options.brandingColors?.secondary || DEFAULT_COLORS.secondary}
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={options.brandingColors?.secondary || DEFAULT_COLORS.secondary}
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-hover text-main text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-main mb-2">
                      Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={options.brandingColors?.background || DEFAULT_COLORS.background}
                        onChange={(e) => handleColorChange('background', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={options.brandingColors?.background || DEFAULT_COLORS.background}
                        onChange={(e) => handleColorChange('background', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-hover text-main text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="px-6 pb-4">
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-secondary text-center mt-2">
              {progress < 30 && 'Preparing documents...'}
              {progress >= 30 && progress < 80 && 'Generating bundle...'}
              {progress >= 80 && 'Finalizing...'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between">
          <div className="text-sm text-secondary">
            {documents.length} document{documents.length !== 1 ? 's' : ''} will be bundled
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-border text-secondary hover:text-main hover:bg-surface-hover transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || documents.length === 0}
              className="px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Icons.Download className="w-4 h-4" />
                  Generate & Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleGenerator;

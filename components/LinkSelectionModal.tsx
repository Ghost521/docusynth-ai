
import React, { useState } from 'react';
import { DiscoveredLink } from '../types';
import { Icons } from './Icon';

interface LinkSelectionModalProps {
  links: DiscoveredLink[];
  onConfirm: (selectedLinks: DiscoveredLink[]) => void;
  onCancel: () => void;
  baseUrl: string;
  title?: string;
}

const LinkSelectionModal: React.FC<LinkSelectionModalProps> = ({ links, onConfirm, onCancel, baseUrl, title }) => {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set(links.map(l => l.url)));

  const toggleLink = (url: string) => {
    const newSet = new Set(selectedUrls);
    if (newSet.has(url)) {
      newSet.delete(url);
    } else {
      newSet.add(url);
    }
    setSelectedUrls(newSet);
  };

  const toggleAll = () => {
    if (selectedUrls.size === links.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(links.map(l => l.url)));
    }
  };

  const handleConfirm = () => {
    const selected = links.filter(l => selectedUrls.has(l.url));
    onConfirm(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl animate-scaleIn">
        
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-main flex items-center gap-2">
            <Icons.Globe className="w-5 h-5 text-primary" />
            {title || "Select Pages to Crawl"}
          </h2>
          <p className="text-sm text-secondary mt-1 truncate">
            Found {links.length} pages {title ? 'in import' : 'under'} <span className="font-mono text-xs bg-surface-hover px-1 py-0.5 rounded">{baseUrl || 'Bulk List'}</span>
          </p>
        </div>

        <div className="p-4 border-b border-border bg-surface-hover/50 flex justify-between items-center">
          <label className="flex items-center gap-2 text-sm text-main cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={selectedUrls.size === links.length && links.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-500 text-primary focus:ring-primary"
            />
            Select All
          </label>
          <span className="text-xs text-secondary">{selectedUrls.size} selected</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {links.length === 0 ? (
            <div className="text-center p-8 text-secondary">
              No links found. Try a different source.
            </div>
          ) : (
            <div className="space-y-1">
              {links.map((link) => (
                <label 
                  key={link.url} 
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border border-transparent ${
                    selectedUrls.has(link.url) 
                      ? 'bg-primary/10 border-primary/20' 
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedUrls.has(link.url)}
                    onChange={() => toggleLink(link.url)}
                    className="mt-1 w-4 h-4 rounded border-gray-500 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-main truncate">{link.title || "Untitled Page"}</div>
                    <div className="text-xs text-secondary truncate font-mono mt-0.5 opacity-80">{link.url}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-main hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selectedUrls.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icons.Cpu className="w-4 h-4" />
            Start Crawling ({selectedUrls.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkSelectionModal;

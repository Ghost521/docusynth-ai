
import React from 'react';
import { GeneratedDoc, DocVersion } from '../types';
import { Icons } from './Icon';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: GeneratedDoc;
  onRevert: (version: DocVersion) => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose, doc, onRevert }) => {
  if (!isOpen) return null;

  const versions = doc.versions || [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[80vh] overflow-hidden animate-scaleIn">
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Version History</h2>
              <p className="text-xs text-secondary mt-0.5">Timeline for "{doc.topic}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
          <div className="space-y-6 relative">
            {/* Vertical Line */}
            <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-border" />

            {/* Current Version Item */}
            <div className="relative pl-14 group">
              <div className="absolute left-4 top-1 w-4 h-4 rounded-full bg-primary ring-4 ring-primary/20 z-10" />
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">Active Version</span>
                  <span className="text-[10px] text-secondary font-mono">
                    {new Date(doc.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-secondary line-clamp-2 italic">
                  Currently displayed content. This is the latest synthesized knowledge.
                </p>
              </div>
            </div>

            {/* Historical Versions */}
            {versions.length === 0 ? (
              <div className="relative pl-14 py-4 text-secondary text-sm italic">
                No previous versions available for this document.
              </div>
            ) : (
              [...versions].reverse().map((version) => (
                <div key={version.id} className="relative pl-14 group">
                  <div className="absolute left-4 top-1 w-4 h-4 rounded-full bg-border group-hover:bg-secondary transition-colors z-10" />
                  <div className="p-4 rounded-xl bg-surface border border-border hover:border-secondary/30 transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-main">
                          {version.label || 'Historical Snapshot'}
                        </span>
                        {version.label?.includes('Edit') && <Icons.Edit className="w-3 h-3 text-secondary/70" />}
                        {version.label?.includes('Refresh') && <Icons.Refresh className="w-3 h-3 text-secondary/70" />}
                      </div>
                      <span className="text-[10px] text-secondary font-mono">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-secondary line-clamp-2 mb-4 opacity-70 font-mono bg-black/5 dark:bg-black/20 p-2 rounded">
                      {version.content.substring(0, 150).replace(/\n/g, ' ')}...
                    </p>
                    <button 
                      onClick={() => onRevert(version)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold transition-all border border-border hover:border-primary"
                    >
                      <Icons.Refresh className="w-3 h-3" />
                      Revert to this Version
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-surface hover:bg-surface-hover text-main rounded-lg text-sm font-bold border border-border transition-all"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default VersionHistoryModal;

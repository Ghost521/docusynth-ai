
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Icons } from './Icon';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  topic: string;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summary, topic }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[80vh] overflow-hidden animate-scaleIn">
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.AlignLeft className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Executive Summary</h2>
              <p className="text-xs text-secondary mt-0.5">Quick overview of "{topic}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-background custom-scrollbar">
           <div className="prose prose-sm max-w-none dark:prose-invert">
             <ReactMarkdown>{summary}</ReactMarkdown>
           </div>
        </div>

        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-end gap-2">
            <button 
                onClick={() => navigator.clipboard.writeText(summary)}
                className="px-4 py-2 bg-surface hover:bg-surface-hover text-main rounded-lg text-sm font-bold border border-border transition-all flex items-center gap-2"
            >
                <Icons.Copy className="w-4 h-4" />
                Copy
            </button>
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold shadow-lg transition-all"
            >
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};

export default SummaryModal;

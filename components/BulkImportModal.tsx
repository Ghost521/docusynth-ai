
import React, { useState, useRef } from 'react';
import { Icons } from './Icon';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (urls: string[]) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    // Extract URLs: split by newline, comma, semicolon, or space if strictly url list.
    const urls = text
      .split(/[\n,;]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
    
    if (urls.length > 0) {
      onImport(urls);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
        <header className="p-6 border-b border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icons.CloudUpload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Bulk Import</h2>
              <p className="text-xs text-secondary mt-0.5">Paste URLs or upload a list (CSV/TXT)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <div 
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-surface-hover/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Icons.CloudUpload className="w-8 h-8 text-secondary mb-2" />
              <p className="text-sm font-bold text-main">Click to upload or drag and drop</p>
              <p className="text-xs text-secondary">CSV or TXT files supported</p>
            </div>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-widest">Or Paste URLs</label>
              <button 
                onClick={() => setText('')} 
                className="text-[10px] text-secondary hover:text-red-500 font-medium"
              >
                Clear
              </button>
            </div>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`https://example.com/docs/page1\nhttps://example.com/docs/page2\n...`}
              className="w-full h-40 bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono text-main outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>
        </div>

        <footer className="p-4 bg-surface-hover/30 border-t border-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-surface hover:bg-surface-hover text-main rounded-xl text-sm font-bold border border-border transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-6 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Process Links
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BulkImportModal;

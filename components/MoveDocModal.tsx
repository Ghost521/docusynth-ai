
import React from 'react';
import { Project, GeneratedDoc } from '../types';
import { Icons } from './Icon';

interface MoveDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: GeneratedDoc;
  projects: Project[];
  onMove: (docId: string, projectId: string | undefined) => void;
}

const MoveDocModal: React.FC<MoveDocModalProps> = ({ isOpen, onClose, doc, projects, onMove }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scaleIn">
        <header className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2">
            <Icons.Folder className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-main">Move to Project</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-full transition-colors text-secondary">
            <Icons.X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
          <div className="mb-2 px-3 py-2 text-[10px] font-bold text-secondary uppercase tracking-widest">
            Select Destination
          </div>
          
          <button
            onClick={() => {
              onMove(doc.id, undefined);
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 ${
              !doc.projectId ? 'bg-primary/10 text-primary border border-primary/20 font-bold' : 'text-secondary hover:bg-surface-hover'
            }`}
          >
            <Icons.Globe className="w-4 h-4" />
            <span>None (General History)</span>
            {!doc.projectId && <Icons.Check className="ml-auto w-3.5 h-3.5" />}
          </button>

          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => {
                onMove(doc.id, project.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 ${
                doc.projectId === project.id ? 'bg-primary/10 text-primary border border-primary/20 font-bold' : 'text-secondary hover:bg-surface-hover'
              }`}
            >
              <Icons.Folder className="w-4 h-4" />
              <span className="truncate pr-4">{project.name}</span>
              {doc.projectId === project.id && <Icons.Check className="ml-auto w-3.5 h-3.5" />}
            </button>
          ))}
          
          {projects.length === 0 && (
            <div className="p-4 text-center text-xs text-secondary italic">
              No projects created yet.
            </div>
          )}
        </div>

        <div className="p-3 bg-surface-hover/30 border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-main hover:bg-surface-hover transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveDocModal;

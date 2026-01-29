import React from 'react';
import { Icons } from './Icon';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  confirmLabel, 
  onConfirm, 
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn transition-all duration-300">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
              {variant === 'danger' ? <Icons.AlertTriangle className="w-6 h-6" /> : <Icons.Info className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-main leading-tight">{title}</h3>
              <p className="text-sm text-secondary mt-2 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-surface-hover/50 flex justify-end gap-3 border-t border-border">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-main hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-6 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg active:scale-95 ${
              variant === 'danger' 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-primary hover:bg-blue-600 shadow-primary/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
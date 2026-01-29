import React, { useEffect } from 'react';
import { Icons } from './Icon';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000); // Auto dismiss after 6 seconds
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgColors = {
    success: 'bg-surface border-green-500/30 text-main shadow-lg shadow-green-900/10',
    error: 'bg-surface border-red-500/30 text-main shadow-lg shadow-red-900/10',
    warning: 'bg-surface border-yellow-500/30 text-main shadow-lg shadow-yellow-900/10',
    info: 'bg-surface border-blue-500/30 text-main shadow-lg shadow-blue-900/10',
  };

  const icons = {
    success: <div className="text-green-500 bg-green-500/10 p-2 rounded-full"><Icons.CheckCircle className="w-5 h-5" /></div>,
    error: <div className="text-red-500 bg-red-500/10 p-2 rounded-full"><Icons.AlertTriangle className="w-5 h-5" /></div>,
    warning: <div className="text-yellow-500 bg-yellow-500/10 p-2 rounded-full"><Icons.AlertTriangle className="w-5 h-5" /></div>,
    info: <div className="text-blue-500 bg-blue-500/10 p-2 rounded-full"><Icons.Info className="w-5 h-5" /></div>,
  };

  return (
    <div className={`pointer-events-auto w-full sm:min-w-[320px] sm:w-auto max-w-md p-4 rounded-xl border flex items-start gap-4 animate-scaleIn transition-all duration-300 transform translate-y-0 ${bgColors[toast.type]}`}>
      <div className="shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold tracking-tight">{toast.title}</h4>
        <p className="text-xs opacity-80 mt-1 leading-relaxed">{toast.message}</p>
      </div>
      <button 
        onClick={onDismiss} 
        className="text-secondary hover:text-main p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 -mr-2 -mt-2"
      >
        <Icons.X className="w-4 h-4" />
      </button>
    </div>
  );
};

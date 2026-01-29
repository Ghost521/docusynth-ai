
import React from 'react';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ label, children, position = 'bottom', shortcut }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-900 dark:border-t-zinc-100 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900 dark:border-b-zinc-100 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-900 dark:border-l-zinc-100 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-900 dark:border-r-zinc-100 border-y-transparent border-l-transparent',
  };

  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div className={`absolute ${positionClasses[position]} pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-50`}>
        <div className="relative">
          <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg flex items-center gap-2">
            {label}
            {shortcut && (
              <kbd className="text-[9px] font-mono bg-white/15 dark:bg-black/10 px-1.5 py-0.5 rounded">{shortcut}</kbd>
            )}
          </div>
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
        </div>
      </div>
    </div>
  );
};

export default Tooltip;


import React, { useMemo } from 'react';
import { CrawlTask } from '../types';
import { Icons } from './Icon';

interface TaskProgressManagerProps {
  tasks: CrawlTask[];
  onViewDoc: (docId: string) => void;
  onClose: () => void;
  onReorder?: (id: string, direction: 'up' | 'down' | 'top') => void;
  crawlDelay?: number;
  onClearCompleted?: () => void;
}

const TaskProgressManager: React.FC<TaskProgressManagerProps> = ({ 
  tasks, 
  onViewDoc, 
  onClose, 
  onReorder, 
  crawlDelay = 1000,
  onClearCompleted
}) => {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const pending = tasks.filter(t => t.status === 'pending');
  const processing = tasks.filter(t => t.status === 'processing');
  const progress = Math.round(((completed + failed) / tasks.length) * 100) || 0;

  // Calculate ETA: Assume 4s avg per page generation + delay
  const AVG_GEN_TIME_MS = 4000; 
  const remainingCount = pending.length + processing.length;
  const etaMs = remainingCount * (AVG_GEN_TIME_MS + crawlDelay);
  
  const formatTime = (ms: number) => {
    if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.ceil((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface/50 backdrop-blur-sm p-4 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        
        <div className="bg-surface border border-border rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-surface">
             <div>
                <h2 className="text-xl font-bold text-main flex items-center gap-2">
                    <Icons.Cpu className={`w-6 h-6 text-primary ${processing.length > 0 ? 'animate-pulse' : ''}`} />
                    {processing.length > 0 ? 'Processing Queue' : 'Queue Manager'}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                   <p className="text-sm text-secondary">
                        {tasks.length} item{tasks.length !== 1 ? 's' : ''} total
                   </p>
                   {remainingCount > 0 && (
                       <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                          ~{formatTime(etaMs)} remaining
                       </span>
                   )}
                </div>
             </div>
             <div className="flex items-center gap-2">
                {onClearCompleted && (completed > 0 || failed > 0) && (
                    <button 
                        onClick={onClearCompleted}
                        className="text-xs font-bold text-secondary hover:text-primary px-3 py-1.5 hover:bg-surface-hover rounded-lg transition-colors mr-2"
                    >
                        Clear Finished
                    </button>
                )}
                <button 
                    onClick={onClose} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover hover:bg-primary/10 text-secondary hover:text-primary rounded-lg text-sm font-bold transition-colors"
                >
                    <Icons.ChevronDown className="w-4 h-4" />
                    Minimize to Background
                </button>
             </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 bg-surface-hover/30 border-b border-border">
             <div className="flex justify-between text-xs font-medium mb-2 text-secondary">
                <span>Overall Progress</span>
                <span>{progress}% ({completed + failed}/{tasks.length})</span>
             </div>
             <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                <div 
                    className="bg-primary h-full transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
             </div>
             {failed > 0 && (
                 <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <Icons.AlertTriangle className="w-3 h-3" />
                    {failed} tasks failed. Check errors below.
                 </p>
             )}
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
             {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-secondary opacity-60">
                    <Icons.Search className="w-8 h-8 mb-2" />
                    <p className="text-sm">Queue is empty</p>
                </div>
             )}
             
             {tasks.map((task, index) => {
                const isFirstPending = index === tasks.findIndex(t => t.status === 'pending');
                const lastPendingIdx = [...tasks].reverse().findIndex(t => t.status === 'pending');
                const isLastPending = lastPendingIdx !== -1 && index === (tasks.length - 1 - lastPendingIdx);

                return (
                    <div 
                        key={task.id} 
                        className={`
                            p-4 rounded-lg border flex items-center justify-between transition-all group
                            ${task.status === 'processing' ? 'bg-primary/5 border-primary/30 shadow-md transform scale-[1.01]' : 'bg-surface border-border'}
                            ${task.status === 'completed' ? 'border-green-500/20 bg-green-500/5' : ''}
                            ${task.status === 'failed' ? 'border-red-500/20 bg-red-500/5' : ''}
                        `}
                    >
                        <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                            {/* Reorder Controls */}
                            {task.status === 'pending' && onReorder && (
                                <div className="flex flex-col gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => onReorder(task.id, 'top')}
                                        disabled={isFirstPending}
                                        className="p-1 hover:text-primary disabled:opacity-20 disabled:hover:text-secondary transition-colors"
                                        title="Move to Top"
                                    >
                                        <Icons.ArrowUpToLine className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => onReorder(task.id, 'up')}
                                        disabled={isFirstPending}
                                        className="p-1 hover:text-primary disabled:opacity-20 disabled:hover:text-secondary transition-colors"
                                        title="Move Up"
                                    >
                                        <Icons.ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => onReorder(task.id, 'down')}
                                        disabled={isLastPending}
                                        className="p-1 hover:text-primary disabled:opacity-20 disabled:hover:text-secondary transition-colors"
                                        title="Move Down"
                                    >
                                        <Icons.ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {task.status === 'pending' && <div className="w-2 h-2 rounded-full bg-secondary/50" />}
                                    {task.status === 'processing' && <div className="w-2 h-2 rounded-full bg-primary animate-ping" />}
                                    {task.status === 'completed' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                                    {task.status === 'failed' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                                    
                                    <span className={`text-sm font-medium truncate ${task.status === 'completed' ? 'text-main' : 'text-secondary'}`}>
                                        {task.title}
                                    </span>
                                </div>
                                <div className="text-xs text-secondary/60 truncate pl-4 mt-1 font-mono">
                                    {task.url}
                                </div>
                                {task.error && (
                                    <div className="text-xs text-red-400 pl-4 mt-1 flex items-center gap-1">
                                        <Icons.AlertTriangle className="w-3 h-3" />
                                        {task.error}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center shrink-0">
                            {task.status === 'pending' && <span className="text-xs text-secondary px-2 py-1 bg-surface-hover rounded font-medium">Pending</span>}
                            {task.status === 'processing' && <span className="text-xs text-primary px-2 py-1 bg-primary/10 rounded animate-pulse font-medium">Processing...</span>}
                            {task.status === 'failed' && <span className="text-xs text-red-500 px-2 py-1 bg-red-500/10 rounded font-medium">Failed</span>}
                            {task.status === 'completed' && task.docId && (
                                <button 
                                    onClick={() => onViewDoc(task.docId!)}
                                    className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 px-3 py-1.5 rounded-md font-medium transition-colors border border-green-500/20"
                                >
                                    <Icons.FileJson className="w-3.5 h-3.5" />
                                    View Doc
                                </button>
                            )}
                        </div>
                    </div>
                );
             })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskProgressManager;

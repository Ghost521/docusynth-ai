
import React from 'react';
import { Icons } from './Icon';

interface LoadingScreenProps {
  message: string;
}

const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({ width = 'w-full', className = '' }) => (
  <div className={`${width} h-3 bg-border/30 rounded-md animate-pulse ${className}`} />
);

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fadeIn">
      {/* Agent status */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
        <div className="relative bg-surface border border-border p-4 rounded-2xl shadow-2xl">
          <Icons.Cpu className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-main tracking-tight animate-pulse mb-2">
        {message || 'Processing...'}
      </h2>
      <p className="text-sm text-secondary max-w-xs text-center mb-10">
        Synthesizing documentation and optimizing tokens for your LLM context.
      </p>

      {/* Document skeleton preview */}
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl p-8 shadow-lg space-y-6">
        <SkeletonLine width="w-2/3" className="h-5" />
        <div className="space-y-3">
          <SkeletonLine width="w-full" />
          <SkeletonLine width="w-5/6" />
          <SkeletonLine width="w-4/5" />
        </div>
        <div className="pt-2 space-y-3">
          <SkeletonLine width="w-1/2" className="h-4" />
          <SkeletonLine width="w-full" />
          <SkeletonLine width="w-3/4" />
          <SkeletonLine width="w-5/6" />
        </div>
        <div className="pt-2 space-y-3">
          <SkeletonLine width="w-2/5" className="h-4" />
          <SkeletonLine width="w-full" />
          <SkeletonLine width="w-2/3" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

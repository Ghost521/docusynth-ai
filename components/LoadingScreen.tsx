
import React from 'react';
import { Icons } from './Icon';

interface LoadingScreenProps {
  message: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fadeIn">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
        <div className="relative bg-surface border border-border p-4 rounded-2xl shadow-2xl">
          <Icons.Cpu className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
      <h2 className="mt-8 text-xl font-bold text-main tracking-tight animate-pulse">
        {message || 'Processing...'}
      </h2>
      <p className="mt-2 text-sm text-secondary max-w-xs text-center">
        Synthesizing documentation and optimizing tokens for your LLM context.
      </p>
    </div>
  );
};

export default LoadingScreen;

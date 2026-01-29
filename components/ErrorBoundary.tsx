import React, { ErrorInfo, ReactNode } from 'react';
import { Icons } from './Icon';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fadeIn">
          <div className="p-4 bg-red-500/10 rounded-full mb-4">
            <Icons.AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-main mb-2">Something went wrong</h2>
          <p className="text-secondary text-sm mb-6 max-w-md">
            The application encountered an unexpected error. This might be due to a connectivity issue or a data glitch.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 rounded-lg text-sm font-bold text-main transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-hover transition-colors"
            >
              Reload Page
            </button>
          </div>
          {this.state.error && (
            <pre className="mt-8 p-4 bg-black/5 dark:bg-white/5 rounded-lg text-[10px] text-left overflow-auto max-w-lg font-mono text-red-500">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
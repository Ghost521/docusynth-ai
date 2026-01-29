import React from 'react';
import { useConvexAuth } from 'convex/react';
import { SignIn, useAuth } from '@clerk/clerk-react';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-main">DocuSynth AI</h1>
            <p className="text-secondary mt-2">
              Generate token-optimized documentation context for LLMs
            </p>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGate;

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';
import type { Id } from '../convex/_generated/dataModel';
import {
  generateAuthUrl,
  generatePKCE,
  generateState,
  generateNonce,
  buildConfigFromWellKnown,
} from '../services/oidcService';
import { generateAuthnRequest, type SAMLConfig } from '../services/samlService';

// ===============================================================
// Types
// ===============================================================

interface SSOLoginButtonProps {
  configId: Id<'ssoConfigurations'>;
  configName?: string;
  provider?: 'saml' | 'oidc';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline';
  showIcon?: boolean;
  onError?: (error: string) => void;
  onLoading?: (loading: boolean) => void;
}

interface SimpleSSOButtonProps {
  workspaceSlug?: string;
  email?: string;
  className?: string;
  onNoSSO?: () => void;
}

// ===============================================================
// Main Component
// ===============================================================

export function SSOLoginButton({
  configId,
  configName,
  provider,
  className = '',
  size = 'md',
  variant = 'primary',
  showIcon = true,
  onError,
  onLoading,
}: SSOLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const createAuthState = useMutation(api.sso.createAuthState);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
  };

  const handleClick = async () => {
    setIsLoading(true);
    onLoading?.(true);

    try {
      // Get the redirect URI (current origin + callback path)
      const redirectUri = `${window.location.origin}/api/sso/callback`;

      // Create auth state in backend
      const { state, nonce, codeVerifier } = await createAuthState({
        configId,
        redirectUri,
      });

      // Store state in sessionStorage for verification on callback
      sessionStorage.setItem('sso_state', state);
      sessionStorage.setItem('sso_nonce', nonce);
      if (codeVerifier) {
        sessionStorage.setItem('sso_code_verifier', codeVerifier);
      }

      // Build the authorization URL based on provider type
      // For now, we'll redirect to a backend endpoint that handles the redirect
      const ssoUrl = `/api/sso/authorize?config=${configId}&state=${state}`;

      // Redirect to SSO
      window.location.href = ssoUrl;
    } catch (error) {
      console.error('SSO login error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to initiate SSO login');
      setIsLoading(false);
      onLoading?.(false);
    }
  };

  const getProviderIcon = () => {
    if (provider === 'saml') {
      return <Icons.Shield className="w-5 h-5" />;
    }
    return <Icons.Key className="w-5 h-5" />;
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isLoading ? (
        <Icons.Loader className="w-5 h-5 animate-spin" />
      ) : showIcon ? (
        getProviderIcon()
      ) : null}
      {isLoading ? 'Redirecting...' : `Sign in with ${configName || 'SSO'}`}
    </button>
  );
}

// ===============================================================
// Auto-detecting SSO Button
// ===============================================================

export function AutoSSOButton({
  workspaceSlug,
  email,
  className = '',
  onNoSSO,
}: SimpleSSOButtonProps) {
  const ssoCheck = useQuery(api.sso.checkSSORequired, {
    workspaceSlug,
    email,
  });

  // If no SSO required, render nothing or call callback
  if (ssoCheck && !ssoCheck.required) {
    onNoSSO?.();
    return null;
  }

  // Loading state
  if (!ssoCheck) {
    return (
      <div className={`animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
    );
  }

  // SSO is required
  return (
    <SSOLoginButton
      configId={ssoCheck.configId}
      configName={ssoCheck.name}
      provider={ssoCheck.provider}
      className={className}
    />
  );
}

// ===============================================================
// SSO Buttons List (for multiple IdPs)
// ===============================================================

interface SSOButtonsListProps {
  workspaceId: Id<'workspaces'>;
  className?: string;
  onError?: (error: string) => void;
}

export function SSOButtonsList({
  workspaceId,
  className = '',
  onError,
}: SSOButtonsListProps) {
  const configs = useQuery(api.sso.listSSOConfigs, { workspaceId });

  if (!configs) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  const enabledConfigs = configs.filter(c => c.enabled);

  if (enabledConfigs.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {enabledConfigs.map((config) => (
        <SSOLoginButton
          key={config._id}
          configId={config._id}
          configName={config.name}
          provider={config.provider}
          variant="outline"
          className="w-full"
          onError={onError}
        />
      ))}
    </div>
  );
}

// ===============================================================
// SSO Divider (for showing "or" between SSO and regular login)
// ===============================================================

interface SSODividerProps {
  text?: string;
  className?: string;
}

export function SSODivider({ text = 'or continue with', className = '' }: SSODividerProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200 dark:border-gray-700" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
          {text}
        </span>
      </div>
    </div>
  );
}

// ===============================================================
// SSO Required Banner
// ===============================================================

interface SSORequiredBannerProps {
  workspaceName?: string;
  configName?: string;
  configId: Id<'ssoConfigurations'>;
  provider?: 'saml' | 'oidc';
  className?: string;
}

export function SSORequiredBanner({
  workspaceName,
  configName,
  configId,
  provider,
  className = '',
}: SSORequiredBannerProps) {
  return (
    <div className={`p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
          <Icons.Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            SSO Required
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {workspaceName ? (
              <>
                <strong>{workspaceName}</strong> requires you to sign in using Single Sign-On
                {configName && ` through ${configName}`}.
              </>
            ) : (
              <>
                This workspace requires Single Sign-On authentication
                {configName && ` through ${configName}`}.
              </>
            )}
          </p>
          <SSOLoginButton
            configId={configId}
            configName={configName}
            provider={provider}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}

// ===============================================================
// Compact SSO Badge (for showing SSO status)
// ===============================================================

interface SSOBadgeProps {
  enabled?: boolean;
  enforced?: boolean;
  providerName?: string;
  className?: string;
}

export function SSOBadge({
  enabled = false,
  enforced = false,
  providerName,
  className = '',
}: SSOBadgeProps) {
  if (!enabled) {
    return null;
  }

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${enforced
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }
        ${className}
      `}
    >
      <Icons.Shield className="w-3 h-3" />
      <span>
        SSO {enforced ? 'Required' : 'Enabled'}
        {providerName && ` (${providerName})`}
      </span>
    </div>
  );
}

export default SSOLoginButton;

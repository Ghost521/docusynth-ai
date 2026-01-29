import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';
import { SSOConfigModal } from './SSOConfigModal';
import type { Id } from '../convex/_generated/dataModel';

// ===============================================================
// Types
// ===============================================================

type ProviderTemplate = 'okta' | 'azure' | 'google' | 'auth0' | 'onelogin' | 'custom';

interface ProviderInfo {
  id: ProviderTemplate;
  name: string;
  logo: string;
  description: string;
  supportedProtocols: ('oidc' | 'saml')[];
  setupUrl?: string;
  docs?: string;
}

interface SSOSetupWizardProps {
  workspaceId: Id<'workspaces'>;
  onClose: () => void;
  onConfigured?: (configId: Id<'ssoConfigurations'>) => void;
}

// ===============================================================
// Provider Templates
// ===============================================================

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'okta',
    name: 'Okta',
    logo: 'https://www.okta.com/sites/default/files/media/image/2020-10/okta_icon_large_256.png',
    description: 'Enterprise identity management with OIDC and SAML support.',
    supportedProtocols: ['oidc', 'saml'],
    setupUrl: 'https://developer.okta.com/docs/guides/build-sso-integration/',
    docs: 'https://developer.okta.com/docs/',
  },
  {
    id: 'azure',
    name: 'Azure AD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Microsoft_Azure_Logo.svg',
    description: 'Microsoft Azure Active Directory for enterprise SSO.',
    supportedProtocols: ['oidc', 'saml'],
    setupUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps',
    docs: 'https://docs.microsoft.com/en-us/azure/active-directory/',
  },
  {
    id: 'google',
    name: 'Google Workspace',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
    description: 'Google Workspace identity for business accounts.',
    supportedProtocols: ['oidc', 'saml'],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    docs: 'https://developers.google.com/identity/protocols/oauth2',
  },
  {
    id: 'auth0',
    name: 'Auth0',
    logo: 'https://cdn.auth0.com/styleguide/latest/lib/logos/img/badge.png',
    description: 'Flexible identity platform with OIDC support.',
    supportedProtocols: ['oidc', 'saml'],
    setupUrl: 'https://manage.auth0.com/dashboard',
    docs: 'https://auth0.com/docs',
  },
  {
    id: 'onelogin',
    name: 'OneLogin',
    logo: 'https://www.onelogin.com/assets/img/press/presskit/icon_black_onelogin.svg',
    description: 'Unified access management for enterprises.',
    supportedProtocols: ['oidc', 'saml'],
    docs: 'https://developers.onelogin.com/',
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    logo: '',
    description: 'Configure any OIDC or SAML 2.0 compliant provider.',
    supportedProtocols: ['oidc', 'saml'],
  },
];

// ===============================================================
// Component
// ===============================================================

export function SSOSetupWizard({
  workspaceId,
  onClose,
  onConfigured,
}: SSOSetupWizardProps) {
  const [step, setStep] = useState<'select' | 'instructions' | 'configure'>('select');
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<'oidc' | 'saml'>('oidc');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const spMetadata = useQuery(api.sso.generateSPMetadata, { workspaceId });

  const handleProviderSelect = (provider: ProviderInfo) => {
    setSelectedProvider(provider);
    setSelectedProtocol(provider.supportedProtocols[0]);
    setStep('instructions');
  };

  const handleBack = () => {
    if (step === 'instructions') {
      setStep('select');
      setSelectedProvider(null);
    } else if (step === 'configure') {
      setStep('instructions');
    }
  };

  const handleContinueToConfig = () => {
    setShowConfigModal(true);
  };

  const handleConfigSaved = () => {
    setShowConfigModal(false);
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Set Up Single Sign-On
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {step === 'select' && 'Choose your identity provider'}
              {step === 'instructions' && `Configure ${selectedProvider?.name}`}
              {step === 'configure' && 'Enter your SSO credentials'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step: Select Provider */}
          {step === 'select' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider)}
                  className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 text-left transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {provider.logo ? (
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Icons.Key className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {provider.name}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {provider.description}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {provider.supportedProtocols.map((protocol) => (
                      <span
                        key={protocol}
                        className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase"
                      >
                        {protocol}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: Instructions */}
          {step === 'instructions' && selectedProvider && (
            <div className="space-y-6">
              {/* Protocol Selection */}
              {selectedProvider.supportedProtocols.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Select Protocol
                  </label>
                  <div className="flex gap-4">
                    {selectedProvider.supportedProtocols.map((protocol) => (
                      <button
                        key={protocol}
                        onClick={() => setSelectedProtocol(protocol)}
                        className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                          selectedProtocol === protocol
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {protocol === 'oidc' ? (
                            <Icons.Key className="w-5 h-5" />
                          ) : (
                            <Icons.Shield className="w-5 h-5" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-white uppercase">
                            {protocol}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {protocol === 'oidc'
                            ? 'Modern OAuth 2.0 with PKCE'
                            : 'Traditional SAML 2.0'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Setup Instructions */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Setup Instructions
                </h3>

                {selectedProtocol === 'oidc' ? (
                  <OIDCInstructions
                    provider={selectedProvider}
                    workspaceId={workspaceId}
                  />
                ) : (
                  <SAMLInstructions
                    provider={selectedProvider}
                    spMetadata={spMetadata}
                    copyToClipboard={copyToClipboard}
                  />
                )}
              </div>

              {/* External Links */}
              {(selectedProvider.docs || selectedProvider.setupUrl) && (
                <div className="flex gap-4">
                  {selectedProvider.docs && (
                    <a
                      href={selectedProvider.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Icons.ExternalLink className="w-4 h-4" />
                      View Documentation
                    </a>
                  )}
                  {selectedProvider.setupUrl && (
                    <a
                      href={selectedProvider.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Icons.ExternalLink className="w-4 h-4" />
                      Open {selectedProvider.name} Console
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={step === 'select' ? onClose : handleBack}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {step === 'select' ? 'Cancel' : 'Back'}
          </button>

          {step === 'instructions' && (
            <button
              onClick={handleContinueToConfig}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              Continue to Configuration
              <Icons.ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <SSOConfigModal
          workspaceId={workspaceId}
          onClose={() => setShowConfigModal(false)}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  );
}

// ===============================================================
// Instruction Components
// ===============================================================

function OIDCInstructions({
  provider,
  workspaceId,
}: {
  provider: ProviderInfo;
  workspaceId: Id<'workspaces'>;
}) {
  const redirectUri = `${window.location.origin}/api/sso/callback`;

  const steps = getOIDCSteps(provider.id, redirectUri);

  return (
    <div className="space-y-4">
      <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600 dark:text-gray-400">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>

      <div className="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Callback URL
        </h4>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded text-sm break-all">
            {redirectUri}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(redirectUri)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Copy to clipboard"
          >
            <Icons.Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SAMLInstructions({
  provider,
  spMetadata,
  copyToClipboard,
}: {
  provider: ProviderInfo;
  spMetadata: {
    entityId: string;
    acsUrl: string;
    sloUrl: string;
    metadataXml: string;
  } | null | undefined;
  copyToClipboard: (text: string) => void;
}) {
  const steps = getSAMLSteps(provider.id);

  return (
    <div className="space-y-4">
      <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600 dark:text-gray-400">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>

      <div className="mt-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Service Provider Details
        </h4>

        {spMetadata ? (
          <div className="space-y-2">
            <MetadataField
              label="Entity ID / Issuer"
              value={spMetadata.entityId}
              onCopy={() => copyToClipboard(spMetadata.entityId)}
            />
            <MetadataField
              label="ACS URL"
              value={spMetadata.acsUrl}
              onCopy={() => copyToClipboard(spMetadata.acsUrl)}
            />
            <MetadataField
              label="SLO URL"
              value={spMetadata.sloUrl}
              onCopy={() => copyToClipboard(spMetadata.sloUrl)}
            />

            <div className="pt-2">
              <button
                onClick={() => copyToClipboard(spMetadata.metadataXml)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Icons.Download className="w-4 h-4" />
                Copy Metadata XML
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          <p className="text-sm text-gray-900 dark:text-white break-all font-mono">
            {value}
          </p>
        </div>
        <button
          onClick={onCopy}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          title="Copy to clipboard"
        >
          <Icons.Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ===============================================================
// Provider-Specific Instructions
// ===============================================================

function getOIDCSteps(providerId: ProviderTemplate, redirectUri: string): string[] {
  switch (providerId) {
    case 'okta':
      return [
        'Sign in to your Okta Admin Console',
        'Navigate to Applications > Create App Integration',
        'Select "OIDC - OpenID Connect" and "Web Application"',
        `Add "${redirectUri}" to Sign-in redirect URIs`,
        'Copy the Client ID and Client Secret',
        'Note your Okta domain (e.g., https://your-company.okta.com)',
      ];
    case 'azure':
      return [
        'Sign in to the Azure Portal',
        'Navigate to Azure Active Directory > App registrations',
        'Click "New registration" and name your app',
        `Add "${redirectUri}" as a Redirect URI (Web platform)`,
        'Copy the Application (client) ID',
        'Create a client secret under Certificates & secrets',
        'Note your tenant ID for the issuer URL',
      ];
    case 'google':
      return [
        'Go to Google Cloud Console > APIs & Services > Credentials',
        'Click "Create Credentials" > "OAuth client ID"',
        'Select "Web application" as the application type',
        `Add "${redirectUri}" to Authorized redirect URIs`,
        'Copy the Client ID and Client Secret',
      ];
    case 'auth0':
      return [
        'Sign in to your Auth0 Dashboard',
        'Navigate to Applications > Create Application',
        'Select "Regular Web Applications"',
        `Add "${redirectUri}" to Allowed Callback URLs`,
        'Copy the Client ID and Client Secret',
        'Note your Auth0 domain (e.g., your-tenant.auth0.com)',
      ];
    default:
      return [
        'Create a new OIDC/OAuth 2.0 application in your IdP',
        `Set the redirect URI to: ${redirectUri}`,
        'Enable the Authorization Code flow with PKCE',
        'Request scopes: openid, email, profile',
        'Copy the Client ID and Client Secret',
        'Note the issuer URL or endpoints',
      ];
  }
}

function getSAMLSteps(providerId: ProviderTemplate): string[] {
  switch (providerId) {
    case 'okta':
      return [
        'Sign in to your Okta Admin Console',
        'Navigate to Applications > Create App Integration',
        'Select "SAML 2.0"',
        'Enter the SP details shown below',
        'Configure attribute statements (email, name, groups)',
        'Download the IdP metadata or copy the SSO URL and certificate',
      ];
    case 'azure':
      return [
        'Sign in to the Azure Portal',
        'Navigate to Azure Active Directory > Enterprise applications',
        'Click "New application" > "Create your own application"',
        'Select "Integrate any other application you don\'t find in the gallery (Non-gallery)"',
        'Under "Single sign-on", select SAML',
        'Enter the SP details shown below',
        'Download the Federation Metadata XML or copy SSO URL and certificate',
      ];
    default:
      return [
        'Create a new SAML 2.0 application in your IdP',
        'Enter the Service Provider details shown below',
        'Configure attribute mapping for email, name, and groups',
        'Download the IdP metadata or copy the required values',
      ];
  }
}

export default SSOSetupWizard;

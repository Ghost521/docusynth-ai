import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';
import type { Id } from '../convex/_generated/dataModel';

// ===============================================================
// Types
// ===============================================================

type SSOProvider = 'saml' | 'oidc';
type ConfigStep = 'provider' | 'details' | 'mapping' | 'options' | 'review';

interface AttributeMapping {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  groups?: string;
  avatar?: string;
}

interface GroupRoleMapping {
  idpGroup: string;
  role: 'admin' | 'member' | 'viewer';
}

interface SSOConfigModalProps {
  workspaceId: Id<'workspaces'>;
  configId?: Id<'ssoConfigurations'>;
  onClose: () => void;
  onSaved?: () => void;
}

// ===============================================================
// Component
// ===============================================================

export function SSOConfigModal({
  workspaceId,
  configId,
  onClose,
  onSaved,
}: SSOConfigModalProps) {
  const isEditing = !!configId;

  // Queries
  const existingConfig = useQuery(
    api.sso.getSSOConfigById,
    configId ? { configId } : 'skip'
  );
  const spMetadata = useQuery(api.sso.generateSPMetadata, { workspaceId });

  // Mutations
  const createConfig = useMutation(api.sso.createSSOConfig);
  const updateConfig = useMutation(api.sso.updateSSOConfig);

  // Form state
  const [step, setStep] = useState<ConfigStep>('provider');
  const [provider, setProvider] = useState<SSOProvider>('oidc');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SAML fields
  const [samlEntityId, setSamlEntityId] = useState('');
  const [samlSsoUrl, setSamlSsoUrl] = useState('');
  const [samlSloUrl, setSamlSloUrl] = useState('');
  const [samlCertificate, setSamlCertificate] = useState('');
  const [samlSignRequests, setSamlSignRequests] = useState(false);
  const [samlNameIdFormat, setSamlNameIdFormat] = useState('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');

  // OIDC fields
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [oidcIssuer, setOidcIssuer] = useState('');
  const [oidcAuthUrl, setOidcAuthUrl] = useState('');
  const [oidcTokenUrl, setOidcTokenUrl] = useState('');
  const [oidcUserInfoUrl, setOidcUserInfoUrl] = useState('');
  const [oidcScopes, setOidcScopes] = useState('openid email profile');
  const [useWellKnown, setUseWellKnown] = useState(true);

  // Attribute mapping
  const [attributeMapping, setAttributeMapping] = useState<AttributeMapping>({
    email: 'email',
    name: 'name',
    firstName: 'given_name',
    lastName: 'family_name',
    groups: 'groups',
  });

  // Group role mapping
  const [groupRoleMappings, setGroupRoleMappings] = useState<GroupRoleMapping[]>([]);

  // Options
  const [allowedDomains, setAllowedDomains] = useState('');
  const [blockedDomains, setBlockedDomains] = useState('');
  const [enforceSSO, setEnforceSSO] = useState(false);
  const [allowBypassForOwner, setAllowBypassForOwner] = useState(true);
  const [jitProvisioning, setJitProvisioning] = useState(false);
  const [jitDefaultRole, setJitDefaultRole] = useState<'member' | 'viewer'>('member');

  // Load existing config
  useEffect(() => {
    if (existingConfig) {
      setProvider(existingConfig.provider);
      setName(existingConfig.name);
      setStep('details');

      // SAML
      if (existingConfig.samlEntityId) setSamlEntityId(existingConfig.samlEntityId);
      if (existingConfig.samlSsoUrl) setSamlSsoUrl(existingConfig.samlSsoUrl);
      if (existingConfig.samlSloUrl) setSamlSloUrl(existingConfig.samlSloUrl);
      if (existingConfig.samlSignRequests) setSamlSignRequests(existingConfig.samlSignRequests);
      if (existingConfig.samlNameIdFormat) setSamlNameIdFormat(existingConfig.samlNameIdFormat);

      // OIDC
      if (existingConfig.oidcClientId) setOidcClientId(existingConfig.oidcClientId);
      if (existingConfig.oidcIssuer) setOidcIssuer(existingConfig.oidcIssuer);
      if (existingConfig.oidcAuthUrl) setOidcAuthUrl(existingConfig.oidcAuthUrl);
      if (existingConfig.oidcTokenUrl) setOidcTokenUrl(existingConfig.oidcTokenUrl);
      if (existingConfig.oidcUserInfoUrl) setOidcUserInfoUrl(existingConfig.oidcUserInfoUrl);
      if (existingConfig.oidcScopes) setOidcScopes(existingConfig.oidcScopes.join(' '));

      // Mapping
      if (existingConfig.attributeMapping) {
        setAttributeMapping(existingConfig.attributeMapping);
      }
      if (existingConfig.groupRoleMapping) {
        setGroupRoleMappings(existingConfig.groupRoleMapping);
      }

      // Options
      if (existingConfig.allowedDomains) setAllowedDomains(existingConfig.allowedDomains.join(', '));
      if (existingConfig.blockedDomains) setBlockedDomains(existingConfig.blockedDomains.join(', '));
      setEnforceSSO(existingConfig.enforceSSO);
      setAllowBypassForOwner(existingConfig.allowBypassForOwner);
      setJitProvisioning(existingConfig.jitProvisioning);
      setJitDefaultRole(existingConfig.jitDefaultRole);
    }
  }, [existingConfig]);

  // Steps
  const steps: ConfigStep[] = ['provider', 'details', 'mapping', 'options', 'review'];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = (): boolean => {
    switch (step) {
      case 'provider':
        return !!name.trim();
      case 'details':
        if (provider === 'saml') {
          return !!samlEntityId && !!samlSsoUrl && (isEditing || !!samlCertificate);
        } else {
          return !!oidcClientId && (!!oidcIssuer || (!!oidcAuthUrl && !!oidcTokenUrl));
        }
      case 'mapping':
        return !!attributeMapping.email;
      case 'options':
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const commonArgs = {
        name,
        attributeMapping,
        groupRoleMapping: groupRoleMappings.length > 0 ? groupRoleMappings : undefined,
        allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
        blockedDomains: blockedDomains.split(',').map(d => d.trim()).filter(Boolean),
        enforceSSO,
        allowBypassForOwner,
        jitProvisioning,
        jitDefaultRole,
      };

      if (isEditing && configId) {
        // Update existing config
        await updateConfig({
          configId,
          ...commonArgs,
          ...(provider === 'saml'
            ? {
                samlEntityId,
                samlSsoUrl,
                samlSloUrl: samlSloUrl || undefined,
                samlCertificate: samlCertificate || undefined,
                samlSignRequests,
                samlNameIdFormat,
              }
            : {
                oidcClientId,
                oidcClientSecret: oidcClientSecret || undefined,
                oidcIssuer: oidcIssuer || undefined,
                oidcAuthUrl: useWellKnown ? undefined : oidcAuthUrl,
                oidcTokenUrl: useWellKnown ? undefined : oidcTokenUrl,
                oidcUserInfoUrl: useWellKnown ? undefined : oidcUserInfoUrl,
                oidcScopes: oidcScopes.split(/\s+/).filter(Boolean),
              }),
        });
      } else {
        // Create new config
        await createConfig({
          workspaceId,
          provider,
          ...commonArgs,
          ...(provider === 'saml'
            ? {
                samlEntityId,
                samlSsoUrl,
                samlSloUrl: samlSloUrl || undefined,
                samlCertificate,
                samlSignRequests,
                samlNameIdFormat,
              }
            : {
                oidcClientId,
                oidcClientSecret,
                oidcIssuer: oidcIssuer || undefined,
                oidcAuthUrl: useWellKnown ? undefined : oidcAuthUrl,
                oidcTokenUrl: useWellKnown ? undefined : oidcTokenUrl,
                oidcUserInfoUrl: useWellKnown ? undefined : oidcUserInfoUrl,
                oidcScopes: oidcScopes.split(/\s+/).filter(Boolean),
              }),
        });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add group role mapping
  const addGroupMapping = () => {
    setGroupRoleMappings([...groupRoleMappings, { idpGroup: '', role: 'member' }]);
  };

  const removeGroupMapping = (index: number) => {
    setGroupRoleMappings(groupRoleMappings.filter((_, i) => i !== index));
  };

  const updateGroupMapping = (index: number, field: 'idpGroup' | 'role', value: string) => {
    const updated = [...groupRoleMappings];
    if (field === 'role') {
      updated[index].role = value as 'admin' | 'member' | 'viewer';
    } else {
      updated[index].idpGroup = value;
    }
    setGroupRoleMappings(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-main">
              {isEditing ? 'Edit SSO Configuration' : 'Configure Single Sign-On'}
            </h2>
            <p className="text-sm text-secondary mt-1">
              Step {currentStepIndex + 1} of {steps.length}:{' '}
              {step === 'provider' && 'Select Provider'}
              {step === 'details' && 'Provider Details'}
              {step === 'mapping' && 'Attribute Mapping'}
              {step === 'options' && 'Options'}
              {step === 'review' && 'Review'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-surface-hover"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : i === currentStepIndex
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-surface-hover text-secondary'
                  }`}
                >
                  {i < currentStepIndex ? <Icons.Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 rounded ${
                      i < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-surface-hover'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Step: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Company Okta, Azure AD"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-3">
                  Provider Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setProvider('oidc')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      provider === 'oidc'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        provider === 'oidc' ? 'bg-blue-500' : 'bg-gray-100 dark:bg-surface-hover'
                      }`}>
                        <Icons.Key className={`w-5 h-5 ${provider === 'oidc' ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <span className="font-medium text-main">OIDC / OAuth 2.0</span>
                    </div>
                    <p className="text-sm text-secondary">
                      OpenID Connect with PKCE support. Recommended for Okta, Auth0, Azure AD, Google.
                    </p>
                  </button>

                  <button
                    onClick={() => setProvider('saml')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      provider === 'saml'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        provider === 'saml' ? 'bg-blue-500' : 'bg-gray-100 dark:bg-surface-hover'
                      }`}>
                        <Icons.Shield className={`w-5 h-5 ${provider === 'saml' ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <span className="font-medium text-main">SAML 2.0</span>
                    </div>
                    <p className="text-sm text-secondary">
                      Security Assertion Markup Language. Traditional enterprise SSO standard.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Provider Details */}
          {step === 'details' && (
            <div className="space-y-6">
              {provider === 'oidc' ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="useWellKnown"
                      checked={useWellKnown}
                      onChange={(e) => setUseWellKnown(e.target.checked)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="useWellKnown" className="text-sm text-secondary">
                      Auto-configure from Issuer URL (recommended)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Client ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={oidcClientId}
                      onChange={(e) => setOidcClientId(e.target.value)}
                      placeholder="your-client-id"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Client Secret {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      value={oidcClientSecret}
                      onChange={(e) => setOidcClientSecret(e.target.value)}
                      placeholder={isEditing ? '(unchanged)' : 'your-client-secret'}
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>

                  {useWellKnown ? (
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Issuer URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={oidcIssuer}
                        onChange={(e) => setOidcIssuer(e.target.value)}
                        placeholder="https://your-tenant.okta.com"
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                      />
                      <p className="text-xs text-secondary mt-1">
                        We'll auto-discover endpoints from /.well-known/openid-configuration
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                          Authorization URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={oidcAuthUrl}
                          onChange={(e) => setOidcAuthUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                          Token URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={oidcTokenUrl}
                          onChange={(e) => setOidcTokenUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                          UserInfo URL (optional)
                        </label>
                        <input
                          type="url"
                          value={oidcUserInfoUrl}
                          onChange={(e) => setOidcUserInfoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Scopes
                    </label>
                    <input
                      type="text"
                      value={oidcScopes}
                      onChange={(e) => setOidcScopes(e.target.value)}
                      placeholder="openid email profile"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                    <p className="text-xs text-secondary mt-1">
                      Space-separated list of scopes to request
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* SAML SP Metadata */}
                  <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
                    <h4 className="font-medium text-main mb-3">
                      Service Provider Information
                    </h4>
                    <p className="text-sm text-secondary mb-3">
                      Configure your Identity Provider with these values:
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-secondary">Entity ID:</span>
                        <code className="text-main bg-gray-100 dark:bg-surface-hover px-2 py-1 rounded text-xs break-all">
                          {spMetadata?.entityId || 'Loading...'}
                        </code>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-secondary">ACS URL:</span>
                        <code className="text-main bg-gray-100 dark:bg-surface-hover px-2 py-1 rounded text-xs break-all">
                          {spMetadata?.acsUrl || 'Loading...'}
                        </code>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-secondary">SLO URL:</span>
                        <code className="text-main bg-gray-100 dark:bg-surface-hover px-2 py-1 rounded text-xs break-all">
                          {spMetadata?.sloUrl || 'Loading...'}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      IdP Entity ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={samlEntityId}
                      onChange={(e) => setSamlEntityId(e.target.value)}
                      placeholder="https://your-idp.com/entity-id"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      IdP SSO URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={samlSsoUrl}
                      onChange={(e) => setSamlSsoUrl(e.target.value)}
                      placeholder="https://your-idp.com/sso"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      IdP SLO URL (optional)
                    </label>
                    <input
                      type="url"
                      value={samlSloUrl}
                      onChange={(e) => setSamlSloUrl(e.target.value)}
                      placeholder="https://your-idp.com/slo"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      IdP Certificate (X.509) {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={samlCertificate}
                      onChange={(e) => setSamlCertificate(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      rows={6}
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main font-mono text-sm"
                    />
                    {isEditing && !samlCertificate && (
                      <p className="text-xs text-secondary mt-1">
                        Leave empty to keep existing certificate
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="samlSignRequests"
                      checked={samlSignRequests}
                      onChange={(e) => setSamlSignRequests(e.target.checked)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="samlSignRequests" className="text-sm text-secondary">
                      Sign authentication requests
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      NameID Format
                    </label>
                    <select
                      value={samlNameIdFormat}
                      onChange={(e) => setSamlNameIdFormat(e.target.value)}
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    >
                      <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                        Email Address
                      </option>
                      <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">
                        Persistent
                      </option>
                      <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">
                        Transient
                      </option>
                      <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">
                        Unspecified
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: Attribute Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-main mb-3">
                  Attribute Mapping
                </h4>
                <p className="text-sm text-secondary mb-4">
                  Map IdP attributes to DocuSynth user fields. Use dot notation for nested attributes.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={attributeMapping.email}
                        onChange={(e) => setAttributeMapping({ ...attributeMapping, email: e.target.value })}
                        placeholder="email"
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={attributeMapping.name || ''}
                        onChange={(e) => setAttributeMapping({ ...attributeMapping, name: e.target.value })}
                        placeholder="name or displayName"
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={attributeMapping.firstName || ''}
                        onChange={(e) => setAttributeMapping({ ...attributeMapping, firstName: e.target.value })}
                        placeholder="given_name"
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={attributeMapping.lastName || ''}
                        onChange={(e) => setAttributeMapping({ ...attributeMapping, lastName: e.target.value })}
                        placeholder="family_name"
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Groups (for role mapping)
                    </label>
                    <input
                      type="text"
                      value={attributeMapping.groups || ''}
                      onChange={(e) => setAttributeMapping({ ...attributeMapping, groups: e.target.value })}
                      placeholder="groups or memberOf"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>
                </div>
              </div>

              {/* Group to Role Mapping */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-main">
                    Group to Role Mapping
                  </h4>
                  <button
                    onClick={addGroupMapping}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Icons.Plus className="w-4 h-4" />
                    Add Mapping
                  </button>
                </div>
                <p className="text-sm text-secondary mb-4">
                  Automatically assign roles based on IdP group membership.
                </p>

                {groupRoleMappings.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
                    <Icons.Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-secondary">
                      No group mappings configured
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupRoleMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={mapping.idpGroup}
                          onChange={(e) => updateGroupMapping(index, 'idpGroup', e.target.value)}
                          placeholder="IdP Group Name"
                          className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                        />
                        <Icons.ArrowRight className="w-4 h-4 text-gray-400" />
                        <select
                          value={mapping.role}
                          onChange={(e) => updateGroupMapping(index, 'role', e.target.value)}
                          className="px-4 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => removeGroupMapping(index)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Options */}
          {step === 'options' && (
            <div className="space-y-6">
              {/* Domain Restrictions */}
              <div>
                <h4 className="font-medium text-main mb-3">
                  Domain Restrictions
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Allowed Domains
                    </label>
                    <input
                      type="text"
                      value={allowedDomains}
                      onChange={(e) => setAllowedDomains(e.target.value)}
                      placeholder="company.com, subsidiary.com"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                    <p className="text-xs text-secondary mt-1">
                      Comma-separated. Leave empty to allow all domains.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Blocked Domains
                    </label>
                    <input
                      type="text"
                      value={blockedDomains}
                      onChange={(e) => setBlockedDomains(e.target.value)}
                      placeholder="gmail.com, yahoo.com"
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    />
                  </div>
                </div>
              </div>

              {/* Enforcement Options */}
              <div>
                <h4 className="font-medium text-main mb-3">
                  Enforcement Options
                </h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceSSO}
                      onChange={(e) => setEnforceSSO(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-main">
                        Enforce SSO for all members
                      </span>
                      <p className="text-sm text-secondary mt-1">
                        Require workspace members to authenticate through this SSO provider.
                      </p>
                    </div>
                  </label>

                  {enforceSSO && (
                    <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={allowBypassForOwner}
                        onChange={(e) => setAllowBypassForOwner(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-medium text-main">
                          Allow owner to bypass SSO
                        </span>
                        <p className="text-sm text-secondary mt-1">
                          Workspace owner can still log in without SSO (emergency access).
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* JIT Provisioning */}
              <div>
                <h4 className="font-medium text-main mb-3">
                  Just-in-Time Provisioning
                </h4>
                <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jitProvisioning}
                    onChange={(e) => setJitProvisioning(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-main">
                      Enable JIT provisioning
                    </span>
                    <p className="text-sm text-secondary mt-1">
                      Automatically create workspace membership when users authenticate through SSO.
                    </p>
                  </div>
                </label>

                {jitProvisioning && (
                  <div className="mt-4 ml-4">
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Default Role for JIT Users
                    </label>
                    <select
                      value={jitDefaultRole}
                      onChange={(e) => setJitDefaultRole(e.target.value as 'member' | 'viewer')}
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-main"
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> The configuration will be saved in test mode.
                  You'll need to test the connection before enabling it for all users.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-main">Configuration Summary</h4>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-secondary">Name:</span>
                    <span className="ml-2 text-main font-medium">{name}</span>
                  </div>
                  <div>
                    <span className="text-secondary">Provider:</span>
                    <span className="ml-2 text-main font-medium uppercase">{provider}</span>
                  </div>

                  {provider === 'oidc' ? (
                    <>
                      <div className="col-span-2">
                        <span className="text-secondary">Client ID:</span>
                        <span className="ml-2 text-main font-mono">{oidcClientId}</span>
                      </div>
                      {oidcIssuer && (
                        <div className="col-span-2">
                          <span className="text-secondary">Issuer:</span>
                          <span className="ml-2 text-main font-mono">{oidcIssuer}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <span className="text-secondary">Entity ID:</span>
                        <span className="ml-2 text-main font-mono break-all">{samlEntityId}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-secondary">SSO URL:</span>
                        <span className="ml-2 text-main font-mono break-all">{samlSsoUrl}</span>
                      </div>
                    </>
                  )}

                  <div>
                    <span className="text-secondary">Enforce SSO:</span>
                    <span className="ml-2 text-main">{enforceSSO ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-secondary">JIT Provisioning:</span>
                    <span className="ml-2 text-main">{jitProvisioning ? 'Yes' : 'No'}</span>
                  </div>

                  {groupRoleMappings.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-secondary">Group Mappings:</span>
                      <span className="ml-2 text-main">{groupRoleMappings.length} configured</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <button
            onClick={step === 'provider' ? onClose : handleBack}
            className="px-4 py-2 text-secondary hover:bg-surface-hover rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            {step === 'provider' ? 'Cancel' : 'Back'}
          </button>

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4" />
                  {isEditing ? 'Save Changes' : 'Create Configuration'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue
              <Icons.ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SSOConfigModal;

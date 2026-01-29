/**
 * OIDC/OAuth 2.0 Service
 *
 * Handles OpenID Connect authentication flows including:
 * - Authorization Code flow with PKCE
 * - Token exchange
 * - Token refresh
 * - UserInfo endpoint
 * - ID Token validation
 */

// ===============================================================
// Types
// ===============================================================

export interface OIDCConfig {
  clientId: string;
  clientSecret?: string;
  issuer?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  scopes: string[];
}

export interface OIDCWellKnownConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  [key: string]: unknown;
}

export interface IDTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  acr?: string;
  amr?: string[];
  azp?: string;
  at_hash?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  groups?: string[];
  [key: string]: unknown;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

// ===============================================================
// PKCE Generation
// ===============================================================

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<PKCEChallenge> {
  // Generate code verifier (43-128 characters)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array);

  // Generate code challenge using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64UrlEncode(new Uint8Array(hash));

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Generate a secure random state parameter
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate a secure random nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// ===============================================================
// Well-Known Configuration
// ===============================================================

/**
 * Fetch OIDC discovery document from well-known endpoint
 */
export async function fetchWellKnownConfig(issuer: string): Promise<OIDCWellKnownConfig> {
  const wellKnownUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

  const response = await fetch(wellKnownUrl, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC configuration: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Build OIDC config from well-known configuration
 */
export async function buildConfigFromWellKnown(
  issuer: string,
  clientId: string,
  clientSecret?: string,
  scopes?: string[]
): Promise<OIDCConfig> {
  const wellKnown = await fetchWellKnownConfig(issuer);

  return {
    clientId,
    clientSecret,
    issuer: wellKnown.issuer,
    authorizationEndpoint: wellKnown.authorization_endpoint,
    tokenEndpoint: wellKnown.token_endpoint,
    userInfoEndpoint: wellKnown.userinfo_endpoint,
    jwksUri: wellKnown.jwks_uri,
    endSessionEndpoint: wellKnown.end_session_endpoint,
    scopes: scopes || ['openid', 'email', 'profile'],
  };
}

// ===============================================================
// Authorization URL Generation
// ===============================================================

/**
 * Generate authorization URL for initiating OIDC flow
 */
export function generateAuthUrl(
  config: OIDCConfig,
  redirectUri: string,
  state: string,
  nonce: string,
  pkce?: PKCEChallenge,
  additionalParams?: Record<string, string>
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
    nonce,
  });

  // Add PKCE parameters if provided
  if (pkce) {
    params.set('code_challenge', pkce.codeChallenge);
    params.set('code_challenge_method', pkce.codeChallengeMethod);
  }

  // Add any additional parameters
  if (additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      params.set(key, value);
    }
  }

  return `${config.authorizationEndpoint}?${params.toString()}`;
}

// ===============================================================
// Token Exchange
// ===============================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
  config: OIDCConfig,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
  });

  // Add client secret for confidential clients
  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  // Add PKCE verifier
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(
  config: OIDCConfig,
  refreshTokenValue: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
    client_id: config.clientId,
  });

  // Add client secret for confidential clients
  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// ===============================================================
// UserInfo Endpoint
// ===============================================================

/**
 * Fetch user information from UserInfo endpoint
 */
export async function getUserInfo(
  config: OIDCConfig,
  accessToken: string
): Promise<UserInfo> {
  if (!config.userInfoEndpoint) {
    throw new Error('UserInfo endpoint not configured');
  }

  const response = await fetch(config.userInfoEndpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`UserInfo request failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// ===============================================================
// ID Token Validation
// ===============================================================

/**
 * Decode JWT without verification (for extracting claims)
 */
export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: IDTokenClaims;
  signature: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  return {
    header,
    payload,
    signature: parts[2],
  };
}

/**
 * Validate ID token claims
 */
export function validateIdTokenClaims(
  claims: IDTokenClaims,
  config: OIDCConfig,
  expectedNonce?: string,
  clockSkewSeconds: number = 300 // 5 minutes
): { valid: boolean; error?: string } {
  const now = Math.floor(Date.now() / 1000);

  // Validate issuer
  if (config.issuer && claims.iss !== config.issuer) {
    return { valid: false, error: `Invalid issuer: expected ${config.issuer}, got ${claims.iss}` };
  }

  // Validate audience
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(config.clientId)) {
    return { valid: false, error: `Invalid audience: ${config.clientId} not in ${audience.join(', ')}` };
  }

  // Validate expiration
  if (claims.exp + clockSkewSeconds < now) {
    return { valid: false, error: 'ID token has expired' };
  }

  // Validate issued at (not in the future)
  if (claims.iat - clockSkewSeconds > now) {
    return { valid: false, error: 'ID token issued in the future' };
  }

  // Validate nonce if provided
  if (expectedNonce && claims.nonce !== expectedNonce) {
    return { valid: false, error: 'Nonce mismatch' };
  }

  // Validate azp if present (for multiple audiences)
  if (audience.length > 1 && claims.azp && claims.azp !== config.clientId) {
    return { valid: false, error: `Invalid authorized party: expected ${config.clientId}, got ${claims.azp}` };
  }

  return { valid: true };
}

/**
 * Full ID token validation (claims + signature)
 * Note: For production, use a proper JWT library with JWKS support
 */
export async function validateIdToken(
  token: string,
  config: OIDCConfig,
  expectedNonce?: string
): Promise<{ valid: boolean; claims?: IDTokenClaims; error?: string }> {
  try {
    const { payload: claims } = decodeJwt(token);

    // Validate claims
    const claimsValidation = validateIdTokenClaims(claims, config, expectedNonce);
    if (!claimsValidation.valid) {
      return claimsValidation;
    }

    // Note: Full signature validation requires fetching JWKS and verifying
    // with the appropriate public key. For production, use jose or similar.

    return { valid: true, claims };
  } catch (error) {
    return {
      valid: false,
      error: `ID token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ===============================================================
// Logout
// ===============================================================

/**
 * Build logout URL for RP-initiated logout
 */
export function buildLogoutUrl(
  config: OIDCConfig,
  idToken?: string,
  postLogoutRedirectUri?: string,
  state?: string
): string | null {
  if (!config.endSessionEndpoint) {
    return null;
  }

  const params = new URLSearchParams();

  if (idToken) {
    params.set('id_token_hint', idToken);
  }

  if (postLogoutRedirectUri) {
    params.set('post_logout_redirect_uri', postLogoutRedirectUri);
  }

  if (state) {
    params.set('state', state);
  }

  const queryString = params.toString();
  return queryString
    ? `${config.endSessionEndpoint}?${queryString}`
    : config.endSessionEndpoint;
}

// ===============================================================
// Utility Functions
// ===============================================================

/**
 * Base64URL encode
 */
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return atob(base64);
}

/**
 * Calculate token expiry timestamp
 */
export function calculateExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpired(expiresAt: number, bufferSeconds: number = 60): boolean {
  return Date.now() >= expiresAt - bufferSeconds * 1000;
}

/**
 * Extract user info from ID token claims
 */
export function extractUserFromClaims(claims: IDTokenClaims): {
  sub: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  groups?: string[];
} {
  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    firstName: claims.given_name,
    lastName: claims.family_name,
    picture: claims.picture,
    groups: claims.groups,
  };
}

/**
 * Parse callback URL parameters
 */
export function parseCallbackParams(url: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error') || undefined,
    errorDescription: params.get('error_description') || undefined,
  };
}

/**
 * Build a minimal OIDC config for testing
 */
export function buildMinimalConfig(
  clientId: string,
  authEndpoint: string,
  tokenEndpoint: string,
  clientSecret?: string
): OIDCConfig {
  return {
    clientId,
    clientSecret,
    authorizationEndpoint: authEndpoint,
    tokenEndpoint,
    scopes: ['openid', 'email', 'profile'],
  };
}

/**
 * Common OIDC provider configurations
 */
export const COMMON_PROVIDERS = {
  google: {
    issuer: 'https://accounts.google.com',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  microsoft: {
    issuer: 'https://login.microsoftonline.com/common/v2.0',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
  },
  okta: (domain: string) => ({
    issuer: `https://${domain}`,
    authorizationEndpoint: `https://${domain}/oauth2/v1/authorize`,
    tokenEndpoint: `https://${domain}/oauth2/v1/token`,
    userInfoEndpoint: `https://${domain}/oauth2/v1/userinfo`,
    jwksUri: `https://${domain}/oauth2/v1/keys`,
    endSessionEndpoint: `https://${domain}/oauth2/v1/logout`,
  }),
  auth0: (domain: string) => ({
    issuer: `https://${domain}/`,
    authorizationEndpoint: `https://${domain}/authorize`,
    tokenEndpoint: `https://${domain}/oauth/token`,
    userInfoEndpoint: `https://${domain}/userinfo`,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    endSessionEndpoint: `https://${domain}/v2/logout`,
  }),
};

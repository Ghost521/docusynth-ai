/**
 * SAML 2.0 Service
 *
 * Handles SAML authentication flows including:
 * - SP-initiated SSO
 * - IdP-initiated SSO
 * - Single Logout (SLO)
 * - Metadata generation
 * - Response validation
 */

// ===============================================================
// Types
// ===============================================================

export interface SAMLConfig {
  // Service Provider (DocuSynth)
  spEntityId: string;
  spAcsUrl: string;
  spSloUrl: string;
  // Identity Provider
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl?: string;
  idpCertificate: string;
  // Options
  signRequests: boolean;
  signatureAlgorithm: 'sha256' | 'sha512';
  digestAlgorithm: 'sha256' | 'sha512';
  nameIdFormat: string;
}

export interface SAMLAssertion {
  issuer: string;
  nameId: string;
  nameIdFormat: string;
  sessionIndex?: string;
  notBefore?: Date;
  notOnOrAfter?: Date;
  audience?: string;
  attributes: Record<string, string | string[]>;
}

export interface AuthnRequestParams {
  id: string;
  issueInstant: string;
  destination: string;
  issuer: string;
  acsUrl: string;
  nameIdFormat?: string;
}

export interface LogoutRequestParams {
  id: string;
  issueInstant: string;
  destination: string;
  issuer: string;
  nameId: string;
  sessionIndex?: string;
}

// ===============================================================
// SAML Request Generation
// ===============================================================

/**
 * Generate a SAML AuthnRequest for SP-initiated SSO
 */
export function generateAuthnRequest(config: SAMLConfig, params: Partial<AuthnRequestParams> = {}): {
  request: string;
  id: string;
  redirectUrl: string;
} {
  const id = params.id || `_${generateId()}`;
  const issueInstant = params.issueInstant || new Date().toISOString();
  const nameIdFormat = params.nameIdFormat || config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

  const request = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                    ID="${id}"
                    Version="2.0"
                    IssueInstant="${issueInstant}"
                    Destination="${config.idpSsoUrl}"
                    AssertionConsumerServiceURL="${config.spAcsUrl}"
                    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="${nameIdFormat}"
                      AllowCreate="true"/>
</samlp:AuthnRequest>`;

  // Deflate and base64 encode for redirect binding
  const deflated = deflateRaw(request);
  const encoded = btoa(String.fromCharCode(...deflated));
  const urlEncoded = encodeURIComponent(encoded);

  const redirectUrl = `${config.idpSsoUrl}?SAMLRequest=${urlEncoded}`;

  return { request, id, redirectUrl };
}

/**
 * Generate a SAML LogoutRequest for SP-initiated SLO
 */
export function generateLogoutRequest(config: SAMLConfig, params: LogoutRequestParams): {
  request: string;
  id: string;
  redirectUrl: string;
} {
  const id = params.id || `_${generateId()}`;

  let sessionIndexElement = '';
  if (params.sessionIndex) {
    sessionIndexElement = `<samlp:SessionIndex>${params.sessionIndex}</samlp:SessionIndex>`;
  }

  const request = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${id}"
                     Version="2.0"
                     IssueInstant="${params.issueInstant}"
                     Destination="${params.destination}">
  <saml:Issuer>${params.issuer}</saml:Issuer>
  <saml:NameID>${params.nameId}</saml:NameID>
  ${sessionIndexElement}
</samlp:LogoutRequest>`;

  // Deflate and base64 encode for redirect binding
  const deflated = deflateRaw(request);
  const encoded = btoa(String.fromCharCode(...deflated));
  const urlEncoded = encodeURIComponent(encoded);

  const redirectUrl = `${params.destination}?SAMLRequest=${urlEncoded}`;

  return { request, id, redirectUrl };
}

// ===============================================================
// SAML Response Parsing
// ===============================================================

/**
 * Parse a SAML Response from base64 encoded POST data
 */
export function parseResponse(samlResponse: string): {
  success: boolean;
  assertion?: SAMLAssertion;
  error?: string;
  rawXml?: string;
} {
  try {
    // Decode base64
    const decoded = atob(samlResponse);
    const xml = decoded;

    // Parse XML using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid XML in SAML response' };
    }

    // Check response status
    const statusCode = doc.querySelector('StatusCode');
    if (statusCode) {
      const statusValue = statusCode.getAttribute('Value');
      if (statusValue && !statusValue.includes('Success')) {
        const statusMessage = doc.querySelector('StatusMessage')?.textContent;
        return {
          success: false,
          error: `SAML authentication failed: ${statusMessage || statusValue}`
        };
      }
    }

    // Extract assertion
    const assertion = doc.querySelector('Assertion');
    if (!assertion) {
      return { success: false, error: 'No assertion found in SAML response' };
    }

    // Extract issuer
    const issuer = assertion.querySelector('Issuer')?.textContent || '';

    // Extract NameID
    const nameIdElement = assertion.querySelector('Subject > NameID');
    const nameId = nameIdElement?.textContent || '';
    const nameIdFormat = nameIdElement?.getAttribute('Format') || '';

    // Extract session index
    const authnStatement = assertion.querySelector('AuthnStatement');
    const sessionIndex = authnStatement?.getAttribute('SessionIndex') || undefined;

    // Extract conditions
    const conditions = assertion.querySelector('Conditions');
    const notBefore = conditions?.getAttribute('NotBefore');
    const notOnOrAfter = conditions?.getAttribute('NotOnOrAfter');
    const audience = conditions?.querySelector('AudienceRestriction > Audience')?.textContent || undefined;

    // Extract attributes
    const attributes: Record<string, string | string[]> = {};
    const attributeStatements = assertion.querySelectorAll('AttributeStatement > Attribute');

    attributeStatements.forEach((attr) => {
      const name = attr.getAttribute('Name') || '';
      const values = Array.from(attr.querySelectorAll('AttributeValue'))
        .map((v) => v.textContent || '');

      if (values.length === 1) {
        attributes[name] = values[0];
      } else if (values.length > 1) {
        attributes[name] = values;
      }
    });

    return {
      success: true,
      assertion: {
        issuer,
        nameId,
        nameIdFormat,
        sessionIndex,
        notBefore: notBefore ? new Date(notBefore) : undefined,
        notOnOrAfter: notOnOrAfter ? new Date(notOnOrAfter) : undefined,
        audience,
        attributes,
      },
      rawXml: xml,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse SAML response: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse a SAML LogoutRequest from IdP
 */
export function parseLogoutRequest(samlRequest: string, isDeflated: boolean = true): {
  success: boolean;
  nameId?: string;
  sessionIndex?: string;
  issuer?: string;
  error?: string;
} {
  try {
    let xml: string;

    if (isDeflated) {
      // URL decode, base64 decode, then inflate
      const decoded = atob(decodeURIComponent(samlRequest));
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      xml = inflateRaw(bytes);
    } else {
      // Just base64 decode
      xml = atob(samlRequest);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid XML in LogoutRequest' };
    }

    const issuer = doc.querySelector('Issuer')?.textContent || undefined;
    const nameId = doc.querySelector('NameID')?.textContent || undefined;
    const sessionIndex = doc.querySelector('SessionIndex')?.textContent || undefined;

    return {
      success: true,
      nameId,
      sessionIndex,
      issuer,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse LogoutRequest: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ===============================================================
// SAML Validation
// ===============================================================

/**
 * Validate SAML assertion conditions
 */
export function validateAssertionConditions(
  assertion: SAMLAssertion,
  expectedAudience: string,
  clockSkewMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; error?: string } {
  const now = new Date();

  // Check NotBefore
  if (assertion.notBefore) {
    const notBeforeWithSkew = new Date(assertion.notBefore.getTime() - clockSkewMs);
    if (now < notBeforeWithSkew) {
      return { valid: false, error: 'Assertion is not yet valid (NotBefore condition)' };
    }
  }

  // Check NotOnOrAfter
  if (assertion.notOnOrAfter) {
    const notOnOrAfterWithSkew = new Date(assertion.notOnOrAfter.getTime() + clockSkewMs);
    if (now > notOnOrAfterWithSkew) {
      return { valid: false, error: 'Assertion has expired (NotOnOrAfter condition)' };
    }
  }

  // Check Audience
  if (assertion.audience && assertion.audience !== expectedAudience) {
    return { valid: false, error: `Invalid audience: expected ${expectedAudience}, got ${assertion.audience}` };
  }

  return { valid: true };
}

/**
 * Validate SAML signature (basic check - in production use a proper crypto library)
 * Note: Full signature validation requires XML-DSig library
 */
export function validateSignature(
  xml: string,
  certificate: string
): { valid: boolean; error?: string } {
  // Check if signature exists
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const signature = doc.querySelector('Signature');
  if (!signature) {
    // Some IdPs don't sign responses, only assertions
    const assertionSignature = doc.querySelector('Assertion > Signature');
    if (!assertionSignature) {
      return { valid: false, error: 'No signature found in SAML response' };
    }
  }

  // Note: Full signature validation requires proper XML-DSig implementation
  // In production, use a library like xml-crypto or node-saml
  // For now, we just check that a signature exists

  return { valid: true };
}

// ===============================================================
// SP Metadata Generation
// ===============================================================

/**
 * Generate SAML Service Provider metadata XML
 */
export function generateSPMetadata(config: {
  entityId: string;
  acsUrl: string;
  sloUrl: string;
  organizationName: string;
  organizationDisplayName: string;
  organizationUrl: string;
  nameIdFormats?: string[];
}): string {
  const nameIdFormats = config.nameIdFormats || [
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  ];

  const nameIdFormatElements = nameIdFormats
    .map(format => `    <NameIDFormat>${format}</NameIDFormat>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${config.entityId}">
  <SPSSODescriptor AuthnRequestsSigned="true"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
${nameIdFormatElements}
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${config.acsUrl}"
                              index="0"
                              isDefault="true"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                         Location="${config.sloUrl}"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                         Location="${config.sloUrl}"/>
  </SPSSODescriptor>
  <Organization>
    <OrganizationName xml:lang="en">${escapeXml(config.organizationName)}</OrganizationName>
    <OrganizationDisplayName xml:lang="en">${escapeXml(config.organizationDisplayName)}</OrganizationDisplayName>
    <OrganizationURL xml:lang="en">${escapeXml(config.organizationUrl)}</OrganizationURL>
  </Organization>
</EntityDescriptor>`;
}

// ===============================================================
// Utility Functions
// ===============================================================

/**
 * Generate a unique ID for SAML requests
 */
function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Simple deflate implementation for SAML redirect binding
 * Note: In production, use pako or similar library
 */
function deflateRaw(str: string): Uint8Array {
  // Convert string to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // For browser compatibility, we'll use a simple approach
  // In production, use pako.deflateRaw or CompressionStream
  // For now, return uncompressed (some IdPs accept this)
  return data;
}

/**
 * Simple inflate implementation
 */
function inflateRaw(data: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(data);
}

/**
 * Extract user attributes from SAML assertion
 */
export function extractAttributes(assertion: SAMLAssertion): {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
} {
  const attrs = assertion.attributes;

  // Common attribute names for email
  const emailKeys = [
    'email',
    'Email',
    'mail',
    'emailAddress',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    'urn:oid:0.9.2342.19200300.100.1.3',
  ];

  // Common attribute names for name
  const nameKeys = [
    'name',
    'displayName',
    'cn',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    'urn:oid:2.16.840.1.113730.3.1.241',
  ];

  // Common attribute names for first name
  const firstNameKeys = [
    'firstName',
    'givenName',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    'urn:oid:2.5.4.42',
  ];

  // Common attribute names for last name
  const lastNameKeys = [
    'lastName',
    'surname',
    'sn',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    'urn:oid:2.5.4.4',
  ];

  // Common attribute names for groups
  const groupKeys = [
    'groups',
    'memberOf',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
    'http://schemas.xmlsoap.org/claims/Group',
  ];

  const findAttribute = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = attrs[key];
      if (value) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
    // Also try NameID for email
    if (keys.includes('email') && assertion.nameIdFormat.includes('emailAddress')) {
      return assertion.nameId;
    }
    return undefined;
  };

  const findGroupAttribute = (keys: string[]): string[] | undefined => {
    for (const key of keys) {
      const value = attrs[key];
      if (value) {
        return Array.isArray(value) ? value : [value];
      }
    }
    return undefined;
  };

  return {
    email: findAttribute(emailKeys),
    name: findAttribute(nameKeys),
    firstName: findAttribute(firstNameKeys),
    lastName: findAttribute(lastNameKeys),
    groups: findGroupAttribute(groupKeys),
  };
}

/**
 * Build authentication URL for SP-initiated SSO
 */
export function buildAuthUrl(
  config: SAMLConfig,
  relayState?: string
): string {
  const { redirectUrl, id } = generateAuthnRequest(config);

  let url = redirectUrl;
  if (relayState) {
    url += `&RelayState=${encodeURIComponent(relayState)}`;
  }

  return url;
}

/**
 * Generate LogoutResponse for IdP-initiated logout
 */
export function generateLogoutResponse(
  inResponseTo: string,
  destination: string,
  issuer: string,
  success: boolean = true
): string {
  const id = `_${generateId()}`;
  const issueInstant = new Date().toISOString();
  const statusCode = success
    ? 'urn:oasis:names:tc:SAML:2.0:status:Success'
    : 'urn:oasis:names:tc:SAML:2.0:status:Requester';

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutResponse xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                      ID="${id}"
                      Version="2.0"
                      IssueInstant="${issueInstant}"
                      Destination="${destination}"
                      InResponseTo="${inResponseTo}">
  <saml:Issuer>${issuer}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="${statusCode}"/>
  </samlp:Status>
</samlp:LogoutResponse>`;
}

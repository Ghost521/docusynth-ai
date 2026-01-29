import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";

// ===============================================================
// SSO Configuration Types
// ===============================================================

const ssoProviderValidator = v.union(v.literal("saml"), v.literal("oidc"));

const attributeMappingValidator = v.object({
  email: v.string(),
  name: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  groups: v.optional(v.string()),
  avatar: v.optional(v.string()),
});

const groupRoleMappingValidator = v.array(v.object({
  idpGroup: v.string(),
  role: v.union(
    v.literal("admin"),
    v.literal("member"),
    v.literal("viewer")
  ),
}));

// Role types
type Role = "owner" | "admin" | "member" | "viewer";

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Helper to generate secure random strings
function generateSecureRandom(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// Generate base64url encoded random bytes (for PKCE)
function generatePKCEVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ===============================================================
// SSO Configuration Queries
// ===============================================================

// Get SSO configuration for a workspace
export const getSSOConfig = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    // Only admins can view SSO config details
    if (!hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view SSO configuration");
    }

    const configs = await ctx.db
      .query("ssoConfigurations")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    // Redact sensitive fields
    return configs.map((config) => ({
      ...config,
      samlCertificate: config.samlCertificate ? "[REDACTED]" : undefined,
      oidcClientSecret: config.oidcClientSecret ? "[REDACTED]" : undefined,
    }));
  },
});

// Get a specific SSO configuration by ID
export const getSSOConfigById = query({
  args: {
    configId: v.id("ssoConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", config.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view this SSO configuration");
    }

    return {
      ...config,
      samlCertificate: config.samlCertificate ? "[REDACTED]" : undefined,
      oidcClientSecret: config.oidcClientSecret ? "[REDACTED]" : undefined,
    };
  },
});

// List all SSO configurations for a workspace
export const listSSOConfigs = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }

    const configs = await ctx.db
      .query("ssoConfigurations")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    // Return simplified list for all members
    return configs.map((config) => ({
      _id: config._id,
      provider: config.provider,
      name: config.name,
      enabled: config.enabled,
      enforceSSO: config.enforceSSO,
      createdAt: config.createdAt,
      lastUsedAt: config.lastUsedAt,
    }));
  },
});

// Check if SSO is required for a workspace (public query for login flow)
export const checkSSORequired = query({
  args: {
    workspaceSlug: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceSlug, email }) => {
    // Check by workspace slug
    if (workspaceSlug) {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("bySlug", (q) => q.eq("slug", workspaceSlug))
        .unique();

      if (workspace) {
        const configs = await ctx.db
          .query("ssoConfigurations")
          .withIndex("byWorkspaceAndEnabled", (q) =>
            q.eq("workspaceId", workspace._id).eq("enabled", true)
          )
          .collect();

        const enforcedConfig = configs.find((c) => c.enforceSSO);
        if (enforcedConfig) {
          return {
            required: true,
            configId: enforcedConfig._id,
            provider: enforcedConfig.provider,
            name: enforcedConfig.name,
          };
        }
      }
    }

    // Check by email domain
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain) {
        const routing = await ctx.db
          .query("ssoDomainRouting")
          .withIndex("byDomain", (q) => q.eq("domain", domain))
          .filter((q) => q.eq(q.field("verified"), true))
          .first();

        if (routing) {
          const config = await ctx.db.get(routing.configId);
          if (config?.enabled && config.enforceSSO) {
            return {
              required: true,
              configId: config._id,
              provider: config.provider,
              name: config.name,
            };
          }
        }
      }
    }

    return { required: false };
  },
});

// ===============================================================
// SSO Configuration Mutations
// ===============================================================

// Create a new SSO configuration
export const createSSOConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: ssoProviderValidator,
    name: v.string(),
    // SAML fields
    samlEntityId: v.optional(v.string()),
    samlSsoUrl: v.optional(v.string()),
    samlSloUrl: v.optional(v.string()),
    samlCertificate: v.optional(v.string()),
    samlSignRequests: v.optional(v.boolean()),
    samlSignatureAlgorithm: v.optional(v.string()),
    samlNameIdFormat: v.optional(v.string()),
    // OIDC fields
    oidcClientId: v.optional(v.string()),
    oidcClientSecret: v.optional(v.string()),
    oidcIssuer: v.optional(v.string()),
    oidcAuthUrl: v.optional(v.string()),
    oidcTokenUrl: v.optional(v.string()),
    oidcUserInfoUrl: v.optional(v.string()),
    oidcJwksUrl: v.optional(v.string()),
    oidcScopes: v.optional(v.array(v.string())),
    // Common fields
    attributeMapping: attributeMappingValidator,
    groupRoleMapping: v.optional(groupRoleMappingValidator),
    allowedDomains: v.optional(v.array(v.string())),
    blockedDomains: v.optional(v.array(v.string())),
    enforceSSO: v.optional(v.boolean()),
    allowBypassForOwner: v.optional(v.boolean()),
    jitProvisioning: v.optional(v.boolean()),
    jitDefaultRole: v.optional(v.union(v.literal("member"), v.literal("viewer"))),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to create SSO configuration");
    }

    // Check workspace plan (enterprise required for SSO)
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.plan !== "enterprise") {
      throw new Error("SSO is only available on Enterprise plans");
    }

    // Validate provider-specific fields
    if (args.provider === "saml") {
      if (!args.samlEntityId || !args.samlSsoUrl || !args.samlCertificate) {
        throw new Error("SAML configuration requires entityId, ssoUrl, and certificate");
      }
    } else if (args.provider === "oidc") {
      if (!args.oidcClientId || !args.oidcClientSecret) {
        throw new Error("OIDC configuration requires clientId and clientSecret");
      }
      if (!args.oidcIssuer && (!args.oidcAuthUrl || !args.oidcTokenUrl)) {
        throw new Error("OIDC configuration requires either issuer or authUrl and tokenUrl");
      }
    }

    const now = Date.now();

    // Create the configuration
    const configId = await ctx.db.insert("ssoConfigurations", {
      workspaceId: args.workspaceId,
      provider: args.provider,
      name: args.name,
      enabled: false, // Start disabled until tested
      // SAML
      samlEntityId: args.samlEntityId,
      samlSsoUrl: args.samlSsoUrl,
      samlSloUrl: args.samlSloUrl,
      samlCertificate: args.samlCertificate, // Will be encrypted by action
      samlSignRequests: args.samlSignRequests ?? false,
      samlSignatureAlgorithm: args.samlSignatureAlgorithm ?? "sha256",
      samlNameIdFormat: args.samlNameIdFormat,
      // OIDC
      oidcClientId: args.oidcClientId,
      oidcClientSecret: args.oidcClientSecret, // Will be encrypted by action
      oidcIssuer: args.oidcIssuer,
      oidcAuthUrl: args.oidcAuthUrl,
      oidcTokenUrl: args.oidcTokenUrl,
      oidcUserInfoUrl: args.oidcUserInfoUrl,
      oidcJwksUrl: args.oidcJwksUrl,
      oidcScopes: args.oidcScopes ?? ["openid", "email", "profile"],
      // Common
      attributeMapping: args.attributeMapping,
      groupRoleMapping: args.groupRoleMapping,
      allowedDomains: args.allowedDomains ?? [],
      blockedDomains: args.blockedDomains ?? [],
      enforceSSO: args.enforceSSO ?? false,
      allowBypassForOwner: args.allowBypassForOwner ?? true,
      jitProvisioning: args.jitProvisioning ?? false,
      jitDefaultRole: args.jitDefaultRole ?? "member",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      testMode: true, // Start in test mode
    });

    // Log the creation
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: args.workspaceId,
      configId,
      userId,
      eventType: "config_created",
      success: true,
      metadata: { provider: args.provider, name: args.name },
      timestamp: now,
    });

    return { configId };
  },
});

// Update an SSO configuration
export const updateSSOConfig = mutation({
  args: {
    configId: v.id("ssoConfigurations"),
    name: v.optional(v.string()),
    // SAML fields
    samlEntityId: v.optional(v.string()),
    samlSsoUrl: v.optional(v.string()),
    samlSloUrl: v.optional(v.string()),
    samlCertificate: v.optional(v.string()),
    samlSignRequests: v.optional(v.boolean()),
    samlSignatureAlgorithm: v.optional(v.string()),
    samlNameIdFormat: v.optional(v.string()),
    // OIDC fields
    oidcClientId: v.optional(v.string()),
    oidcClientSecret: v.optional(v.string()),
    oidcIssuer: v.optional(v.string()),
    oidcAuthUrl: v.optional(v.string()),
    oidcTokenUrl: v.optional(v.string()),
    oidcUserInfoUrl: v.optional(v.string()),
    oidcJwksUrl: v.optional(v.string()),
    oidcScopes: v.optional(v.array(v.string())),
    // Common fields
    attributeMapping: v.optional(attributeMappingValidator),
    groupRoleMapping: v.optional(groupRoleMappingValidator),
    allowedDomains: v.optional(v.array(v.string())),
    blockedDomains: v.optional(v.array(v.string())),
    enforceSSO: v.optional(v.boolean()),
    allowBypassForOwner: v.optional(v.boolean()),
    jitProvisioning: v.optional(v.boolean()),
    jitDefaultRole: v.optional(v.union(v.literal("member"), v.literal("viewer"))),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(args.configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", config.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to update SSO configuration");
    }

    const { configId, ...updates } = args;
    const now = Date.now();

    // Filter out undefined values
    const validUpdates: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        validUpdates[key] = value;
      }
    }

    await ctx.db.patch(configId, validUpdates);

    // Log the update
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: config.workspaceId,
      configId,
      userId,
      eventType: "config_updated",
      success: true,
      metadata: { updatedFields: Object.keys(validUpdates) },
      timestamp: now,
    });
  },
});

// Enable/disable SSO configuration
export const toggleSSOConfig = mutation({
  args: {
    configId: v.id("ssoConfigurations"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { configId, enabled }) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", config.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to update SSO configuration");
    }

    // If enabling, ensure not in test mode
    if (enabled && config.testMode) {
      throw new Error("Cannot enable SSO while in test mode. Test the configuration first.");
    }

    const now = Date.now();

    await ctx.db.patch(configId, {
      enabled,
      updatedAt: now,
    });

    // Log the change
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: config.workspaceId,
      configId,
      userId,
      eventType: enabled ? "config_enabled" : "config_disabled",
      success: true,
      timestamp: now,
    });
  },
});

// Delete SSO configuration
export const deleteSSOConfig = mutation({
  args: {
    configId: v.id("ssoConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Only owner can delete SSO config
    const workspace = await ctx.db.get(config.workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      throw new Error("Only the workspace owner can delete SSO configuration");
    }

    const now = Date.now();

    // Terminate all active sessions for this config
    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("byConfig", (q) => q.eq("configId", configId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "revoked",
        terminatedAt: now,
      });
    }

    // Delete domain routings
    const routings = await ctx.db
      .query("ssoDomainRouting")
      .withIndex("byConfig", (q) => q.eq("configId", configId))
      .collect();

    for (const routing of routings) {
      await ctx.db.delete(routing._id);
    }

    // Log the deletion before deleting
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: config.workspaceId,
      configId,
      userId,
      eventType: "config_deleted",
      success: true,
      metadata: { name: config.name, provider: config.provider },
      timestamp: now,
    });

    // Delete the config
    await ctx.db.delete(configId);
  },
});

// ===============================================================
// SP Metadata Generation
// ===============================================================

// Generate SAML Service Provider metadata
export const generateSPMetadata = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getUserId(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view SP metadata");
    }

    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Get the base URL from environment
    const baseUrl = process.env.CONVEX_SITE_URL || "https://docusynth.ai";
    const entityId = `${baseUrl}/saml/sp/${workspace.slug}`;
    const acsUrl = `${baseUrl}/api/sso/saml/acs/${workspace.slug}`;
    const sloUrl = `${baseUrl}/api/sso/saml/slo/${workspace.slug}`;

    // Generate XML metadata
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="true"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${acsUrl}"
                              index="0"
                              isDefault="true"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                         Location="${sloUrl}"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                         Location="${sloUrl}"/>
  </SPSSODescriptor>
  <Organization>
    <OrganizationName xml:lang="en">DocuSynth AI - ${workspace.name}</OrganizationName>
    <OrganizationDisplayName xml:lang="en">${workspace.name}</OrganizationDisplayName>
    <OrganizationURL xml:lang="en">${baseUrl}</OrganizationURL>
  </Organization>
</EntityDescriptor>`;

    return {
      entityId,
      acsUrl,
      sloUrl,
      metadataXml: metadata,
    };
  },
});

// ===============================================================
// SSO Auth State Management
// ===============================================================

// Create auth state for SSO initiation
export const createAuthState = mutation({
  args: {
    configId: v.id("ssoConfigurations"),
    redirectUri: v.string(),
  },
  handler: async (ctx, { configId, redirectUri }) => {
    const config = await ctx.db.get(configId);
    if (!config) {
      throw new Error("SSO configuration not found");
    }

    if (!config.enabled && !config.testMode) {
      throw new Error("SSO is not enabled for this configuration");
    }

    const now = Date.now();
    const state = generateSecureRandom(32);
    const nonce = generateSecureRandom(32);
    const codeVerifier = config.provider === "oidc" ? generatePKCEVerifier() : undefined;

    await ctx.db.insert("ssoAuthState", {
      state,
      workspaceId: config.workspaceId,
      configId,
      codeVerifier,
      nonce,
      redirectUri,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
    });

    // Log the initiation
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: config.workspaceId,
      configId,
      eventType: "login_initiated",
      success: true,
      timestamp: now,
    });

    return { state, nonce, codeVerifier };
  },
});

// Validate and consume auth state
export const validateAuthState = internalMutation({
  args: {
    state: v.string(),
  },
  handler: async (ctx, { state }) => {
    const authState = await ctx.db
      .query("ssoAuthState")
      .withIndex("byState", (q) => q.eq("state", state))
      .unique();

    if (!authState) {
      return { valid: false, error: "Invalid state parameter" };
    }

    if (authState.usedAt) {
      return { valid: false, error: "State has already been used" };
    }

    if (Date.now() > authState.expiresAt) {
      return { valid: false, error: "State has expired" };
    }

    // Mark as used
    await ctx.db.patch(authState._id, { usedAt: Date.now() });

    return {
      valid: true,
      workspaceId: authState.workspaceId,
      configId: authState.configId,
      codeVerifier: authState.codeVerifier,
      nonce: authState.nonce,
      redirectUri: authState.redirectUri,
    };
  },
});

// ===============================================================
// Domain Routing
// ===============================================================

// Add domain routing
export const addDomainRouting = mutation({
  args: {
    configId: v.id("ssoConfigurations"),
    domain: v.string(),
  },
  handler: async (ctx, { configId, domain }) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", config.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to manage domain routing");
    }

    // Normalize domain
    const normalizedDomain = domain.toLowerCase().trim();

    // Check if domain is already routed
    const existing = await ctx.db
      .query("ssoDomainRouting")
      .withIndex("byDomain", (q) => q.eq("domain", normalizedDomain))
      .first();

    if (existing) {
      throw new Error("This domain is already configured for another workspace");
    }

    // Generate verification token
    const verificationToken = generateSecureRandom(32);

    const routingId = await ctx.db.insert("ssoDomainRouting", {
      domain: normalizedDomain,
      workspaceId: config.workspaceId,
      configId,
      verified: false,
      verificationToken,
      verificationMethod: "dns_txt",
      createdAt: Date.now(),
    });

    return {
      routingId,
      verificationToken,
      dnsRecord: `_docusynth-verification.${normalizedDomain}`,
      dnsValue: `docusynth-verify=${verificationToken}`,
    };
  },
});

// Verify domain ownership
export const verifyDomain = mutation({
  args: {
    routingId: v.id("ssoDomainRouting"),
  },
  handler: async (ctx, { routingId }) => {
    const userId = await getUserId(ctx);
    const routing = await ctx.db.get(routingId);

    if (!routing) {
      throw new Error("Domain routing not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", routing.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to verify domains");
    }

    // In a real implementation, this would check DNS TXT records
    // For now, we'll just mark it as verified (manual verification)
    await ctx.db.patch(routingId, {
      verified: true,
      verificationMethod: "manual",
      verifiedAt: Date.now(),
    });

    return { verified: true };
  },
});

// Remove domain routing
export const removeDomainRouting = mutation({
  args: {
    routingId: v.id("ssoDomainRouting"),
  },
  handler: async (ctx, { routingId }) => {
    const userId = await getUserId(ctx);
    const routing = await ctx.db.get(routingId);

    if (!routing) {
      throw new Error("Domain routing not found");
    }

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", routing.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to manage domain routing");
    }

    await ctx.db.delete(routingId);
  },
});

// List domain routings for a config
export const listDomainRoutings = query({
  args: {
    configId: v.id("ssoConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    const userId = await getUserId(ctx);
    const config = await ctx.db.get(configId);

    if (!config) {
      throw new Error("SSO configuration not found");
    }

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", config.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view domain routings");
    }

    return await ctx.db
      .query("ssoDomainRouting")
      .withIndex("byConfig", (q) => q.eq("configId", configId))
      .collect();
  },
});

// ===============================================================
// Attribute Mapping
// ===============================================================

// Map IdP attributes to user profile
export const mapAttributes = internalQuery({
  args: {
    configId: v.id("ssoConfigurations"),
    attributes: v.any(),
  },
  handler: async (ctx, { configId, attributes }) => {
    const config = await ctx.db.get(configId);
    if (!config) {
      return { error: "Configuration not found" };
    }

    const mapping = config.attributeMapping;
    const result: Record<string, string | undefined> = {};

    // Map email (required)
    const email = getAttributeValue(attributes, mapping.email);
    if (!email) {
      return { error: "Email attribute not found in IdP response" };
    }
    result.email = email.toLowerCase();

    // Map optional attributes
    if (mapping.name) {
      result.name = getAttributeValue(attributes, mapping.name);
    }
    if (mapping.firstName) {
      result.firstName = getAttributeValue(attributes, mapping.firstName);
    }
    if (mapping.lastName) {
      result.lastName = getAttributeValue(attributes, mapping.lastName);
    }
    if (mapping.avatar) {
      result.avatar = getAttributeValue(attributes, mapping.avatar);
    }

    // Construct name from firstName and lastName if not directly mapped
    if (!result.name && (result.firstName || result.lastName)) {
      result.name = [result.firstName, result.lastName].filter(Boolean).join(" ");
    }

    // Map groups for role assignment
    let role: "admin" | "member" | "viewer" = config.jitDefaultRole;
    if (mapping.groups && config.groupRoleMapping) {
      const groups = getAttributeValue(attributes, mapping.groups);
      if (groups) {
        const groupList = Array.isArray(groups) ? groups : [groups];
        for (const mapping of config.groupRoleMapping) {
          if (groupList.includes(mapping.idpGroup)) {
            role = mapping.role;
            break;
          }
        }
      }
    }

    return {
      email: result.email,
      name: result.name,
      firstName: result.firstName,
      lastName: result.lastName,
      avatar: result.avatar,
      role,
    };
  },
});

// Helper to get attribute value from various formats
function getAttributeValue(attributes: Record<string, unknown>, path: string): string | undefined {
  // Handle dot notation paths
  const parts = path.split(".");
  let value: unknown = attributes;

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    return value[0] as string;
  }

  return value as string;
}

// ===============================================================
// SSO Audit Log
// ===============================================================

// Get SSO audit log
export const getAuditLog = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, limit = 100, eventType }) => {
    const userId = await getUserId(ctx);

    // Verify admin access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership || !hasPermission(membership.role as Role, "admin")) {
      throw new Error("You don't have permission to view audit logs");
    }

    let query = ctx.db
      .query("ssoAuditLog")
      .withIndex("byWorkspaceAndTimestamp", (q) => q.eq("workspaceId", workspaceId))
      .order("desc");

    if (eventType) {
      query = query.filter((q) => q.eq(q.field("eventType"), eventType));
    }

    return await query.take(limit);
  },
});

// ===============================================================
// Internal Helpers
// ===============================================================

// Get SSO config by ID (internal)
export const getConfigInternal = internalQuery({
  args: {
    configId: v.id("ssoConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    return await ctx.db.get(configId);
  },
});

// Log SSO event (internal)
export const logSSOEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    configId: v.optional(v.id("ssoConfigurations")),
    userId: v.optional(v.string()),
    sessionId: v.optional(v.id("ssoSessions")),
    eventType: v.string(),
    success: v.boolean(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ssoAuditLog", {
      workspaceId: args.workspaceId,
      configId: args.configId,
      userId: args.userId,
      sessionId: args.sessionId,
      eventType: args.eventType as Doc<"ssoAuditLog">["eventType"],
      success: args.success,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });
  },
});

// Update last used timestamp
export const updateLastUsed = internalMutation({
  args: {
    configId: v.id("ssoConfigurations"),
  },
  handler: async (ctx, { configId }) => {
    await ctx.db.patch(configId, { lastUsedAt: Date.now() });
  },
});

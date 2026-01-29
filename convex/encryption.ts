"use node";

import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Get the master encryption key from environment
// In production, this should be a securely stored secret
function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // If no key is set, use a derived key from a stable identifier
    // This is less secure but allows the system to function
    // In production, always set ENCRYPTION_KEY
    console.warn(
      "ENCRYPTION_KEY not set. Using derived key. Set ENCRYPTION_KEY for production."
    );
    const fallbackKey = process.env.CONVEX_SITE_URL || "docusynth-default-key";
    return crypto.scryptSync(fallbackKey, "docusynth-salt", KEY_LENGTH);
  }

  // If the key is a hex string, decode it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // Otherwise, derive a key from the provided secret
  return crypto.scryptSync(key, "docusynth-salt", KEY_LENGTH);
}

// Encrypt a plaintext string
function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  // Format: iv (32 hex chars) + authTag (32 hex chars) + encrypted
  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

// Decrypt an encrypted string
function decrypt(encryptedData: string): string {
  const key = getMasterKey();

  // Extract IV, AuthTag, and encrypted data
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), "hex");
  const authTag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Check if a string is encrypted (has the right format)
function isEncrypted(value: string): boolean {
  // Encrypted values should be at least IV + AuthTag in hex (64 chars)
  // and should be all hex characters
  return value.length >= 64 && /^[0-9a-fA-F]+$/.test(value);
}

// Internal action to encrypt and store a secret
export const storeSecret = internalAction({
  args: {
    userId: v.string(),
    secretType: v.union(
      v.literal("githubToken"),
      v.literal("claudeApiKey"),
      v.literal("openAiApiKey")
    ),
    value: v.string(),
  },
  handler: async (ctx, { userId, secretType, value }) => {
    // Encrypt the value if it's not empty
    const encryptedValue = value ? encrypt(value) : "";

    // Store the encrypted value using the mutation
    await ctx.runMutation(internal.encryptionQueries.storeSecretInternal, {
      userId,
      secretType,
      encryptedValue,
    });
  },
});

// Internal action to retrieve and decrypt a secret
export const getSecret = internalAction({
  args: {
    userId: v.string(),
    secretType: v.union(
      v.literal("githubToken"),
      v.literal("claudeApiKey"),
      v.literal("openAiApiKey")
    ),
  },
  handler: async (ctx, { userId, secretType }) => {
    const settings = await ctx.runQuery(internal.encryptionQueries.getUserSettingsRaw, { userId });

    if (!settings) return null;

    const encryptedValue = settings[secretType];
    if (!encryptedValue) return null;

    try {
      // Check if the value is encrypted
      if (isEncrypted(encryptedValue)) {
        return decrypt(encryptedValue);
      }
      // If not encrypted (legacy data), return as-is
      // This handles migration from plaintext storage
      return encryptedValue;
    } catch (error) {
      console.error(`Failed to decrypt ${secretType}:`, error);
      // If decryption fails, the data might be corrupted or the key changed
      return null;
    }
  },
});

// Get all secrets for a user (decrypted)
export const getAllSecrets = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const settings = await ctx.runQuery(internal.encryptionQueries.getUserSettingsRaw, { userId });

    if (!settings) {
      return {
        githubToken: null,
        claudeApiKey: null,
        openAiApiKey: null,
      };
    }

    const decryptIfNeeded = (value: string | undefined): string | null => {
      if (!value) return null;
      try {
        if (isEncrypted(value)) {
          return decrypt(value);
        }
        return value;
      } catch {
        return null;
      }
    };

    return {
      githubToken: decryptIfNeeded(settings.githubToken),
      claudeApiKey: decryptIfNeeded(settings.claudeApiKey),
      openAiApiKey: decryptIfNeeded(settings.openAiApiKey),
    };
  },
});

// Migrate existing plaintext secrets to encrypted format
export const migrateSecrets = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const settings = await ctx.runQuery(internal.encryptionQueries.getUserSettingsRaw, { userId });

    if (!settings) return { migrated: false };

    const updates: { githubToken?: string; claudeApiKey?: string; openAiApiKey?: string } = {};
    let migrated = false;

    const maybeEncrypt = (
      key: "githubToken" | "claudeApiKey" | "openAiApiKey"
    ) => {
      const value = settings[key];
      if (value && !isEncrypted(value)) {
        updates[key] = encrypt(value);
        migrated = true;
      }
    };

    maybeEncrypt("githubToken");
    maybeEncrypt("claudeApiKey");
    maybeEncrypt("openAiApiKey");

    if (migrated) {
      await ctx.runMutation(internal.encryptionQueries.updateSecretsInternal, {
        settingsId: settings._id,
        updates,
      });
    }

    return { migrated };
  },
});

// Verify a secret matches an expected value (for validation)
export const verifySecret = internalAction({
  args: {
    userId: v.string(),
    secretType: v.union(
      v.literal("githubToken"),
      v.literal("claudeApiKey"),
      v.literal("openAiApiKey")
    ),
    expectedValue: v.string(),
  },
  handler: async (ctx, { userId, secretType, expectedValue }) => {
    const settings = await ctx.runQuery(internal.encryptionQueries.getUserSettingsRaw, { userId });

    if (!settings) return false;

    const encryptedValue = settings[secretType];
    if (!encryptedValue) return false;

    try {
      let decrypted: string;
      if (isEncrypted(encryptedValue)) {
        decrypted = decrypt(encryptedValue);
      } else {
        decrypted = encryptedValue;
      }
      return decrypted === expectedValue;
    } catch {
      return false;
    }
  },
});

// Get API key for a specific provider (with decryption)
export const getApiKey = internalAction({
  args: {
    userId: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("claude"), v.literal("openai")),
  },
  handler: async (ctx, { userId, provider }) => {
    const settings = await ctx.runQuery(internal.encryptionQueries.getUserSettingsRaw, { userId });

    // For Gemini, always use environment variable
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      return key || null;
    }

    if (!settings) {
      // Fall back to environment variables
      if (provider === "claude") {
        return process.env.CLAUDE_API_KEY || null;
      }
      if (provider === "openai") {
        return process.env.OPENAI_API_KEY || null;
      }
      return null;
    }

    const secretType = provider === "claude" ? "claudeApiKey" : "openAiApiKey";
    const encryptedValue = settings[secretType];

    if (!encryptedValue) {
      // Fall back to environment variables
      if (provider === "claude") {
        return process.env.CLAUDE_API_KEY || null;
      }
      if (provider === "openai") {
        return process.env.OPENAI_API_KEY || null;
      }
      return null;
    }

    try {
      if (isEncrypted(encryptedValue)) {
        return decrypt(encryptedValue);
      }
      return encryptedValue;
    } catch {
      // Fall back to environment variables on decryption failure
      if (provider === "claude") {
        return process.env.CLAUDE_API_KEY || null;
      }
      if (provider === "openai") {
        return process.env.OPENAI_API_KEY || null;
      }
      return null;
    }
  },
});

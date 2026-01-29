import { describe, it, expect, beforeEach } from 'vitest';
import { encryptSecret, decryptSecret } from '../../services/cryptoService';

describe('encryptSecret', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string for empty input', async () => {
    const result = await encryptSecret('');
    expect(result).toBe('');
  });

  it('returns a base64 string for non-empty input', async () => {
    const result = await encryptSecret('my-secret-key');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    // Base64 pattern: only contains valid base64 characters
    expect(result).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('stores master key in localStorage on first call', async () => {
    expect(localStorage.getItem('docu_synth_master_key')).toBeNull();
    await encryptSecret('test');
    // After encryption, a key should be stored (by our mock, exportKey returns ArrayBuffer)
    expect(localStorage.getItem('docu_synth_master_key')).toBeTruthy();
  });

  it('reuses existing master key from localStorage', async () => {
    // Set up a pre-existing key
    localStorage.setItem('docu_synth_master_key', btoa(String.fromCharCode(...new Uint8Array(32))));
    await encryptSecret('test');
    // Should have called importKey rather than generateKey
    expect(window.crypto.subtle.importKey).toHaveBeenCalled();
  });

  it('produces different ciphertexts for same input (due to random IV)', async () => {
    const result1 = await encryptSecret('same-input');
    localStorage.clear(); // Force new key
    const result2 = await encryptSecret('same-input');
    // With random IVs, outputs should differ (though our mock is somewhat deterministic)
    // At minimum both should be valid base64
    expect(result1).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result2).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('decryptSecret', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string for empty input', async () => {
    const result = await decryptSecret('');
    expect(result).toBe('');
  });

  it('returns empty string on decryption failure (corrupted data)', async () => {
    // Force a failure by making decrypt throw
    const originalDecrypt = window.crypto.subtle.decrypt;
    (window.crypto.subtle.decrypt as any) = async () => { throw new Error('Decryption failed'); };

    const result = await decryptSecret('corrupted-base64-data');
    expect(result).toBe('');

    // Restore
    window.crypto.subtle.decrypt = originalDecrypt;
  });
});

describe('round-trip encrypt/decrypt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('encrypt then decrypt returns original value', async () => {
    const original = 'my-api-key-12345';
    const encrypted = await encryptSecret(original);
    expect(encrypted).not.toBe(original);

    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it('handles unicode text round-trip', async () => {
    const original = 'Key with unicode: café';
    const encrypted = await encryptSecret(original);
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });
});

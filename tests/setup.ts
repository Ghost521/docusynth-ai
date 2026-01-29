import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, afterAll, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});
afterAll(() => server.close());

// localStorage in-memory mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Web Crypto API mock
const cryptoMock = {
  subtle: {
    generateKey: vi.fn(async () => ({ type: 'secret', algorithm: { name: 'AES-GCM' } })),
    importKey: vi.fn(async () => ({ type: 'secret', algorithm: { name: 'AES-GCM' } })),
    exportKey: vi.fn(async () => new ArrayBuffer(32)),
    encrypt: vi.fn(async (_algo: any, _key: any, data: ArrayBuffer) => {
      // Return input data prefixed with a fake 16-byte tag for realistic output
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length + 16);
      output.set(input);
      return output.buffer;
    }),
    decrypt: vi.fn(async (_algo: any, _key: any, data: ArrayBuffer) => {
      // Strip the fake 16-byte tag added during encrypt
      const input = new Uint8Array(data);
      return input.slice(0, input.length - 16).buffer;
    }),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};
Object.defineProperty(window, 'crypto', { value: cryptoMock });

// navigator.clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(async () => {}),
    readText: vi.fn(async () => ''),
  },
  writable: true,
});

// Mock window.btoa/atob for jsdom
if (typeof window.btoa === 'undefined') {
  window.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof window.atob === 'undefined') {
  window.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

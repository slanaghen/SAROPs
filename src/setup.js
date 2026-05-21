import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Centralized setup for jest-dom matchers
expect.extend(matchers);

// Fix for TypeError: RequestInit: Expected signal to be an instance of AbortSignal.
// Node/undici and JSDOM may provide different AbortController/AbortSignal
// implementations (different realms), causing strict instanceof checks to fail.
// Ensure the runtime uses the same constructors on both `window` and `globalThis`.
if (typeof window !== 'undefined') {
  if (typeof globalThis.AbortController !== 'undefined') {
    window.AbortController = globalThis.AbortController;
  }
  if (typeof globalThis.AbortSignal !== 'undefined') {
    window.AbortSignal = globalThis.AbortSignal;
  }
}

// Wrap the global Request constructor to coerce signals coming from a different
// realm into a `globalThis.AbortSignal` instance accepted by undici.
if (typeof globalThis.Request !== 'undefined' && typeof globalThis.AbortController !== 'undefined') {
  const NativeRequest = globalThis.Request;
  // Test whether the native Request accepts an AbortSignal from this realm.
  let nativeAcceptsSignal = true;
  try {
    new NativeRequest('about:blank', { signal: new globalThis.AbortController().signal });
  } catch (e) {
    nativeAcceptsSignal = false;
  }

  if (!nativeAcceptsSignal) {
    // Lightweight Request shim used only for tests to avoid undici's strict
    // instance checks. This stores the fields react-router expects and is
    // sufficient for client-side navigation usage in tests.
    globalThis.Request = class {
      constructor(input, init = {}) {
        this.url = typeof input === 'string' ? input : input?.url;
        this.method = init.method || 'GET';
        this.headers = init.headers || {};
        this.body = init.body;
        this.signal = init.signal;
      }
      clone() {
        return new globalThis.Request(this.url, { method: this.method, headers: this.headers, body: this.body, signal: this.signal });
      }
    };
  }
}

// Global mock for Google Maps loader to prevent resolution errors and JSDOM crashes
vi.mock('@googlemaps/js-api-loader', () => {
  const mockMapInstance = {
    addListener: vi.fn(),
    setOptions: vi.fn(),
  };
  const MockMap = vi.fn(() => mockMapInstance);
  const mockLoaderInstance = {
    importLibrary: vi.fn((lib) => {
      if (lib === 'maps') {
        if (typeof window !== 'undefined') {
          window.google = {
            maps: {
              event: { addListenerOnce: vi.fn() },
              ControlPosition: { TOP_LEFT: 1 }
            }
          };
        }
        return Promise.resolve({ Map: MockMap });
      }
      return Promise.resolve({});
    }),
    setOptions: vi.fn(),
  };
  const MockLoader = vi.fn(() => mockLoaderInstance);
  return { Loader: MockLoader };
});
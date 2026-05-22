import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { AbortController as NodeAbortController, AbortSignal as NodeAbortSignal } from 'node:events';

// Centralized setup for jest-dom matchers
expect.extend(matchers);

if (typeof window !== 'undefined') {
  // Overwrite JSDOM globals with Node.js native constructors to resolve realm mismatches.
  // This prevents "AbortController is not a constructor" and 
  // "Expected signal to be an instance of AbortSignal" errors during React Router 7 navigation.
  Object.defineProperty(window, 'AbortController', {
    writable: true,
    configurable: true,
    value: NodeAbortController,
  });
  Object.defineProperty(window, 'AbortSignal', {
    writable: true,
    configurable: true,
    value: NodeAbortSignal,
  });

  globalThis.AbortController = NodeAbortController;
  globalThis.AbortSignal = NodeAbortSignal;
}

/**
 * Global helper for Vitest to create consistent Supabase Query Mocks
 */
globalThis.createSupabaseQueryMock = (data, error = null) => {
  let isSingle = false;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    match: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(() => { isSingle = true; return query; }),
    maybeSingle: vi.fn(() => { isSingle = true; return query; }),
    then: vi.fn((onFulfilled) => {
      let resultData = data;
      if (isSingle && Array.isArray(data)) resultData = data[0];
      else if (!isSingle && !Array.isArray(data) && data !== null && typeof data === 'object') resultData = [data];
      return Promise.resolve({ data: resultData, error }).then(onFulfilled);
    }),
  };
  return query;
};

// Global mock for Google Maps loader to prevent resolution errors and JSDOM crashes
vi.mock('@googlemaps/js-api-loader', () => {
  const mockMapInstance = {
    addListener: vi.fn(),
    setOptions: vi.fn(),
  };
  const MockMap = vi.fn(() => mockMapInstance);
  const mockLoaderInstance = {
    importLibrary: vi.fn((lib) => (lib === 'maps' ? Promise.resolve({ Map: MockMap }) : Promise.resolve({}))),
    setOptions: vi.fn(),
  };
  const MockLoader = vi.fn(() => mockLoaderInstance);
  return { Loader: MockLoader };
});
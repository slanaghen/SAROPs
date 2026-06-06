import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Centralized setup for jest-dom matchers
expect.extend(matchers);

// Fix for "AbortController is not a constructor" errors in Vitest + JSDOM.
// React Router 7 and Supabase require native implementations. We ensure that 
// if we are in a JSDOM environment, the window object uses the native Node.js 
// constructors from globalThis to avoid realm mismatches and instance checks failing.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'AbortController', {
    writable: true,
    configurable: true,
    value: globalThis.AbortController,
  });
  Object.defineProperty(window, 'AbortSignal', {
    writable: true,
    configurable: true,
    value: globalThis.AbortSignal,
  });
  Object.defineProperty(window, 'Event', {
    writable: true,
    configurable: true,
    value: globalThis.Event,
  });
  Object.defineProperty(window, 'MessageEvent', {
    writable: true,
    configurable: true,
    value: globalThis.MessageEvent,
  });
  Object.defineProperty(window, 'CloseEvent', {
    writable: true,
    configurable: true,
    value: globalThis.CloseEvent,
  });
  Object.defineProperty(window, 'ErrorEvent', {
    writable: true,
    configurable: true,
    value: globalThis.ErrorEvent,
  });
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
    neq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    or: vi.fn(() => query),
    gt: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    insert: vi.fn(() => query),
    upsert: vi.fn(() => query),
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

  // Define the global window.google object for tests to satisfy component expectations
  const googleMock = {
    maps: {
      Map: MockMap,
      ControlPosition: { TOP_LEFT: 1, TOP_CENTER: 2, TOP_RIGHT: 3, LEFT_CENTER: 4, LEFT_TOP: 5, LEFT_BOTTOM: 6, RIGHT_TOP: 7, RIGHT_CENTER: 8, RIGHT_BOTTOM: 9, BOTTOM_LEFT: 10, BOTTOM_CENTER: 11, BOTTOM_RIGHT: 12 },
      event: { addListenerOnce: vi.fn(), trigger: vi.fn() }
    }
  };
  globalThis.google = googleMock;
  if (typeof window !== 'undefined') window.google = googleMock;

  return { Loader: MockLoader };
});
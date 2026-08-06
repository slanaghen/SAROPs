import { vi } from 'vitest';

/**
 * Creates a comprehensive, chainable mock for the Supabase query builder.
 * This allows for testing complex queries that chain methods like .select(), .eq(), .in(), etc.
 */
global.createSupabaseQueryMock = (data, error = null) => {
  const mock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    // Mock terminal methods that execute the query
    maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
    // Default promise resolution for non-specific chains
    then: (onFulfilled) => {
      return Promise.resolve({ data, error }).then(onFulfilled);
    }
  };
  return mock;
};
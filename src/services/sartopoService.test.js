import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSartopoConfig, downloadAndSyncSartopoData, createSartopoMap } from './sartopoService';

describe('SARTopo Service', () => {
  const mockSupabase = {
    from: vi.fn(), // Will be implemented in tests
    functions: { invoke: vi.fn() }, // Mock Supabase functions for the proxy
  };

  const mockTrackers = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
  };

  // Helper to create a more robust mock for the Supabase fluent query API
  const createSupabaseQueryMock = (data, error = null) => {
    const mock = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
      then: (cb) => Promise.resolve({ data, error }).then(cb),
      // Integrate trackers and ensure chainability
      update: vi.fn(function(...args) {
        mockTrackers.update(...args);
        return this;
      }),
      upsert: vi.fn(function(...args) {
        mockTrackers.upsert(...args);
        return this;
      }),
      insert: vi.fn(function(...args) {
        mockTrackers.insert(...args);
        return this;
      }),
    };
    // Make chainable methods return the mock itself
    mock.select.mockReturnThis();
    mock.eq.mockReturnThis();
    return mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockTrackers).forEach(tracker => tracker.mockClear());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getSartopoConfig', () => {
    it('should parse a raw ID', () => {
      const { id, query } = getSartopoConfig('9ABC');
      expect(id).toBe('9ABC');
      expect(query).toBe('');
    });

    it('should parse a full URL and extract the ID', () => {
      const { id } = getSartopoConfig('https://sartopo.com/m/9ABC');
      expect(id).toBe('9ABC');
    });

    it('should parse a URL with query parameters and strip security keys', () => {
      const { id, query, params } = getSartopoConfig('https://sartopo.com/m/9ABC?k=123&foo=bar&readCode=456');
      expect(id).toBe('9ABC');
      expect(query).toBe('?foo=bar');
      expect(params.has('k')).toBe(false);
      expect(params.has('readCode')).toBe(false);
      expect(params.get('foo')).toBe('bar');
    });

    it('should handle null or empty input', () => {
      const { id, query } = getSartopoConfig(null);
      expect(id).toBeNull();
      expect(query).toBe('');
    });
  });

  describe('downloadAndSyncSartopoData', () => {
    it('should invoke the proxy and sync current SARTopo data without caching map data', async () => {
      const sartopoConfig = { id: 'MAP123', params: new URLSearchParams(), query: '' };
      
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') {
          return createSupabaseQueryMock([{ sartopo_id: 'f1', title: 'Old Title' }]);
        }
        if (table === 'action_logs') {
          return createSupabaseQueryMock(null);
        }
        return createSupabaseQueryMock(null);
      });

      const newSartopoFeatures = [
        { id: 'f1', properties: { class: 'Assignment', title: 'Updated Title' } }, // Update
        { id: 'f2', properties: { class: 'Assignment', name: 'New Assignment' } }, // Create
      ];
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValue({
        data: { result: { state: { features: newSartopoFeatures } } },
        error: null,
      });

      const result = await downloadAndSyncSartopoData({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        sartopoConfig,
      });

      // 1. Verify invoke was called correctly
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', {
        body: expect.objectContaining({
          method: 'GET',
          path: '/api/v1/map/MAP123/since/0',
        }),
      });

      // 2. Verify assignments were upserted
      const upsertPayload = mockTrackers.upsert.mock.calls[0][0];
      expect(upsertPayload.length).toBe(2);
      expect(upsertPayload.find(p => p.sartopo_id === 'f1').title).toBe('Updated Title');
      expect(upsertPayload.find(p => p.sartopo_id === 'f2').title).toBe('New Assignment');
      expect(mockTrackers.upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'op_period_id,sartopo_id' });

      // 3. Verify action log was created
      expect(mockTrackers.insert).toHaveBeenCalledWith(expect.objectContaining({
        action: expect.stringContaining('Synced 2 assignments from SARTopo'),
      }));

      // 4. Verify result object and no map data was stored in incidents.
      expect(result.syncCount).toBe(2);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('incidents');
    });

    it('should throw an error if the proxy invocation fails', async () => {
      const sartopoConfig = { id: 'MAP123', params: new URLSearchParams(), query: '' };
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Proxy function crashed' },
      });

      await expect(downloadAndSyncSartopoData({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        sartopoConfig,
      })).rejects.toThrow('Edge Function Error: Proxy function crashed');
    });
  });

  describe('createSartopoMap', () => {
    it('should call the proxy with the correct parameters for map creation', async () => {
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValue({ data: { id: 'new-map' }, error: null });
      await createSartopoMap(mockSupabase, 'New Test Map', {});

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', expect.objectContaining({
        body: expect.objectContaining({ method: 'POST', path: '/api/v1/acct/collaborative-map' })
      }));
    });
  });
});

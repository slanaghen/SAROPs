import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSartopoConfig, downloadAndSyncSartopoData } from './sartopoService';
import * as sartopoAuth from '../utils/sartopoAuth';

// Mock the crypto-dependent function
vi.mock('../utils/sartopoAuth', () => ({
  signSartopoRequest: vi.fn().mockResolvedValue('signed_string'),
}));

describe('SARTopo Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_ID', 'test_id');
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_SECRET', 'test_secret');
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
    it('should fetch, merge, and sync SARTopo data', async () => {
      const sartopoConfig = { id: 'MAP123', params: new URLSearchParams(), query: '' };
      
      // Mock existing data in the database
      const existingDbData = {
        result: {
          state: {
            features: [{ id: 'f1', properties: { title: 'Old Title' } }],
          },
        },
      };
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'incidents') {
          return { ...mockSupabase, maybeSingle: vi.fn().mockResolvedValue({ data: { sartopo_map_data: existingDbData }, error: null }) };
        }
        if (table === 'assignments') {
          const mockEq = vi.fn().mockResolvedValue({ data: [{ sartopo_id: 'f1', title: 'Old Title' }], error: null });
          const mockSelect = vi.fn(() => ({ eq: mockEq }));
          return { select: mockSelect };
        }
        return mockSupabase;
      });
      mockSupabase.upsert.mockResolvedValue({ error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });

      // Mock the fetch response from SARTopo
      const newSartopoFeatures = [
        { id: 'f1', properties: { class: 'Assignment', title: 'Updated Title' } }, // Update
        { id: 'f2', properties: { class: 'Assignment', name: 'New Assignment' } }, // Create
      ];
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: { state: { features: newSartopoFeatures } } }),
      });

      const result = await downloadAndSyncSartopoData({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        sartopoConfig,
      });

      // 1. Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/map/MAP123/since/0'));

      // 2. Verify incident data was updated with merged features
      const updateCall = vi.mocked(mockSupabase.update).mock.calls[0][0];
      const mergedFeatures = updateCall.sartopo_map_data.features;
      expect(mergedFeatures.length).toBe(2);
      expect(mergedFeatures.find(f => f.id === 'f1').properties.title).toBe('Updated Title');
      expect(mergedFeatures.find(f => f.id === 'f2').properties.name).toBe('New Assignment');

      // 3. Verify assignments were upserted
      const upsertPayload = vi.mocked(mockSupabase.upsert).mock.calls[0][0];
      expect(upsertPayload.length).toBe(2);
      expect(upsertPayload.find(p => p.sartopo_id === 'f1').title).toBe('Updated Title');
      expect(upsertPayload.find(p => p.sartopo_id === 'f2').title).toBe('New Assignment');
      expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'op_period_id,sartopo_id' });

      // 4. Verify action log was created
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        action: expect.stringContaining('Synced 2 assignments from SARTopo'),
      }));

      // 5. Verify result object
      expect(result.syncCount).toBe(2);
    });

    it('should throw an error if fetch is not ok', async () => {
      const sartopoConfig = { id: 'MAP123', params: new URLSearchParams(), query: '' };
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Map not found',
      });

      await expect(downloadAndSyncSartopoData({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        sartopoConfig,
      })).rejects.toThrow('SARTopo returned 404: Not Found');
    });
  });
});
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { syncOfflineClues } from './offlineClueSync';
import * as offlineDB from '../utils/offlineClueDB';
import { OfflineClue } from '../utils/offlineClueDB';

// Mock the entire offlineClueDB module
vi.mock('../utils/offlineClueDB');

describe('offlineClueSync Service', () => {
  const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn(),
  };

  const mockUnsyncedClues: OfflineClue[] = [
    { clue_id: 'c1', incident_id: 'inc-1', description: 'Clue 1', latitude: 0, longitude: 0, timestamp: '', synced: false, photo_url: '', discovered_by_team_id: null, discovered_by_responder_id: null },
    { clue_id: 'c2', incident_id: 'inc-1', description: 'Clue 2', latitude: 0, longitude: 0, timestamp: '', synced: false, photo_url: '', discovered_by_team_id: null, discovered_by_responder_id: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch unsynced clues, upsert them, and mark them as synced', async () => {
    vi.mocked(offlineDB.getUnsyncedCluesOffline).mockResolvedValue(mockUnsyncedClues);
    vi.mocked(mockSupabase.upsert).mockResolvedValue({ error: null });
    vi.mocked(offlineDB.markClueAsSynced).mockResolvedValue(undefined);

    const onProgress = vi.fn();
    const result = await syncOfflineClues(mockSupabase, onProgress);

    expect(offlineDB.getUnsyncedCluesOffline).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('clues');
    expect(mockSupabase.upsert).toHaveBeenCalledTimes(2);
    expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.objectContaining({ clue_id: 'c1' }), expect.any(Object));
    expect(offlineDB.markClueAsSynced).toHaveBeenCalledTimes(2);
    expect(offlineDB.markClueAsSynced).toHaveBeenCalledWith('c1');
    expect(offlineDB.markClueAsSynced).toHaveBeenCalledWith('c2');

    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ total: 2, completed: 2, successful: 2, inProgress: false }));
  });

  it('should handle sync errors and mark clues with an error message', async () => {
    const dbError = new Error('Conflict');
    vi.mocked(offlineDB.getUnsyncedCluesOffline).mockResolvedValue(mockUnsyncedClues);
    // Fail the first upsert, succeed on the second
    vi.mocked(mockSupabase.upsert)
      .mockResolvedValueOnce({ error: dbError })
      .mockResolvedValueOnce({ error: null });
    
    const result = await syncOfflineClues(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toEqual({ clueId: 'c1', error: 'Conflict' });

    expect(offlineDB.markClueWithSyncError).toHaveBeenCalledWith('c1', 'Conflict');
    expect(offlineDB.markClueAsSynced).toHaveBeenCalledWith('c2');
  });
});
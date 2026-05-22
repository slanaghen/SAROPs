import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useOfflineClues } from './useOfflineClues';
import * as db from '../utils/offlineClueDB';

vi.mock('../utils/offlineClueDB', () => ({
  getCluesByIncidentOffline: vi.fn(),
  getUnsyncedCluesOffline: vi.fn().mockResolvedValue([]),
  getOfflineCreatedCluesOffline: vi.fn().mockResolvedValue([]),
  saveClueOffline: vi.fn(),
}));

describe('useOfflineClues Hook', () => {
  const incidentId = 'inc-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getCluesByIncidentOffline).mockResolvedValue([]);
  });

  it('loads clues for the current incident on mount', async () => {
    const mockClues = [{ clue_id: 'c1', incident_id: incidentId, description: 'Test Clue' }];
    vi.mocked(db.getCluesByIncidentOffline).mockResolvedValue(mockClues as any);

    const { result } = renderHook(() => useOfflineClues(incidentId));

    expect(result.current.loading).toBe(true);
    
    await act(async () => {
      // Wait for useEffect
    });

    expect(result.current.clues).toEqual(mockClues);
    expect(result.current.loading).toBe(false);
  });

  it('updates local state immediately when a new clue is created', async () => {
    const newClue: any = { clue_id: 'c2', incident_id: incidentId, description: 'New' };
    vi.mocked(db.saveClueOffline).mockResolvedValue(newClue);

    const { result } = renderHook(() => useOfflineClues(incidentId));

    // Wait for the initial mount-triggered load to complete to prevent
    // it from overwriting state updates made by the creation process.
    await act(async () => {});

    await act(async () => {
      await result.current.createClue(newClue);
    });

    expect(result.current.clues).toContainEqual(newClue);
    expect(result.current.unsyncedCount).toBe(1);
    expect(db.saveClueOffline).toHaveBeenCalledWith(newClue);
  });
});
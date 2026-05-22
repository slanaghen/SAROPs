import { useEffect, useState, useCallback } from 'react';
import { Clue } from '../types/sarops-types';
import {
  saveClueOffline,
  updateClueOffline,
  deleteClueOffline,
  getClueOffline,
  getCluesByIncidentOffline,
  getUnsyncedCluesOffline,
  getOfflineCreatedCluesOffline,
  markClueAsSynced,
  markClueWithSyncError,
  getCluesSyncLog,
  clearAllOfflineClues,
  exportOfflineCluesAsJSON,
  getOfflineStorageStats,
  OfflineClue,
  SyncLogEntry,
} from '../utils/offlineClueDB';

export interface UseOfflineCluesReturn {
  // Data
  clues: OfflineClue[];
  unsyncedCount: number;
  offlineCreatedCount: number;
  isOnline: boolean;
  loading: boolean;
  error: string | null;

  // Operations
  createClue: (clue: Clue) => Promise<OfflineClue>;
  updateClue: (clue: OfflineClue) => Promise<OfflineClue>;
  deleteClue: (clueId: string) => Promise<void>;
  getClue: (clueId: string) => Promise<OfflineClue | null>;
  getCluesByIncident: (incidentId: string) => Promise<OfflineClue[]>;
  getUnsyncedClues: () => Promise<OfflineClue[]>;
  getOfflineCreatedClues: (incidentId?: string) => Promise<OfflineClue[]>;
  markSynced: (clueId: string) => Promise<void>;
  markSyncError: (clueId: string, error: string) => Promise<void>;
  getSyncLog: (clueId?: string) => Promise<SyncLogEntry[]>;
  
  // Utilities
  clearAllClues: () => Promise<void>;
  exportAsJSON: () => Promise<string>;
  getStorageStats: () => Promise<any>;
}

/**
 * useOfflineClues Hook
 * 
 * Provides a convenient interface for managing offline clues in React components
 * Tracks online/offline status and provides common operations
 */
export const useOfflineClues = (
  incidentId?: string
): UseOfflineCluesReturn => {
  const [clues, setClues] = useState<OfflineClue[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [offlineCreatedCount, setOfflineCreatedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load clues for the incident
  const loadClues = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (incidentId) {
        const loadedClues = await getCluesByIncidentOffline(incidentId);
        setClues(loadedClues);
      }

      // Update counts
      const unsynced = await getUnsyncedCluesOffline();
      setUnsyncedCount(unsynced.length);

      const offlineCreated = await getOfflineCreatedCluesOffline(incidentId);
      setOfflineCreatedCount(offlineCreated.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load clues';
      setError(message);
      console.error('Error loading clues:', err);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  // Load clues on mount and when incident changes
  useEffect(() => {
    loadClues();
  }, [loadClues]);

  // Create a new clue
  const createClue = useCallback(
    async (clue: Clue): Promise<OfflineClue> => {
      setError(null);

      try {
        const savedClue = await saveClueOffline(clue);
        
        // Update local state if it's for the current incident
        if (!incidentId || clue.incident_id === incidentId) {
          setClues(prev => [savedClue, ...prev]);
          setOfflineCreatedCount(prev => prev + 1);
          setUnsyncedCount(prev => prev + 1);
        }

        return savedClue;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create clue';
        setError(message);
        throw err;
      }
    },
    [incidentId]
  );

  // Update a clue
  const updateClue = useCallback(
    async (clue: OfflineClue): Promise<OfflineClue> => {
      setError(null);

      try {
        const updatedClue = await updateClueOffline(clue);

        // Update local state
        setClues(prev =>
          prev.map(c => (c.clue_id === clue.clue_id ? updatedClue : c))
        );
        setUnsyncedCount(prev => prev + 1);

        return updatedClue;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update clue';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Delete a clue
  const deleteClue = useCallback(
    async (clueId: string): Promise<void> => {
      setError(null);

      try {
        await deleteClueOffline(clueId);

        // Update local state
        setClues(prev => prev.filter(c => c.clue_id !== clueId));
        setOfflineCreatedCount(prev => {
          const clue = clues.find(c => c.clue_id === clueId);
          return clue?.created_offline_at ? prev - 1 : prev;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete clue';
        setError(message);
        throw err;
      }
    },
    [clues]
  );

  // Get a single clue
  const getClue = useCallback(async (clueId: string): Promise<OfflineClue | null> => {
    setError(null);

    try {
      return await getClueOffline(clueId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get clue';
      setError(message);
      throw err;
    }
  }, []);

  // Get clues by incident
  const getCluesByIncident = useCallback(
    async (incidentId: string): Promise<OfflineClue[]> => {
      setError(null);

      try {
        return await getCluesByIncidentOffline(incidentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get clues';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Get unsynced clues
  const getUnsyncedClues = useCallback(async (): Promise<OfflineClue[]> => {
    setError(null);

    try {
      return await getUnsyncedCluesOffline();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get unsynced clues';
      setError(message);
      throw err;
    }
  }, []);

  // Get offline created clues
  const getOfflineCreatedClues = useCallback(
    async (incidentId?: string): Promise<OfflineClue[]> => {
      setError(null);

      try {
        return await getOfflineCreatedCluesOffline(incidentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get offline clues';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Mark clue as synced
  const markSynced = useCallback(async (clueId: string): Promise<void> => {
    setError(null);

    try {
      await markClueAsSynced(clueId);

      // Update local state
      setClues(prev =>
        prev.map(c =>
          c.clue_id === clueId ? { ...c, synced: true } : c
        )
      );

      // Update count
      const unsynced = await getUnsyncedCluesOffline();
      setUnsyncedCount(unsynced.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark synced';
      setError(message);
      throw err;
    }
  }, []);

  // Mark clue with sync error
  const markSyncError = useCallback(
    async (clueId: string, syncError: string): Promise<void> => {
      setError(null);

      try {
        await markClueWithSyncError(clueId, syncError);

        // Update local state
        setClues(prev =>
          prev.map(c =>
            c.clue_id === clueId
              ? { ...c, sync_error: syncError, last_sync_attempt: new Date().toISOString() }
              : c
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark error';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Get sync log
  const getSyncLog = useCallback(
    async (clueId?: string): Promise<SyncLogEntry[]> => {
      setError(null);

      try {
        return await getCluesSyncLog(clueId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get sync log';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Clear all clues
  const clearAllClues = useCallback(async (): Promise<void> => {
    setError(null);

    try {
      await clearAllOfflineClues();
      setClues([]);
      setUnsyncedCount(0);
      setOfflineCreatedCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear clues';
      setError(message);
      throw err;
    }
  }, []);

  // Export as JSON
  const exportAsJSON = useCallback(async (): Promise<string> => {
    setError(null);

    try {
      return await exportOfflineCluesAsJSON();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export';
      setError(message);
      throw err;
    }
  }, []);

  // Get storage stats
  const getStorageStats = useCallback(async (): Promise<any> => {
    setError(null);

    try {
      return await getOfflineStorageStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get stats';
      setError(message);
      throw err;
    }
  }, []);

  return {
    clues,
    unsyncedCount,
    offlineCreatedCount,
    isOnline,
    loading,
    error,
    createClue,
    updateClue,
    deleteClue,
    getClue,
    getCluesByIncident,
    getUnsyncedClues,
    getOfflineCreatedClues,
    markSynced,
    markSyncError,
    getSyncLog,
    clearAllClues,
    exportAsJSON,
    getStorageStats,
  };
};

export default useOfflineClues;

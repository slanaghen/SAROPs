import { SupabaseClient } from '@supabase/supabase-js';
import { Clue } from '../types/sarops-types';
import {
  getUnsyncedCluesOffline,
  markClueAsSynced,
  markClueWithSyncError,
  OfflineClue,
} from './offlineClueDB';

/**
 * Sync service for offline clues
 * 
 * Handles:
 * - Syncing offline clues to Supabase when online
 * - Conflict resolution
 * - Error handling and retry logic
 * - Progress tracking
 */

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  successful: number;
  inProgress: boolean;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{
    clueId: string;
    error: string;
  }>;
}

/**
 * Sync all offline clues to Supabase
 */
export const syncOffllineClues = async (
  supabaseClient: SupabaseClient,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> => {
  const result: SyncResult = {
    success: false,
    synced: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Get all unsynced clues
    const unsyncedClues = await getUnsyncedCluesOffline();
    const total = unsyncedClues.length;

    if (total === 0) {
      result.success = true;
      return result;
    }

    // Update progress
    onProgress?.({
      total,
      completed: 0,
      failed: 0,
      successful: 0,
      inProgress: true,
    });

    // Process each clue
    for (let i = 0; i < unsyncedClues.length; i++) {
      const offlineClue = unsyncedClues[i];

      try {
        // Remove offline-only fields before sending to Supabase
        const clueToSync = createClueForSync(offlineClue);

        // Insert or update in Supabase
        const { data, error } = await supabaseClient
          .from('clues')
          .upsert(clueToSync, { onConflict: 'clue_id' });

        if (error) {
          throw error;
        }

        // Mark as synced
        await markClueAsSynced(offlineClue.clue_id);
        result.synced++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        // Mark with sync error
        await markClueWithSyncError(offlineClue.clue_id, errorMessage);
        
        result.failed++;
        result.errors.push({
          clueId: offlineClue.clue_id,
          error: errorMessage,
        });
      }

      // Update progress
      const completed = i + 1;
      onProgress?.({
        total,
        completed,
        failed: result.failed,
        successful: result.synced,
        inProgress: true,
      });
    }

    result.success = result.failed === 0;
  } catch (err) {
    console.error('Sync error:', err);
    result.success = false;
  }

  // Final progress update
  onProgress?.({
    total: result.synced + result.failed,
    completed: result.synced + result.failed,
    failed: result.failed,
    successful: result.synced,
    inProgress: false,
  });

  return result;
};

/**
 * Transform offline clue to match Supabase schema
 * Removes offline-only fields
 */
const createClueForSync = (offlineClue: OfflineClue): Clue => {
  const { synced, sync_error, created_offline_at, last_sync_attempt, ...clue } = offlineClue;
  return clue as Clue;
};

/**
 * Setup automatic sync when online
 * Listens for online event and syncs offline clues
 */
export const setupAutoSync = (
  supabaseClient: SupabaseClient,
  onSync?: (result: SyncResult) => void
): (() => void) => {
  const handleOnline = async () => {
    console.log('Back online, syncing offline clues...');
    
    try {
      const result = await syncOffllineClues(supabaseClient);
      
      if (result.synced > 0) {
        console.log(`Successfully synced ${result.synced} clues`);
      }
      
      if (result.failed > 0) {
        console.warn(`Failed to sync ${result.failed} clues`, result.errors);
      }

      onSync?.(result);
    } catch (err) {
      console.error('Error during auto-sync:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * Sync a single clue to Supabase
 */
export const syncSingleClue = async (
  supabaseClient: SupabaseClient,
  offlineClue: OfflineClue
): Promise<boolean> => {
  try {
    const clueToSync = createClueForSync(offlineClue);

    const { error } = await supabaseClient
      .from('clues')
      .upsert(clueToSync, { onConflict: 'clue_id' });

    if (error) {
      throw error;
    }

    // Mark as synced
    await markClueAsSynced(offlineClue.clue_id);
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await markClueWithSyncError(offlineClue.clue_id, errorMessage);
    return false;
  }
};

/**
 * Retry syncing a failed clue
 */
export const retrySyncClue = async (
  supabaseClient: SupabaseClient,
  clueId: string,
  offlineClue: OfflineClue
): Promise<boolean> => {
  return syncSingleClue(supabaseClient, offlineClue);
};

/**
 * Get sync readiness status
 */
export const getSyncReadiness = async (): Promise<{
  isOnline: boolean;
  unsyncedCount: number;
  readyToSync: boolean;
}> => {
  const unsyncedClues = await getUnsyncedCluesOffline();
  
  return {
    isOnline: navigator.onLine,
    unsyncedCount: unsyncedClues.length,
    readyToSync: navigator.onLine && unsyncedClues.length > 0,
  };
};

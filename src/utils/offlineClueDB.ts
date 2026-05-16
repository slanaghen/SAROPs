import { Clue } from '../types/sarops-types';

/**
 * IndexedDB utilities for offline Clue storage in SAROps
 * 
 * Provides functions to:
 * - Initialize IndexedDB database
 * - Save clues offline
 * - Query clues from local storage
 * - Track sync status
 * - Bulk sync to Supabase when online
 */

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const DB_NAME = 'SAROps_DB';
const DB_VERSION = 1;
const CLUES_STORE = 'clues';
const SYNC_LOG_STORE = 'sync_log';

export interface OfflineClue extends Clue {
  // Additional fields for offline tracking
  synced?: boolean;
  sync_error?: string;
  created_offline_at?: string;
  last_sync_attempt?: string;
}

export interface SyncLogEntry {
  id?: number;
  clue_id: string;
  action: 'create' | 'update' | 'delete';
  synced: boolean;
  sync_error?: string;
  created_at: string;
  synced_at?: string;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

/**
 * Initialize IndexedDB database for SAROps offline storage
 * Creates object stores if they don't exist
 */
export const initializeOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create clues object store with incident_id index for querying
      if (!db.objectStoreNames.contains(CLUES_STORE)) {
        const cluesStore = db.createObjectStore(CLUES_STORE, {
          keyPath: 'clue_id',
        });
        
        // Index by incident_id for efficient querying
        cluesStore.createIndex('incident_id', 'incident_id', { unique: false });
        
        // Index by synced status for bulk sync operations
        cluesStore.createIndex('synced', 'synced', { unique: false });
        
        // Index by timestamp for ordering
        cluesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create sync log store for tracking changes
      if (!db.objectStoreNames.contains(SYNC_LOG_STORE)) {
        const syncStore = db.createObjectStore(SYNC_LOG_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        
        syncStore.createIndex('clue_id', 'clue_id', { unique: false });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
};

// ============================================================================
// CLUE OPERATIONS
// ============================================================================

/**
 * Save a new clue to IndexedDB
 * Used when creating a clue offline
 */
export const saveClueOffline = async (clue: Clue): Promise<OfflineClue> => {
  const db = await initializeOfflineDB();

  const offlineClue: OfflineClue = {
    ...clue,
    synced: false,
    created_offline_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    // Save the clue
    const clueRequest = cluesStore.add(offlineClue);

    clueRequest.onerror = () => {
      reject(new Error(`Failed to save clue: ${clueRequest.error}`));
    };

    clueRequest.onsuccess = () => {
      // Log the sync action
      const syncEntry: SyncLogEntry = {
        clue_id: clue.clue_id,
        action: 'create',
        synced: false,
        created_at: new Date().toISOString(),
      };

      const syncRequest = syncStore.add(syncEntry);

      syncRequest.onerror = () => {
        reject(new Error(`Failed to log sync entry: ${syncRequest.error}`));
      };

      syncRequest.onsuccess = () => {
        resolve(offlineClue);
      };
    };
  });
};

/**
 * Update an existing clue in IndexedDB
 */
export const updateClueOffline = async (clue: OfflineClue): Promise<OfflineClue> => {
  const db = await initializeOfflineDB();

  const updatedClue: OfflineClue = {
    ...clue,
    synced: false, // Mark as needing sync after update
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    // Update the clue
    const clueRequest = cluesStore.put(updatedClue);

    clueRequest.onerror = () => {
      reject(new Error(`Failed to update clue: ${clueRequest.error}`));
    };

    clueRequest.onsuccess = () => {
      // Log the update action
      const syncEntry: SyncLogEntry = {
        clue_id: clue.clue_id,
        action: 'update',
        synced: false,
        created_at: new Date().toISOString(),
      };

      const syncRequest = syncStore.add(syncEntry);

      syncRequest.onerror = () => {
        reject(new Error(`Failed to log sync entry: ${syncRequest.error}`));
      };

      syncRequest.onsuccess = () => {
        resolve(updatedClue);
      };
    };
  });
};

/**
 * Delete a clue from IndexedDB
 */
export const deleteClueOffline = async (clueId: string): Promise<void> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    // Delete the clue
    const clueRequest = cluesStore.delete(clueId);

    clueRequest.onerror = () => {
      reject(new Error(`Failed to delete clue: ${clueRequest.error}`));
    };

    clueRequest.onsuccess = () => {
      // Log the delete action
      const syncEntry: SyncLogEntry = {
        clue_id: clueId,
        action: 'delete',
        synced: false,
        created_at: new Date().toISOString(),
      };

      const syncRequest = syncStore.add(syncEntry);

      syncRequest.onerror = () => {
        reject(new Error(`Failed to log sync entry: ${syncRequest.error}`));
      };

      syncRequest.onsuccess = () => {
        resolve();
      };
    };
  });
};

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get a single clue by ID
 */
export const getClueOffline = async (clueId: string): Promise<OfflineClue | null> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);

    const request = cluesStore.get(clueId);

    request.onerror = () => {
      reject(new Error(`Failed to get clue: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
};

/**
 * Get all clues for a specific incident
 */
export const getCluesByIncidentOffline = async (
  incidentId: string
): Promise<OfflineClue[]> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const index = cluesStore.index('incident_id');

    const request = index.getAll(incidentId);

    request.onerror = () => {
      reject(new Error(`Failed to get clues by incident: ${request.error}`));
    };

    request.onsuccess = () => {
      // Sort by timestamp (newest first)
      const clues = request.result as OfflineClue[];
      clues.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      resolve(clues);
    };
  });
};

/**
 * Get all unsynced clues (for offline-first sync when online)
 */
export const getUnsyncedCluesOffline = async (): Promise<OfflineClue[]> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const index = cluesStore.index('synced');

    const request = index.getAll(false);

    request.onerror = () => {
      reject(new Error(`Failed to get unsynced clues: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result as OfflineClue[]);
    };
  });
};

/**
 * Get all clues created offline (for reference/audit)
 */
export const getOfflineCreatedCluesOffline = async (
  incidentId?: string
): Promise<OfflineClue[]> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);

    const request = cluesStore.getAll();

    request.onerror = () => {
      reject(new Error(`Failed to get offline clues: ${request.error}`));
    };

    request.onsuccess = () => {
      let clues = (request.result as OfflineClue[]).filter(
        (c) => c.created_offline_at !== undefined
      );

      if (incidentId) {
        clues = clues.filter((c) => c.incident_id === incidentId);
      }

      resolve(clues);
    };
  });
};

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Mark a clue as synced
 */
export const markClueAsSynced = async (clueId: string): Promise<void> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    // Get the clue first
    const getRequest = cluesStore.get(clueId);

    getRequest.onerror = () => {
      reject(new Error(`Failed to get clue: ${getRequest.error}`));
    };

    getRequest.onsuccess = () => {
      const clue = getRequest.result as OfflineClue;

      if (!clue) {
        reject(new Error(`Clue not found: ${clueId}`));
        return;
      }

      // Update synced status
      clue.synced = true;

      const updateRequest = cluesStore.put(clue);

      updateRequest.onerror = () => {
        reject(new Error(`Failed to update clue sync status: ${updateRequest.error}`));
      };

      updateRequest.onsuccess = () => {
        // Update sync log
        const syncIndex = syncStore.index('clue_id');
        const logRequest = syncIndex.getAll(clueId);

        logRequest.onerror = () => {
          reject(new Error(`Failed to get sync log: ${logRequest.error}`));
        };

        logRequest.onsuccess = () => {
          const logs = logRequest.result as SyncLogEntry[];
          
          if (logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            latestLog.synced = true;
            latestLog.synced_at = new Date().toISOString();

            const logUpdateRequest = syncStore.put(latestLog);

            logUpdateRequest.onerror = () => {
              reject(
                new Error(`Failed to update sync log: ${logUpdateRequest.error}`)
              );
            };

            logUpdateRequest.onsuccess = () => {
              resolve();
            };
          } else {
            resolve();
          }
        };
      };
    };
  });
};

/**
 * Mark a clue with a sync error
 */
export const markClueWithSyncError = async (
  clueId: string,
  error: string
): Promise<void> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    // Get the clue
    const getRequest = cluesStore.get(clueId);

    getRequest.onerror = () => {
      reject(new Error(`Failed to get clue: ${getRequest.error}`));
    };

    getRequest.onsuccess = () => {
      const clue = getRequest.result as OfflineClue;

      if (!clue) {
        reject(new Error(`Clue not found: ${clueId}`));
        return;
      }

      // Update error status
      clue.sync_error = error;
      clue.last_sync_attempt = new Date().toISOString();

      const updateRequest = cluesStore.put(clue);

      updateRequest.onerror = () => {
        reject(new Error(`Failed to update clue error: ${updateRequest.error}`));
      };

      updateRequest.onsuccess = () => {
        // Log the error
        const syncEntry: SyncLogEntry = {
          clue_id: clueId,
          action: 'update',
          synced: false,
          sync_error: error,
          created_at: new Date().toISOString(),
        };

        const syncRequest = syncStore.add(syncEntry);

        syncRequest.onerror = () => {
          reject(new Error(`Failed to log sync error: ${syncRequest.error}`));
        };

        syncRequest.onsuccess = () => {
          resolve();
        };
      };
    };
  });
};

/**
 * Get sync log for a clue
 */
export const getCluesSyncLog = async (clueId?: string): Promise<SyncLogEntry[]> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_LOG_STORE], 'readonly');
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    let request;

    if (clueId) {
      const index = syncStore.index('clue_id');
      request = index.getAll(clueId);
    } else {
      request = syncStore.getAll();
    }

    request.onerror = () => {
      reject(new Error(`Failed to get sync log: ${request.error}`));
    };

    request.onsuccess = () => {
      const logs = request.result as SyncLogEntry[];
      // Sort by created_at (newest first)
      logs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      resolve(logs);
    };
  });
};

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Clear all offline clue data
 * WARNING: This deletes all locally stored clues
 */
export const clearAllOfflineClues = async (): Promise<void> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readwrite');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    const clueRequest = cluesStore.clear();
    const syncRequest = syncStore.clear();

    clueRequest.onerror = () => {
      reject(new Error(`Failed to clear clues: ${clueRequest.error}`));
    };

    syncRequest.onerror = () => {
      reject(new Error(`Failed to clear sync log: ${syncRequest.error}`));
    };

    syncRequest.onsuccess = () => {
      resolve();
    };
  });
};

/**
 * Export offline clues as JSON (for backup/debugging)
 */
export const exportOfflineCluesAsJSON = async (): Promise<string> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);

    const request = cluesStore.getAll();

    request.onerror = () => {
      reject(new Error(`Failed to export clues: ${request.error}`));
    };

    request.onsuccess = () => {
      const clues = request.result as OfflineClue[];
      resolve(JSON.stringify(clues, null, 2));
    };
  });
};

/**
 * Get offline storage statistics
 */
export const getOfflineStorageStats = async (): Promise<{
  totalClues: number;
  unsyncedClues: number;
  offlineCreatedClues: number;
  syncLogEntries: number;
}> => {
  const db = await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLUES_STORE, SYNC_LOG_STORE], 'readonly');
    const cluesStore = transaction.objectStore(CLUES_STORE);
    const syncStore = transaction.objectStore(SYNC_LOG_STORE);

    const clueRequest = cluesStore.count();
    const unsyncedRequest = cluesStore.index('synced').count(false);
    const syncLogRequest = syncStore.count();

    let completedRequests = 0;
    const results: any = {};

    const checkComplete = () => {
      completedRequests++;
      if (completedRequests === 4) {
        resolve({
          totalClues: results.total,
          unsyncedClues: results.unsynced,
          offlineCreatedClues: results.offlineCreated,
          syncLogEntries: results.syncLog,
        });
      }
    };

    clueRequest.onerror = () => reject(new Error('Failed to count clues'));
    clueRequest.onsuccess = () => {
      results.total = clueRequest.result;
      checkComplete();
    };

    unsyncedRequest.onerror = () =>
      reject(new Error('Failed to count unsynced clues'));
    unsyncedRequest.onsuccess = () => {
      results.unsynced = unsyncedRequest.result;
      checkComplete();
    };

    syncLogRequest.onerror = () => reject(new Error('Failed to count sync log'));
    syncLogRequest.onsuccess = () => {
      results.syncLog = syncLogRequest.result;
      checkComplete();
    };

    // Count offline created clues
    const allCluesRequest = cluesStore.getAll();
    allCluesRequest.onerror = () => reject(new Error('Failed to get all clues'));
    allCluesRequest.onsuccess = () => {
      const clues = allCluesRequest.result as OfflineClue[];
      results.offlineCreated = clues.filter(
        (c) => c.created_offline_at !== undefined
      ).length;
      checkComplete();
    };
  });
};

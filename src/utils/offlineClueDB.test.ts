import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initializeOfflineDB,
  saveClueOffline,
  getClueOffline,
  getCluesByIncidentOffline,
  markClueAsSynced,
  clearAllOfflineClues,
  OfflineClue,
} from './offlineClueDB';

// ============================================================================
// MOCK INDEXEDDB
// ============================================================================

// In-memory store for IndexedDB simulation
const mockStores: Map<string, Map<string, any>> = new Map();
const mockIndexes: Map<string, Map<string, Map<any, any[]>>> = new Map(); // storeName -> indexName -> indexValue -> [items]
let syncLogAutoIncrement = 1;

// Helper to create a mock IDBRequest
const createMockRequest = (result: any, error: any = null) => {
  const request: any = {
    result,
    error,
    onerror: null,
    onsuccess: null,
  };

  // Simulate async behavior for request completion
  Promise.resolve().then(() => {
    if (error && request.onerror) {
      request.onerror(new Event('error'));
    } else if (request.onsuccess) {
      request.onsuccess(new Event('success'));
    }
  });

  return request;
};

// Mock IDBObjectStore
const createMockObjectStore = (storeName: string, keyPath: string) => {
  const store = mockStores.get(storeName) || new Map<string, any>();
  mockStores.set(storeName, store);

  const storeIndexes = mockIndexes.get(storeName) || new Map<string, Map<any, any[]>>();
  mockIndexes.set(storeName, storeIndexes);

  const mockObjectStore: any = {
    add: vi.fn((value) => {
      let key = value[keyPath];
      // Simulate autoIncrement for sync_log store
      if (storeName === 'sync_log' && key === undefined) {
        key = syncLogAutoIncrement++;
        value.id = key; // Assign the key back to the object
      }
      if (store.has(key)) {
        return createMockRequest(null, new Error('Key already exists'));
      }
      store.set(key, value);
      // Update indexes
      storeIndexes.forEach((indexMap, indexName) => {
        const indexValue = value[indexName];
        if (indexValue !== undefined) {
          if (!indexMap.has(indexValue)) {
            indexMap.set(indexValue, []);
          }
          indexMap.get(indexValue)!.push(value);
        }
      });
      return createMockRequest(key);
    }),
    put: vi.fn((value) => {
      const key = value[keyPath];
      const oldValue = store.get(key);
      store.set(key, value);
      // Update indexes (remove old, add new)
      storeIndexes.forEach((indexMap, indexName) => {
        // Remove old value from index
        if (oldValue) {
          const oldIndexValue = oldValue[indexName];
          if (oldIndexValue !== undefined && indexMap.has(oldIndexValue)) {
            indexMap.set(oldIndexValue, indexMap.get(oldIndexValue)!.filter((item: any) => item[keyPath] !== key));
            if (indexMap.get(oldIndexValue)!.length === 0) {
              indexMap.delete(oldIndexValue);
            }
          }
        }
        // Add new value to index
        const newIndexValue = value[indexName];
        if (newIndexValue !== undefined) {
          if (!indexMap.has(newIndexValue)) {
            indexMap.set(newIndexValue, []);
          }
          indexMap.get(newIndexValue)!.push(value);
        }
      });
      return createMockRequest(key);
    }),
    get: vi.fn((key) => {
      return createMockRequest(store.get(key));
    }),
    delete: vi.fn((key) => {
      const valueToDelete = store.get(key);
      if (valueToDelete) {
        store.delete(key);
        // Update indexes
        storeIndexes.forEach((indexMap, indexName) => {
          const indexValue = valueToDelete[indexName];
          if (indexValue !== undefined && indexMap.has(indexValue)) {
            indexMap.set(indexValue, indexMap.get(indexValue)!.filter((item: any) => item[keyPath] !== key));
            if (indexMap.get(indexValue)!.length === 0) {
              indexMap.delete(indexValue);
            }
          }
        });
      }
      return createMockRequest(undefined);
    }),
    clear: vi.fn(() => {
      store.clear();
      storeIndexes.clear();
      return createMockRequest(undefined);
    }),
    count: vi.fn(() => {
      return createMockRequest(store.size);
    }),
    index: vi.fn((indexName: string) => {
      const indexMap = storeIndexes.get(indexName) || new Map<any, any[]>();
      storeIndexes.set(indexName, indexMap); // Ensure index map exists

      const mockIndex: any = {
        getAll: vi.fn((query: any) => {
          if (query === undefined) {
            return createMockRequest(Array.from(store.values()));
          }
          return createMockRequest(indexMap.get(query) || []);
        }),
        count: vi.fn((query: any) => {
          if (query === undefined) {
            return createMockRequest(store.size);
          }
          return createMockRequest((indexMap.get(query) || []).length);
        }),
      };
      return mockIndex;
    }),
    createIndex: vi.fn((indexName: string) => {
      if (!storeIndexes.has(indexName)) {
        storeIndexes.set(indexName, new Map<any, any[]>());
      }
    }),
  };
  return mockObjectStore;
};

// Mock IDBTransaction
const createMockTransaction = (storeNames: string[], mode: string, db: any) => {
  const mockTransaction: any = {
    objectStore: vi.fn((storeName: string) => {
      if (!storeNames.includes(storeName)) {
        throw new Error(`Store ${storeName} not in transaction scope`);
      }
      return db.objectStores.get(storeName);
    }),
    oncomplete: null,
    onerror: null,
  };

  // Simulate transaction completion
  Promise.resolve().then(() => {
    if (mockTransaction.oncomplete) {
      mockTransaction.oncomplete(new Event('complete'));
    }
  });

  return mockTransaction;
};

// Mock IDBDatabase
const createMockDatabase = (name: string, version: number) => {
  const objectStores = new Map<string, any>();
  const objectStoreNames = new Set<string>();

  const mockDb: any = {
    name,
    version,
    objectStoreNames: {
      contains: vi.fn((name: string) => objectStoreNames.has(name)),
      [Symbol.iterator]: function* () {
        yield* objectStoreNames;
      },
    },
    createObjectStore: vi.fn((storeName: string, options: any) => {
      objectStoreNames.add(storeName);
      const store = createMockObjectStore(storeName, options.keyPath);
      objectStores.set(storeName, store);
      return store;
    }),
    transaction: vi.fn((storeNames: string | string[], mode: string) => {
      const namesArray = Array.isArray(storeNames) ? storeNames : [storeNames];
      return createMockTransaction(namesArray, mode, mockDb);
    }),
    close: vi.fn(() => {}),
    objectStores, // Internal for transaction to access
  };
  return mockDb;
};

// Mock indexedDB factory
const mockIndexedDB: any = {
  open: vi.fn((dbName: string, version: number) => {
    const mockDb = createMockDatabase(dbName, version);
    const request = createMockRequest(mockDb);

    // Simulate onupgradeneeded for initial setup
    // This is crucial for the database to be "created" and object stores to be made
    Promise.resolve().then(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: mockDb } });
      }
      // Then simulate onsuccess
      if (request.onsuccess) {
        request.onsuccess({ target: { result: mockDb } });
      }
    });

    return request;
  }),
};

// Stub the global indexedDB
vi.stubGlobal('indexedDB', mockIndexedDB);

describe('offlineClueDB', () => {
  beforeEach(async () => {
    // Clear the database before each test
    mockStores.clear();
    mockIndexes.clear();
    syncLogAutoIncrement = 1;
    mockIndexedDB.open.mockClear(); // Clear open calls
    await clearAllOfflineClues();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockClue: OfflineClue = {
    clue_id: 'clue-1',
    incident_id: 'inc-1',
    latitude: 40.0,
    longitude: -105.0,
    description: 'Test clue',
    timestamp: new Date().toISOString(),
    photo_url: '',
    discovered_by_team_id: null,
    discovered_by_responder_id: null,
  };

  it('should initialize the database with correct object stores', async () => {
    const db = await initializeOfflineDB();
    expect(db.name).toBe('SAROps_DB');
    expect(Array.from(db.objectStoreNames)).toContain('clues');
    expect(Array.from(db.objectStoreNames)).toContain('sync_log');
    db.close();
  });

  it('should save a clue and mark it as unsynced', async () => {
    await saveClueOffline(mockClue);
    const savedClue = await getClueOffline('clue-1');
    expect(savedClue).toBeDefined();
    expect(savedClue?.clue_id).toBe('clue-1');
    expect(savedClue?.synced).toBe(false);
  });

  it('should retrieve all clues for a specific incident', async () => {
    await saveClueOffline({ ...mockClue, clue_id: 'c1', incident_id: 'inc-1' });
    await saveClueOffline({ ...mockClue, clue_id: 'c2', incident_id: 'inc-1' });
    await saveClueOffline({ ...mockClue, clue_id: 'c3', incident_id: 'inc-2' });

    const incident1Clues = await getCluesByIncidentOffline('inc-1');
    expect(incident1Clues).toHaveLength(2);
    expect(incident1Clues.every(c => c.incident_id === 'inc-1')).toBe(true);
  });

  it('should mark a clue as synced', async () => {
    await saveClueOffline(mockClue);
    let clue = await getClueOffline('clue-1');
    expect(clue?.synced).toBe(false);

    await markClueAsSynced('clue-1');
    clue = await getClueOffline('clue-1');
    expect(clue?.synced).toBe(true);
  });
});
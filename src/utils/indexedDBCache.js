/**
 * IndexedDB Utility for SARTopo Map Caching
 * Provides a persistent local storage for GeoJSON features to enable incremental syncing.
 */

const DB_NAME = 'SAROps_MapCache';
const DB_VERSION = 1;
const STORE_NAME = 'map_features';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'mapId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Retrieves cached map data for a specific map ID.
 */
export const getCachedMap = async (mapId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(mapId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Saves or updates map features and the sync high-water mark.
 */
export const setCachedMap = async (mapId, features, lastSync) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data = {
      mapId,
      features, // Full feature collection
      lastSync, // Milliseconds timestamp
      updatedAt: Date.now()
    };
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Merges incremental updates into an existing feature array.
 */
export const mergeMapUpdates = (baseFeatures, updateFeatures) => {
  const featureMap = new Map(baseFeatures.map(f => [f.id, f]));
  
  updateFeatures.forEach(update => {
    // SARTopo diffs: if a feature exists, update it. If new, add it.
    // Note: Deletions in SARTopo API are handled by specific properties 
    // or missing from the since payload depending on API version.
    featureMap.set(update.id, update);
  });

  return Array.from(featureMap.values());
};

export const clearMapCache = async (mapId) => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(mapId);
};
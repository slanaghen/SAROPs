# Offline Clue Storage Documentation

Complete guide for implementing offline Clue storage in SAROps using IndexedDB.

## Overview

The offline clue storage system allows SAROps personnel to:
- Create and record clues without internet connection
- Automatically sync clues to Supabase when back online
- Track sync status and handle errors
- Maintain full audit trail of changes

## Architecture

```
┌─────────────────────────────────────────────┐
│         React Components                    │
│  (ClueForm, ClueList, SyncStatus)          │
└────────────────────┬────────────────────────┘
                     │
┌─────────────────────▼────────────────────────┐
│    useOfflineClues Hook                     │
│  (State management, UI integration)         │
└────────────────────┬────────────────────────┘
                     │
┌─────────────────────▼────────────────────────┐
│  offlineClueSync Service                    │
│  (Sync orchestration, conflict resolution)  │
└────────────────────┬────────────────────────┘
                     │
┌─────────────────────▼────────────────────────┐
│  offlineClueDB Utilities                    │
│  (IndexedDB CRUD operations)                │
└────────────────────┬────────────────────────┘
                     │
┌─────────────────────▼────────────────────────┐
│       IndexedDB (Browser Storage)           │
│  - clues (object store)                     │
│  - sync_log (object store)                  │
└─────────────────────────────────────────────┘
```

## Files

### Core Utilities

#### `src/utils/offlineClueDB.ts`
Low-level IndexedDB operations.

**Key Functions:**
```typescript
initializeOfflineDB()                           // Initialize database
saveClueOffline(clue: Clue)                    // Create clue
updateClueOffline(clue: OfflineClue)           // Update clue
deleteClueOffline(clueId: string)              // Delete clue
getClueOffline(clueId: string)                 // Get single clue
getCluesByIncidentOffline(incidentId: string)  // Get all clues for incident
getUnsyncedCluesOffline()                      // Get unsynced clues
getOfflineCreatedCluesOffline(incidentId?)    // Get clues created offline
markClueAsSynced(clueId: string)               // Mark synced
markClueWithSyncError(clueId, error)           // Track sync errors
getCluesSyncLog(clueId?)                       // Get audit trail
clearAllOfflineClues()                         // Delete all local clues
exportOfflineCluesAsJSON()                     // Export for backup
getOfflineStorageStats()                       // Get statistics
```

#### `src/hooks/useOfflineClues.ts`
React hook for component integration.

**Returns:**
```typescript
{
  clues: OfflineClue[]
  unsyncedCount: number
  offlineCreatedCount: number
  isOnline: boolean
  loading: boolean
  error: string | null
  createClue: (clue: Clue) => Promise<OfflineClue>
  updateClue: (clue: OfflineClue) => Promise<OfflineClue>
  deleteClue: (clueId: string) => Promise<void>
  // ... plus 10 more methods
}
```

#### `src/services/offlineClueSync.ts`
Sync orchestration and conflict resolution.

**Key Functions:**
```typescript
syncOffllineClues(supabaseClient, onProgress?)  // Sync all offline clues
setupAutoSync(supabaseClient, onSync?)          // Auto-sync when online
syncSingleClue(supabaseClient, offlineClue)     // Sync one clue
retrySyncClue(supabaseClient, clueId, clue)     // Retry failed sync
getSyncReadiness()                              // Check if ready to sync
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js uuid
```

### 2. Create Directory Structure
```
src/
  utils/
    offlineClueDB.ts
  hooks/
    useOfflineClues.ts
  services/
    offlineClueSync.ts
  examples/
    OfflineClueExample.tsx
```

### 3. Environment Variables
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database Setup
Ensure Supabase has the `clues` table created (see `sarops-schema.sql`).

## Usage Examples

### Basic: Creating a Clue Offline

```typescript
import { useOfflineClues } from '../hooks/useOfflineClues';
import { Clue } from '../types/sarops-types';
import { v4 as uuidv4 } from 'uuid';

function MyComponent() {
  const { createClue } = useOfflineClues('incident-uuid');

  const handleCreateClue = async () => {
    const newClue: Clue = {
      clue_id: uuidv4(),
      incident_id: 'incident-uuid',
      sartopo_marker_id: null,
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
      description: 'Found backpack near trail',
      photo_url: 'file:///path/to/photo.jpg',
      discovered_by_team_id: null,
      discovered_by_responder_id: 'responder-uuid',
      timestamp: new Date().toISOString(),
    };

    try {
      const savedClue = await createClue(newClue);
      console.log('Clue saved:', savedClue);
    } catch (err) {
      console.error('Failed to save clue:', err);
    }
  };

  return <button onClick={handleCreateClue}>Save Clue</button>;
}
```

### Intermediate: Listing Clues with Sync Status

```typescript
function ClueListComponent({ incidentId }) {
  const {
    clues,
    unsyncedCount,
    isOnline,
    loading,
    error,
  } = useOfflineClues(incidentId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Clues ({clues.length})</h2>
      
      <div className="status">
        {isOnline ? '🟢 Online' : '🔴 Offline'}
        {unsyncedCount > 0 && ` - ${unsyncedCount} unsynced`}
      </div>

      {clues.map(clue => (
        <div key={clue.clue_id}>
          <h3>{clue.description}</h3>
          <p>📍 {clue.coordinates.latitude}, {clue.coordinates.longitude}</p>
          {!clue.synced && <span className="badge">Unsynced</span>}
          {clue.sync_error && <span className="error">{clue.sync_error}</span>}
        </div>
      ))}
    </div>
  );
}
```

### Advanced: Manual Sync Control

```typescript
import { syncOffllineClues } from '../services/offlineClueSync';

async function ManualSyncComponent() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);

    const syncResult = await syncOffllineClues(supabaseClient, (progress) => {
      console.log(
        `Syncing: ${progress.completed}/${progress.total} complete`
      );
    });

    setResult(syncResult);
    setSyncing(false);

    if (syncResult.success) {
      console.log(`✓ Synced ${syncResult.synced} clues`);
    } else {
      console.error(`✗ Failed to sync ${syncResult.failed} clues`);
      syncResult.errors.forEach(err => {
        console.error(`  - ${err.clueId}: ${err.error}`);
      });
    }
  };

  return (
    <div>
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

### Expert: Auto-Sync with Error Handling

```typescript
import { setupAutoSync, getSyncReadiness } from '../services/offlineClueSync';

useEffect(() => {
  // Setup automatic sync when online
  const cleanup = setupAutoSync(supabaseClient, (result) => {
    if (result.success) {
      showNotification(`✓ Synced ${result.synced} clues`);
    } else {
      showNotification(
        `✗ ${result.failed} clues failed to sync`,
        'error'
      );
    }
  });

  // Check sync readiness and update UI
  const checkStatus = async () => {
    const { isOnline, unsyncedCount, readyToSync } = 
      await getSyncReadiness();
    
    updateSyncIndicator({
      isOnline,
      unsyncedCount,
      readyToSync,
    });
  };

  // Check every 5 seconds
  const interval = setInterval(checkStatus, 5000);

  return () => {
    cleanup();
    clearInterval(interval);
  };
}, []);
```

## Data Schema

### OfflineClue Interface
```typescript
interface OfflineClue extends Clue {
  synced?: boolean;                    // Whether synced to Supabase
  sync_error?: string;                 // Last sync error message
  created_offline_at?: string;         // Timestamp of offline creation
  last_sync_attempt?: string;          // Last sync attempt timestamp
}
```

### SyncLogEntry Interface
```typescript
interface SyncLogEntry {
  id?: number;                         // Auto-incremented ID
  clue_id: string;                     // UUID of the clue
  action: 'create' | 'update' | 'delete';
  synced: boolean;                     // Whether action was synced
  sync_error?: string;                 // Error message if failed
  created_at: string;                  // Action timestamp
  synced_at?: string;                  // Sync completion timestamp
}
```

### IndexedDB Object Stores

**clues**
- Key: `clue_id` (string)
- Indexes:
  - `incident_id` - Query clues by incident
  - `synced` - Query unsynced clues
  - `timestamp` - Sort by timestamp

**sync_log**
- Key: `id` (auto-increment)
- Indexes:
  - `clue_id` - Get history for a clue
  - `synced` - Get completed/pending actions
  - `created_at` - Timeline queries

## Offline-First Workflow

### User Goes Offline
1. User creates/edits clues
2. `saveClueOffline()` stores in IndexedDB
3. Clue marked as `synced: false`
4. Entry added to sync_log with action timestamp
5. UI shows offline badge

### User Comes Back Online
1. Browser fires `online` event
2. `setupAutoSync()` triggers `syncOffllineClues()`
3. Unsynced clues sent to Supabase via REST API
4. Successful clues marked as `synced: true`
5. Failed clues marked with `sync_error`
6. UI updates to reflect sync status

### Sync Conflict Resolution
- Uses Supabase `UPSERT` with `onConflict: 'clue_id'`
- Server wins on timestamp conflicts
- Retry mechanism for transient failures
- Error tracking for manual intervention

## Error Handling

### Handling Sync Errors

```typescript
// Get unsynced clues with errors
const unsyncedClues = await getUnsyncedCluesOffline();
const failedClues = unsyncedClues.filter(c => c.sync_error);

// Retry individual failed clue
try {
  await retrySyncClue(supabaseClient, clueId, offlineClue);
  console.log('Retry successful');
} catch (err) {
  console.error('Retry failed:', err);
}
```

### Common Error Scenarios

**Network Error**
- Caught by try/catch in sync functions
- Clue remains in local storage
- Retry automatically when online

**Validation Error**
- Server rejects malformed data
- Error stored in `sync_error` field
- Manual intervention required

**Quota Error**
- IndexedDB storage limit exceeded
- `getOfflineStorageStats()` shows usage
- `exportOfflineCluesAsJSON()` for backup
- `clearAllOfflineClues()` to free space

## Performance Optimization

### Storage Limits
- IndexedDB typically allows 50MB per domain
- Monitor with `getOfflineStorageStats()`
- Implement cleanup strategy

### Batch Operations
```typescript
// Sync multiple clues efficiently
const unsyncedClues = await getUnsyncedCluesOffline();
for (const clue of unsyncedClues) {
  await syncSingleClue(supabaseClient, clue);
}
```

### Indexed Queries
- Use `incident_id` index for incident-specific queries
- Use `synced` index to find pending updates
- Avoid full table scans with filters

## Testing

### Unit Tests
```typescript
describe('offlineClueDB', () => {
  beforeEach(async () => {
    await clearAllOfflineClues();
  });

  test('saves clue offline', async () => {
    const clue: Clue = { /* ... */ };
    const saved = await saveClueOffline(clue);
    expect(saved.clue_id).toBe(clue.clue_id);
    expect(saved.synced).toBe(false);
  });

  test('retrieves clue by incident', async () => {
    const clue1: Clue = { incident_id: 'inc1', /* ... */ };
    const clue2: Clue = { incident_id: 'inc2', /* ... */ };
    
    await saveClueOffline(clue1);
    await saveClueOffline(clue2);
    
    const results = await getCluesByIncidentOffline('inc1');
    expect(results).toHaveLength(1);
    expect(results[0].clue_id).toBe(clue1.clue_id);
  });
});
```

### Integration Tests
```typescript
test('syncs offline clues to Supabase', async () => {
  // Create offline
  const clue = await saveClueOffline(newClue);
  
  // Verify unsynced
  let unsynced = await getUnsyncedCluesOffline();
  expect(unsynced).toContainEqual(expect.objectContaining({
    clue_id: clue.clue_id,
    synced: false,
  }));
  
  // Sync
  const result = await syncOffllineClues(supabaseClient);
  expect(result.success).toBe(true);
  expect(result.synced).toBe(1);
  
  // Verify synced
  unsynced = await getUnsyncedCluesOffline();
  expect(unsynced).not.toContainEqual(
    expect.objectContaining({ clue_id: clue.clue_id })
  );
});
```

## Monitoring & Debugging

### Storage Statistics
```typescript
const stats = await getOfflineStorageStats();
console.log(`Total clues: ${stats.totalClues}`);
console.log(`Unsynced: ${stats.unsyncedClues}`);
console.log(`Offline created: ${stats.offlineCreatedClues}`);
console.log(`Sync log entries: ${stats.syncLogEntries}`);
```

### Export for Backup
```typescript
const json = await exportOfflineCluesAsJSON();
localStorage.setItem('clues_backup', json);
```

### Audit Trail
```typescript
const log = await getCluesSyncLog(clueId);
log.forEach(entry => {
  console.log(`${entry.created_at}: ${entry.action} - ${entry.synced ? '✓' : '✗'}`);
});
```

## Best Practices

1. **Always initialize database** before operations:
   ```typescript
   const db = await initializeOfflineDB();
   ```

2. **Handle errors gracefully**:
   ```typescript
   try {
     await createClue(newClue);
   } catch (err) {
     showUserError(err);
   }
   ```

3. **Monitor sync status**:
   ```typescript
   setupAutoSync(supabaseClient, (result) => {
     updateUI(result);
   });
   ```

4. **Cleanup on unmount**:
   ```typescript
   useEffect(() => {
     return () => {
       // Cleanup subscriptions, timers, etc.
     };
   }, []);
   ```

5. **Respect user preferences**:
   - Ask before clearing all clues
   - Show sync status prominently
   - Allow manual intervention

6. **Test offline scenarios**:
   - Use DevTools Network tab to simulate offline
   - Test with poor connectivity
   - Verify error recovery

## Troubleshooting

### Clues Not Syncing
1. Check `navigator.onLine`
2. Verify Supabase credentials
3. Check browser console for errors
4. Review sync error in `clue.sync_error`

### IndexedDB Not Available
1. Check private/incognito mode (may restrict IndexedDB)
2. Verify browser supports IndexedDB
3. Check storage quota
4. Clear browser cache if corrupted

### Performance Issues
1. Use `getOfflineStorageStats()` to check storage
2. Implement pagination for large datasets
3. Use indexes for queries
4. Monitor sync time with `onProgress` callback

## See Also
- [sarops-schema.sql](../sarops-schema.sql) - Database schema
- [sarops-types.d.ts](../sarops-types.d.ts) - TypeScript interfaces
- [OfflineClueExample.tsx](../examples/OfflineClueExample.tsx) - Complete example

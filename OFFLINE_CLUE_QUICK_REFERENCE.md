/**
 * QUICK REFERENCE: Offline Clue Storage
 * 
 * Copy-paste ready examples for common tasks
 */

// ============================================================================
// 1. INITIALIZATION
// ============================================================================

// In your main App component or page wrapper:
import { useOfflineClues } from '../hooks/useOfflineClues';
import { setupAutoSync } from '../services/offlineClueSync';
import { supabase } from '../lib/supabase';

useEffect(() => {
  // Auto-sync offline clues when online
  const cleanup = setupAutoSync(supabase, (result) => {
    if (result.success) {
      console.log(`✓ Synced ${result.synced} clues`);
    } else {
      console.error(`✗ Failed to sync ${result.failed} clues`);
    }
  });

  return cleanup;
}, []);

// ============================================================================
// 2. CREATE A CLUE OFFLINE
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Clue } from '../types/sarops-types';

const { createClue } = useOfflineClues(incidentId);

const handleCreateClue = async () => {
  const newClue: Clue = {
    clue_id: uuidv4(),
    incident_id: incidentId,
    sartopo_marker_id: null,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    },
    description: description,
    photo_url: photoUrl || '',
    discovered_by_team_id: teamId || null,
    discovered_by_responder_id: responderId || null,
    timestamp: new Date().toISOString(),
  };

  try {
    const savedClue = await createClue(newClue);
    console.log('Clue saved:', savedClue);
  } catch (err) {
    console.error('Error saving clue:', err);
  }
};

// ============================================================================
// 3. LIST ALL CLUES FOR AN INCIDENT
// ============================================================================

const { clues, loading, error } = useOfflineClues(incidentId);

return (
  <div>
    {loading ? (
      <p>Loading clues...</p>
    ) : error ? (
      <p>Error: {error}</p>
    ) : (
      <ul>
        {clues.map(clue => (
          <li key={clue.clue_id}>
            <strong>{clue.description}</strong>
            <p>📍 {clue.coordinates.latitude}, {clue.coordinates.longitude}</p>
            <small>{new Date(clue.timestamp).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ============================================================================
// 4. CHECK ONLINE/OFFLINE STATUS
// ============================================================================

const { isOnline, unsyncedCount } = useOfflineClues(incidentId);

return (
  <div>
    <span>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
    {unsyncedCount > 0 && <span>{unsyncedCount} unsynced clues</span>}
  </div>
);

// ============================================================================
// 5. UPDATE A CLUE
// ============================================================================

const { updateClue } = useOfflineClues(incidentId);

const handleUpdateClue = async (clueId: string, updatedData: Partial<OfflineClue>) => {
  try {
    const updatedClue = await updateClue({
      ...clue,
      ...updatedData,
    });
    console.log('Clue updated:', updatedClue);
  } catch (err) {
    console.error('Error updating clue:', err);
  }
};

// ============================================================================
// 6. DELETE A CLUE
// ============================================================================

const { deleteClue } = useOfflineClues(incidentId);

const handleDeleteClue = async (clueId: string) => {
  if (window.confirm('Delete this clue?')) {
    try {
      await deleteClue(clueId);
      console.log('Clue deleted');
    } catch (err) {
      console.error('Error deleting clue:', err);
    }
  }
};

// ============================================================================
// 7. SYNC STATUS INDICATOR
// ============================================================================

const { isOnline, unsyncedCount, offlineCreatedCount } = useOfflineClues(incidentId);

return (
  <div className="status-bar">
    <span className={`status ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? '🟢' : '🔴'} {isOnline ? 'Online' : 'Offline'}
    </span>
    
    {unsyncedCount > 0 && (
      <span className="unsynced">
        ⬆️ {unsyncedCount} pending sync
      </span>
    )}
    
    {offlineCreatedCount > 0 && (
      <span className="offline-created">
        💾 {offlineCreatedCount} created offline
      </span>
    )}
  </div>
);

// ============================================================================
// 8. MANUAL SYNC BUTTON
// ============================================================================

import { syncOffllineClues } from '../services/offlineClueSync';
import { useState } from 'react';

const [syncing, setSyncing] = useState(false);

const handleSync = async () => {
  setSyncing(true);
  
  try {
    const result = await syncOffllineClues(supabase, (progress) => {
      console.log(`Progress: ${progress.completed}/${progress.total}`);
    });

    if (result.success) {
      alert(`✓ Synced ${result.synced} clues`);
    } else {
      alert(`✗ ${result.failed} clues failed`);
      result.errors.forEach(err => {
        console.error(`${err.clueId}: ${err.error}`);
      });
    }
  } catch (err) {
    alert('Sync failed: ' + err.message);
  } finally {
    setSyncing(false);
  }
};

return <button onClick={handleSync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Now'}</button>;

// ============================================================================
// 9. GET STORAGE STATISTICS
// ============================================================================

const { getStorageStats } = useOfflineClues(incidentId);

const [stats, setStats] = useState(null);

useEffect(() => {
  const loadStats = async () => {
    try {
      const s = await getStorageStats();
      setStats(s);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };
  loadStats();
}, [getStorageStats]);

return stats ? (
  <div>
    <p>Total: {stats.totalClues}</p>
    <p>Unsynced: {stats.unsyncedClues}</p>
    <p>Created Offline: {stats.offlineCreatedClues}</p>
    <p>Sync Log Entries: {stats.syncLogEntries}</p>
  </div>
) : null;

// ============================================================================
// 10. GET SYNC LOG / AUDIT TRAIL
// ============================================================================

const { getSyncLog } = useOfflineClues(incidentId);

const [logs, setLogs] = useState([]);

const handleShowSyncLog = async (clueId?: string) => {
  try {
    const syncLogs = await getSyncLog(clueId);
    setLogs(syncLogs);
    
    syncLogs.forEach(log => {
      console.log(
        `${log.created_at}: ${log.action} ${log.synced ? '✓' : '✗'}`,
        log.sync_error ? `(Error: ${log.sync_error})` : ''
      );
    });
  } catch (err) {
    console.error('Error getting sync log:', err);
  }
};

// ============================================================================
// 11. ERROR HANDLING
// ============================================================================

const { error } = useOfflineClues(incidentId);

useEffect(() => {
  if (error) {
    console.error('Offline clue error:', error);
    // Show error to user
    showNotification(error, 'error');
  }
}, [error]);

// ============================================================================
// 12. EXPORT FOR BACKUP
// ============================================================================

const { exportAsJSON } = useOfflineClues(incidentId);

const handleExportBackup = async () => {
  try {
    const json = await exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clues-backup-${new Date().toISOString()}.json`;
    a.click();
  } catch (err) {
    console.error('Error exporting backup:', err);
  }
};

// ============================================================================
// 13. HANDLE OFFLINE CLUES WITH ERRORS
// ============================================================================

const { getUnsyncedClues } = useOfflineClues(incidentId);

const handleRetryFailedClues = async () => {
  try {
    const unsynced = await getUnsyncedClues();
    const failed = unsynced.filter(c => c.sync_error);

    for (const clue of failed) {
      // Retry individual clue
      const result = await syncSingleClue(supabase, clue);
      if (result) {
        console.log(`✓ Retried: ${clue.clue_id}`);
      } else {
        console.log(`✗ Still failing: ${clue.clue_id}`);
      }
    }
  } catch (err) {
    console.error('Error retrying:', err);
  }
};

// ============================================================================
// 14. SHOW SYNC STATUS WITH PROGRESS
// ============================================================================

const [progress, setProgress] = useState({ completed: 0, total: 0 });

const handleSyncWithProgress = async () => {
  const result = await syncOffllineClues(supabase, (p) => {
    setProgress({ completed: p.completed, total: p.total });
  });

  console.log(`Sync complete: ${result.synced}/${result.synced + result.failed}`);
};

return (
  <div>
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${(progress.completed / progress.total) * 100}%` }}
      />
    </div>
    <p>{progress.completed} / {progress.total}</p>
  </div>
);

// ============================================================================
// 15. COMPLETE FORM COMPONENT WITH OFFLINE SUPPORT
// ============================================================================

function ClueFormWithOfflineSupport({ incidentId }: { incidentId: string }) {
  const [formData, setFormData] = useState({
    description: '',
    latitude: '',
    longitude: '',
  });

  const { createClue, isOnline } = useOfflineClues(incidentId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const clue: Clue = {
        clue_id: uuidv4(),
        incident_id: incidentId,
        sartopo_marker_id: null,
        coordinates: {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        },
        description: formData.description,
        photo_url: '',
        discovered_by_team_id: null,
        discovered_by_responder_id: null,
        timestamp: new Date().toISOString(),
      };

      await createClue(clue);

      setMessage(
        `✓ Clue saved ${isOnline ? '' : 'offline '}` +
        `${isOnline ? '' : 'and will sync when online'}`
      );

      setFormData({ description: '', latitude: '', longitude: '' });

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Report a Clue</h2>

      {message && <div className="message">{message}</div>}

      {!isOnline && (
        <div className="warning">
          📡 You're offline. Clues will be saved locally and synced when online.
        </div>
      )}

      <input
        type="text"
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        required
      />

      <input
        type="number"
        placeholder="Latitude"
        step="0.00001"
        value={formData.latitude}
        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
        required
      />

      <input
        type="number"
        placeholder="Longitude"
        step="0.00001"
        value={formData.longitude}
        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
        required
      />

      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Clue'}
      </button>
    </form>
  );
}

// ============================================================================
// ENVIRONMENT VARIABLES CHECKLIST
// ============================================================================

/*
Required in .env:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Optional npm packages:
- npm install uuid (for generating IDs)
- npm install @supabase/supabase-js (for sync)

Browser requirements:
- IndexedDB support (available in all modern browsers)
- Service Workers for offline support (optional but recommended)
*/

// ============================================================================
// BROWSER STORAGE LIMITS
// ============================================================================

/*
Most browsers allow:
- Chrome: 50MB per domain
- Firefox: 50MB per domain
- Safari: 50MB per domain
- Edge: 50MB per domain

Use getStorageStats() to monitor usage:
- If approaching limit: export and clear old clues
- If exceeding limit: browser may clear IndexedDB
*/

// ============================================================================
// TESTING IN DEVTOOLS
// ============================================================================

/*
To simulate offline:
1. Open DevTools (F12)
2. Go to Network tab
3. Find "Throttling" dropdown (usually says "No throttling")
4. Select "Offline"

To view IndexedDB:
1. Open DevTools (F12)
2. Go to Application tab
3. Expand "IndexedDB"
4. Select your storage: "SAROps_DB"
5. Browse "clues" and "sync_log" object stores
*/

/**
 * EXAMPLE: Using Offline Clue Storage in a React Component
 * 
 * This file demonstrates how to integrate offline clue storage
 * into your SAROps React components.
 */

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Clue } from '../types/sarops-types';
import { useOfflineClues } from '../hooks/useOfflineClues';
import { 
  syncOffllineClues, 
  setupAutoSync, 
  getSyncReadiness 
} from '../services/offlineClueSync';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * ClueForm Component
 * 
 * Example form for creating and saving clues offline
 */
export const ClueForm: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const [formData, setFormData] = useState({
    description: '',
    latitude: '',
    longitude: '',
    photoUrl: '',
    discoveredByTeamId: '',
    discoveredByResponderId: '',
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { createClue, isOnline } = useOfflineClues(incidentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Validate form
      if (!formData.description || !formData.latitude || !formData.longitude) {
        throw new Error('Description and coordinates are required');
      }

      // Create clue object matching schema
      const newClue: Clue = {
        clue_id: uuidv4(),
        incident_id: incidentId,
        sartopo_marker_id: null,
        coordinates: {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        },
        description: formData.description,
        photo_url: formData.photoUrl,
        discovered_by_team_id: formData.discoveredByTeamId || null,
        discovered_by_responder_id: formData.discoveredByResponderId || null,
        timestamp: new Date().toISOString(),
      };

      // Save to IndexedDB
      await createClue(newClue);

      setSuccessMessage(
        `Clue saved ${isOnline ? '' : 'offline. '}Will be synced to server.`
      );

      // Reset form
      setFormData({
        description: '',
        latitude: '',
        longitude: '',
        photoUrl: '',
        discoveredByTeamId: '',
        discoveredByResponderId: '',
      });

      // Clear message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save clue';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clue-form">
      <h2>Report a Clue</h2>

      {errorMessage && (
        <div className="alert alert-error">{errorMessage}</div>
      )}

      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}

      {!isOnline && (
        <div className="alert alert-warning">
          📡 You're offline. Clues will be saved locally and synced when online.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Description *</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe the clue..."
            required
          />
        </div>

        <div className="form-group">
          <label>Latitude *</label>
          <input
            type="number"
            step="0.00001"
            value={formData.latitude}
            onChange={(e) =>
              setFormData({ ...formData, latitude: e.target.value })
            }
            placeholder="e.g., 37.7749"
            required
          />
        </div>

        <div className="form-group">
          <label>Longitude *</label>
          <input
            type="number"
            step="0.00001"
            value={formData.longitude}
            onChange={(e) =>
              setFormData({ ...formData, longitude: e.target.value })
            }
            placeholder="e.g., -122.4194"
            required
          />
        </div>

        <div className="form-group">
          <label>Photo URL</label>
          <input
            type="text"
            value={formData.photoUrl}
            onChange={(e) =>
              setFormData({ ...formData, photoUrl: e.target.value })
            }
            placeholder="URL to photo (optional)"
          />
        </div>

        <div className="form-group">
          <label>Discovered by Team ID</label>
          <input
            type="text"
            value={formData.discoveredByTeamId}
            onChange={(e) =>
              setFormData({ ...formData, discoveredByTeamId: e.target.value })
            }
            placeholder="Team UUID (optional)"
          />
        </div>

        <div className="form-group">
          <label>Discovered by Responder ID</label>
          <input
            type="text"
            value={formData.discoveredByResponderId}
            onChange={(e) =>
              setFormData({ ...formData, discoveredByResponderId: e.target.value })
            }
            placeholder="Responder UUID (optional)"
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Clue'}
        </button>
      </form>
    </div>
  );
};

/**
 * ClueList Component
 * 
 * Example component for displaying offline clues
 */
export const ClueList: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const {
    clues,
    unsyncedCount,
    offlineCreatedCount,
    isOnline,
    loading,
    error,
    deleteClue,
    getStorageStats,
  } = useOfflineClues(incidentId);

  const [storageStats, setStorageStats] = useState<any>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getStorageStats();
        setStorageStats(stats);
      } catch (err) {
        console.error('Error loading storage stats:', err);
      }
    };

    loadStats();
  }, [clues, getStorageStats]);

  const handleDelete = async (clueId: string) => {
    if (window.confirm('Are you sure you want to delete this clue?')) {
      try {
        await deleteClue(clueId);
      } catch (err) {
        console.error('Error deleting clue:', err);
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading clues...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="clue-list">
      <h2>Clues ({clues.length})</h2>

      <div className="clue-stats">
        <div className="stat">
          <span className="label">Total:</span>
          <span className="value">{storageStats?.totalClues || 0}</span>
        </div>
        <div className="stat">
          <span className="label">Unsynced:</span>
          <span className="value">{unsyncedCount}</span>
        </div>
        <div className="stat">
          <span className="label">Created Offline:</span>
          <span className="value">{offlineCreatedCount}</span>
        </div>
        <div className="stat">
          <span className="label">Status:</span>
          <span className={`value ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
      </div>

      {clues.length === 0 ? (
        <div className="empty-state">No clues recorded for this incident</div>
      ) : (
        <div className="clue-items">
          {clues.map((clue) => (
            <div key={clue.clue_id} className="clue-item">
              <div className="clue-header">
                <h3>{clue.description.substring(0, 50)}...</h3>
                {clue.synced === false && (
                  <span className="badge badge-unsynced">Unsynced</span>
                )}
                {clue.created_offline_at && (
                  <span className="badge badge-offline">Created Offline</span>
                )}
                {clue.sync_error && (
                  <span className="badge badge-error">Sync Error</span>
                )}
              </div>

              <div className="clue-body">
                <p className="description">{clue.description}</p>
                <div className="coordinates">
                  <span>📍 {clue.coordinates.latitude}, {clue.coordinates.longitude}</span>
                </div>
                <div className="meta">
                  <span className="timestamp">
                    {new Date(clue.timestamp).toLocaleString()}
                  </span>
                  {clue.photo_url && (
                    <a href={clue.photo_url} target="_blank" rel="noopener noreferrer">
                      📷 View Photo
                    </a>
                  )}
                </div>
              </div>

              <div className="clue-footer">
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(clue.clue_id)}
                >
                  Delete
                </button>
                {clue.sync_error && (
                  <span className="sync-error">{clue.sync_error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * SyncStatus Component
 * 
 * Shows sync status and provides manual sync button
 */
export const SyncStatus: React.FC = () => {
  const [syncProgress, setSyncProgress] = useState({ inProgress: false, message: '' });
  const [readiness, setReadiness] = useState({
    isOnline: false,
    unsyncedCount: 0,
    readyToSync: false,
  });

  useEffect(() => {
    // Setup auto-sync
    const cleanup = setupAutoSync(supabase, (result) => {
      if (result.success) {
        setSyncProgress({
          inProgress: false,
          message: `✓ Synced ${result.synced} clue(s)`,
        });
      } else {
        setSyncProgress({
          inProgress: false,
          message: `✗ Failed to sync ${result.failed} clue(s)`,
        });
      }

      // Clear message after 5 seconds
      setTimeout(() => setSyncProgress({ inProgress: false, message: '' }), 5000);
    });

    return cleanup;
  }, []);

  useEffect(() => {
    const checkReadiness = async () => {
      try {
        const status = await getSyncReadiness();
        setReadiness(status);
      } catch (err) {
        console.error('Error checking sync readiness:', err);
      }
    };

    // Check immediately and every 5 seconds
    checkReadiness();
    const interval = setInterval(checkReadiness, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setSyncProgress({
      inProgress: true,
      message: 'Syncing...',
    });

    try {
      const result = await syncOffllineClues(supabase);

      if (result.success) {
        setSyncProgress({
          inProgress: false,
          message: `✓ Synced ${result.synced} clue(s)`,
        });
      } else {
        setSyncProgress({
          inProgress: false,
          message: `✗ ${result.failed} clue(s) failed to sync`,
        });
      }

      // Refresh readiness
      const status = await getSyncReadiness();
      setReadiness(status);

      // Clear message after 5 seconds
      setTimeout(() => setSyncProgress({ inProgress: false, message: '' }), 5000);
    } catch (err) {
      setSyncProgress({
        inProgress: false,
        message: `Error: ${err instanceof Error ? err.message : 'Sync failed'}`,
      });
    }
  };

  return (
    <div className="sync-status">
      <div className="sync-info">
        <span className={`status-indicator ${readiness.isOnline ? 'online' : 'offline'}`}>
          {readiness.isOnline ? '🟢 Online' : '🔴 Offline'}
        </span>
        <span className="unsynced-count">
          {readiness.unsyncedCount} unsynced clue(s)
        </span>
      </div>

      {syncProgress.message && (
        <div className="sync-message">{syncProgress.message}</div>
      )}

      <button
        className="btn-sync"
        onClick={handleManualSync}
        disabled={!readiness.readyToSync || syncProgress.inProgress}
      >
        {syncProgress.inProgress ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

/**
 * Main Example Component
 */
const OfflineClueExample: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  return (
    <div className="offline-clue-example">
      <div className="section">
        <SyncStatus />
      </div>

      <div className="grid">
        <div className="column">
          <ClueForm incidentId={incidentId} />
        </div>

        <div className="column">
          <ClueList incidentId={incidentId} />
        </div>
      </div>
    </div>
  );
};

export default OfflineClueExample;

/**
 * USAGE IN YOUR APP
 * 
 * import OfflineClueExample from './examples/OfflineClueExample';
 * 
 * export default function App() {
 *   return (
 *     <OfflineClueExample incidentId="incident-uuid-here" />
 *   );
 * }
 * 
 * DEPENDENCIES
 * - @supabase/supabase-js
 * - uuid
 */

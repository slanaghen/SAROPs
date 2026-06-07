import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import '../styles.css';

/**
 * ActionLogPage
 * Displays timestamped actions for the current incident.
 * Supports manual entry of log items.
 */
const ActionLogPage = () => {
  const { incidentId, responderName, user } = useIncident();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualAction, setManualAction] = useState('');
  const { addToast } = useToast();

  const fetchLogs = async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('action_logs')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      addToast('Failed to load action logs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [incidentId]);

  const handleAddManualLog = async (e) => {
    e.preventDefault();
    if (!manualAction.trim() || !incidentId) return;

    try {
      const { error: insertError } = await supabase
        .from('action_logs')
        .insert({
          incident_id: incidentId,
          action: manualAction.trim(),
          user_name: responderName || user?.email || 'Anonymous'
        });

      if (insertError) throw insertError;
      setManualAction('');
      fetchLogs();
    } catch (err) {
      addToast('Failed to add log entry: ' + err.message, 'error');
    }
  };

  if (!incidentId) {
    return (
      <div className="app-shell">
        <h1>Incident Action Log</h1>
        <div className="operations-message">Please select or start an incident to view the action log.</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <h1>Incident Action Log</h1>
      
      <div className="section-card" style={{ marginBottom: '20px' }}>
        <form onSubmit={handleAddManualLog} data-lpignore="true" style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            className="form-control"
            value={manualAction} 
            onChange={(e) => setManualAction(e.target.value)} 
            autoComplete="off"
            data-lpignore="true"
            placeholder="Manually record an action (e.g., 'CP moved to base of mountain')..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button type="submit" className="btn btn-primary btn-sm">Add to Log</button>
        </form>
      </div>

      <div className="operations-table-wrapper">
        <table className="operations-table">
          <thead>
            <tr>
              <th style={{ width: '200px' }}>Timestamp</th>
              <th>Action Details</th>
              <th style={{ width: '200px' }}>Initiated By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="empty-row">Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="3" className="empty-row">No actions recorded yet.</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '11px', color: '#64748b' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>{log.action}</td>
                  <td><span className="status-indicator attached">{log.user_name}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActionLogPage;
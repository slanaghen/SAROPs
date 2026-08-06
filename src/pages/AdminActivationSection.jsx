import React from 'react';

const AdminActivationSection = ({
  isActive,
  incidentData,
  allIncidents,
  loading,
  fetching,
  selectedActivationId,
  setSelectedActivationId,
  handleLeaveIncident,
  handleActivateSession,
  responderStatus,
}) => {
  return (
    <div className="section-card" style={{ marginBottom: '24px' }}>
      <h2>Incident Activation</h2>
      {isActive && responderStatus !== 'CheckedOut' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f9ff', padding: 'var(--space-md)', borderRadius: '8px', border: '1px solid #bae6fd' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#0369a1' }}>Current Active Session: {incidentData?.name || 'In Progress'}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#0c4a6e' }}>
              The top banner now reflects this incident. Use the menu to navigate to Operations, Planning, or Dashboards.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="action-btn action-btn-secondary"
              style={{ borderColor: '#fecaca' }}
              onClick={handleLeaveIncident}
              disabled={responderStatus !== 'Staged'}
              title={responderStatus !== 'Staged' ? "You must return to 'Staged' status before checking out. Use the Operations dashboard to release yourself from your current team." : "End your operational session for this incident"}
            >
              Check out from Incident
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 4px' }}>
              Select an active incident to check in as a responder and establish session context.
            </p>
            {allIncidents.filter(inc => !inc.end_datetime).length === 0 && !fetching && (
              <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, margin: 0 }}>
                ⚠️ No active incidents found. Use the "New Incident" button in the management table below to start one.
              </p>
            )}
          </div>
          <div className="action-btn-group" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: '250px' }}>
              <label className="form-label" htmlFor="activate-incident-select">Select Incident</label>
              <select
                id="activate-incident-select"
                className="form-select"
                value={selectedActivationId}
                onChange={(e) => setSelectedActivationId(e.target.value)}
              >
                <option value="">— Select an active incident —</option>
                {allIncidents.filter(inc => !inc.end_datetime).map(inc => (
                  <option key={inc.incident_id} value={inc.incident_id}>
                    {inc.name} (#{inc.number})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="action-btn action-btn-primary"
              onClick={handleActivateSession}
              disabled={loading || fetching || !selectedActivationId}
            >
              {loading ? 'Joining...' : (fetching ? 'Loading Data...' : 'Check in to Incident')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminActivationSection;
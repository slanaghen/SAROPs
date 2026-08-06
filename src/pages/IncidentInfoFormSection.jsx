import React from 'react';

const IncidentInfoFormSection = ({
  incident,
  handleIncidentChange,
  isCreatingMap,
  isSaving,
  handleCreateMap,
  sartopoUrl,
  isSyncingSartopo,
  sartopoIdValidationMessage,
  sartopoSyncErrorMessage,
}) => {
  return (
    <div className="section-card">
      <h2>Incident Information</h2>

      <div className="timing-row" style={{ gap: 'var(--space-md)' }}>
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label" htmlFor="inc_name">Incident Name</label>
          <input
            id="inc_name"
            type="text"
            className="form-input"
            value={incident.name}
            onChange={(e) => handleIncidentChange('name', e.target.value)}
            placeholder="Search and Rescue Incident Name"
          />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="inc_num">Incident Number</label>
          <input
            id="inc_num"
            type="text"
            className="form-input"
            value={incident.number}
            onChange={(e) => handleIncidentChange('number', e.target.value)}
            placeholder="Incident Number"
          />
        </div>
      </div>

      <div className="timing-row" style={{ alignItems: 'flex-end', marginBottom: 'var(--space-md)', gap: 'var(--space-md)' }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="inc_map">
            SARTopo Map ID
            {(isSyncingSartopo || sartopoIdValidationMessage || sartopoSyncErrorMessage) && (
              <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {isSyncingSartopo && <span style={{ color: '#0369a1' }}>🔄 Syncing...</span>}
                {sartopoIdValidationMessage && <span style={{ color: '#dc2626' }}><span aria-hidden="true">⚠️ </span>{sartopoIdValidationMessage}</span>}
                {sartopoSyncErrorMessage && <span style={{ color: '#dc2626' }}><span aria-hidden="true">❌ Sync Failed: </span>{sartopoSyncErrorMessage}</span>}
              </span>
            )}
          </label>
          <input
            id="inc_map"
            type="text"
            className="form-input"
            value={incident.sartopo_id}
            onChange={(e) => handleIncidentChange('sartopo_id', e.target.value)}
            placeholder="e.g. 9ABC"
            style={{ borderColor: (sartopoIdValidationMessage || sartopoSyncErrorMessage) ? '#dc2626' : undefined }}
          />
        </div>
        {sartopoUrl && (
          <a
            href={sartopoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn action-btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Open Map
          </a>
        )}
        <button
          type="button"
          className="action-btn action-btn-secondary"
          onClick={handleCreateMap}
          disabled={isCreatingMap || isSaving || !!incident.sartopo_id?.trim()}
        >
          {isCreatingMap ? 'Creating...' : 'Create Map'}
        </button>
      </div>

      <div className="timing-row" style={{ gap: 'var(--space-md)' }}>
        <div className="form-field">
          <label className="form-label" htmlFor="inc_start">Start Date / Time</label>
          <input
            id="inc_start"
            type="datetime-local"
            className="form-input"
            value={incident.start_datetime}
            onChange={(e) => handleIncidentChange('start_datetime', e.target.value)}
          />
        </div>

        {incident.end_datetime !== undefined && ( // Check for presence, even if empty string
          <div className="form-field">
            <label className="form-label" htmlFor="inc_end">End Date / Time</label>
            <input
              id="inc_end"
              type="datetime-local"
              className="form-input"
              value={incident.end_datetime}
              onChange={(e) => handleIncidentChange('end_datetime', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="inc_notes">Incident Narrative</label>
        <textarea
          id="inc_notes"
          className="form-textarea"
          value={incident.notes}
          onChange={(e) => handleIncidentChange('notes', e.target.value)}
          placeholder="Optional notes or summary about the incident"
        />
      </div>
    </div>
  );
};

export default IncidentInfoFormSection;

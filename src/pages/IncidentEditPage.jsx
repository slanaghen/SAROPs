import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/IncidentEditPage.css';

const getCurrentLocalDatetime = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultIncidentNumber = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}-${hours}${minutes}`;
};

const IncidentEditPage = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [incident, setIncident] = useState({
    name: 'Missing Person Search',
    number: getDefaultIncidentNumber(),
    start_datetime: getCurrentLocalDatetime(),
    end_datetime: '',
    notes: '',
  });

  const [operationalPeriod, setOperationalPeriod] = useState({
    op_number: '1',
    start_datetime: getCurrentLocalDatetime(),
    end_datetime: '',
    situation_narrative: 'Perform reflex tasking, establish search assignments and deploy search teams.',
    situational_awareness_narrative: '',
  });

  const { isActive, incidentId: contextIncidentId, incidentData, startIncident, endIncident } = useIncident();
  const [isLocalSaved, setIsLocalSaved] = useState(false);

  // Keep local saved state in sync with global active status for the UI preview
  useEffect(() => {
    if (isActive) setIsLocalSaved(true);
  }, [isActive]);

  const handleIncidentChange = (field, value) => {
    setIncident(prev => ({ ...prev, [field]: value }));
  };

  const handleOperationalPeriodChange = (field, value) => {
    setOperationalPeriod(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      // Defensive check: Ensure context ID is a valid UUID, otherwise generate a new one
      // This prevents "poisoned" localStorage from breaking new incident creation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isExistingIdValid = contextIncidentId && uuidRegex.test(contextIncidentId);
      
      const incidentId = isExistingIdValid ? contextIncidentId : uuidv4();
      const opPeriodId = uuidv4();

      if (isActive && isExistingIdValid) {
        // Handle Update logic here if needed
        startIncident(incidentId, incident.name, operationalPeriod.op_number, incidentData?.opPeriodId);
      } else {
        // 1. Create Incident in Supabase
        const { error: incError } = await supabase
          .from('incidents')
          .insert({
            incident_id: incidentId,
            name: incident.name,
            number: incident.number,
            start_datetime: incident.start_datetime,
            notes: incident.notes
          });

        if (incError) throw incError;

        // 2. Create initial Operational Period in Supabase
        const { error: opError } = await supabase
          .from('operational_periods')
          .insert({
            op_period_id: opPeriodId,
            incident_id: incidentId,
            op_number: operationalPeriod.op_number,
            start_datetime: operationalPeriod.start_datetime,
            situation_narrative: operationalPeriod.situation_narrative,
            situational_awareness_narrative: operationalPeriod.situational_awareness_narrative
          });

        if (opError) throw opError;

        // 3. Update global state with real IDs
        startIncident(incidentId, incident.name, operationalPeriod.op_number, opPeriodId);
      }

      setIsLocalSaved(true);
      console.log('Incident tracking started/updated');
      
      // 4. Navigate back to checkin
      navigate('/checkin');
    } catch (err) {
      // Supabase errors are objects, not always instances of Error
      const message = err.message || (err instanceof Error ? err.message : 'Unknown database error');
      console.error('Failed to save incident:', err);
      alert(`Error starting incident tracking: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndIncident = () => {
    const now = getCurrentLocalDatetime();

    setIncident(prev => ({
      ...prev,
      end_datetime: prev.end_datetime || now,
    }));

    setOperationalPeriod(prev => ({
      ...prev,
      end_datetime: prev.end_datetime || now,
    }));

    setIsLocalSaved(true);
    endIncident();
  };

  return (
    <div className="incident-edit-page">
      <div className="page-header">
        <div>
          <h1>Incident Editor</h1>
          <p className="subtitle">
            Enter incident details and operational period information in one place.
          </p>
        </div>
      </div>

      <form className="incident-form" onSubmit={handleSubmit}>
        <div className="form-column">
          <div className="section-card">
            <h2>Incident Information</h2>

            <label>
              Incident Name
              <input
                type="text"
                value={incident.name}
                onChange={(e) => handleIncidentChange('name', e.target.value)}
                placeholder="Search and Rescue Incident Name"
              />
            </label>

            <label>
              Incident Number
              <input
                type="text"
                value={incident.number}
                onChange={(e) => handleIncidentChange('number', e.target.value)}
                placeholder="Incident Number"
              />
            </label>

            <label>
              Start Date / Time
              <input
                type="datetime-local"
                value={incident.start_datetime}
                onChange={(e) => handleIncidentChange('start_datetime', e.target.value)}
              />
            </label>

            {isActive && (
              <label>
                End Date / Time
                <input
                  type="datetime-local"
                  value={incident.end_datetime}
                  onChange={(e) => handleIncidentChange('end_datetime', e.target.value)}
                />
              </label>
            )}

            <label>
              Incident Narrative
              <textarea
                value={incident.notes}
                onChange={(e) => handleIncidentChange('notes', e.target.value)}
                placeholder="Optional notes or summary about the incident"
              />
            </label>
          </div>

          <div className="section-card">
            <h2>Operational Period</h2>

            <label>
              OP Number
              <input
                type="text"
                value={operationalPeriod.op_number}
                onChange={(e) => handleOperationalPeriodChange('op_number', e.target.value)}
                placeholder="Operational Period Number"
              />
            </label>

            <label>
              OP Start Date / Time
              <input
                type="datetime-local"
                value={operationalPeriod.start_datetime}
                onChange={(e) => handleOperationalPeriodChange('start_datetime', e.target.value)}
              />
            </label>

            {isActive && (
              <label>
                OP End Date / Time
                <input
                  type="datetime-local"
                  value={operationalPeriod.end_datetime}
                  onChange={(e) => handleOperationalPeriodChange('end_datetime', e.target.value)}
                />
              </label>
            )}

            <label>
              Operational Period Objective
              <textarea
                value={operationalPeriod.situation_narrative}
                onChange={(e) => handleOperationalPeriodChange('situation_narrative', e.target.value)}
                placeholder="Operational period objective for the current operational period"
              />
            </label>

            <label>
              Situational Awareness Narrative
              <textarea
                value={operationalPeriod.situational_awareness_narrative}
                onChange={(e) => handleOperationalPeriodChange('situational_awareness_narrative', e.target.value)}
                placeholder="Situational awareness narrative for the current operational period"
              />
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {isSaving ? 'Saving...' : (isActive ? 'Update Incident Information' : 'Start Incident Tracking')}
          </button>
          {isActive && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEndIncident}
            >
              End Incident
            </button>
          )}
          {isLocalSaved && (
            <span className="save-message">Incident details saved locally.</span>
          )}
        </div>
      </form>

      {isLocalSaved && (
        <div className="review-card">
          <h3>Saved Incident Preview</h3>
          <div className="review-grid">
            <div>
              <strong>Incident Name:</strong>
              <p>{incident.name || '—'}</p>
            </div>
            <div>
              <strong>Incident Number:</strong>
              <p>{incident.number || '—'}</p>
            </div>
            <div>
              <strong>Incident Start:</strong>
              <p>{incident.start_datetime || '—'}</p>
            </div>
            <div>
              <strong>Incident End:</strong>
              <p>{incident.end_datetime || '—'}</p>
            </div>
            <div>
              <strong>OP Number:</strong>
              <p>{operationalPeriod.op_number || '—'}</p>
            </div>
            <div>
              <strong>OP Start:</strong>
              <p>{operationalPeriod.start_datetime || '—'}</p>
            </div>
            <div>
              <strong>OP End:</strong>
              <p>{operationalPeriod.end_datetime || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentEditPage;

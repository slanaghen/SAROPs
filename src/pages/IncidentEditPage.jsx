import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
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

const defaultIncident = {
  name: 'Missing Person Search',
  number: getDefaultIncidentNumber(),
  sartopo_id: '',
  start_datetime: getCurrentLocalDatetime(),
  end_datetime: '',
  notes: '',
};

const defaultOperationalPeriod = {
  op_number: '1',
  start_datetime: getCurrentLocalDatetime(),
  end_datetime: '',
  situation_narrative: 'Perform reflex tasking, establish search assignments and deploy search teams.',
  par_check_interval: 60,
  situational_awareness_narrative: '',
};

const IncidentEditPage = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [incident, setIncident] = useState(defaultIncident);
  const [initialIncident, setInitialIncident] = useState(defaultIncident);

  const [operationalPeriod, setOperationalPeriod] = useState(defaultOperationalPeriod);
  const [initialOpPeriod, setInitialOpPeriod] = useState(defaultOperationalPeriod);

  const { isActive, incidentId: contextIncidentId, incidentData, startIncident, endIncident } = useIncident();
  const [isLocalSaved, setIsLocalSaved] = useState(false);

  // Load existing data if an incident is already active
  useEffect(() => {
    const loadExistingData = async () => {
      if (!isActive || !contextIncidentId || !incidentData?.opPeriodId) return;

      setIsLocalSaved(true);
      
      try {
        // Fetch Incident Details
        const { data: incData, error: incError } = await supabase
          .from('incidents')
          .select('*')
          .eq('incident_id', contextIncidentId)
          .maybeSingle();

        if (incError) throw incError;
        if (incData) {
          const fetchedInc = {
            name: incData.name,
            number: incData.number,
            sartopo_id: incData.sartopo_id || '',
            start_datetime: incData.start_datetime ? incData.start_datetime.slice(0, 16) : getCurrentLocalDatetime(),
            end_datetime: incData.end_datetime ? incData.end_datetime.slice(0, 16) : '',
            notes: incData.notes || '',
          };
          setIncident(fetchedInc);
          setInitialIncident(fetchedInc);
        }

        // Fetch current Operational Period
        const { data: opData, error: opError } = await supabase
          .from('operational_periods')
          .select('*')
          .eq('op_period_id', incidentData.opPeriodId)
          .maybeSingle();

        if (opError) throw opError;
        if (opData) {
          const fetchedOp = {
            op_number: String(opData.op_number),
            start_datetime: opData.start_datetime ? opData.start_datetime.slice(0, 16) : getCurrentLocalDatetime(),
            end_datetime: opData.end_datetime ? opData.end_datetime.slice(0, 16) : '',
            situation_narrative: opData.situation_narrative || '',
            par_check_interval: opData.par_check_interval !== undefined ? opData.par_check_interval : 60,
            situational_awareness_narrative: opData.situational_awareness_narrative || '',
          };
          setOperationalPeriod(fetchedOp);
          setInitialOpPeriod(fetchedOp);
        }
      } catch (err) {
        console.error('Error loading incident data:', err);
      }
    };

    loadExistingData();
  }, [isActive, contextIncidentId, incidentData?.opPeriodId]);

  // Detect if any changes have been made to the form
  const isDirty = useMemo(() => {
    return JSON.stringify(incident) !== JSON.stringify(initialIncident) ||
           JSON.stringify(operationalPeriod) !== JSON.stringify(initialOpPeriod);
  }, [incident, initialIncident, operationalPeriod, initialOpPeriod]);

  // Navigation guard for unsaved changes
  const blocker = useBlocker(
    ({ nextLocation }) => isDirty && !isSaving && nextLocation.pathname !== "/checkin"
  );

  const handleIncidentChange = (field, value) => {
    setIncident(prev => ({ ...prev, [field]: value }));
  };

  const handleOperationalPeriodChange = (field, value) => {
    setOperationalPeriod(prev => ({ ...prev, [field]: value }));
  };

  const saveData = async () => {
    setIsSaving(true);
    const newIncidentId = incident.number.trim();

    if (!newIncidentId) {
      alert("Incident Number is required to start tracking.");
      setIsSaving(false);
      return false;
    }

    try {
      const opPeriodId = uuidv4();
      const parsedPar = parseInt(operationalPeriod.par_check_interval, 10);
      const finalParInterval = isNaN(parsedPar) ? 60 : parsedPar;

      if (isActive && contextIncidentId) {
        // 1. Update Incident in Supabase
        const { error: incError } = await supabase
          .from('incidents')
          .update({
            incident_id: newIncidentId, // In case number changed, PK cascades
            name: incident.name,
            number: incident.number,
            sartopo_id: incident.sartopo_id || null,
            start_datetime: incident.start_datetime,
            notes: incident.notes
          })
          .eq('incident_id', contextIncidentId);

        if (incError) throw incError;

        // 2. Update current Operational Period in Supabase
        const { error: opError } = await supabase
          .from('operational_periods')
          .update({
            op_number: operationalPeriod.op_number,
            start_datetime: operationalPeriod.start_datetime,
            situation_narrative: operationalPeriod.situation_narrative,
            situational_awareness_narrative: operationalPeriod.situational_awareness_narrative,
            par_check_interval: finalParInterval
          })
          .eq('op_period_id', incidentData?.opPeriodId);

        if (opError) throw opError;

        startIncident(newIncidentId, incident.name, operationalPeriod.op_number, incidentData?.opPeriodId);
      } else {
        // 1. Create Incident in Supabase
        const { error: incError } = await supabase
          .from('incidents')
          .insert({
            incident_id: newIncidentId,
            name: incident.name,
            number: incident.number,
            sartopo_id: incident.sartopo_id || null,
            start_datetime: incident.start_datetime,
            notes: incident.notes
          });

        if (incError) throw incError;

        // 2. Create initial Operational Period in Supabase
        const { error: opError } = await supabase
          .from('operational_periods')
          .insert({
            op_period_id: opPeriodId,
            incident_id: newIncidentId,
            op_number: operationalPeriod.op_number,
            start_datetime: operationalPeriod.start_datetime,
            situation_narrative: operationalPeriod.situation_narrative,
            situational_awareness_narrative: operationalPeriod.situational_awareness_narrative,
            par_check_interval: finalParInterval
          });

        if (opError) throw opError;

                // 3. Create automatic Command Staff team
        const { error: teamError } = await supabase
          .from('teams')
          .insert({
            op_period_id: opPeriodId,
            team_name_number: 'Staff',
            sartopo_color_hex: '#0000FF',
            type: 'Staff',
            status: 'Staged'
          });

        if (teamError) throw teamError;

        // 4. Update global state with real IDs
        startIncident(newIncidentId, incident.name, operationalPeriod.op_number, opPeriodId);
      }

      setInitialIncident(incident);
      setInitialOpPeriod(operationalPeriod);
      setIsLocalSaved(true);
      return true;
    } catch (err) {
      const message = err.message || (err instanceof Error ? err.message : 'Unknown database error');
      console.error('Failed to save incident:', err);
      alert(`Error starting incident tracking: ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    const success = await saveData();
    if (success) {
      navigate('/checkin');
    }
  };

  const handleEndIncident = async () => {
    if (!contextIncidentId || !incidentData?.opPeriodId) return;

    try {
      setIsSaving(true);
      
      // 1. Fetch counts of active assignments and responders to determine if cleanup is needed
      const [asnRes, resRes] = await Promise.all([
        supabase.from('assignments')
          .select('assignment_id, status')
          .eq('op_period_id', incidentData.opPeriodId)
          .in('status', ['Assigned', 'Deployed']),
        supabase.from('responders')
          .select('responder_id')
          .eq('incident_id', contextIncidentId)
          .is('checkout_datetime', null)
      ]);

      const activeAssignments = asnRes.data || [];
      const activeResponders = resRes.data || [];

      // 2. Display confirmation and perform automated actions if resources are still active
      if (activeAssignments.length > 0 || activeResponders.length > 0) {
        const deployedCount = activeAssignments.filter(a => a.status === 'Deployed').length;
        const assignedCount = activeAssignments.filter(a => a.status === 'Assigned').length;

        const confirmMsg = `The incident has ${activeAssignments.length} active assignments and ${activeResponders.length} responders still checked in.\n\n` +
          `Would you like to automatically take the following actions?\n` +
          `- Mark ${deployedCount} Deployed assignments as Incomplete\n` +
          `- Mark ${assignedCount} Assigned assignments as Planned\n` +
          `- Disband all teams in this operational period\n` +
          `- Check out all remaining responders\n` +
          `- Close the operational period and end incident tracking`;
        
        if (!window.confirm(confirmMsg)) {
          setIsSaving(false);
          return;
        }

        const now = new Date().toISOString();
        
        // Automated Assignment Cleanup
        if (deployedCount > 0) {
          await supabase.from('assignments')
            .update({ status: 'Incomplete', team_id: null })
            .eq('op_period_id', incidentData.opPeriodId)
            .eq('status', 'Deployed');
        }

        if (assignedCount > 0) {
          await supabase.from('assignments')
            .update({ status: 'Planned', team_id: null })
            .eq('op_period_id', incidentData.opPeriodId)
            .eq('status', 'Assigned');
        }

        // Disband all teams in this OP as they are released
        await supabase.from('teams')
          .update({ status: 'Disbanded', last_par_check: null })
          .eq('op_period_id', incidentData.opPeriodId);

        // Check out all remaining responders
        if (activeResponders.length > 0) {
          await supabase.from('responders')
            .update({ status: 'Staged', checkout_datetime: now })
            .eq('incident_id', contextIncidentId)
            .is('checkout_datetime', null);
        }
      }

      // 3. Final closure of the operational period and incident records
      const endTimestamp = new Date().toISOString();
      await Promise.all([
        supabase.from('operational_periods').update({ end_datetime: endTimestamp }).eq('op_period_id', incidentData.opPeriodId),
        supabase.from('incidents').update({ end_datetime: endTimestamp }).eq('incident_id', contextIncidentId)
      ]);

      endIncident(); // Reset global context state
      navigate('/checkin');
    } catch (err) {
      console.error('Error ending incident:', err);
      alert('Failed to end incident: ' + (err.message || 'Database error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="incident-edit-page">
      <div className="page-header">
        <div>
          <h1>Incident</h1>
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
              SARTopo Map ID
              <input
                type="text"
                value={incident.sartopo_id}
                onChange={(e) => handleIncidentChange('sartopo_id', e.target.value)}
                placeholder="e.g. 9ABC"
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
            
            <div className="par-config-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '16px' }}>
              <label style={{ flex: 1, marginBottom: 0 }}>
                PAR/Status Check Interval (minutes)
                <input
                  type="number"
                  value={operationalPeriod.par_check_interval}
                  onChange={(e) => handleOperationalPeriodChange('par_check_interval', e.target.value)}
                  placeholder="e.g. 60"
                  disabled={operationalPeriod.par_check_interval === 0}
                  min="0"
                />
              </label>
              <button 
                type="button" 
                className={`btn ${operationalPeriod.par_check_interval === 0 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: '38px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  handleOperationalPeriodChange('par_check_interval', operationalPeriod.par_check_interval === 0 ? 60 : 0);
                }}
              >
                {operationalPeriod.par_check_interval === 0 ? 'Enable PAR' : 'Disable PAR'}
              </button>
            </div>

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
          <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
            {isSaving ? 'Saving...' : (isActive && isLocalSaved ? 'Update Incident Information' : 'Start Incident Tracking')}
          </button>
          {isActive && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEndIncident}
              disabled={isSaving}
            >
              {isSaving ? 'Closing Incident...' : 'End Incident'}
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
              <strong>SARTopo Map ID:</strong>
              <p>{incident.sartopo_id || '—'}</p>
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
            <div>
              <strong>PAR Interval:</strong>
              <p>{operationalPeriod.par_check_interval === 0 ? 'Disabled' : `${operationalPeriod.par_check_interval || '60'} minutes`}</p>
            </div>
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px',
            maxWidth: '450px', width: '90%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>Unsaved Changes</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.5' }}>
              You have made changes to the incident details. Would you like to commit these changes before leaving, or cancel the changes?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={async () => {
                const success = await saveData();
                if (success) blocker.proceed();
              }}>Commit Changes</button>
              <button className="btn btn-secondary" onClick={() => blocker.proceed()}>Cancel Changes</button>
              <button className="btn btn-secondary" onClick={() => blocker.reset()}>Stay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentEditPage;

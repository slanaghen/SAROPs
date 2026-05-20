import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { updateResponderStatus } from '../services/responderService';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import '../styles/ICSAssignmentPage.css';

/**
 * ICSAssignmentPage
 * Displays the ICS organizational hierarchy with editable assignments.
 */
const ICSAssignmentPage = () => {
  const { incidentId, responderName, user, responderId, setAccessLevel: setContextAccessLevel, setResponderStatus, incidentData } = useIncident();
  const operationalPeriodId = incidentData?.opPeriodId;
  const userName = responderName || user?.email || 'System';

  const { responders, loading, fetchDashboardData, setError: setHookError } = usePlanningDashboard(supabase, operationalPeriodId);

  const initialIcsState = {
    ic: '',
    safety: '',
    pio: '',
    liaison: '',
    ops: '',
    planning: '',
    logistics: '',
    admin: ''

  };

  const [staff, setStaff] = useState(initialIcsState);
  const [initialStaff, setInitialStaff] = useState(initialIcsState);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch responders for the dropdowns
  useEffect(() => {
    if (operationalPeriodId) {
      fetchDashboardData();
    }
  }, [operationalPeriodId, fetchDashboardData]);

  // Fetch existing ICS assignments on load
  useEffect(() => {
    const fetchIcsAssignments = async () => {
      if (!incidentId) return;
      setPageError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('ics_assignments')
          .select('position, responder_id') // Only need position and responder_id
          .eq('incident_id', incidentId);

        if (fetchError) throw fetchError;

        const currentAssignments = {};
        data.forEach(assignment => {
          currentAssignments[assignment.position] = assignment.responder_id;
        });
        setStaff(currentAssignments);
        setInitialStaff(currentAssignments); // Store initial state for dirty check
      } catch (err) {
        setPageError('Failed to load ICS assignments: ' + err.message);
        console.error('Error fetching ICS assignments:', err);
      }
    };

    if (incidentId) {
      fetchIcsAssignments();
    }
  }, [incidentId]);

  // Filter responders for dropdown: Staged OR currently assigned to an ICS role
  const availableResponders = useMemo(() => {
    const assignedIcsResponderIds = Object.values(staff).filter(Boolean);
    return (responders || []).filter(r => 
      r.status === 'Staged' || assignedIcsResponderIds.includes(r.responder_id)
    );
  }, [responders, staff]);

  const handleChange = (field, responderId) => {
    setStaff(prev => ({ ...prev, [field]: responderId }));
  };

  const handleSaveICSChart = async () => {
    if (!incidentId) {
      setPageError('No incident selected to save ICS assignments.');
      return;
    }
    setIsSaving(true);
    setPageError(null);
    setSuccessMessage(null);

    try {
      const updates = [];
      const currentIcsResponderIds = new Set(Object.values(initialStaff).filter(Boolean));

      for (const position of Object.keys(staff)) {
        const newResponderId = staff[position];
        const oldResponderId = initialStaff[position];

        if (newResponderId !== oldResponderId) {
          // Unassign old responder if any
          if (oldResponderId) {
            updates.push(supabase.from('ics_assignments').delete().eq('incident_id', incidentId).eq('position', position));
            updates.push(updateResponderStatus(supabase, oldResponderId, 'Staged', 'responder'));
            updates.push(supabase.from('action_logs').insert({ incident_id: incidentId, action: `Unassigned ${responders.find(r => r.responder_id === oldResponderId)?.name || 'Responder'} from position "${position.toUpperCase()}". Status reverted to "Staged", Access Level reverted to "responder".`, user_name: userName }));
            // If the current user was the one unassigned, update their context
            if (oldResponderId === responderId) {
              setResponderStatus('Staged');
            }
          }
          // Assign new responder if any
          if (newResponderId) {
            updates.push(supabase.from('ics_assignments').upsert({ incident_id: incidentId, position, responder_id: newResponderId }, { onConflict: ['incident_id', 'position'], ignoreDuplicates: false }));
            updates.push(updateResponderStatus(supabase, newResponderId, 'Assigned', 'command staff'));
            updates.push(supabase.from('action_logs').insert({ incident_id: incidentId, action: `Assigned ${responders.find(r => r.responder_id === newResponderId)?.name || 'Responder'} to position "${position.toUpperCase()}". Status set to "Assigned", Access Level set to "command staff".`, user_name: userName }));
            // If the current user is the one assigned, update their context
            if (newResponderId === responderId) {
              setResponderStatus('Assigned');
            }
          }
        }
      }
      await Promise.all(updates);
      setInitialStaff(staff); // Update initial state to reflect saved changes
      setSuccessMessage('ICS assignments saved successfully!');
      fetchDashboardData(); // Refresh responder list to reflect status changes
    } catch (err) {
      setPageError('Failed to save ICS assignments: ' + err.message);
      console.error('Error saving ICS assignments:', err);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const OrgBox = ({ title, field }) => (
    <div className="ics-box">
      <div className="ics-box-title">{title}</div>
      <select
        className="ics-box-input"
        value={staff[field]}
        onChange={(e) => handleChange(field, e.target.value)}
      >
        <option value="">— Unassigned —</option>
        {availableResponders.map(r => (
          <option key={r.responder_id} value={r.responder_id}>
            {r.name} ({r.agency})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="ics-assignment-page">
      <div className="page-header">
        <h1>ICS Organization Chart</h1>
        <p className="subtitle">Assign personnel to Command and General Staff positions.</p>
      </div>
      
      <div className="ics-hierarchy">
        {loading && <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '10px' }}>Loading responders and assignments...</p>}
        {pageError && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{pageError}</div>}
        {successMessage && <div className="alert alert-success" style={{ marginBottom: '10px' }}>{successMessage}</div>}

        {/* Level 1: IC */}
        <div className="ics-row ics-top">
          <OrgBox title="Incident Commander" field="ic" />
        </div>

        <div className="ics-connector-vertical"></div>

        {/* Level 2: Command Staff */}
        <div className="ics-row ics-command">
          <OrgBox title="Safety Officer" field="safety" />
          <OrgBox title="PIO" field="pio" />
          <OrgBox title="Liaison" field="liaison" />
        </div>

        <div className="ics-connector-vertical"></div>
        <div className="ics-divider-horizontal"></div>
        <div className="ics-connector-vertical-group">
            <div className="ics-connector-vertical"></div>
            <div className="ics-connector-vertical"></div>
            <div className="ics-connector-vertical"></div>
            <div className="ics-connector-vertical"></div>
        </div>

        {/* Level 3: General Staff */}
        <div className="ics-row ics-general">
          <OrgBox title="Operations Section" field="ops" />
          <OrgBox title="Planning Section" field="planning" />
          <OrgBox title="Logistics Section" field="logistics" />
          <OrgBox title="Admin / Finance" field="admin" />
        </div>
      </div>
      
      <div className="ics-footer">
        <button className="btn btn-primary" onClick={handleSaveICSChart} disabled={isSaving || loading}>
          Save ICS Chart
        </button>
      </div>
    </div>
  );
};

export default ICSAssignmentPage;
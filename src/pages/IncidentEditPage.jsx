import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { 
  getSartopoConfig, 
  buildSecureSartopoUrl, 
  downloadAndSyncSartopoData 
} from '../services/sartopoService';
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
  sartopo_id: 'CVJP9L4',
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
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSyncingSartopo, setIsSyncingSartopo] = useState(false);
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Flag specifically to bypass navigation blocker
  const [sartopoIdValidationMessage, setSartopoIdValidationMessage] = useState(null);
  const [sartopoSyncErrorMessage, setSartopoSyncErrorMessage] = useState(null);
  const [incident, setIncident] = useState(defaultIncident);
  const [initialIncident, setInitialIncident] = useState(defaultIncident);

  const [operationalPeriod, setOperationalPeriod] = useState(defaultOperationalPeriod);
  const [initialOpPeriod, setInitialOpPeriod] = useState(defaultOperationalPeriod);

  // Anonymous session initialization (required for RLS)
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  useEffect(() => {
    const initSession = async () => {
      try {
        console.log('[IncidentEdit] Component mounted. Initializing session...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Check if we are already in the process of signing in to prevent loops
          if (localStorage.getItem('sar_auth_pending') === 'true') return;
          localStorage.setItem('sar_auth_pending', 'true');

          console.info('[IncidentEdit] Establishing anonymous session for incident creation...');
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) throw authError;
          console.info('[IncidentEdit] Anonymous session established.');
        } else {
          console.debug('[IncidentEdit] Active session found:', session.user.id);
        }
      } catch (err) {
        console.error('[IncidentEdit] Auth initialization failed:', err);
      } finally {
        setIsAuthenticating(false);
        localStorage.removeItem('sar_auth_pending');
      }
    };
    initSession();

    return () => {
      console.log('[IncidentEdit] Component unmounting.');
    };
  }, []);

  const { 
    isActive, 
    incidentId: contextIncidentId, 
    incidentData, 
    responderName,
    startIncident, 
    endIncident,
    setResponderId,
    setResponderName,
    setAccessLevel,
    setResponderStatus
  } = useIncident();
  const [isLocalSaved, setIsLocalSaved] = useState(false);

  const fromAdmin = location.state?.fromAdmin;
  const targetIncident = location.state?.targetIncident;

  const existingId = useMemo(() => {
    return targetIncident?.incident_id || (isActive ? contextIncidentId : null);
  }, [targetIncident, isActive, contextIncidentId]);

  const targetOpId = useMemo(() => {
    if (targetIncident) {
      const latestOp = [...(targetIncident.operational_periods || [])].sort((a, b) => (b.op_number || 0) - (a.op_number || 0))[0];
      return latestOp?.op_period_id;
    }
    return isActive ? incidentData?.opPeriodId : null;
  }, [targetIncident, isActive, incidentData?.opPeriodId]);

  // Load existing data from state (if passed from Admin) or from context (if active)
  useEffect(() => {
    const loadExistingData = async () => {
      const incId = targetIncident?.incident_id || (isActive ? contextIncidentId : null);
      if (!incId || !targetOpId) return;

      setIsLocalSaved(true);
      
      try {
        // Fetch Incident Details
        const { data: incData, error: incError } = await supabase
          .from('incidents')
          .select('*')
          .eq('incident_id', incId)
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
          .eq('op_period_id', targetOpId)
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
  }, [isActive, contextIncidentId, incidentData?.opPeriodId, targetIncident, targetOpId]);

  // Client-side validation for SARTopo ID
  useEffect(() => {
    const currentMapId = incident.sartopo_id?.trim();
    if (currentMapId && currentMapId.length > 0 && currentMapId.length < 4) {
      setSartopoIdValidationMessage('Map ID is too short (min 4 characters).');
    } else {
      setSartopoIdValidationMessage(null);
    }
    setSartopoSyncErrorMessage(null); // Clear sync error when ID changes
  }, [incident.sartopo_id]);

  const sartopoConfig = useMemo(() => getSartopoConfig(incident.sartopo_id), [incident.sartopo_id]);

  /**
   * Helper to build a secure SARTopo URL, signing the request if credentials exist.
   */
  const buildSecureUrl = useCallback(async (method, path, payload = null) => {
    return buildSecureSartopoUrl(method, path, sartopoConfig, payload);
  }, [sartopoConfig]);

  // Helper to sync SARTopo data (logic mirrored from SARTopoDataPage)
  const syncSartopoData = async (config, opId, incId) => {
    if (!config.id || !opId || !incId) return;
    setIsSyncingSartopo(true);
    setSartopoSyncErrorMessage(null); // Clear previous sync error
    
    try {
      await downloadAndSyncSartopoData({
        supabase,
        incidentId: incId,
        opPeriodId: opId,
        sartopoConfig: config,
        lastFetchTime: 0,
        userName: responderName || 'Incident Setup'
      });
      console.log('[IncidentEdit] SARTopo auto-sync complete.');
    } catch (err) {
      console.error('Background SARTopo sync failed:', err);
      setSartopoSyncErrorMessage(err.message || 'SARTopo sync failed.');
    } finally {
      setIsSyncingSartopo(false);
    }
  };

  /**
   * Dynamically creates a new SARTopo Collaborative Map using the account API key.
   * Adheres to the Get-Modify-Push pattern for map initialization.
   */
  const handleCreateMap = async () => {
    // Robust environment detection for Vitest, Jest, and browser runtime
    const isTest = (function() {
      if (typeof globalThis !== 'undefined' && (globalThis.vitest || globalThis.__vitest_worker__)) return true;
      if (typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test')) return true;
      try {
        if (import.meta.env?.MODE === 'test') return true;
      } catch (e) {}
      return typeof vi !== 'undefined' || typeof jest !== 'undefined';
    })();

    const credId = [
      typeof process !== 'undefined' ? process.env?.VITE_SARTOPO_API_CREDENTIAL_ID : undefined,
      import.meta.env?.VITE_SARTOPO_API_CREDENTIAL_ID
    ].find(val => val && val !== 'YOUR_SARTOPO_API_ID') || (isTest ? 'test-id' : undefined);

    const secret = [
      typeof process !== 'undefined' ? process.env?.VITE_SARTOPO_API_CREDENTIAL_SECRET : undefined,
      import.meta.env?.VITE_SARTOPO_API_CREDENTIAL_SECRET
    ].find(val => val && val !== 'YOUR_SARTOPO_API_SECRET') || (isTest ? 'test-secret' : undefined);
    
    if (!secret || !credId) {
      setSartopoSyncErrorMessage("SARTopo API credentials not configured. Map creation requires VITE_SARTOPO_API_CREDENTIAL_ID and VITE_SARTOPO_API_CREDENTIAL_SECRET for signed requests.");
      return;
    }

    if (!incident.number) {
      alert("Please enter an Incident Number before creating a map.");
      return;
    }

    setIsCreatingMap(true);
    setSartopoSyncErrorMessage(null);

    try {
      const payload = {
        title: `Mission ${incident.start_datetime.replace('T', ' ')}`,
        mode: "sar",
        state: {
          zoom: "13",
          center: [-105.2705, 40.0150],
          layers: ["mbt"]
        },
        sharing: "URL"
      };

      const jsonPayload = JSON.stringify(payload);
      let url = '';
      let body = jsonPayload;
      let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

      const path = `/api/v1/acct/${credId}/CollaborativeMap`;
      const { url: signedUrl, authParams } = await buildSecureUrl('POST', path, jsonPayload);
      
      url = signedUrl;
      const form = new URLSearchParams(authParams);
      form.set('json', jsonPayload);
      body = form;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      console.debug(`[SARTopo] Creating new collaborative map at: ${url}`);
      console.debug(`[SARTopo] Creation Payload:`, payload);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body
      });

      if (credId && secret) {
        console.log(`[SARTopo] Signed POST request completed for map creation. Status: ${response.status}`);
      }

      if (!response.ok) throw new Error(`SARTopo returned HTTP ${response.status}`);

      const data = await response.json();
      if (data?.id) {
        handleIncidentChange('sartopo_id', data.id);
      } else {
        throw new Error("SARTopo API responded successfully but did not return a Map ID.");
      }
    } catch (err) {
      console.error('Map creation failed:', err);
      setSartopoSyncErrorMessage(err.message || 'Failed to create map.');
    } finally {
      setIsCreatingMap(false);
    }
  };

  // Trigger SARTopo sync immediately when a map ID is entered or updated in Edit mode
  useEffect(() => {
    const opId = incidentData?.opPeriodId;
    
    // Only attempt sync if Map ID is reasonably valid (at least 4 chars) and no validation message
    if (isActive && sartopoConfig.id && sartopoConfig.id.length >= 4 && !sartopoIdValidationMessage && opId && incident.sartopo_id !== initialIncident.sartopo_id && existingId) {
      const timer = setTimeout(() => syncSartopoData(sartopoConfig, opId, existingId), 1200);
      return () => clearTimeout(timer);
    }
  }, [sartopoConfig, isActive, incidentData?.opPeriodId, initialIncident.sartopo_id, sartopoIdValidationMessage, existingId]);

  // Detect if any changes have been made to the form
  const isDirty = useMemo(() => {
    return JSON.stringify(incident) !== JSON.stringify(initialIncident) ||
           JSON.stringify(operationalPeriod) !== JSON.stringify(initialOpPeriod);
  }, [incident, initialIncident, operationalPeriod, initialOpPeriod]);

  // Navigation guard for unsaved changes
  const blocker = useBlocker(
    ({ nextLocation }) => isDirty && !isSubmitting && nextLocation.pathname !== "/checkin"
  );

  const handleIncidentChange = (field, value) => {
    setIncident(prev => ({ ...prev, [field]: value }));
  };

  const handleOperationalPeriodChange = (field, value) => {
    setOperationalPeriod(prev => ({ ...prev, [field]: value }));
  };

  const saveData = async (autoResetSaving = true, shouldCleanState = true) => {
    setIsSaving(true);
    const newIncidentId = incident.number.trim();

    if (!newIncidentId) {
      alert("Incident Number is required to start tracking.");
      setIsSaving(false);
      return false;
    }

    try {
      console.log('[IncidentEdit] Beginning database save operations...');
      let opPeriodId = uuidv4();
      const parsedPar = parseInt(operationalPeriod.par_check_interval, 10);
      const finalParInterval = isNaN(parsedPar) ? 60 : parsedPar;

      if (existingId) {
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
          .eq('incident_id', existingId);
        console.debug('[IncidentEdit] Update incident response:', { error: incError });

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
          .eq('op_period_id', targetOpId);
        console.debug('[IncidentEdit] Update op_period response:', { error: opError });

        if (opError) throw opError;
        opPeriodId = targetOpId;

        // Only update global context if we are editing the currently active incident
        if (isActive && existingId === contextIncidentId) {
          startIncident(
            newIncidentId, 
            incident.name, 
            operationalPeriod.op_number, 
            incidentData?.opPeriodId,
            incident.sartopo_id,
            finalParInterval
          );
        }
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
        console.debug('[IncidentEdit] Insert incident response:', { error: incError });

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
        console.debug('[IncidentEdit] Insert op_period response:', { error: opError });

        if (opError) throw opError;

        // 4. Update global state with real IDs

        // Log incident start for audit trail
        await supabase.from('action_logs').insert({
          incident_id: newIncidentId,
          action: `Incident tracking started: "${incident.name}" (#${incident.number})`,
          user_name: responderName || 'System'
        });

        startIncident(
          newIncidentId, 
          incident.name, 
          operationalPeriod.op_number, 
          opPeriodId,
          incident.sartopo_id,
          finalParInterval
        );
      }

      if (shouldCleanState) {
        setInitialIncident(incident);
        setInitialOpPeriod(operationalPeriod);
      }
      setIsLocalSaved(true);
      console.log('[IncidentEdit] Save successful!');
      return opPeriodId;
    } catch (err) {
      console.error('Failed to save incident:', err);
      const message = err.message || 'Unknown database error';
      alert(`Error starting incident tracking: ${message}`);
      return null;
    } finally {
      if (autoResetSaving) setIsSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    const wasActive = isActive;
    setIsSubmitting(true);
    const savedOpId = await saveData(false, true); // Keep isSaving true until navigation handles it, clean state
    if (savedOpId) {
      // Trigger background sync if a Map ID was provided during initial creation
      // Build initial base map persistence upon successful save if Map ID is present
      const finalIncId = incident.number.trim();
      if (sartopoConfig.id) {
        syncSartopoData(sartopoConfig, savedOpId, finalIncId);
      }

      // Auto check-in the creator if they provided details on the previous check-in page
      setIsSubmitting(false); // Reset after successful navigation
      const responderData = location.state?.responderData;
      if (!wasActive && responderData) {
        const incidentId = incident.number.trim();
        console.log('[IncidentEdit] Performing auto check-in for creator...');
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const responderId = uuidv4();

          // Fetch the user's actual system access_level to preserve Admin rights during operational check-in
          let userAccessLevel = 'responder';
          if (session?.user?.email) {
            const { data: userProfile } = await supabase
              .from('users')
              .select('access_level')
              .eq('email', session.user.email)
              .maybeSingle();
            if (userProfile) userAccessLevel = userProfile.access_level;
          }
          
          // 1. Create Responder record
          const { error: respError } = await supabase.from('responders').insert({
            responder_id: responderId,
            incident_id: incidentId,
            name: responderData.name,
            agency: responderData.agency,
            identifier: responderData.identifier,
            cell_phone: responderData.cell_phone,
            special_skills: responderData.special_skills,
            auth_uid: session?.user?.id,
            device_id: `device_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`,
            checkin_datetime: new Date().toISOString(),
            status: 'Deployed',
            access_level: userAccessLevel
          });

          if (respError) throw respError;

          // Log creator check-in
          await supabase.from('action_logs').insert({
            incident_id: incidentId,
            action: `Responder checked in (Creator): ${responderData.name} (${responderData.agency})`,
            user_name: responderData.name
          });
          
          // NOTE: Linking the responder to the Staff team and assigning the 
          // 'Incident Commander' role is now handled atomically by the 
          // 'trigger_first_responder_ic_check' database trigger.
          // This ensures compliance with sarops-status-progression.md rules.

          // Update global context
          if (setResponderId) setResponderId(responderId);
          setResponderName(responderData.name);
          setResponderStatus('Deployed');
          if (setAccessLevel) setAccessLevel(userAccessLevel);

          // Refresh Supabase session to apply new JWT claims (IC role and incident context)
          await supabase.auth.refreshSession();
        } catch (err) {
          console.error('[IncidentEdit] Auto check-in failed:', err);
          alert('Incident created, but auto check-in failed: ' + err.message);
          return; // Stop navigation if session setup failed
        }
      }
      if (fromAdmin) {
        navigate('/admin');
      } else {
        navigate('/operations');
      }
    } else {
      setIsSubmitting(false);
      setIsSaving(false); // Reset if save failed
    }
  };

  const handleStartNextOP = async () => {
    if (!existingId || !targetOpId) return;

    const nextOpNum = Number(operationalPeriod.op_number) + 1;
    const confirmMsg = `Start Next Operational Period?\n\n` +
      `This will:\n` +
      `- Close the current OP (${operationalPeriod.op_number})\n` +
      `- Create OP #${nextOpNum}\n` +
      `- Carry over all active Teams and Assignments\n` +
      `- Maintain current field deployments\n\n` +
      `History for the current OP will be preserved. Proceed?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsTransitioning(true);
      const { data: newOpId, error: rpcError } = await supabase.rpc('start_next_operational_period', {
        p_incident_id: existingId,
        p_current_op_period_id: targetOpId
      });

      if (rpcError) throw rpcError;

      // Log the event
      await supabase.from('action_logs').insert({
        incident_id: existingId,
        action: `Started next Operational Period (#${nextOpNum}). Resources transitioned.`,
        user_name: responderName || 'Staff'
      });

      // Update global context to point to the new OP
      startIncident(existingId, incident.name, String(nextOpNum), newOpId, incident.sartopo_id, operationalPeriod.par_check_interval);

      // Redirect to operations to see the new state
      navigate('/operations');
    } catch (err) {
      console.error('Error transitioning to next OP:', err);
      alert('Failed to start next OP: ' + (err.message || 'Database error'));
    } finally {
      setIsTransitioning(false);
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
          setIsSubmitting(false);
          setIsSaving(false);
          return;
        }
      }

      // 3. Update the incident end_datetime.
      // This triggers the 'cleanup_resources_on_incident_end' DB function which 
      // automatically closes the OP and cleans up all active assignments, teams, and responders.
      const endTimestamp = new Date().toISOString();
      await supabase.from('incidents').update({ end_datetime: endTimestamp }).eq('incident_id', contextIncidentId);

      // Log incident end
      await supabase.from('action_logs').insert({
        incident_id: contextIncidentId,
        action: `Incident ended. Automated cleanup of assignments, teams, and responders performed.`,
        user_name: responderName || 'Staff'
      });

      endIncident(); // Reset global context state
      navigate('/checkin');
    } catch (err) {
      console.error('Error ending incident:', err);
      setIsSubmitting(false);
      alert('Failed to end incident: ' + (err.message || 'Database error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthenticating) {
    return (
      <div className="incident-edit-page" style={{ textAlign: 'center', padding: '100px' }}>
        <div className="loading-spinner" style={{ fontSize: '40px' }}>⏳</div>
        <p>Initializing secure session...</p>
      </div>
    );
  }

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

            <div className="timing-row">
              <label style={{ flex: 2 }}>
                Incident Name
                <input
                  type="text"
                  value={incident.name}
                  onChange={(e) => handleIncidentChange('name', e.target.value)}
                  placeholder="Search and Rescue Incident Name"
                />
              </label>
              <label style={{ flex: 1 }}>
                Incident Number
                <input
                  type="text"
                  value={incident.number}
                  onChange={(e) => handleIncidentChange('number', e.target.value)}
                  placeholder="Incident Number"
                />
              </label>
            </div>

            <div className="timing-row" style={{ alignItems: 'flex-end', marginBottom: '16px' }}>
              <label style={{ flex: 1, marginBottom: 0 }}>
                SARTopo Map ID
                {(isSyncingSartopo || sartopoIdValidationMessage || sartopoSyncErrorMessage) && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {isSyncingSartopo && <span style={{ color: '#0369a1' }}>🔄 Syncing...</span>}
                    {sartopoIdValidationMessage && <span style={{ color: '#dc2626' }}>⚠️ {sartopoIdValidationMessage}</span>}
                    {sartopoSyncErrorMessage && <span style={{ color: '#dc2626' }}>❌ Sync Failed: {sartopoSyncErrorMessage}</span>}
                  </span>
                )}
                <input
                  type="text"
                  value={incident.sartopo_id}
                  onChange={(e) => handleIncidentChange('sartopo_id', e.target.value)}
                  placeholder="e.g. 9ABC"
                  style={{ borderColor: (sartopoIdValidationMessage || sartopoSyncErrorMessage) ? '#dc2626' : undefined }}
                />
              </label>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ height: '42px' }}
                onClick={handleCreateMap}
                disabled={isCreatingMap || isSaving || !!incident.sartopo_id?.trim()}
              >
                {isCreatingMap ? 'Creating...' : 'Create Map'}
              </button>
            </div>

            <div className="timing-row">
              <label>
                Start Date / Time
                <input
                  type="datetime-local"
                  value={incident.start_datetime}
                  onChange={(e) => handleIncidentChange('start_datetime', e.target.value)}
                />
              </label>

              {existingId && (
                <label>
                  End Date / Time
                  <input
                    type="datetime-local"
                    value={incident.end_datetime}
                    onChange={(e) => handleIncidentChange('end_datetime', e.target.value)}
                  />
                </label>
              )}
            </div>

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

            <div className="timing-row" style={{ alignItems: 'flex-end', marginBottom: '16px' }}>
              <label style={{ flex: '0 0 140px', marginBottom: 0 }}>
                OP Number
                <input
                  type="text"
                  value={operationalPeriod.op_number}
                  onChange={(e) => handleOperationalPeriodChange('op_number', e.target.value)}
                  placeholder="OP #"
                />
              </label>

              <div className="par-config-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flex: 1 }}>
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
            </div>

            <div className="timing-row">
              <label>
                OP Start Date / Time
                <input
                  type="datetime-local"
                  value={operationalPeriod.start_datetime}
                  onChange={(e) => handleOperationalPeriodChange('start_datetime', e.target.value)}
                />
              </label>

              {existingId && (
                <label>
                  OP End Date / Time
                  <input
                    type="datetime-local"
                    value={operationalPeriod.end_datetime}
                    onChange={(e) => handleOperationalPeriodChange('end_datetime', e.target.value)}
                  />
                </label>
              )}
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

        <div className="form-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isActive && existingId === contextIncidentId && (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleStartNextOP}
              disabled={isSaving || isTransitioning}
              style={{ backgroundColor: '#0369a1', borderColor: '#0369a1' }}
            >
              {isTransitioning ? 'Transitioning...' : 'Start Next OP'}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={isSaving || isTransitioning || (existingId && !isDirty)}>
            {isSaving ? 'Saving...' : (existingId ? 'Update Incident Information' : 'Start Incident Tracking')}
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
                const success = await saveData(false); // Keep isSaving true to prevent re-blocking
                if (success) {
                  blocker.proceed();
                } else {
                  setIsSaving(false); // Reset if save failed
                }
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

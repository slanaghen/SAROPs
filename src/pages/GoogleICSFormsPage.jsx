import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import '../styles.css';

/**
 * GoogleICSFormsPage
 * 
 * Allows users to input a Google Sheets URL and retrieve all defined named ranges.
 * This facilitates mapping SAROps operational data to custom ICS spreadsheet templates.
 */
const contextFields = [
  {
    category: 'Incident Context',
    icon: '🏔️',
    fields: [
      { name: 'incident_id', desc: 'Internal unique identifier' },
      { name: 'incident_name', desc: 'The official name of the incident' },
      { name: 'incident_number', desc: 'The operational/agency tracking number' },
      { name: 'incident_location', desc: 'Coordinates/location of Incident Command Post' },
      { name: 'incident_type', desc: 'Type of incident (e.g. Lost Person)' },
      { name: 'incident_notes', desc: 'General notes and background information' },
      { name: 'sartopo_map_id', desc: 'Linked SARTopo Map ID' }
    ]
  },
  {
    category: 'Operational Period',
    icon: '⏱️',
    fields: [
      { name: 'op_period_number', desc: 'Current operational period number' },
      { name: 'op_period_start', desc: 'Start date & time of current period' },
      { name: 'op_period_end', desc: 'End date & time of current period' },
      { name: 'situation_summary', desc: 'Full narrative summary of the current situation' },
      { name: 'safety_narrative', desc: 'Hazards and safety considerations for the period' },
      { name: 'par_check_interval', desc: 'Required interval for personnel accountability checks' }
    ]
  },
  {
    category: 'Command & General Staff',
    icon: '👥',
    fields: [
      { name: 'incident_commander', desc: 'The person in overall command' },
      { name: 'public_info_officer', desc: 'PIO - Responsible for media/public relations' },
      { name: 'safety_officer', desc: 'Responsible for monitoring safety conditions' },
      { name: 'liaison_officer', desc: 'Point of contact for assisting agencies' },
      { name: 'operations_chief', desc: 'OSC - Manages all tactical operations' },
      { name: 'planning_chief', desc: 'PSC - Manages information and planning' },
      { name: 'logistics_chief', desc: 'LSC - Provides resources and services' },
      { name: 'finance_chief', desc: 'FSC - Responsible for financial and cost analysis' }
    ]
  },
  {
    category: 'Assignment & Tactical',
    icon: '🚩',
    fields: [
      { name: 'assignment_title', desc: 'Name of the specific task or area' },
      { name: 'assignment_status', desc: 'Current state (Planned, Deployed, etc.)' },
      { name: 'assignment_segment', desc: 'Division/Group or segment identifier' },
      { name: 'resource_type', desc: 'Required resource kind/type' },
      { name: 'team_size', desc: 'Target or current personnel count' },
      { name: 'comms_primary', desc: 'Primary tactical frequency/channel' },
      { name: 'task_description', desc: 'Detailed tactical instructions' },
      { name: 'debrief_narrative', desc: 'Summary of findings after completion' },
      { name: 'pod_percentage', desc: 'Probability of Detection achieved' },
      { name: 'assignment_priority', desc: 'Mission criticality level' },
      { name: 'hazards_tactical', desc: 'Site-specific hazards' },
      { name: 'transportation_plan', desc: 'Infiltration/Exfiltration method' },
      { name: 'team_members', desc: 'Comma-separated list of all team members' },
      { name: 'team_leader', desc: 'Name of the assigned team leader' }
    ]
  },
  {
    category: 'Action Log',
    icon: '📝',
    fields: [
      { name: 'action_log_entries', desc: 'Serialized array of all incident log events' },
      { name: 'last_action_timestamp', desc: 'Timestamp of the most recent logged activity' }
    ]
  },
  {
    category: 'Current Responder',
    icon: '👤',
    fields: [
      { name: 'responder_name', desc: 'Full name of the current user' },
      { name: 'responder_agency', desc: 'Agency affiliation' },
      { name: 'responder_identifier', desc: 'Radio ID or Badge number' },
      { name: 'responder_phone', desc: 'Contact cell number' },
      { name: 'responder_type', desc: 'Service type (SAR, Fire, etc.)' },
      { name: 'responder_skills', desc: 'Specialized capabilities and certifications' }
    ]
  }
];

const GoogleICSFormsPage = () => {
  const { incidentData, incidentId, responderId } = useIncident();
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1FLyD5OQO-WgkNs3i68ziUseHUiOxlLr6/edit');
  const [namedRanges, setNamedRanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const { addToast } = useToast();
  const [associations, setAssociations] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [currentResponder, setCurrentResponder] = useState(null);
  const [staffMapping, setStaffMapping] = useState({});
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);

  // Helper to extract spreadsheet ID from typical Google Sheets URL
  const extractSpreadsheetId = (url) => {
    const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  };

  // Fetch assignments for the current OP period to populate the tactical dropdown
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!incidentData?.opPeriodId) return;
      const { data, error: fetchErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('is_orphaned', false)
        .order('title');
      
      if (!fetchErr && data) setAssignments(data);
    };
    fetchAssignments();
  }, [incidentData?.opPeriodId]);

  // Fetch full details for the current responder session
  useEffect(() => {
    const fetchResponder = async () => {
      if (!responderId) return;
      const { data } = await supabase
        .from('responders')
        .select('*')
        .eq('responder_id', responderId)
        .maybeSingle();
      if (data) setCurrentResponder(data);
    };
    fetchResponder();
  }, [responderId]);

  // Fetch and resolve Command & General Staff roles for the current operational period
  useEffect(() => {
    const fetchStaff = async () => {
      if (!incidentData?.opPeriodId) return;
      const { data: staffTeam } = await supabase
        .from('teams')
        .select(`
          team_id,
          team_responders (
            role,
            responders ( name )
          )
        `)
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('type', 'Staff')
        .maybeSingle();

      if (staffTeam) {
        const mapping = {};
        staffTeam.team_responders?.forEach(tr => {
          const r = tr.role?.toLowerCase() || '';
          const name = tr.responders?.name;
          if (!name) return;

          if (r === 'incident commander') mapping.incident_commander = name;
          else if (r.includes('pio') || r.includes('public info')) mapping.public_info_officer = name;
          else if (r.includes('safety')) mapping.safety_officer = name;
          else if (r.includes('liaison')) mapping.liaison_officer = name;
          else if (r.includes('operations')) mapping.operations_chief = name;
          else if (r.includes('planning')) mapping.planning_chief = name;
          else if (r.includes('logistics')) mapping.logistics_chief = name;
          else if (r.includes('finance') || r.includes('admin')) mapping.finance_chief = name;
        });
        setStaffMapping(mapping);
      }
    };
    fetchStaff();
  }, [incidentData?.opPeriodId]);

  // Fetch and resolve members/leader for the selected assignment's team
  useEffect(() => {
    const fetchTeamData = async () => {
      const selectedAsn = assignments.find(a => a.assignment_id === selectedAssignmentId);
      if (!selectedAsn?.team_id) {
        setSelectedTeamDetails(null);
        return;
      }

      const { data } = await supabase
        .from('teams')
        .select(`
          leader_responder_id,
          team_responders (
            role,
            responders ( name, responder_id )
          )
        `)
        .eq('team_id', selectedAsn.team_id)
        .maybeSingle();

      if (data) setSelectedTeamDetails(data);
    };
    fetchTeamData();
  }, [selectedAssignmentId, assignments]);

  const handleLoad = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      addToast('Invalid URL. Please provide a full Google Sheets URL (e.g., https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)', 'error');
      setNamedRanges([]);
      return;
    }

    setLoading(true);
    setNamedRanges([]);

    try {
      // Use the Vite proxy (defined in vite.config.js) for development
      // or the environment-specific proxy URL for production.
      const PROXY_BASE = import.meta.env.VITE_PROXY_URL || '';

      const response = await fetch(`${PROXY_BASE}/api/sheets/named-ranges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId })
      });

      if (!response.ok) {
        let errDetails = `Server returned ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            errDetails = errData.error.message;
          } else if (errData?.message) {
            errDetails = errData.message;
          }
        } catch (_) {}
        throw new Error(errDetails);
      }
      const data = await response.json();

      const ranges = data.namedRanges || [];
      
      if (ranges.length === 0) {
        addToast('No named ranges found in this spreadsheet. Check the "Data -> Named ranges" menu in your Google Sheet.', 'error');
      } else {
        const names = ranges.map(r => r.name).sort((a, b) => a.localeCompare(b));
        setNamedRanges(names);
      }
    } catch (err) {
      console.error('Error loading named ranges:', err);
      if (err.message === 'Failed to fetch') {
        addToast('Could not connect to the proxy server. Please ensure the backend service is running on port 3001.', 'error');
      } else {
        addToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || Object.keys(associations).length === 0) {
      addToast('Please load a spreadsheet and map at least one field before transferring.', 'error');
      return;
    }

    setTransferring(true);

    try {
      const selectedAsn = assignments.find(a => a.assignment_id === selectedAssignmentId);
      const valuesToUpdate = {};

      // Map data from context and selected assignment based on associations
      for (const [rangeName, fieldName] of Object.entries(associations)) {
        let value = null;

        // Global Context resolving
        if (fieldName === 'incident_id') value = incidentId;
        else if (fieldName === 'incident_name') value = incidentData?.name;
        else if (fieldName === 'incident_number') value = incidentId; // fallback to ID/Number
        else if (fieldName === 'op_period_number') value = incidentData?.opNumber;

        // Responder Context resolving
        else if (fieldName === 'responder_name') value = currentResponder?.name;
        else if (fieldName === 'responder_agency') value = currentResponder?.agency;
        else if (fieldName === 'responder_identifier') value = currentResponder?.identifier;
        else if (fieldName === 'responder_phone') value = currentResponder?.cell_phone;
        else if (fieldName === 'responder_type') value = currentResponder?.responder_type;
        else if (fieldName === 'responder_skills') value = currentResponder?.special_skills;

        // Command & General Staff resolving
        else if (staffMapping[fieldName]) {
          value = staffMapping[fieldName];
        }

        // Tactical Context resolving (requires selected assignment)
        else if (selectedAsn) {
          if (fieldName === 'assignment_title') value = selectedAsn.title;
          else if (fieldName === 'assignment_status') value = selectedAsn.status;
          else if (fieldName === 'assignment_segment') value = selectedAsn.segment;
          else if (fieldName === 'resource_type') value = selectedAsn.resource_type;
          else if (fieldName === 'team_size') value = selectedAsn.team_size;
          else if (fieldName === 'comms_primary') value = selectedAsn.frequency_primary;
          else if (fieldName === 'task_description') value = selectedAsn.description;
          else if (fieldName === 'debrief_narrative') value = selectedAsn.debrief_narrative;
          else if (fieldName === 'pod_percentage') value = selectedAsn.probability_of_detection;
          else if (fieldName === 'assignment_priority') value = selectedAsn.priority;
          else if (fieldName === 'hazards_tactical') value = selectedAsn.hazards;
          else if (fieldName === 'transportation_plan') value = selectedAsn.transportation;
          
          else if (fieldName === 'team_members') {
            value = selectedTeamDetails?.team_responders?.map(tr => tr.responders?.name).filter(Boolean).join(', ');
          }
          else if (fieldName === 'team_leader') {
            const leader = selectedTeamDetails?.team_responders?.find(tr => tr.responders?.responder_id === selectedTeamDetails.leader_responder_id);
            value = leader?.responders?.name;
          }
        }

        if (value !== null && value !== undefined) {
          valuesToUpdate[rangeName] = String(value);
        }
      }

      const PROXY_BASE = import.meta.env.VITE_PROXY_URL || '';
      const response = await fetch(`${PROXY_BASE}/api/sheets/update-values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, values: valuesToUpdate })
      });

      if (!response.ok) throw new Error('Transfer failed. Please ensure the backend proxy is configured for write access.');
      addToast(`Data successfully transferred: ${Object.keys(valuesToUpdate).length} fields updated in Google Sheets.`, 'success');
    } catch (err) {
      console.error('Transfer error:', err); 
      addToast(err.message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="app-shell" style={{ padding: '24px' }}>
      <div className="page-header">
        <div>
          <h1>Google Forms</h1>
          <p className="subtitle">Inspect and import field definitions from Google Sheets templates.</p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label htmlFor="sheet-url" style={{ fontWeight: 600 }}>Google Sheet URL:</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              id="sheet-url"
              type="text"
              className="status-update-select" 
              style={{ flex: 1, height: '40px', padding: '0 12px' }}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <button 
              className="btn btn-primary"
              style={{ height: '40px', padding: '0 24px', whiteSpace: 'nowrap' }}
              onClick={handleLoad}
              disabled={loading || !sheetUrl.trim()}
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
            <button 
              className="btn btn-primary"
              style={{ height: '40px', padding: '0 24px', whiteSpace: 'nowrap', backgroundColor: '#059669', borderColor: '#059669' }}
              onClick={handleTransfer}
              disabled={loading || transferring || !sheetUrl.trim() || Object.keys(associations).length === 0}
              title="Push current operational values to the mapped named ranges in Google Sheets"
            >
              {transferring ? 'Transferring...' : 'Transfer Data'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left Side: Named Ranges */}
        <div className="section-card" style={{ flex: '2 1 600px', margin: 0 }}>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            Detected Named Ranges {namedRanges.length > 0 && `(${namedRanges.length})`}
          </h2>

          {namedRanges.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {namedRanges.map((name, idx) => (
                <div 
                  key={idx} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                    const fieldName = e.dataTransfer.getData('text/plain');
                    if (fieldName) {
                      setAssociations(prev => ({
                        ...prev,
                        [name]: fieldName
                      }));
                    }
                  }}
                  style={{ 
                    padding: '12px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    minHeight: '46px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: '#38bdf8', flexShrink: 0 }}>🏷️</span> 
                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <span style={{ wordBreak: 'break-all' }}>{name}</span>
                      {associations[name] && (
                        <span style={{ 
                          color: '#2563eb', 
                          fontWeight: 700, 
                          fontFamily: 'sans-serif', 
                          fontSize: '11px', 
                          background: '#dbeafe', 
                          padding: '2px 6px', 
                          borderRadius: '4px' 
                        }}>
                          ({associations[name]})
                        </span>
                      )}
                    </span>
                  </div>
                  {associations[name] && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssociations(prev => {
                          const updated = { ...prev };
                          delete updated[name];
                          return updated;
                        });
                      }}
                      title="Remove association"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ 
              height: '200px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#94a3b8',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <p>No named ranges loaded.</p>
              <p style={{ fontSize: '13px' }}>Provide a valid Google Sheet URL and click "Load" to view the available data points.</p>
            </div>
          )}
        </div>

        {/* Right Side: Context Fields */}
        <div className="section-card" style={{ flex: '1 1 300px', margin: 0 }}>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            Context Fields
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
            Drag fields from here and drop them onto a named range on the left to associate them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {contextFields.map((cat, idx) => (
              <div key={idx}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span>{cat.icon}</span> {cat.category}
                </h3>
                {cat.category === 'Assignment & Tactical' && (
                  <div className="form-row" style={{ marginBottom: '12px' }}>
                    <select 
                      className="status-update-select"
                      style={{ width: '100%', height: '32px', fontSize: '12px' }}
                      value={selectedAssignmentId}
                      onChange={(e) => setSelectedAssignmentId(e.target.value)}
                    >
                      <option value="">— Select Assignment for Context —</option>
                      {assignments.map(a => (
                        <option key={a.assignment_id} value={a.assignment_id}>
                          {a.title} ({a.segment})
                        </option>
                      ))}
                    </select>
                    <small className="form-hint" style={{ fontSize: '10px' }}>Assignment fields below will use data from this selection.</small>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cat.fields.map((f, fIdx) => (
                    <div 
                      key={fIdx} 
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', f.name);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      style={{ 
                        padding: '10px', 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'grab',
                        userSelect: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.background = '#f1f5f9';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                    >
                      <div style={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 600, 
                        color: '#2563eb', 
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>{f.name}</span>
                        <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Field</span>
                      </div>
                      <div style={{ color: '#475569', lineHeight: '1.4' }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleICSFormsPage;
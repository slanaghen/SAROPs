import React, { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import '../styles/ICSAssignmentPage.css';

/**
 * ICSAssignmentPage
 * Displays the ICS organizational hierarchy with editable assignments.
 */
const ICSAssignmentPage = () => {
  const { incidentData } = useIncident();
  const operationalPeriodId = incidentData?.opPeriodId;

  const { teams, responders, loading, error: hookError, fetchDashboardData } = usePlanningDashboard(supabase, operationalPeriodId);

  // Fetch responders for the dropdowns
  useEffect(() => {
    if (operationalPeriodId) {
      fetchDashboardData();
    }
  }, [operationalPeriodId, fetchDashboardData]);

  // Derived mapping of ICS positions to names based on the Staff team members
  const icsMapping = useMemo(() => {
    const mapping = {
      ic: null, safety: null, pio: null, liaison: null, ops: null, planning: null, logistics: null, admin: null
    };

    const staffTeam = teams?.find(t => t.type === 'Staff');
    
    if (staffTeam?.current_responders) {
      staffTeam.current_responders.forEach(member => {
        const role = member.role?.toLowerCase() || '';
        // Use name and agency directly from the team member metadata provided by the database view
        const data = { name: member.name, agency: member.agency };

        if (role.includes('commander')) mapping.ic = data;
        else if (role.includes('safety')) mapping.safety = data;
        else if (role.includes('pio') || role.includes('public info')) mapping.pio = data;
        else if (role.includes('liaison')) mapping.liaison = data;
        else if (role.includes('operations')) mapping.ops = data;
        else if (role.includes('planning')) mapping.planning = data;
        else if (role.includes('logistics')) mapping.logistics = data;
        else if (role.includes('admin') || role.includes('finance')) mapping.admin = data;
      });
    }
    return mapping;
  }, [teams]);
  

  const OrgBox = ({ title, field }) => {
    const data = icsMapping[field];
    return (
      <div className="ics-box">
        <div className="ics-box-title">{title}</div>

        {/* Renaming class and adding data-lpignore prevents password managers from misidentifying display boxes as input fields */}
        <div className="ics-box-display" data-lpignore="true" style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '6px', 
          padding: '8px 12px', 
          fontSize: '14px',
          minHeight: '44px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          color: data ? '#1e293b' : '#94a3b8'
        }}>
          {data ? (
            <>
              <div style={{ lineHeight: 1.2 }}>{data.name}</div>
              {data.agency && (
                <div style={{ fontSize: '11px', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  {data.agency}
                </div>
              )}
            </>
          ) : ''}
        </div>
      </div>
    );
  };

  return (
    <div className="ics-assignment-page">
      <div className="page-header">
        <h1>ICS Chart</h1>
        <p className="subtitle">Assign personnel to Command and General Staff positions.</p>
      </div>
      
      {/* data-lpignore on the container prevents the LastPass extension from crashing while parsing the chart structure */}
      <div className="ics-hierarchy" data-lpignore="true">
        {loading && <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '10px' }}>Loading organization data...</p>}
        {hookError && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{hookError}</div>}

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
    </div>
  );
};

export default ICSAssignmentPage;
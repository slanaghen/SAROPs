import React from 'react';

const AdminAssignmentsTable = ({
  allAssignments,
  allIncidents,
  isAssignmentsExpanded,
  setIsAssignmentsExpanded,
  handleEditAssignment,
  handleNewAssignment,
  handleDeleteAssignment,
}) => {
  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isAssignmentsExpanded ? '16px' : 0 }}
        onClick={() => setIsAssignmentsExpanded(!isAssignmentsExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Assignment Management ({allAssignments.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewAssignment(); }}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isAssignmentsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isAssignmentsExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Segment</th>
                <th>Type</th>
                <th>Incident</th>
                <th>Inc #</th>
                <th>OP #</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allAssignments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-row">No assignments found in database.</td>
                </tr>
              ) : (
                allAssignments.map((asn, index) => {
                  const opPeriod = asn.operational_periods;
                  const opNum = opPeriod?.op_number;

                  // Manually find incident details from the already fetched allIncidents list
                  // This makes the display more robust against broken nested FKs
                  const incident = opPeriod?.incident_id
                    ? allIncidents.find(inc => inc.incident_id === opPeriod.incident_id)
                    : null;

                  const incidentName = incident?.name;
                  const incidentNumber = incident?.number;

                  return (
                    <tr key={asn.assignment_id || `asn-${index}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{asn.title}</div>
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>{asn.segment || '—'}</td>
                      <td>{asn.resource_type || '—'}</td>
                      <td>{incidentName || '—'}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>{incidentNumber || '—'}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>{opNum ? `OP #${opNum}` : '—'}</td>
                      <td>
                        <span className={`status-indicator ${asn.status.toLowerCase()}`}>
                          {asn.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => handleEditAssignment(asn)} className="btn btn-secondary btn-sm">Edit</button>
                        <button
                          onClick={() => handleDeleteAssignment(asn.assignment_id, asn.title, asn.resource_type)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#dc2626' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAssignmentsTable;
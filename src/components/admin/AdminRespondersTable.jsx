import React from 'react';

const AdminRespondersTable = ({
  allResponders,
  isRespondersExpanded,
  setIsRespondersExpanded,
  handleCheckOutResponder,
  handleEditResponder,
  handleNewResponder,
  handleDeleteResponder,
}) => {
  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isRespondersExpanded ? '16px' : 0 }}
        onClick={() => setIsRespondersExpanded(!isRespondersExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Responder Management ({allResponders.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewResponder(); }}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isRespondersExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isRespondersExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Agency</th>
                <th>Identifier</th>
                <th>Check-In Time</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allResponders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">No responders found in database.</td>
                </tr>
              ) : (
                allResponders.map(res => {
                  const isCheckedOut = !!res.checkout_datetime;
                  return (
                    <tr key={res.responder_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{res.name}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{res.agency || '—'}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{res.identifier || '—'}</td>
                      <td>{new Date(res.checkin_datetime).toLocaleString()}</td>
                      <td>
                        <span className={`status-indicator ${(res.status || 'unknown').toLowerCase()}`}>
                          {res.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleEditResponder(res)} className="btn btn-secondary btn-sm">Edit</button>
                          {!isCheckedOut && (
                            <button
                              onClick={() => handleCheckOutResponder(res.responder_id)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f59e0b' }}
                            >
                              Check Out
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteResponder(res.responder_id, res.name, res.agency)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </div>
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

export default AdminRespondersTable;
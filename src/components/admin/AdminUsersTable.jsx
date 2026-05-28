import React from 'react';

const AdminUsersTable = ({
  users,
  fetching,
  isUsersExpanded,
  setIsUsersExpanded,
  handleChangePassword,
  handleEditUser,
  handleNewUser,
  handleRemoveAdmin,
}) => {
  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isUsersExpanded ? '16px' : 0 }}
        onClick={() => setIsUsersExpanded(!isUsersExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>System Users ({users.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewUser(); }}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isUsersExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isUsersExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access Level</th>
                <th>Phone</th>
                <th>Agency</th>
                <th>Identifier</th>
                <th>Skills</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr><td colSpan="5" className="empty-row">Loading system users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="empty-row">No system users configured.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.email}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name || user.username || '—'}</div>
                    </td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{user.email}</td>
                    <td>
                      <span className={`status-indicator ${user.access_level || 'responder'}`}>
                        {user.access_level || 'responder'}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>{user.cell_phone || '—'}</td>
                    <td>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{user.agency || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{user.identifier || '—'}</div>
                    </td>

                    <td>
                      <div style={{ fontSize: '11px', fontStyle: 'italic', maxWidth: '200px' }}>
                        {user.special_skills || '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEditUser(user)} className="btn btn-secondary btn-sm">Edit</button>
                        <button onClick={() => handleChangePassword(user.email)} className="btn btn-secondary btn-sm">Password</button>
                        <button onClick={() => handleRemoveAdmin(user.email)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsersTable;
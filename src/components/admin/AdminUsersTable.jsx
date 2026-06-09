import React, { useState, useMemo } from 'react';

const AdminUsersTable = ({
  users = [],
  fetching,
  isUsersExpanded,
  setIsUsersExpanded,
  handleChangePassword,
  handleEditUser,
  handleNewUser,
  handleRemoveAdmin,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const sortedUsers = useMemo(() => {
    let items = [...users];
    if (sortConfig.key) {
      items.sort((a, b) => {
        const aVal = (a[sortConfig.key] || a.username || '').toString().toLowerCase();
        const bVal = (b[sortConfig.key] || b.username || '').toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [users, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isUsersExpanded ? '16px' : 0 }}
        onClick={() => setIsUsersExpanded(!isUsersExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>System Users ({users.length})</h2>
          <button 
            className="action-btn action-btn-primary action-btn-header" 
            onClick={(e) => { e.stopPropagation(); handleNewUser(); }}
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
                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                  Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('email')} style={{ cursor: 'pointer' }}>
                  Email {sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('access_level')} style={{ cursor: 'pointer' }}>
                  Access Level {sortConfig.key === 'access_level' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('cell_phone')} style={{ cursor: 'pointer' }}>
                  Phone {sortConfig.key === 'cell_phone' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('agency')} style={{ cursor: 'pointer' }}>
                  Agency {sortConfig.key === 'agency' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('identifier')} style={{ cursor: 'pointer' }}>
                  Identifier {sortConfig.key === 'identifier' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('special_skills')} style={{ cursor: 'pointer' }}>
                  Skills {sortConfig.key === 'special_skills' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr><td colSpan="5" className="empty-row">Loading system users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="empty-row">No system users configured.</td></tr>
              ) : (
                sortedUsers.map(user => (
                  <tr key={user.email}>
                    <td style={{ color: '#000' }}>
                      <div style={{ fontWeight: 600 }}>{user.name || user.username || '—'}</div>
                    </td>
                    <td style={{ color: '#000' }}>{user.email}</td>
                    <td style={{ color: '#000' }}>
                      <span className={`status-chip status-chip-${user.access_level || 'responder'}`}>
                        {user.access_level || 'responder'}
                      </span>
                    </td>
                    <td style={{ color: '#000' }}>{user.cell_phone || '—'}</td>
                    <td style={{ color: '#000' }}>
                      <div>{user.agency || '—'}</div>
                    </td>
                    <td style={{ color: '#000' }}>
                      <div>{user.identifier || '—'}</div>
                    </td>

                    <td style={{ color: '#000' }}>
                      <div style={{ fontStyle: 'italic', maxWidth: '200px' }}>
                        {user.special_skills || '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleChangePassword(user.email)} className="action-btn action-btn-secondary">Password</button>
                        <button onClick={() => handleEditUser(user)} className="action-btn action-btn-secondary">Edit</button>
                        <button onClick={() => handleRemoveAdmin(user.email)} className="action-btn action-btn-danger">Remove</button>
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
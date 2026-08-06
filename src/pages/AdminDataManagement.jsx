import React from 'react';

const AdminDataManagement = ({ loading, handleSeedData, handleClearData }) => {
  return (
    <div className="section-card" style={{ marginBottom: '24px' }}>
      <h2>Data Management</h2>
      <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 16px' }}>Manage incident records, perform cascading deletions, and initialize test data.</p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
        <button
          onClick={handleSeedData}
          className="action-btn action-btn-secondary"
          disabled={loading}
        >
          {loading ? 'Seeding...' : 'Seed Dev Data'}
        </button>
        <button
          onClick={handleClearData}
          className="action-btn action-btn-danger"
          disabled={loading}
        >
          {loading ? 'Clearing...' : 'Clear All Data'}
        </button>
      </div>
    </div>
  );
};

export default AdminDataManagement;

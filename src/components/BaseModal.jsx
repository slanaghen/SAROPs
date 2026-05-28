import React from 'react';

const BaseModal = ({ isOpen, onClose, title, children, actions, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-actions">
          {actions}
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default BaseModal;
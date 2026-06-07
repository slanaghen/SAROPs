import React from 'react';
import { useToast } from '../context/ToastContext';
import '../styles/ToastContainer.css'; // Assuming you'll create this CSS file

const ToastContainer = () => {
  const { toasts = [], removeToast } = useToast() || {};

  return (
    <div className="toast-container">
      {(toasts || []).map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          onClick={() => removeToast(toast.id)}
        >
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'i'}
              {toast.type === 'warning' && '⚠️'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close-button" onClick={() => removeToast(toast.id)}>
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
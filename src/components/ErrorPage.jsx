import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';

const ErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log for debugging, but hide details in production if preferred
  console.error('Unhandled Route Error:', error);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🧭</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
          Mission Interrupted
        </h1>
        <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>
          The application encountered an unexpected error. This might be due to a lost connection or a temporary synchronization issue.
        </p>
        
        {error && (
          <div style={{
            background: '#fff1f2',
            color: '#be123c',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            marginBottom: '32px',
            textAlign: 'left',
            overflow: 'auto',
            maxHeight: '120px',
            border: '1px solid #fecdd3'
          }}>
            <strong>Technical Detail:</strong><br />
            {error.statusText || error.message || 'Unknown internal error occurred.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            Reload Page
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/checkin')}>
            Return to Check-in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
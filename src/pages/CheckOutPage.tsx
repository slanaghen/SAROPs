import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/IncidentEditPage.css'; // Reusing existing card styles

const CheckOutPage: React.FC = () => {
  const navigate = useNavigate();
  const { responderId, responderName, setResponderStatus, isActive } = useIncident();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmCheckOut = async () => {
    if (!responderId) {
      setError("No active responder session found. Please check in first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const checkoutTime = new Date().toISOString();

      // Update database: set status to CheckedOut (Cleared)
      const { error: dbError } = await supabase
        .from('responders')
        .update({
          checkout_datetime: checkoutTime,
          status: 'CheckedOut',
        })
        .eq('responder_id', responderId);

      if (dbError) throw dbError;

      // Update local context: change status but leave incident/name as is
      setResponderStatus('CheckedOut');
      
      alert("You have been successfully cleared from the incident.");
      navigate('/responder-dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-out failed';
      console.error('Check-out error:', err);
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isActive || !responderId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No Active Session</h2>
        <p>You must be checked in to an incident before you can check out.</p>
        <button className="btn btn-primary" onClick={() => navigate('/checkin')} style={{ marginTop: '20px' }}>
          Go to Check-In
        </button>
      </div>
    );
  }

  return (
    <div className="incident-edit-page">
      <div className="page-header">
        <h1>Responder Check-Out</h1>
        <p className="subtitle">Transition your status to cleared while remaining in the incident session.</p>
      </div>

      <div className="section-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>👋</div>
        <h2>Ready to clear, {responderName}?</h2>
        <p style={{ color: '#64748b', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
          Checking out will mark your status as <strong>Checked Out</strong> in the database. 
          Your incident session and operational data will remain visible in the banner.
        </p>

        {error && <p className="alert alert-error" style={{ marginBottom: '24px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={isProcessing}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirmCheckOut} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Confirm Check-Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckOutPage;
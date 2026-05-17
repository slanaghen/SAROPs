import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/IncidentEditPage.css'; // Reusing existing card styles

const CheckOutPage: React.FC = () => {
  const navigate = useNavigate(); //
  const { responderId, responderName, responderStatus, logout, isActive } = useIncident(); //
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmCheckOut = async () => {
    if (!responderId) {
      setError("No active responder session found. Please check in first.");
      return;
    }

    // Allow both 'Staged' (available field responders) and 'Active' (command staff) to check out
    const allowedStatuses = ['Staged', 'Active'];
    if (!allowedStatuses.includes(responderStatus || '')) {
      setError(`Check-out unsuccessful: Your current status is "${responderStatus}". Only responders in "Staged" or "Active" status can check out. Please ensure you have been released from your team or assignment before clearing.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Clear leadership status in teams table to avoid foreign key violation
      const { error: leaderError } = await supabase
        .from('teams')
        .update({ leader_responder_id: null })
        .eq('leader_responder_id', responderId);

      if (leaderError) throw leaderError;

      // Delete the responder record from the database
      const { error: dbError } = await supabase //
        .from('responders') //
        .delete() //
        .eq('responder_id', responderId);

      if (dbError) throw dbError;

      // Clear the global incident context and local session
      logout(); //
      
      alert("You have been successfully cleared from the incident.");
      navigate('/checkin'); //
    } catch (err) {
      const message = err instanceof Error ? err.message : (error?.message || 'Check-out failed');
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
          Checking out will remove your record from the incident and clear your local session.
          You will need to check back in to rejoin the operation.
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
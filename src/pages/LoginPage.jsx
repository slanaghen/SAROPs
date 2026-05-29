import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import AdminLogin from '../components/admin/AdminLogin';

const LoginPage = () => {
  const navigate = useNavigate();
  const { 
    setIsAdmin, setResponderId, setResponderName, setResponderStatus, 
    setAccessLevel, startIncident 
  } = useIncident();

  const handleLoginSuccess = async (selectedId, userRecord, responderRecord) => {
    // Persist system user identity for the Settings page
    if (userRecord?.email) {
      localStorage.setItem('sarops_user_email', userRecord.email);
    }

    if (selectedId === 'NEW_INCIDENT') {
      setIsAdmin(true);
      setResponderName(userRecord.name || userRecord.username);
      setAccessLevel(userRecord.access_level);
      navigate('/incident', { 
        state: { 
          responderData: {
            name: userRecord.name || userRecord.username,
            agency: userRecord.agency || 'Unknown',
            identifier: userRecord.identifier || userRecord.username,
            cell_phone: userRecord.cell_phone || '',
            special_skills: userRecord.special_skills || '',
            responder_type: userRecord.responder_type || 'SAR'
          }
        } 
      });
      return;
    }

    if (selectedId) {
      // Fetch incident details to initialize context
      const { data } = await supabase
        .from('incidents')
        .select('*, operational_periods(*)')
        .eq('incident_id', selectedId)
        .maybeSingle();
      
      if (data) {
        const latestOp = data.operational_periods?.sort((a, b) => b.op_number - a.op_number)[0];
        startIncident(data.incident_id, data.name, latestOp?.op_number, latestOp?.op_period_id, data.sartopo_id, latestOp?.par_check_interval);
      }
    }

    if (responderRecord) {
      setResponderId(responderRecord.responder_id);
      setResponderName(responderRecord.name);
      setResponderStatus(responderRecord.status);
      setAccessLevel(responderRecord.access_level);
    }

    if (selectedId) {
      setIsAdmin(true);
      if (userRecord?.access_level === 'staff' || userRecord?.access_level === 'admin') {
        navigate('/operations');
      } else {
        navigate('/responder');
      }
    } else {
      // Set basic context info even if not checked into a specific incident
      setResponderName(userRecord.name || userRecord.username);
      setAccessLevel(userRecord.access_level);
      setIsAdmin(true);
      // If admin, go to admin dashboard. If responder (likely a new registration), go to settings.
      if (userRecord?.access_level === 'admin') {
        navigate('/admin');
      } else {
        navigate('/settings');
      }
    }
  };

  return (
    <AdminLogin onLoginSuccess={handleLoginSuccess} />
  );
};

export default LoginPage;
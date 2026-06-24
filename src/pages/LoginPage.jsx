import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import LoginForm from '../components/admin/Login';
import { useToast } from '../context/ToastContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const {
    setIsAdmin, setResponderId, setResponderName, setResponderStatus,
    setAccessLevel, startIncident
  } = useIncident();
  const { addToast } = useToast(); // This is already defined in the context

  const handleLoginSuccess = async (selectedId, userRecord, responderRecord, loginVehicles = '') => {
    // Persist system user identity for the Settings page
    if (userRecord?.email) {
      localStorage.setItem('sarops_user_email', userRecord.email);
    }

    // Prioritize the responder ID from the check-in record, 
    // but fallback to a profile lookup if the upsert return was empty
    const finalResponder = Array.isArray(responderRecord) ? responderRecord[0] : responderRecord;
    const finalResponderId = finalResponder?.responder_id;

    console.debug('[LoginPage] userRecord, responderRecord:', userRecord?.name, responderRecord?.name); // SGL

    if (finalResponderId) {
      setResponderId(finalResponderId);
      setResponderName(finalResponder.name || userRecord.name || userRecord.username);
      setResponderStatus(finalResponder.status || 'Staged');
      setAccessLevel(finalResponder.access_level || userRecord.access_level);
    } else {

      // Refresh Supabase session to apply new JWT claims (access_level and incident_id)
      await supabase.auth.refreshSession();

      const { data: { user } } = await supabase.auth.getUser();// SGL
      console.debug('[LoginPage] user:', user?.email); // SGL
      const { data: { session } } = await supabase.auth.getSession(); // SGL
      console.debug('[LoginPage] session:', session?.user?.email); // SGL


      // Fallback: If we don't have a responder ID yet but have an identity, 
      // set the basic info to allow the dashboard to attempt its own lookup.
      setResponderName(userRecord.name || userRecord.username);
      setAccessLevel(userRecord.access_level);
    }

    if (selectedId === 'NEW_INCIDENT') {
      setIsAdmin(userRecord.access_level === 'staff' || userRecord.access_level === 'admin');
      console.debug('[LoginPage] user access level:', userRecord.access_level);
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
            responder_type: userRecord.responder_type || 'SAR',
            vehicles: loginVehicles
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
        .order('op_number', { foreignTable: 'operational_periods', ascending: false })
        .maybeSingle();

      if (data) {
        const latestOp = data.operational_periods?.[0];
        startIncident(data.incident_id, data.name, latestOp?.op_number, latestOp?.op_period_id, data.sartopo_id, latestOp?.par_check_interval);
      }
    }


    if (selectedId) {
      setIsAdmin(userRecord.access_level === 'staff' || userRecord.access_level === 'admin');
      if (userRecord?.access_level === 'staff' || userRecord?.access_level === 'admin') {
        navigate('/operations');
      } else {
        navigate('/responder');
      }
    } else {
      setIsAdmin(userRecord.access_level === 'staff' || userRecord.access_level === 'admin');
      setResponderName(userRecord.name || userRecord.username);
      setAccessLevel(userRecord.access_level);
      if (userRecord?.access_level === 'admin') {
        navigate('/admin');
      } else {
        navigate('/settings');
      }
    }
  };

  return (
    <LoginForm onLoginSuccess={handleLoginSuccess} />
  );
};

export default LoginPage;
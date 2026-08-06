import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import AdminUserFormModal from '../components/admin/AdminUserFormModal';
import '../styles/IncidentEditPage.css';
import { useToast } from '../context/ToastContext';
import { useIncident } from '../context/IncidentContext'; // Import useIncident
import '../styles/ActionButtons.css';
import '../styles/FormElements.css';

const SettingsPage = () => {
  const { user: globalUser, responderId, incidentId } = useIncident(); // Get user, responderId, and incidentId from global context
  const [userProfile, setUserProfile] = useState(null); // Local state for the profile data
  const [isOperationalProfile, setIsOperationalProfile] = useState(false); // Flag to distinguish profile type
  const [loading, setLoading] = useState(true); // Start in loading state
  const { addToast } = useToast();
  const [displayDensity, setDisplayDensity] = useState('compact');
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
        }
      } catch (err) {
        console.error('Session initialization failed:', err);
        addToast('Failed to establish a secure session.', 'error');
      } finally {
        setIsAuthenticating(false);
      }
    };
    initSession();
  }, [addToast]);

  const fetchMyProfile = useCallback(async () => {
    if (isAuthenticating) return; // Don't fetch until session is ready. incidentId is optional for system users.
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || localStorage.getItem('sarops_user_email');
      let foundProfile = false;

      // Prioritize finding an active operational profile for the current incident.
      // This covers both anonymous check-ins and logged-in users who are checked-in.
      if (session?.user?.id && incidentId) {
        const { data: responderProfile, error: responderError } = await supabase
          .from('responders')
          .select('responder_id, name, agency, identifier, cell_phone, responder_type, special_skills, access_level')
          .eq('auth_uid', session.user.id)
          .eq('incident_id', incidentId)
          .is('checkout_datetime', null);

        if (responderError) throw responderError;

        if (responderProfile && responderProfile.length > 0) {
          if (responderProfile.length > 1) {
            console.warn(`[SettingsPage] Found multiple active responder records for this user in the current incident. Using the first record. This may indicate a data integrity issue.`);
          }
          const activeResponderProfile = responderProfile[0];
          const savedDensity = localStorage.getItem('sarops_session_density') || 'compact';
          setDisplayDensity(savedDensity);
          setUserProfile({
            ...activeResponderProfile,
            email: userEmail || `responder-session`,
            username: responderProfile.name,
            display_density: savedDensity,
          });
          setIsOperationalProfile(true);
          foundProfile = true;
        }
      }

      // If no operational profile was found, try to find a system user profile.
      // This covers logged-in users who are not checked into the current incident.
      if (!foundProfile && userEmail && !session?.user?.is_anonymous) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('email, username, name, agency, identifier, cell_phone, responder_type, special_skills, access_level, display_density')
          .eq('email', userEmail)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (data) {
          setUserProfile(data);
          setIsOperationalProfile(false); // Set flag only when a system profile is successfully loaded
          if (data.display_density) setDisplayDensity(data.display_density);
          foundProfile = true;
        }
      }

      if (!foundProfile) {
        setUserProfile(null);
      }
    } catch (err) { // Error is handled by the hook's setError
      addToast('Failed to load profile settings: ' + err.message, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [incidentId, isAuthenticating, addToast]);

  useEffect(() => {
    fetchMyProfile();
  }, [fetchMyProfile]);

  const handleSaveProfile = async (formData, stayOpen = false) => {
    setLoading(true);
    try {
      if (isOperationalProfile) {
        // Update the 'responders' table for the current session
        const { error: updateError } = await supabase
          .from('responders')
          .update({
            name: formData.name,
            agency: formData.agency,
            identifier: formData.identifier,
            cell_phone: formData.cell_phone,
            responder_type: formData.responder_type,
            special_skills: formData.special_skills,
          })
          .eq('responder_id', userProfile.responder_id);
        
        if (updateError) throw updateError;
        addToast('Session profile updated successfully.', 'success');
        // This is a session-only change, it won't persist globally for this user type
        if (formData.display_density !== displayDensity) {
          localStorage.setItem('sarops_session_density', formData.display_density);
          setDisplayDensity(formData.display_density);
        }
      } else {
        // Update the 'users' table for the persistent system user
        const { error: updateError } = await supabase.rpc('admin_add_user', {
          p_email: formData.email,
          p_username: formData.username,
          p_password: formData.password || null,
          p_access_level: formData.access_level,
          p_name: formData.name,
          p_agency: formData.agency,
          p_identifier: formData.identifier,
          p_phone: formData.cell_phone,
          p_type: formData.responder_type,
          p_skills: formData.special_skills,
          p_display_density: formData.display_density,
        });

        if (updateError) throw updateError;
        addToast('Profile updated successfully.', 'success');
      }
      await fetchMyProfile();
    } catch (err) { // Error is handled by the hook's setError
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`incident-edit-page density-${userProfile?.display_density || 'compact'}`} style={{ paddingBottom: 'var(--space-lg)' }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1>Account Settings</h1>
        <p className="subtitle">Update your personal information and security credentials.</p>
      </div>

      {loading && !userProfile && (
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
          <p className="operations-message">Loading your profile details...</p>
        </div>
      )}

      {!loading && !userProfile && (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="alert alert-error" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h3 style={{ marginTop: 0 }}>No Session Found</h3>
            <p style={{ margin: 0 }}>We couldn't identify your account. Please log in to manage your settings.</p>
          </div>
        </div>
      )}

      {!loading && userProfile && (
        <div className="section-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <AdminUserFormModal
            isOpen={true}
            onClose={() => {}} // Non-functional in embedded page mode
            onSave={handleSaveProfile}
            initialData={userProfile}
            loading={loading}
            isProfileSettings={true}
            isOperationalProfile={isOperationalProfile}
          />
        </div>
      )}
      
      <style>{`
        /* Transform the modal into an embedded page component */
        .incident-edit-page .modal-backdrop { position: static; background: none; padding: 0; }
        .incident-edit-page .modal { 
          box-shadow: none; 
          width: 100%; 
          max-width: none; 
          border: none; 
          padding: 0 !important; 
        }
        .modal-actions .btn-secondary { display: none; }
        
        /* Ensure the form body inside the embedded modal uses full width */
        .incident-edit-page .modal-body { padding: 0; }
      `}</style>
    </div>
  );
};

export default SettingsPage;
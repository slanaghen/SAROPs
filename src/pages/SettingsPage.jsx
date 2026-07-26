import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import AdminUserFormModal from '../components/admin/AdminUserFormModal';
import '../styles/IncidentEditPage.css';
import { useToast } from '../context/ToastContext';
import { useIncident } from '../context/IncidentContext'; // Import useIncident
import '../styles/ActionButtons.css';
import '../styles/FormElements.css';

const SettingsPage = () => {
  const { user: globalUser } = useIncident(); // Get user from global context
  const [userProfile, setUserProfile] = useState(null); // Local state for the profile data
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const fetchMyProfile = useCallback(async () => {
    // Use the globalUser from context, which is kept in sync by App.jsx
    const userEmail = globalUser?.email || localStorage.getItem('sarops_user_email');

    // Guard: If email is not yet available, the session may still be initializing.
    // We return early instead of throwing to avoid error toasts during initial mount.
    if (!userEmail) return;

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('email, username, name, agency, identifier, cell_phone, responder_type, special_skills, access_level, display_density')
        .eq('email', userEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setUserProfile(data);
    } catch (err) { // Error is handled by the hook's setError
      addToast('Failed to load profile settings: ' + err.message, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [globalUser?.email, addToast]); // Dependency on globalUser.email

  useEffect(() => {
    fetchMyProfile();
  }, [fetchMyProfile]);

  const handleSaveProfile = async (formData, stayOpen = false) => {
    setLoading(true);
    try {
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
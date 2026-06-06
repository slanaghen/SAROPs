import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import AdminUserFormModal from '../components/admin/AdminUserFormModal';
import '../styles/IncidentEditPage.css';

const SettingsPage = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchMyProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Attempt to identify the user via Supabase Auth (OTP users) or localStorage (RPC users)
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || localStorage.getItem('sarops_user_email');

      if (!userEmail) throw new Error('No active session found.');

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setUserProfile(data);
    } catch (err) {
      setError('Failed to load profile settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyProfile();
  }, [fetchMyProfile]);

  const handleSaveProfile = async (formData, stayOpen = false) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

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
        p_vehicles: formData.vehicles,
        p_display_density: formData.display_density,
      });

      if (updateError) throw updateError;
      setSuccess('Profile updated successfully.');
      await fetchMyProfile();
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="incident-edit-page">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1>Account Settings</h1>
        <p className="subtitle">Update your personal information and security credentials.</p>
      </div>

      {loading && !userProfile && <p className="operations-message" style={{ textAlign: 'center' }}>Loading your profile...</p>}
      
      {!loading && userProfile && (
        <div className="section-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <AdminUserFormModal
            isOpen={true}
            onClose={() => {}} // Non-functional in embedded page mode
            onSave={handleSaveProfile}
            initialData={userProfile}
            loading={loading}
            error={error}
            success={success}
            isProfileSettings={true}
          />
        </div>
      )}
      
      <style>{`
        /* Transform the modal into an embedded page component */
        .modal-backdrop { position: static; background: none; padding: 0; }
        .modal { box-shadow: none; width: 100%; max-width: none; padding: 0; border: none; }
        .modal-actions .btn-secondary { display: none; }
      `}</style>
    </div>
  );
};

export default SettingsPage;
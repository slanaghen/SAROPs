import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Responder, ResponderStatus } from '../types/sarops-types';
import '../styles/ResponderCheckin.css';

/**
 * ResponderCheckin Component
 *
 * Allows a search and rescue responder to check in at an incident.
 * Captures their information and generates a unique device ID for
 * offline tracking and session management.
 *
 * Props:
 * - onCheckIn: Callback when responder successfully checks in
 * - isLoading: Show loading state
 * - error: Display error message
 * - successMessage: Display success confirmation
 */
interface ResponderCheckinProps {
  onCheckIn?: (responder: Responder) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  incidents?: any[]; // List of active incidents
  loadingIncidents?: boolean;
  incidentError?: string | null;
  onIncidentSelected?: (incidentId: string) => void;
  onCreateIncident?: () => void;
  selectedIncidentId?: string;
}

const ResponderCheckin: React.FC<ResponderCheckinProps> = ({
  onCheckIn,
  isLoading = false,
  error: externalError = null,
  successMessage: externalSuccessMessage = null,
  incidents = [],
  loadingIncidents = false,
  incidentError = null,
  onIncidentSelected,
  onCreateIncident,
  selectedIncidentId = '',
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    agency: '',
    identifier: '',
    cell_phone: '',
    special_skills: '',
    is_command_staff: false,
  });

  // UI state
  const [internalError, setInternalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedResponder, setConfirmedResponder] = useState<Responder | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    name: string;
    email: string;
    password?: string;
    agency: string;
    identifier: string;
    cell_phone: string;
    special_skills: string;
    is_command_staff: boolean;
    incident_id?: string;
  } | null>(null);

  // Use external error/loading/success if provided, otherwise use internal state
  const displayError = externalError || internalError;
  const displayLoading = isLoading || localLoading;
  const displaySuccessMessage = externalSuccessMessage || successMessage;

  /**
   * Format phone number as nnn-nnn-nnnn
   */
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/[^\d]/g, '');
    const len = digits.length;
    if (len < 4) return digits;
    if (len < 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  /**
   * Generate device ID - unique identifier for this browser/device session
   * Used for offline tracking and identifying which device a responder is using
   */
  const generateDeviceId = (): string => {
    // Create a device identifier based on browser info + timestamp + random
    const browserInfo = `${navigator.userAgent}${navigator.language}`;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `device_${timestamp}_${random}`;
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const processedValue = type === 'checkbox' ? checked : (name === 'cell_phone' ? formatPhoneNumber(value) : value);

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
    // Clear errors when user starts typing
    if (internalError) setInternalError(null);
  };

  /**
   * Validate form data
   */
  const validateForm = (data = formData): boolean => {
    if (!data.name?.trim()) {
      setInternalError('Name is required');
      return false;
    }
    if (!data.email?.trim() || !data.email.includes('@')) {
      setInternalError('A valid email address is required');
      return false;
    }
    if (!data.password || data.password.length < 6) {
      setInternalError('Password must be at least 6 characters');
      return false;
    }
    if (!data.agency?.trim()) {
      setInternalError('Agency is required');
      return false;
    }
    if (!data.identifier?.trim()) {
      setInternalError('Identifier is required (e.g., badge number, radio call sign)');
      return false;
    }
    if (!data.cell_phone?.trim()) {
      setInternalError('Cell phone number is required');
      return false;
    }

    // Validate that we have at least 10 digits
    const digitsOnly = (data.cell_phone || '').replace(/[^\d]/g, '');
    if (digitsOnly.length < 10) {
      setInternalError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  /**
   * Create responder object from form data
   */
  const createResponderObject = (data = formData, incidentId = selectedIncidentId): Responder => {
    const now = new Date().toISOString();

    return {
      responder_id: uuidv4(),
      incident_id: incidentId,
      name: (data.name || '').trim(),
      email: (data.email || '').trim().toLowerCase(),
      agency: (data.agency || '').trim(),
      identifier: (data.identifier || '').trim(),
      cell_phone: (data.cell_phone || '').trim(),
      special_skills: (data.special_skills || '').trim() || undefined,
      access_level: data.is_command_staff ? 'command staff' : 'responder', // Admin is now handled by AdminPage auth
      device_id: generateDeviceId(),
      checkin_datetime: now,
      checkout_datetime: null,
      status: 'Staged' as ResponderStatus,
    };
  };

  /**
   * Handle form submission - show confirmation dialog
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInternalError(null);

    // Read values directly from the submitted form and apply formatting
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const submitted = {
      name: (fd.get('name') as string) || '',
      email: (fd.get('email') as string) || '',
      password: (fd.get('password') as string) || '',
      agency: (fd.get('agency') as string) || '',
      identifier: (fd.get('identifier') as string) || '',
      cell_phone: formatPhoneNumber((fd.get('cell_phone') as string) || ''),
      special_skills: (fd.get('special_skills') as string) || '',
      is_command_staff: fd.get('is_command_staff') === 'on',
      incident_id: selectedIncidentId,
    };

    // Update controlled state to reflect formatted values and snapshot confirmation data
    setFormData(submitted);
    setConfirmationData(submitted);

    if (!validateForm(submitted)) {
      return;
    }

    // Create responder object from submitted values and show confirmation
    const responder = createResponderObject(submitted, selectedIncidentId);
    console.debug('ResponderCheckin submit -> responder:', responder);
    setConfirmedResponder(responder);
    setShowConfirmation(true);
  };

  /**
   * Handle confirmation - save responder
   */
  const handleConfirmCheckin = async () => {
    if (!confirmedResponder) return;

    setLocalLoading(true);
    setInternalError(null);

    try {
      // Call the onCheckIn callback
      if (onCheckIn && selectedIncidentId) { // Pass selectedIncidentId
        await onCheckIn(confirmedResponder);
      }

      // Show success message
      setSuccessMessage(
        `✓ ${confirmedResponder.name} checked in successfully!`
      );

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        agency: '',
        identifier: '',
        cell_phone: '',
        special_skills: '',
        is_command_staff: false,
      });
      setConfirmationData(null);

      setShowConfirmation(false);
      setConfirmedResponder(null);

      // Clear success message after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Check-in failed';
      setInternalError(errorMessage);
      console.error('Check-in error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  /**
   * Handle cancel confirmation
   */
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setConfirmedResponder(null);
    setConfirmationData(null);
  };

  const displayResponder = confirmationData || confirmedResponder;

  return (
    <div className="responder-checkin">
      <div className="checkin-container">
        <div className="checkin-header">
          <h1>Responder Check-In</h1>
          <p className="subtitle">Welcome to the incident. Please enter your information.</p>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span className="alert-message">{displayError}</span>
            <button
              className="alert-close"
              onClick={() => setInternalError(null)}
              aria-label="Close error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Alert */}
        {displaySuccessMessage && (
          <div className="alert alert-success" role="alert">
            <span className="alert-icon">✓</span>
            <span className="alert-message">{displaySuccessMessage}</span>
          </div>
        )}

        {/* Main Form */}
        {!showConfirmation ? (
          <form onSubmit={handleSubmit} className="checkin-form">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="First and Last Name"
                required
                autoFocus
                disabled={displayLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="name@agency.gov"
                required
                disabled={displayLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                required
                disabled={displayLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="agency">Agency *</label>
              <input
                id="agency"
                type="text"
                name="agency"
                value={formData.agency}
                onChange={handleInputChange}
                placeholder="e.g., Sheriff's Office, Fire Department, Volunteer"
                required
                disabled={displayLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="identifier">Identifier *</label>
              <input
                id="identifier"
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                placeholder="Badge #, Call Sign, or Employee ID"
                required
                disabled={displayLoading}
              />
              <small className="form-hint">
                A unique identifier to distinguish you from other responders
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="cell_phone">Cell Phone Number *</label>
              <input
                id="cell_phone"
                type="tel"
                name="cell_phone"
                value={formData.cell_phone}
                onChange={handleInputChange}
                placeholder="(555) 123-4567 or 555-123-4567"
                required
                disabled={displayLoading}
              />
              <small className="form-hint">
                So we can contact you if needed
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="special_skills">Special Skills / Capabilities</label>
              <input
                id="special_skills"
                type="text"
                name="special_skills"
                value={formData.special_skills}
                onChange={handleInputChange}
                placeholder="e.g., Dog Handler, Diver, Pilot"
                disabled={displayLoading}
              />
              <small className="form-hint">
                Optional: enter your special qualifications or capabilities.
              </small>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                id="is_command_staff"
                type="checkbox"
                name="is_command_staff"
                checked={formData.is_command_staff}
                onChange={handleInputChange}
                disabled={displayLoading}
                style={{ width: 'auto', margin: 0 }}
              />
              <label htmlFor="is_command_staff" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>Command Staff</label>
            </div>

            {/* Incident Selection Dropdown */}
            {incidents.length > 0 && (
              <div className="form-group">
                <label htmlFor="incident">Select Active Incident *</label>
                <select
                  id="incident"
                  value={selectedIncidentId}
                  onChange={(e) => {
                    onIncidentSelected?.(e.target.value);
                  }}
                  disabled={loadingIncidents || displayLoading}
                  required
                >
                  <option value="">— Select an Incident —</option>
                  {incidents.map((inc) => (
                    <option key={inc.incident_id} value={inc.incident_id}>
                      {inc.name} ({inc.number})
                    </option>
                  ))}
                </select>
                {incidentError && <small className="form-hint error-text">{incidentError}</small>}
              </div>
            )}

            <div className="login-actions" style={{ marginTop: '24px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-large"
                disabled={displayLoading || (incidents.length > 0 && !selectedIncidentId)}
                aria-busy={displayLoading}
                style={{ width: '100%', marginBottom: '12px' }}
              >
                {displayLoading ? 'Processing...' : 'Continue to Confirmation'}
              </button>

              {incidents.length > 0 && <div className="divider" style={{ textAlign: 'center', margin: '12px 0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>or</div>}

              <button type="button" className="btn btn-secondary" onClick={onCreateIncident}>
                Create New Incident
              </button>
            </div>
          </form>
        ) : displayResponder ? (
          /* Confirmation Screen */
          <div className="confirmation-screen">
            <div className="confirmation-header">
              <h2>Confirm Your Information</h2>
              <p>Please verify the following information is correct:</p>
            </div>

            <div className="confirmation-details">
              <div className="detail-item">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{displayResponder.name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Incident:</span>
                <span className="detail-value">
                  {incidents.find(i => i.incident_id === selectedIncidentId)?.name || 'None Selected'}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{displayResponder.email}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Agency:</span>
                <span className="detail-value">{displayResponder.agency}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Identifier:</span>
                <span className="detail-value">{displayResponder.identifier}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Cell Phone:</span>
                <span className="detail-value">{displayResponder.cell_phone}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Access Level:</span>
                <span className="detail-value"> {/* Admin status is now determined by AdminPage auth */}
                  {displayResponder.is_command_staff ? 'Command Staff' : 'Responder'}
                </span>
              </div>

              {displayResponder.special_skills ? (
                <div className="detail-item">
                  <span className="detail-label">Special Skills:</span>
                  <span className="detail-value">{displayResponder.special_skills}</span>
                </div>
              ) : null}

              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className={`detail-value status-badge ${((confirmedResponder && confirmedResponder.status) || 'Staged').toLowerCase()}`}>
                  {(confirmedResponder && confirmedResponder.status) || 'Staged'}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Check-In Time:</span>
                <span className="detail-value">
                  {new Date((confirmedResponder && confirmedResponder.checkin_datetime) || new Date().toISOString()).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="confirmation-footer">
              <small className="privacy-notice">
                💾 Your information will be stored securely and used only for incident coordination.
              </small>

              <div className="confirmation-buttons">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelConfirmation}
                  disabled={displayLoading}
                >
                  Back to Edit
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={handleConfirmCheckin}
                  disabled={displayLoading}
                  aria-busy={displayLoading}
                >
                  {displayLoading ? 'Checking In...' : 'Confirm Check-In'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer Info */}
        <div className="checkin-footer">
          <p className="footer-text">
            🔒 Your personal information is protected and will only be used for incident coordination.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResponderCheckin;

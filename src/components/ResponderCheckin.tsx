import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { Responder, ResponderStatus, AccessLevel, ResponderType } from '../types/sarops-types';
import { getResponderByIdentifier } from '../services/responderService';
import '../styles/ResponderCheckin.css';
import '../styles/FormElements.css';
import '../styles/ActionButtons.css';

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
  onCreateIncident?: (formData: any) => void;
  isAdmin?: boolean; // Add isAdmin prop
  selectedIncidentId?: string;
  initialData?: {
    name: string;
    agency: string;
    identifier: string;
    cell_phone: string;
    special_skills: string;
    vehicles: string;
    responder_type: ResponderType | '';
  };
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
  isAdmin = false, // Default to false
  selectedIncidentId = '',
  initialData,
}) => {
  // Form state
  const [formData, setFormData] = useState(initialData || {
    name: '',
    agency: '',
    identifier: '',
    cell_phone: '',
    special_skills: '',
    responder_type: '', // New field
    vehicles: '',
  });

  // UI state
  const [internalError, setInternalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedResponder, setConfirmedResponder] = useState<Responder | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    name: string;
    agency: string;
    identifier: string;
    cell_phone: string;
    responder_type: ResponderType | '';
    special_skills: string;
    vehicles: string;
    incident_id?: string;
  } | null>(null);

  const [displayDensity, setDisplayDensity] = useState('comfortable');

  // Fetch display density for local component styling
  useEffect(() => {
    const fetchDensity = async () => {
      const userEmail = localStorage.getItem('sarops_user_email');
      if (!userEmail) return;
      const { data } = await supabase.from('users').select('display_density').eq('email', userEmail).maybeSingle();
      if (data?.display_density) setDisplayDensity(data.display_density);
    };
    fetchDensity();
  }, []);

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
    // Prioritize standard UUIDs for device identification where available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `dev_${crypto.randomUUID()}`;
    }
    return `device_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    let processedValue: any;

    const { value, checked } = e.target as HTMLInputElement;
    processedValue = type === 'checkbox' ? checked : (name === 'cell_phone' ? formatPhoneNumber(value) : (type === 'radio' ? value : value));

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
    if (!selectedIncidentId) {
      setInternalError('Please select an active incident or create a new one to continue');
      return false;
    }
    if (!data.name?.trim()) {
      setInternalError('Name is required');
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
    if (!data.responder_type) {
      setInternalError('Please select a responder type');
      return false;
    }

    return true;
  };

  /**
   * Create responder object from form data
   */
  const createResponderObject = async (data = formData, incidentId = selectedIncidentId): Promise<Responder> => {
    const now = new Date().toISOString();
    let initialAccessLevel: AccessLevel = 'responder';
    let initialStatus: ResponderStatus = 'Staged';

    // Check if a responder with this identifier already exists and is command staff
    // This is important if they were assigned an ICS role before checking in
    try {
      const existingResponder = await getResponderByIdentifier(supabase, data.identifier.trim());
      if (existingResponder && (existingResponder.access_level === 'staff' || existingResponder.access_level === 'admin')) {
        initialAccessLevel = existingResponder.access_level;
        initialStatus = 'Assigned'; // Command staff are 'Assigned' by default
      }
    } catch (e) {
      console.warn('Could not check for existing responder by identifier:', e);
    }

    return {
      responder_id: uuidv4(),
      incident_id: incidentId,
      name: (data.name || '').trim(),
      agency: (data.agency || '').trim(),
      identifier: (data.identifier || '').trim(),
      cell_phone: (data.cell_phone || '').trim(),
      special_skills: (data.special_skills || '').trim() || undefined,
      vehicles: (data.vehicles || '').trim() || undefined,
      responder_type: data.responder_type || undefined,
      access_level: initialAccessLevel,
      device_id: generateDeviceId(),
      checkin_datetime: now,
      checkout_datetime: null,
      status: initialStatus,
    };
  };

  /**
   * Handle form submission - show confirmation dialog
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInternalError(null);

    // Use the component's Tracked state as the source of truth
    const submittedData = { ...formData, incident_id: selectedIncidentId };

    if (!validateForm(submittedData)) {
      return;
    }

    setConfirmationData(submittedData);

    // Create responder object from submitted values and show confirmation
    const responder = await createResponderObject(submittedData, selectedIncidentId);
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
      if (!selectedIncidentId) {
        throw new Error('No incident selected. Please go back and select an incident.');
      }

      // Call the onCheckIn callback
      if (onCheckIn) {
        await onCheckIn(confirmedResponder);
      }

      // Show success message
      setSuccessMessage(
        `✓ ${confirmedResponder.name} checked in successfully!`
      );

      // Reset form
      setFormData({
        name: '',
        agency: '',
        identifier: '',
        cell_phone: '',
        special_skills: '',
        vehicles: '',
        responder_type: '',
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
    <div className={`checkin-container density-${displayDensity}`}>
      <div className="checkin-header">
        <h1>Responder Check-In</h1>
        <p style={{ color: 'white', fontSize: 'var(--text-sm)', margin: 'var(--space-xs) 0 0' }}>
          Registered user? <Link to="/login" style={{ color: '#0ea5e9', fontWeight: 600, textDecoration: 'none' }}>Login here</Link>
        </p>
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
          <form onSubmit={handleSubmit} className="checkin-form" noValidate>
            {/* Row 1: Name and Phone */}
            <div className="form-grid" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <div className="form-field">
                <label className="form-label" htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  className="form-input"
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
              <div className="form-field">
                <label className="form-label" htmlFor="cell_phone">Cell Phone Number *</label>
                <input
                  id="cell_phone"
                  className="form-input"
                  type="tel"
                  name="cell_phone"
                  value={formData.cell_phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567 or 555-123-4567"
                  required
                  disabled={displayLoading}
                />
                <small className="form-hint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                  So we can contact you if needed
                </small>
              </div>
            </div>

            {/* Row 2: Agency and Identifier */}
            <div className="form-grid" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <div className="form-field">
                <label className="form-label" htmlFor="agency">Agency *</label>
              <input
                  id="agency"
                className="form-input"
                  type="text"
                  name="agency"
                  value={formData.agency}
                onChange={handleInputChange}
                  placeholder="e.g., Sheriff's Office, Volunteer"
                required
                disabled={displayLoading}
              />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="identifier">Identifier *</label>
              <input
                id="identifier"
                className="form-input"
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                placeholder="Badge #, Call Sign, or Employee ID"
                required
                disabled={displayLoading}
              />
              <small className="form-hint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                A unique identifier to distinguish you from other responders
              </small>
              </div>
            </div>

            {/* Row 3: Capabilities and Vehicles */}
            <div className="form-grid" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <div className="form-field">
                <label className="form-label" htmlFor="special_skills">Capabilities</label>
                <input
                  id="special_skills"
                  type="text"
                  name="special_skills"
                  className="form-input"
                  value={formData.special_skills}
                  onChange={handleInputChange}
                  placeholder="e.g. EMT, K9 Handler, Rope Rescue, ..."
                  disabled={displayLoading}
                />
                <small className="form-hint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                  List specialized skills or certifications separated by commas.
                </small>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="vehicles">Vehicles</label>
                <input
                  id="vehicles"
                  type="text"
                  name="vehicles"
                  className="form-input"
                  value={formData.vehicles}
                  onChange={handleInputChange}
                  placeholder="3121, UTV, boat, snowmobile, helicopter, ..."
                  disabled={displayLoading}
                />
                <small className="form-hint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                  List vehicle designations separated by commas.
                </small>
              </div>
            </div>

            {/* Row 4: Empty Spacing Grid */}
            <div className="form-grid" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="form-field" />
              <div className="form-field" />
            </div>

            {/* Row 5: Responder Type (Centered Single Column) */}
            <div className="form-field radio-form-group" style={{ alignItems: 'center', textAlign: 'center', marginBottom: 'var(--space-md)' }}>
              <label className="form-label">Responder Type *</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="responder_type"
                    value="SAR"
                    checked={formData.responder_type === 'SAR'}
                    onChange={handleInputChange}
                    disabled={displayLoading}
                    required
                  />
                  SAR
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="responder_type"
                    value="Fire"
                    checked={formData.responder_type === 'Fire'}
                    onChange={handleInputChange}
                    disabled={displayLoading}
                  />
                  Fire
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="responder_type"
                    value="Law"
                    checked={formData.responder_type === 'Law'}
                    onChange={handleInputChange}
                    disabled={displayLoading}
                  />
                  Law
                </label>
                <label className="radio-label">
                  <input type="radio" name="responder_type" value="Medical" checked={formData.responder_type === 'Medical'} onChange={handleInputChange} disabled={displayLoading} />
                  Medical
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="responder_type"
                    value="Other"
                    checked={formData.responder_type === 'Other'}
                    onChange={handleInputChange}
                    disabled={displayLoading} />
                  Other
                </label>
              </div>
              <small className="form-hint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                Your primary operational role/agency type.
              </small>
            </div>

            {/* Row 6: Incident Selection (Centered Single Column) */}
            <div className="form-field" style={{ maxWidth: '400px', margin: '0 auto var(--space-md)' }}>
              <label className="form-label" htmlFor="incident">Select Active Incident *</label>
              <select
                id="incident"
                className="form-select"
                value={selectedIncidentId}
                onChange={(e) => {
                if (e.target.value === 'NEW_INCIDENT') {
                    onCreateIncident?.(formData);
                  } else {
                    onIncidentSelected?.(e.target.value);
                  }
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
                {(incidents.length === 0 || isAdmin || !confirmedResponder) && (
                  <option value="NEW_INCIDENT">+ Create New Incident</option>
                )}
              </select>
              {incidentError && <small className="form-hint error-text" style={{ fontSize: 'var(--text-xs)', color: '#dc2626' }}>{incidentError}</small>}
            </div>

            {/* Row 7: Continue Button (Centered Single Column) */}
            <div className="login-actions" style={{ maxWidth: '400px', margin: 'var(--space-lg) auto 0' }}>
              <button
                type="submit"
                className="action-btn action-btn-primary action-btn-full"
                disabled={displayLoading}
                aria-busy={displayLoading}
                style={{ marginBottom: 'var(--space-md)' }}
              >
                {displayLoading ? 'Processing...' : 'Continue to Confirmation'}
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
                  {incidents.find(i => i.incident_id === (displayResponder as any).incident_id)?.name || 'None Selected'}
                </span>
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
                <span className="detail-label">Responder Type:</span>
                <span className="detail-value">{displayResponder.responder_type}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Access Level:</span>
                <span className="detail-value" style={{ textTransform: 'capitalize' }}>{displayResponder.access_level || 'responder'}</span>
              </div>

              {displayResponder.special_skills ? (
                <div className="detail-item">
                  <span className="detail-label">Capabilities:</span>
                  <span className="detail-value">{displayResponder.special_skills}</span>
                </div>
              ) : null}

              {displayResponder.vehicles ? (
                <div className="detail-item">
                  <span className="detail-label">Vehicles:</span>
                  <span className="detail-value">{displayResponder.vehicles}</span>
                </div>
              ) : null}

              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">
                  <span className={`status-badge ${((confirmedResponder && confirmedResponder.status) || 'Staged').toLowerCase()}`}>
                    {(confirmedResponder && confirmedResponder.status) || 'Staged'}
                  </span>
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
  );
};

export default ResponderCheckin;

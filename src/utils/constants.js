// src/utils/constants.js

/**
 * Centralized constants for SAROps application.
 * Improves maintainability, reduces magic strings, and prevents typos.
 */

// --- Responder Statuses ---
export const RESPONDER_STATUS = {
  STAGED: 'Staged',
  ATTACHED: 'Attached',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  CHECKED_OUT: 'CheckedOut',
};

// --- Team Statuses ---
export const TEAM_STATUS = {
  STAGED: 'Staged',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  DISBANDED: 'Disbanded',
};

// --- Team Types ---
export const TEAM_TYPE = {
  GROUND: 'Ground',
  DOG: 'Dog',
  STAFF: 'Staff',
  OTHER: 'Other',
};

// --- Assignment Statuses ---
export const ASSIGNMENT_STATUS = {
  PLANNED: 'Planned',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  COMPLETED: 'Completed',
  INCOMPLETE: 'Incomplete',
};

// --- Vehicle Statuses ---
export const VEHICLE_STATUS = {
  STAGED: 'Staged',
ATTACHED: 'Attached',
ASSIGNED: 'Assigned',
DEPLOYED: 'Deployed',
CHECKED_OUT: 'CheckedOut',
};

// --- Incident Statuses ---
export const INCIDENT_STATUS = {
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

// --- Refresh Intervals (in milliseconds) ---
export const REFRESH_INTERVALS = {
  OPERATIONS: 30000, // 30 seconds
  RESPONDER: 30000,  // 30 seconds
  SARTOPO: 60000,    // 60 seconds
};
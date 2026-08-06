// --- Refresh Intervals (in milliseconds) ---
export const OPERATIONS_REFRESH_INTERVAL = 30000;
export const RESPONDER_REFRESH_INTERVAL = 30000;
export const SARTOPO_REFRESH_INTERVAL = 60000;

// --- Status Enums ---
export const RESPONDER_STATUS = {
  STAGED: 'Staged',
  ATTACHED: 'Attached',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  CHECKED_OUT: 'CheckedOut',
  CLEARED: 'Cleared',
};

export const TEAM_STATUS = {
  STAGED: 'Staged',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  DISBANDED: 'Disbanded',
};

export const ASSIGNMENT_STATUS = {
  PLANNED: 'Planned',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  COMPLETED: 'Completed',
  INCOMPLETE: 'Incomplete',
};

export const VEHICLE_STATUS = {
  STAGED: 'Staged',
  ATTACHED: 'Attached',
  ASSIGNED: 'Assigned',
  DEPLOYED: 'Deployed',
  CHECKED_OUT: 'CheckedOut',
};

// --- Type Lists for Dropdowns ---
export const RESPONDER_TYPES = ['SAR', 'Fire', 'Law', 'Medical'];

export const TEAM_TYPES = [
  'Hasty', 'Ground', 'Vehicle', 'UAS', 'Water', 
  'Tracking', 'Dog', 'Avalanche', 'Transport', 
  'Helicopter', 'Medical', 'Staff', 'Other'
];

export const RESOURCE_TYPES = TEAM_TYPES;

export const RESPONDER_STATUS_LIST = [
  'Staged', 'Attached', 'Assigned', 'Deployed', 'CheckedOut', 'Cleared'
];

export const ACCESS_LEVELS = ['responder', 'staff', 'admin'];

export const STAFF_PREDEFINED_ROLES = [
  'Incident Commander',
  'Public Information Officer',
  'Safety Officer',
  'Liaison Officer',
  'Operations Section Chief',
  'Planning Section Chief',
  'Logistics Section Chief',
  'Finance/Admin Section Chief',
  'Mapper'
];

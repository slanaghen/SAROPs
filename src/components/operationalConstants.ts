/**
 * Standardized operational capabilities and resource types.
 */
export const TEAM_TYPES = [
  'Hasty', 'Ground', 'Vehicle', 'UAS', 
  'Water', 'Tracking', 'Dog', 'Avalanche', 
  'Transport', 'Helicopter', 'Medical', 'Other'
];

export const RESOURCE_TYPES = [...TEAM_TYPES];

export const SKILLS_LIST = [
  "Air Scent Dog", "Trail Dog", "UAS", "Vehicle", "Snowmobile", "UTV", 
  "Swiftwater", "Dive", "Avalanche", "Boat", "Helicopter", "Rope Rescue", 
  "Litter", "Medical", "Other"
];

export const STAFF_PREDEFINED_ROLES = [
  'Incident Commander', 'Operations', 'Planning', 
  'Logistics', 'PIO', 'Safety', 'Liaison', 'Admin / Finance'
];

/**
 * Polling interval for background data refreshes on the Operations Dashboard.
 */
export const OPERATIONS_REFRESH_INTERVAL = 60000; // 60 seconds

/**
 * Polling interval for background data refreshes on the Responder Dashboard.
 */
export const RESPONDER_REFRESH_INTERVAL = 60000; // 60 seconds
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
export let OPERATIONS_REFRESH_INTERVAL = 1000; // 1 second
export const setOperationsRefreshInterval = (ms: number) => { OPERATIONS_REFRESH_INTERVAL = ms; };

/**
 * Polling interval for background data refreshes on the Responder Dashboard.
 */
export let RESPONDER_REFRESH_INTERVAL = 1000; // 1 second
export const setResponderRefreshInterval = (ms: number) => { RESPONDER_REFRESH_INTERVAL = ms; };

/**
 * Polling interval for background SARTopo data fetches.
 */
export let SARTOPO_REFRESH_INTERVAL = 1000; // 1 second
export const setSartopoRefreshInterval = (ms: number) => { SARTOPO_REFRESH_INTERVAL = ms; };
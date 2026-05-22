// sarops-types.d.ts

export type AssignmentStatus = 'Planned' | 'Assigned' | 'Deployed' | 'Completed' | 'Incomplete';
export type AccessLevel = 'responder' | 'command staff' | 'admin';
export type TeamStatus = 'Staged' | 'Assigned' | 'Deployed' | 'Disbanded';
export type TeamType = 'Hasty' | 'Ground' | 'Vehicle' | 'UAS' | 'Water' | 'Tracking' | 'Dog' | 'Avalanche' | 'Transport' | 'Helicopter' | 'Medical' | 'Staff' | 'Other';
export type ResponderType = 'SAR' | 'Fire' | 'Law' | 'Medical';
export type ResponderStatus = 'Staged' | 'Attached' | 'Assigned' | 'Deployed' | 'CheckedOut' | 'Cleared';

export interface Incident {
  incident_id: string; // TEXT Primary Key (Incident Number)
  name: string;
  number: string;
  sartopo_id?: string | null;
  notes?: string | null;
  start_datetime: string; // ISO Timestamp
  end_datetime: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OperationalPeriod {
  op_period_id: string; // UUID Primary Key
  incident_id: string; // Foreign Key
  op_number: number;
  start_datetime: string;
  end_datetime: string | null; // Locked Snapshot when OP ends
  situation_narrative: string;
  situational_awareness_narrative: string;
  par_check_interval: number;
  created_at?: string;
  updated_at?: string;
}

export interface Assignment {
  assignment_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  sartopo_id: string | null; // 1:1 mapping to SARTopo object
  status: AssignmentStatus;
  title: string;
  segment?: string | null;
  resource_type?: string;
  team_size?: number;
  frequency_primary?: string;
  description?: string;
  debrief_narrative?: string;
  probability_of_detection?: number;
  team_name?: string;
  priority?: string;
  transportation?: string;
  time_allocated?: string;
  segment_area?: string;
  hazards?: string;
  prepared_by?: string;
  folder_id?: string;
  color?: string;
  stroke?: string;
  fill?: string;
  is_orphaned: boolean;
  team_id: string | null; // The UUID of the team currently tasked with this assignment
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  team_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  team_name_number: string;
  sartopo_color_hex: string; // Pulled dynamically from SARTopo
  type: TeamType;
  status: TeamStatus; // Cascades status changes down to attached Responders
  leader_responder_id: string | null; // Foreign Key to Responder
  current_responders: Partial<Responder>[]; // Array of Responder details for active dashboard use
  equipment: string[]; // Free-text array for general gear
  last_par_check: string | null;
  par_status: string | null;
  created_at?: string;
}

/**
 * Represents a checked-in personnel record.
 * device_id is used for session recovery and identifying unique browser instances.
 */
export interface Responder {
  responder_id: string; // UUID Primary Key
  name: string;
  agency: string;
  identifier: string;
  cell_phone: string;
  special_skills?: string;
  device_id: string; // Distinct browser/session token for offline tracking
  checkin_datetime: string;
  checkout_datetime: string | null;
  responder_type?: ResponderType;
  last_seen_at?: string; // Optional: for real-time presence tracking
  access_level: AccessLevel;
  status: ResponderStatus;
}

export interface ResponderTeamHistory {
  history_id: string; // UUID Primary Key
  responder_id: string; // Foreign Key
  team_id: string; // Foreign Key
  attached_datetime: string;
  detached_datetime: string | null; // For auditing historical attachment timelines
}

export interface Clue {
  clue_id: string; // UUID Primary Key
  incident_id: string; // Foreign Key
  sartopo_marker_id: string | null;
  latitude: number;
  longitude: number;
  description: string;
  photo_url: string; // Local storage URI or Cloud bucket URL
  discovered_by_team_id: string | null;
  discovered_by_responder_id: string | null;
  timestamp: string;
}
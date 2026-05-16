// sarops-types.d.ts

export type AssignmentStatus = 'Draft' | 'Planned' | 'Assigned' | 'Deployed' | 'Completed';
export type TeamStatus = 'Draft' | 'Staged' | 'Assigned' | 'Deployed' | 'Demobilized';
export type TeamType = 'Ground Search' | 'UAS Search' | 'Dog Air' | 'Dog Track' | 'Transport' | 'Helicopter' | 'Other';
export type ResponderStatus = 'Staged' | 'Attached' | 'Assigned' | 'Briefed' | 'Deployed' | 'Debriefed' | 'CheckedOut';

export interface Incident {
  incident_id: string; // UUID Primary Key
  name: string;
  number: string;
  start_datetime: string; // ISO Timestamp
  end_datetime: string | null;
  operational_periods: string[]; // Array of OperationalPeriod_ID
  clues: string[]; // Array of Clue_ID (Stored at Incident level)
}

export interface OperationalPeriod {
  op_period_id: string; // UUID Primary Key
  incident_id: string; // Foreign Key
  op_number: number;
  start_datetime: string;
  end_datetime: string; // Locked Snapshot when OP ends
  situation_narrative: string;
  situational_awareness_narrative: string;
  teams: string[]; // Array of Team_ID active in this OP
  assignments: string[]; // Array of Assignment_ID active in this OP
}

export interface Assignment {
  assignment_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  sartopo_id: string | null; // 1:1 mapping to SARTopo object
  name: string;
  status: AssignmentStatus;
  is_orphaned: boolean; // True if deleted in SARTopo, preserved until explicitly purged
  team_id: string | null; // Foreign Key to Team
}

export interface Team {
  team_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  team_name_number: string;
  sartopo_color_hex: string; // Pulled dynamically from SARTopo
  type: TeamType;
  status: TeamStatus; // Cascades status changes down to attached Responders
  leader_responder_id: string; // Foreign Key to Responder
  current_responders: string[]; // Array of Responder_ID for active dashboard use
  equipment: string[]; // Free-text array for general gear
}

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
  coordinates: {
    latitude: number;
    longitude: number;
  };
  description: string;
  photo_url: string; // Local storage URI or Cloud bucket URL
  discovered_by_team_id: string | null;
  discovered_by_responder_id: string | null;
  timestamp: string;
}
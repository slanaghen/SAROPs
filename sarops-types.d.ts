// sarops-types.d.ts

export type AssignmentStatus = 'Planned' | 'Assigned' | 'Deployed' | 'Completed' | 'Incomplete';
export type AccessLevel = 'responder' | 'command staff';
export type TeamStatus = 'Staged' | 'Assigned' | 'Deployed' | 'Disbanded';
export type TeamType = 'Ground Search' | 'UAS Search' | 'Dog Air' | 'Dog Track' | 'Transport' | 'Helicopter' | 'Other';
export type ResponderStatus = 'Staged' | 'Attached' | 'Assigned' | 'Deployed';

export interface Incident {
  incident_id: string; // UUID Primary Key
  name: string;
  number: string;
  start_datetime: string; // ISO Timestamp
  end_datetime: string | null;
}

export interface OperationalPeriod {
  op_period_id: string; // UUID Primary Key
  incident_id: string; // Foreign Key
  op_number: number;
  start_datetime: string;
  end_datetime: string; // Locked Snapshot when OP ends
  situation_narrative: string;
  situational_awareness_narrative: string;
}

export interface Assignment {
  assignment_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  sartopo_id: string | null; // 1:1 mapping to SARTopo object
  title: string;
  name?: string;
  status: AssignmentStatus;
  is_orphaned: boolean; // True if deleted in SARTopo, preserved until explicitly purged
  team_id: string | null; // Foreign Key to Team
  poa?: number;
  pod?: number;
  debrief_narrative?: string;
  probability_of_detection?: number;

  // SARTopo aligned fields (new)
  title?: string;
  segment?: string | null;
  resource_type?: string;
  team_size?: number;
  frequency_primary?: string;
  description?: string;
  probabilityOfDetection?: number;
  probability_of_detection?: number;

  // Additional metadata
  team_name?: string;
  priority?: string;
  transportation?: string;
  time_allocated?: string;
  segmentArea?: string;
  hazards?: string;
  preparedBy?: string;
  folder_id?: string;
  color?: string;
  stroke?: string;
  fill?: string;
  updated?: string;
}

export interface Team {
  team_id: string; // UUID Primary Key
  op_period_id: string; // Foreign Key
  team_name_number: string;
  sartopo_color_hex: string; // Pulled dynamically from SARTopo
  type: TeamType;
  status: TeamStatus; // Cascades status changes down to attached Responders
  leader_responder_id: string | null; // Foreign Key to Responder
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

export interface ICSAssignment {
  ics_assignment_id: string; // UUID Primary Key
  incident_id: string; // Foreign Key
  position: string; // e.g., 'ic', 'safety', 'ops'
  responder_id: string | null; // Foreign Key to Responder
  assigned_at: string; // ISO Timestamp
}
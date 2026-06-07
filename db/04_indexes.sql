-- Secondary Indexes for Operational Periods
CREATE INDEX idx_operational_periods_start_datetime ON operational_periods(start_datetime);

-- Secondary Indexes for Teams
CREATE INDEX idx_teams_leader_responder_id ON teams(leader_responder_id);
CREATE INDEX idx_teams_status ON teams(status);

-- Secondary Indexes for Assignments
CREATE INDEX idx_assignments_team_id ON assignments(team_id);
CREATE INDEX idx_assignments_status ON assignments(status);

-- Secondary Indexes for History and Audit
CREATE INDEX idx_responder_team_history_responder_id ON responder_team_history(responder_id);
CREATE INDEX idx_responder_team_history_team_id ON responder_team_history(team_id);
CREATE INDEX idx_action_logs_incident_id ON action_logs(incident_id);

-- Secondary Indexes for Clues
CREATE INDEX idx_clues_discovered_by_team_id ON clues(discovered_by_team_id);
CREATE INDEX idx_clues_discovered_by_responder_id ON clues(discovered_by_responder_id);
CREATE INDEX idx_clues_coordinates ON clues(latitude, longitude);

-- Secondary Indexes for Logistics
CREATE INDEX idx_responders_device_id ON responders(device_id);
CREATE INDEX idx_responders_access_level ON responders(access_level);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- Messaging Performance
CREATE INDEX idx_team_messages_composite ON team_messages(team_id, created_at);
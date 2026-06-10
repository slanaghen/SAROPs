-- Updated At
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operational_periods_updated_at BEFORE UPDATE ON operational_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_responders_updated_at BEFORE UPDATE ON responders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ICS Automation
CREATE TRIGGER ensure_staff_team_on_new_op AFTER INSERT ON operational_periods FOR EACH ROW EXECUTE FUNCTION create_staff_team_for_op();
CREATE TRIGGER trigger_first_responder_ic_check AFTER INSERT ON responders FOR EACH ROW EXECUTE FUNCTION auto_assign_first_responder_as_ic();
CREATE TRIGGER trigger_sync_assignment_team_size BEFORE INSERT OR UPDATE OF team_id ON assignments FOR EACH ROW EXECUTE FUNCTION sync_assignment_team_size();
CREATE TRIGGER trigger_sync_assignment_size_from_membership AFTER INSERT OR UPDATE OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION sync_assignment_size_on_membership_change();
CREATE TRIGGER trigger_sync_team_status_from_assignment AFTER INSERT OR UPDATE OF status ON assignments FOR EACH ROW EXECUTE FUNCTION sync_team_status_on_assignment_update();

-- Status Synchronization
CREATE TRIGGER trigger_sync_vehicle_status_on_team_link BEFORE UPDATE OF team_id ON vehicles FOR EACH ROW EXECUTE FUNCTION sync_vehicle_status_on_team_link();
CREATE TRIGGER sync_team_status_on_team_update AFTER INSERT OR UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION sync_team_members_on_status_change();
CREATE TRIGGER sync_responder_status_on_responder_update AFTER INSERT OR UPDATE OF auth_uid, incident_id ON responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();
CREATE TRIGGER sync_access_level_on_team_responders AFTER INSERT OR UPDATE OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();

-- Lifecycle Cleanup
CREATE TRIGGER trigger_incident_cleanup_on_end AFTER UPDATE OF end_datetime ON incidents FOR EACH ROW EXECUTE FUNCTION cleanup_resources_on_incident_end();

-- Membership Validation
CREATE TRIGGER trigger_check_responder_membership
BEFORE INSERT OR UPDATE ON team_responders FOR EACH ROW EXECUTE FUNCTION validate_responder_active_membership();

CREATE TRIGGER trigger_check_team_activation
BEFORE UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_activation();

CREATE TRIGGER trigger_check_team_leader_membership
BEFORE INSERT OR UPDATE OF leader_responder_id ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_leader_membership();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

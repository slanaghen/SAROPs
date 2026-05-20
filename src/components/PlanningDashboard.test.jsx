import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import PlanningDashboard from './PlanningDashboard';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

const mockTeams = [
  { team_id: 't1', team_name_number: 'Team 1', status: 'Staged', type: 'Other' }
];
const mockAssignments = [
  { assignment_id: 'a1', name: 'Assignment A', op_period_id: 'op1', status: 'Planned' }
];

afterEach(() => {
  cleanup();
});

describe('PlanningDashboard Selection', () => {
  beforeEach(() => {
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Steve',
      user: { email: 'steve@example.com' }
    });
  });

  const defaultProps = {
    operationalPeriodId: 'op1',
    teams: mockTeams,
    assignments: mockAssignments,
    responders: [],
    onTeamAssigned: vi.fn(),
    openNewTeamForm: vi.fn(), // Mock the new prop
    openNewAssignmentForm: vi.fn(), // Mock the new prop
  };

  it('should set drag state on the container when a team is dragged', () => {
    render(<PlanningDashboard {...defaultProps} />);
    
    const teamCard = screen.getByText('Team 1').closest('.team-card');

    // Simulate drag start
    fireEvent.dragStart(teamCard, { 
      dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } 
    });

    const container = screen.getByText('Planning Dashboard').closest('.planning-dashboard');
    expect(container).toHaveAttribute('data-dragging', 'true');
  });

  it('should call onTeamAssigned when a team is dropped on an assignment', async () => {
    const onAssigned = vi.fn();
    render(<PlanningDashboard {...defaultProps} onTeamAssigned={onAssigned} />);
    
    const teamCard = screen.getByText('Team 1').closest('.team-card');
    const assignmentCard = screen.getByText('Assignment A').closest('.assignment-card');

    // Simulate Drag and Drop sequence
    fireEvent.dragStart(teamCard, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } });
    fireEvent.drop(assignmentCard);

    await waitFor(() => {
      expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({
        teamId: 't1',
        assignmentId: 'a1'
      }));
    });
  });
});
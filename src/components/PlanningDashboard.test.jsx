import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import PlanningDashboard from './PlanningDashboard';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

const mockTeams = [ // Mock team data
  { team_id: 't1', team_name_number: 'Team 1', status: 'Staged', type: 'Other' }
];
const mockAssignments = [
  { assignment_id: 'a1', title: 'Assignment A', op_period_id: 'op1', status: 'Planned' }
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

    await waitFor(() => { // Wait for the asynchronous onAssigned callback to complete
      expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({
        teamId: 't1',
        assignmentId: 'a1'
      }));
    });
  });

  it('filters the responder list correctly using the unified search input', () => {
    const mockResponders = [
      { responder_id: 'r1', name: 'Sarah Miller', agency: 'K9 Unit', special_skills: 'Air Scent', status: 'Staged', identifier: 'K9-1' },
      { responder_id: 'r2', name: 'James Chen', agency: 'UAS Ops', special_skills: 'UAS', status: 'Staged', identifier: 'PILOT-1' }
    ];
    render(<PlanningDashboard {...defaultProps} responders={mockResponders} />);
    
    const searchInput = screen.getByPlaceholderText(/Search name, ID, agency or skills/i);

    // Search by Skill
    fireEvent.change(searchInput, { target: { value: 'UAS' } });
    expect(screen.getByText('James Chen')).toBeInTheDocument();
    expect(screen.queryByText('Sarah Miller')).not.toBeInTheDocument();

    // Search by Agency
    fireEvent.change(searchInput, { target: { value: 'K9' } });
    expect(screen.queryByText('James Chen')).not.toBeInTheDocument();
    expect(screen.getByText('Sarah Miller')).toBeInTheDocument();

    // Clear Search
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('James Chen')).toBeInTheDocument();
    expect(screen.getByText('Sarah Miller')).toBeInTheDocument();
  });
});
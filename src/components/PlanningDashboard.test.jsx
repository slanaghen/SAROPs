import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';
import PlanningDashboard from './PlanningDashboard';

expect.extend(matchers);

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
  const defaultProps = {
    operationalPeriodId: 'op1',
    teams: mockTeams,
    assignments: mockAssignments,
    responders: [],
    onTeamAssigned: vi.fn()
  };

  it('should enable the assignment button only when both are selected', () => {
    render(<PlanningDashboard {...defaultProps} />);
    
    const assignBtn = screen.getByText(/Assign Team to Assignment/i);
    expect(assignBtn).toBeDisabled();

    // Select Team
    fireEvent.click(screen.getAllByText('Team 1')[0]);
    expect(assignBtn).toBeDisabled();

    // Select Assignment
    fireEvent.click(screen.getAllByText('Assignment A')[0]);
    expect(assignBtn).not.toBeDisabled();
  });

  it('should call onTeamAssigned when the button is clicked', async () => {
    const onAssigned = vi.fn();
    render(<PlanningDashboard {...defaultProps} onTeamAssigned={onAssigned} />);
    
    fireEvent.click(screen.getAllByText('Team 1')[0]);
    fireEvent.click(screen.getAllByText('Assignment A')[0]);
    fireEvent.click(screen.getByText(/Assign Team to Assignment/i));

    expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 't1',
      assignmentId: 'a1'
    }));
  });
});
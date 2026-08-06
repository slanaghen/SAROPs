import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminAssignmentsTable from './AdminAssignmentsTable';

describe('AdminAssignmentsTable', () => {
  const mockHandleEditAssignment = vi.fn();
  const mockHandleNewAssignment = vi.fn();
  const mockHandleDeleteAssignment = vi.fn();

  const mockAssignments = [
    { assignment_id: 'a1', title: 'Task Alpha', resource_type: 'Ground', status: 'Planned', team_id: 't1', incident_id: 'i1' },
    { 
      assignment_id: 'a2', 
      title: 'Task Zulu', 
      resource_type: 'UAS', 
      status: 'Completed', 
      team_id: null, // Should be null after snapshot
      incident_id: 'i2',
      completed_team_snapshot: { // Snapshot data
        team_id: 't2',
        team_name_number: 'Team Zulu',
        type: 'UAS',
        status: 'Reassigned', // As per spec
        leader_name: 'Zulu Leader',
        current_responders: [{ name: 'Zulu Member 1' }, { name: 'Zulu Member 2' }],
        current_vehicles: [{ designation: 'Zulu Vehicle 1' }],
      }
    },
  ];

  const mockIncidents = [
    { incident_id: 'i1', name: 'Incident One', number: '001' },
    { incident_id: 'i2', name: 'Incident Two', number: '002' },
  ];

  const mockTeams = [
    { team_id: 't1', team_name_number: 'Team Alpha' },
    { team_id: 't2', team_name_number: 'Team Zulu' },
  ];

  const defaultProps = {
    allAssignments: mockAssignments,
    allIncidents: mockIncidents,
    allTeams: mockTeams,
    isAssignmentsExpanded: true,
    setIsAssignmentsExpanded: vi.fn(),
    handleEditAssignment: mockHandleEditAssignment,
    handleNewAssignment: mockHandleNewAssignment,
    handleDeleteAssignment: mockHandleDeleteAssignment,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders assignment rows with correct incident and team names', () => {
    render(<AdminAssignmentsTable {...defaultProps} />);
    
    // For the active assignment, find the team by its live team_id
    const row1 = screen.getByText('Task Alpha').closest('tr');
    expect(within(row1).getByText(/Incident One/)).toBeInTheDocument();
    expect(within(row1).getByText('Team Alpha')).toBeInTheDocument();
    
    // For the completed assignment, find the team name from the snapshot
    const row2 = screen.getByText('Task Zulu').closest('tr');
    expect(within(row2).getByText(/Incident Two/)).toBeInTheDocument();
    expect(within(row2).getByText('Team Zulu (Historical)')).toBeInTheDocument();
    
    // Verify tooltip shows historical data from snapshot
    const completedTeamCell = screen.getByText('Team Zulu (Historical)');
    fireEvent.mouseOver(completedTeamCell);
    const tooltip = `Historical Team: Team Zulu
Type: UAS
Status: Reassigned
Leader: Zulu Leader
Members: Zulu Member 1, Zulu Member 2
Vehicles: Zulu Vehicle 1`;
    expect(completedTeamCell).toHaveAttribute('title', tooltip);
  });

  it('sorts assignments by title by default (asc) and toggles direction', () => {
    render(<AdminAssignmentsTable {...defaultProps} />);
    const rows = screen.getAllByRole('row'); // includes header row
    
    // Default sort is by title asc, so Alpha should be before Zulu
    expect(within(rows[1]).getByText('Task Alpha')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Task Zulu')).toBeInTheDocument();

    // Click to sort descending
    fireEvent.click(screen.getByRole('columnheader', { name: /Assignment/i }));
    const rerenderedRows = screen.getAllByRole('row');
    expect(within(rerenderedRows[1]).getByText('Task Zulu')).toBeInTheDocument();
    expect(within(rerenderedRows[2]).getByText('Task Alpha')).toBeInTheDocument();
  });

  it('sorts by team name, considering historical snapshots', () => {
    render(<AdminAssignmentsTable {...defaultProps} />);
    const teamHeader = screen.getByRole('columnheader', { name: /Team/i });
    
    // Sort Ascending
    fireEvent.click(teamHeader);
    let rows = screen.getAllByRole('row');
    // Team Alpha should be first
    expect(within(rows[1]).getByText('Team Alpha')).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Team Zulu/)).toBeInTheDocument();

    // Sort Descending
    fireEvent.click(teamHeader);
    rows = screen.getAllByRole('row');
    // Team Zulu should be first
    expect(within(rows[1]).getByText(/Team Zulu/)).toBeInTheDocument();
    expect(within(rows[2]).getByText('Team Alpha')).toBeInTheDocument();
  });

  it('calls the correct handlers for action buttons', () => {
    render(<AdminAssignmentsTable {...defaultProps} />);
    const row1 = screen.getByText('Task Alpha').closest('tr');

    // Test Edit
    fireEvent.click(within(row1).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditAssignment).toHaveBeenCalledWith(mockAssignments[0]);

    // Test Delete
    fireEvent.click(within(row1).getByRole('button', { name: /Delete/i }));
    expect(mockHandleDeleteAssignment).toHaveBeenCalledWith('a1', 'Task Alpha', 'Ground');
  });

  it('calls the new assignment handler when "+ New" is clicked', () => {
    render(<AdminAssignmentsTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewAssignment).toHaveBeenCalled();
  });
});
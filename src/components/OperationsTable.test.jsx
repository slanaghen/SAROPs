import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OperationsTable from '../components/OperationsTable';

describe('OperationsTable', () => {
  const mockRows = [
    {
      id: 'asn-a1',
      assignmentId: 'a1',
      assignmentName: 'Alpha Assignment',
      assignmentType: 'Ground',
      tacChannel: 'TAC 1',
      hasBoth: true,
      teamId: 't1',
      teamName: 'Team 1',
      teamType: 'Ground',
      teamLeader: 'Steve',
      leaderIdentifier: 'K9-1',
      assignmentStatus: 'Deployed',
      teamStatus: 'Deployed',
      timeSincePar: '5m ago',
      isParOverdue: false
    }
  ];

  const defaultProps = {
    rows: mockRows,
    sortConfig: { key: null, direction: 'asc' },
    requestSort: vi.fn(),
    filters: {},
    onFilterChange: vi.fn(),
    parInterval: 60,
    onStatusUpdate: vi.fn(),
    onResetPar: vi.fn(),
    onUnassignTeam: vi.fn(),
    onDeleteAssignment: vi.fn(),
    onEditTeam: vi.fn(),
    onEditAssignment: vi.fn(),
    openNewTeamForm: vi.fn(), // Added for new button
    openNewAssignmentForm: vi.fn(), // Added for new button
    onNewTeam: vi.fn(), // Existing prop for action menu
    onNewAssignment: vi.fn(),
    onAssignResource: vi.fn()
  };

  it('renders the group headers for Assignment and Team with "New" buttons', () => {
    render(<OperationsTable {...defaultProps} />);
    
    // Find the th elements that contain the text "Assignment" and "Team" respectively
    // Use getAllByRole and then filter with within to handle nested elements
    const groupHeaders = screen.getAllByRole('columnheader', { selector: '.group-header-row th' });
    const assignmentHeader = groupHeaders.find(header => within(header).queryByText(/Assignment/i));
    const teamHeader = groupHeaders.find(header => within(header).queryByText(/Team/i));
    
    expect(assignmentHeader).toBeInTheDocument();
    expect(teamHeader).toBeInTheDocument();

    const newAssignmentButton = within(assignmentHeader).getByRole('button', { name: 'New' });
    const newTeamButton = within(teamHeader).getByRole('button', { name: 'New' });
    expect(newAssignmentButton).toBeInTheDocument();
    expect(newTeamButton).toBeInTheDocument();

    fireEvent.click(newAssignmentButton);
    expect(defaultProps.openNewAssignmentForm).toHaveBeenCalled();
    fireEvent.click(newTeamButton);
    expect(defaultProps.openNewTeamForm).toHaveBeenCalled();
  });

  it('renders assignment and team data in the same row', () => {
    render(<OperationsTable {...defaultProps} />);
    const row = screen.getByText('Alpha Assignment').closest('tr');
    expect(within(row).getByText('Team 1')).toBeInTheDocument();
    expect(within(row).getByText('Steve')).toBeInTheDocument();
    expect(within(row).getByText('K9-1')).toBeInTheDocument();
    expect(within(row).getByText('TAC 1')).toBeInTheDocument();
  });

  it('renders an inline status selector when a team is linked', () => {
    render(<OperationsTable {...defaultProps} />);
    const statusSelect = screen.getByDisplayValue('Deployed');
    expect(statusSelect).toHaveClass('status-select-inline');
    
    fireEvent.change(statusSelect, { target: { value: 'Completed' } });
    expect(defaultProps.onStatusUpdate).toHaveBeenCalledWith('a1', 't1', 'Completed');
  });

  it('applies warning styling and displays time when PAR is overdue', () => {
    const overdueRows = [{ ...mockRows[0], isParOverdue: true, timeSincePar: '75m ago' }];
    render(<OperationsTable {...defaultProps} rows={overdueRows} />);
    
    const row = screen.getByText('Alpha Assignment').closest('tr');
    expect(row).toHaveStyle({ backgroundColor: '#fff7ed' });
    expect(screen.getByText('75m ago')).toHaveClass('status-indicator incomplete');
  });

  it('triggers onResetPar when clicking the overdue PAR chip', () => {
    const overdueRows = [{ ...mockRows[0], isParOverdue: true, timeSincePar: '75m ago' }];
    render(<OperationsTable {...defaultProps} rows={overdueRows} />);
    
    const overdueChip = screen.getByText('75m ago');
    fireEvent.click(overdueChip);
    
    expect(defaultProps.onResetPar).toHaveBeenCalledWith('t1', 'Team 1');
  });

  it('triggers column sorting when headers are clicked', () => {
    render(<OperationsTable {...defaultProps} />);
    // Get the Assignment Name column (the first column with text "Name")
    const nameHeaders = screen.getAllByText('Name', { selector: 'th' }); // Specify selector to avoid matching team name in row
    fireEvent.click(nameHeaders[0]);
    expect(defaultProps.requestSort).toHaveBeenCalledWith('assignmentName');
  });

  it('triggers column filtering when input values change', () => {
    render(<OperationsTable {...defaultProps} />);
    const filterInputs = screen.getAllByPlaceholderText('Filter...');
    fireEvent.change(filterInputs[0], { target: { value: 'Alpha' } });
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('assignmentName', 'Alpha');
  });

  it('provides a context-aware action menu', () => {
    render(<OperationsTable {...defaultProps} />);
    const actions = screen.getByDisplayValue('Actions...');
    
    // Test Edit Team action
    fireEvent.change(actions, { target: { value: 'edit-team' } });
    expect(defaultProps.onEditTeam).toHaveBeenCalledWith('t1');

    // Test Unassign action
    fireEvent.change(actions, { target: { value: 'unassign' } });
    expect(defaultProps.onUnassignTeam).toHaveBeenCalledWith('a1', 't1', 'Alpha Assignment', 'Team 1');
  });

  it('shows empty state message when no rows are provided', () => {
    render(<OperationsTable {...defaultProps} rows={[]} />);
    expect(screen.getByText('No matching records found.')).toBeInTheDocument();
  });
});
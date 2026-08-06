import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminTeamsTable from './AdminTeamsTable';
import { useIncident } from '../../context/IncidentContext';
import { formatTimeSince } from '../../utils/operationalUtils';

// Mock the utility function
vi.mock('../../utils/operationalUtils', () => ({
  formatTimeSince: vi.fn((date) => 'formatted_time'),
}));

vi.mock('../../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('AdminTeamsTable', () => {
  const mockHandleDisbandTeam = vi.fn();
  const mockHandleEditTeam = vi.fn();
  const mockHandleNewTeam = vi.fn();
  const mockHandleDeleteTeam = vi.fn();

  const mockTeams = [
    {
      team_id: 't1',
      team_name_number: 'Alpha Team',
      type: 'Ground',
      status: 'Deployed',
      operational_periods: {
        incident_id: 'i1',
      },
      last_par_check: new Date().toISOString(),
    },
    {
      team_id: 't2',
      team_name_number: 'Zulu Team',
      type: 'UAS',
      status: 'Staged',
      operational_periods: {
        incident_id: 'i2',
      },
      last_par_check: null,
      created_at: new Date().toISOString(),
    },
  ];

  const mockIncidents = [
    { incident_id: 'i1', name: 'Incident One', number: '001' },
    { incident_id: 'i2', name: 'Incident Two', number: '002' },
  ];

  const mockAssignments = [
    { assignment_id: 'a1', title: 'Search Area 1', team_id: 't1' },
  ];

  const defaultProps = {
    allTeams: mockTeams,
    allIncidents: mockIncidents,
    allAssignments: mockAssignments,
    currentTime: Date.now(),
    isTeamsExpanded: true,
    setIsTeamsExpanded: vi.fn(),
    handleDisbandTeam: mockHandleDisbandTeam,
    handleEditTeam: mockHandleEditTeam,
    handleNewTeam: mockHandleNewTeam,
    handleDeleteTeam: mockHandleDeleteTeam,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      user: { email: 'admin@test.com' },
    });
  });

  it('renders team rows with correct incident and assignment data', () => {
    render(<AdminTeamsTable {...defaultProps} />);
    
    const row1 = screen.getByText('Alpha Team').closest('tr');
    expect(within(row1).getByText(/Incident One/)).toBeInTheDocument();
    expect(within(row1).getByText('Search Area 1')).toBeInTheDocument();
    
    const row2 = screen.getByText('Zulu Team').closest('tr');
    expect(within(row2).getByText(/Incident Two/)).toBeInTheDocument();
    expect(within(row2).getByText('—')).toBeInTheDocument(); // No assignment
  });

  it('sorts teams by name by default (asc) and toggles direction', () => {
    render(<AdminTeamsTable {...defaultProps} />);
    const rows = screen.getAllByRole('row'); // includes header row
    
    // Default sort is by name asc, so Alpha should be before Zulu
    expect(within(rows[1]).getByText('Alpha Team')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Zulu Team')).toBeInTheDocument();

    // Click to sort descending
    fireEvent.click(screen.getByText(/Team Name/));
    const rerenderedRows = screen.getAllByRole('row');
    expect(within(rerenderedRows[1]).getByText('Zulu Team')).toBeInTheDocument();
    expect(within(rerenderedRows[2]).getByText('Alpha Team')).toBeInTheDocument();
  });

  it('calls correct handlers for action buttons', () => {
    render(<AdminTeamsTable {...defaultProps} />);
    const zuluRow = screen.getByText('Zulu Team').closest('tr');

    // Test Disband
    fireEvent.click(within(zuluRow).getByRole('button', { name: /Disband/i }));
    expect(mockHandleDisbandTeam).toHaveBeenCalledWith('t2', 'Zulu Team', 'UAS');

    // Test Edit
    fireEvent.click(within(zuluRow).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditTeam).toHaveBeenCalledWith(mockTeams[1]);

    // Test Delete
    fireEvent.click(within(zuluRow).getByRole('button', { name: /Delete/i }));
    expect(mockHandleDeleteTeam).toHaveBeenCalledWith('t2', 'Zulu Team', 'UAS');
  });

  it('disables the "Disband" button for deployed teams', () => {
    render(<AdminTeamsTable {...defaultProps} />);
    const alphaRow = screen.getByText('Alpha Team').closest('tr');
    const disbandButton = within(alphaRow).getByRole('button', { name: /Disband/i });
    expect(disbandButton).toBeDisabled();
  });

  it('calls the new team handler when "+ New" is clicked', () => {
    render(<AdminTeamsTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewTeam).toHaveBeenCalled();
  });
});
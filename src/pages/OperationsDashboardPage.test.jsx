import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OperationsDashboardPage from './OperationsDashboardPage';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';

// Mock child components and hooks
vi.mock('../context/IncidentContext');
vi.mock('../context/ToastContext');
vi.mock('../hooks/usePlanningDashboard');
vi.mock('../components/operations/OperationsTable', () => ({
  // Mock the table to just render its rows so we can find draggable elements, using the correct path
  default: ({ rows, onDragStart, onDrop, onDragOver, onDragEnter, onDragLeave, onDragEnd }) => (
    <table>
      <tbody>
        {rows.map(row => (
          <tr 
            key={row.id} 
            data-testid={row.id}
            onDrop={(e) => onDrop(e, row.id, row.teamId ? 'team' : 'assignment')}
            onDragOver={(e) => onDragOver(e, row.id, row.teamId ? 'team' : 'assignment')}
            onDragEnter={(e) => onDragEnter(e, row.id, row.teamId ? 'team' : 'assignment')}
            onDragLeave={onDragLeave}
            onDragEnd={onDragEnd}
          >
            <td 
              draggable 
              onDragStart={(e) => onDragStart(e, row.id, row.teamId ? 'team' : 'assignment')}
            >
              {row.assignmentName || row.teamName}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}));

describe('OperationsDashboardPage', () => {
  const mockAssignTeamToAssignment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123' },
      incidentId: 'inc-123',
      responderName: 'Test Admin',
    });

    vi.mocked(useToast).mockReturnValue({ addToast: vi.fn() });

    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [{ team_id: 'team-staged-1', team_name_number: 'Ground 1', type: 'Ground', status: 'Staged' }],
      assignments: [{ assignment_id: 'asn-planned-1', title: 'Search Area A', status: 'Planned', team_id: null }],
      responders: [],
      vehicles: [],
      opPeriod: { par_check_interval: 60 },
      loading: false,
      error: null,
      fetchDashboardData: vi.fn(),
      assignTeamToAssignment: mockAssignTeamToAssignment,
      // Add missing properties to prevent destructuring errors
      stats: {
        teams: { staged: 1, assigned: 0, deployed: 0, total: 1 },
        assignments: { planned: 1, assigned: 0, deployed: 0, complete: 0, incomplete: 0, total: 1 },
        responders: { staged: 0, attached: 0, assigned: 0, deployed: 0, total: 0 },
      },
      setError: vi.fn(),
      setLoading: vi.fn(),
      updateResourceStatus: vi.fn(),
      unassignTeam: vi.fn(),
      createTeam: vi.fn(),
      createAssignment: vi.fn(),
      deleteAssignment: vi.fn(),
      disbandTeam: vi.fn(),
      updateTeam: vi.fn(),
      updateAssignment: vi.fn(),
      attachResponderToTeam: vi.fn(),
      detachResponderFromTeam: vi.fn(),
    });
  });

  it('should allow dragging a staged team onto a planned assignment', async () => {
    render(<OperationsDashboardPage />);

    const teamCell = await screen.findByText('Ground 1');
    const assignmentRow = await screen.findByTestId('asn-asn-planned-1');
    
    // JSDOM doesn't implement dataTransfer, so we need to mock it for the event.
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: ''
    };
    fireEvent.dragStart(teamCell, { dataTransfer });

    fireEvent.drop(assignmentRow);

    await waitFor(() => {
      expect(mockAssignTeamToAssignment).toHaveBeenCalledWith('team-staged-1', 'asn-planned-1');
    });
  });
});
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PlanningDashboardPage from './PlanningDashboardPage';
import { useIncident } from '../context/IncidentContext';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';

expect.extend(matchers);

// Mock Context
vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/usePlanningDashboard', () => ({
  usePlanningDashboard: vi.fn(),
}));

// Mock the child component to inspect props passed to it
vi.mock('../components/PlanningDashboard', () => ({
  default: vi.fn((props) => (
    <div data-testid="planning-dashboard-mock">
      <span data-testid="next-assignment-name">{props.defaultNewAssignmentName}</span>
    </div>
  )),
}));

describe('PlanningDashboardPage', () => {
  const mockStats = {
    teams: { staged: 0, assigned: 0, deployed: 0, total: 0 },
    assignments: { planned: 0, assigned: 0, deployed: 0, complete: 0, incomplete: 0, total: 0 },
    responders: { staged: 0, attached: 0, assigned: 0, deployed: 0, total: 0 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render the planning dashboard when an operational period is present', () => {
    // Setup context mock
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123', name: 'Test Incident' },
    });

    // Setup hook mock
    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [],
      assignments: [],
      responders: [],
      loading: false,
      stats: {
        teams: { staged: 0, assigned: 0, deployed: 0, total: 0 },
        assignments: { planned: 0, assigned: 0, deployed: 0, complete: 0, incomplete: 0, total: 0 },
        responders: { staged: 0, attached: 0, assigned: 0, deployed: 0, total: 0 }
      },
      fetchDashboardData: vi.fn(),
      assignTeamToAssignment: vi.fn(),
      createTeam: vi.fn(),
      createAssignment: vi.fn(),
      updateAssignment: vi.fn(),
      deleteAssignment: vi.fn(),
      updateResponder: vi.fn(),
      checkOutResponder: vi.fn(),
      updateTeam: vi.fn(),
      attachResponderToTeam: vi.fn(),
      detachResponderFromTeam: vi.fn(),
      deleteTeam: vi.fn(),
    });

    render(<PlanningDashboardPage />);
    
    expect(screen.getByTestId('planning-dashboard-mock')).toBeInTheDocument();
  });

  it('should show a message if no operational period is selected', () => {
    vi.mocked(useIncident).mockReturnValue({
      incidentData: null,
    });

    render(<PlanningDashboardPage />);
    
    expect(screen.getByText(/Please select an operational period/i)).toBeInTheDocument();
  });

  it('correctly calculates the next assignment name (AA -> AB)', () => {
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123' },
    });

    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [],
      assignments: [
        { segment: 'A', title: 'AA' },
        { segment: 'A', title: 'AB' }
      ],
      responders: [],
      loading: false,
      stats: mockStats,
      error: null, // Ensure error is explicitly null
      fetchDashboardData: vi.fn(),
      assignTeamToAssignment: vi.fn(),
      createTeam: vi.fn(),
      createAssignment: vi.fn(),
      updateAssignment: vi.fn(),
      deleteAssignment: vi.fn(),
      updateResponder: vi.fn(),
      checkOutResponder: vi.fn(),
      updateTeam: vi.fn(),
      attachResponderToTeam: vi.fn(),
      detachResponderFromTeam: vi.fn(),
      deleteTeam: vi.fn(),
    });

    render(<PlanningDashboardPage />);
    
    // Verify that the helper correctly calculated 'AC' and passed it to the component
    expect(screen.getByTestId('planning-dashboard-mock')).toBeInTheDocument();
    const nextName = screen.getByTestId('next-assignment-name').textContent;
    expect(nextName).toBe('AC');
  });

  it('should handle division suffixes at the end of the alphabet (AZ -> AA)', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: { opPeriodId: 'op-123' } });
    vi.mocked(usePlanningDashboard).mockReturnValue({
      assignments: [{ segment: 'A', title: 'AZ' }],
      teams: [], responders: [], loading: false, fetchDashboardData: vi.fn(),
      stats: mockStats,
    });

    render(<PlanningDashboardPage />);
    
    const nextName = screen.getByTestId('next-assignment-name').textContent;
    expect(nextName).toBe('AA'); 
  });

  it('should return the start of the sequence if assignments exist for other divisions but not the target', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: { opPeriodId: 'op-123' } });
    vi.mocked(usePlanningDashboard).mockReturnValue({
      assignments: [
        { segment: 'B', title: 'BA' },
        { segment: 'B', title: 'BB' }
      ],
      teams: [], responders: [], loading: false, fetchDashboardData: vi.fn(),
      stats: mockStats,
    });

    render(<PlanningDashboardPage />);
    
    const nextName = screen.getByTestId('next-assignment-name').textContent;
    expect(nextName).toBe('AA'); // Division B exists, but Division A should start at AA
  });

  it('renders error state and handles retry load', () => {
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123' },
    });

    const mockFetch = vi.fn();
    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [], assignments: [], responders: [],
      loading: false, stats: mockStats,
      error: 'Network Error',
      fetchDashboardData: mockFetch,
    });

    render(<PlanningDashboardPage />);

    // Verify error message is displayed
    expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    
    // Click Retry
    const retryBtn = screen.getByRole('button', { name: /Retry Load/i });
    fireEvent.click(retryBtn);

    // Verify hook function was called
    expect(mockFetch).toHaveBeenCalled();
  });
});
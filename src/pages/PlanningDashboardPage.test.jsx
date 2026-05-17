import { render, screen, cleanup } from '@testing-library/react';
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

// Mock Hook
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
      error: null,
      fetchDashboardData: vi.fn(),
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
        { division: 'A', name: 'AA' },
        { division: 'A', name: 'AB' }
      ],
      responders: [],
      loading: false,
      fetchDashboardData: vi.fn(),
    });

    render(<PlanningDashboardPage />);
    
    // Verify that the helper correctly calculated 'AC' and passed it to the component
    expect(screen.getByTestId('planning-dashboard-mock')).toBeInTheDocument();
    const nextName = screen.getByTestId('next-assignment-name').textContent;
    expect(nextName).toBe('AC');
  });
});
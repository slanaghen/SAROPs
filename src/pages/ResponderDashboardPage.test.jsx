import { render, screen, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';
import ResponderDashboardPage from './ResponderDashboardPage';
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useResponderTeamAndAssignment', () => ({
  default: vi.fn(),
}));

afterEach(cleanup);

describe('ResponderDashboardPage', () => {
  it('shows empty state when responder has no team or assignment', () => {
    vi.mocked(useIncident).mockReturnValue({ responderId: 'r1', setResponderStatus: vi.fn() });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: null,
      assignment: null,
      loading: false,
      error: null,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText(/You are currently not attached to a team/i)).toBeInTheDocument();
  });

  it('renders team and assignment information when available', () => {
    const mockTeam = { team_name_number: 'Team 1', type: 'Ground', status: 'Assigned' };
    const mockAsn = { name: 'Area A', status: 'Planned', division: 'A' };
    
    vi.mocked(useIncident).mockReturnValue({ responderId: 'r1', setResponderStatus: vi.fn() });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      error: null,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText('Your Team: Team 1')).toBeInTheDocument();
    expect(screen.getByText('Current Assignment: Area A')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    vi.mocked(useIncident).mockReturnValue({ responderId: 'r1', setResponderStatus: vi.fn() });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      loading: true,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText(/Loading responder dashboard data/i)).toBeInTheDocument();
  });
});
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import PlanningDashboardPage from './PlanningDashboardPage';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';

// Mock dependencies
vi.mock('../hooks/usePlanningDashboard');
vi.mock('../lib/supabase', () => ({
  default: {},
}));

vi.mock('../components/PlanningDashboard', () => ({
  default: ({ teams }) => (
    <div data-testid="planning-dashboard">
      Dashboard Rendered with {teams.length} teams
    </div>
  ),
}));

describe('PlanningDashboardPage', () => {
  const mockFetchDashboardData = vi.fn();
  const mockAssignTeamToAssignment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    usePlanningDashboard.mockReturnValue({
      teams: [],
      assignments: [],
      responders: [],
      loading: false,
      error: null,
      fetchDashboardData: mockFetchDashboardData,
      assignTeamToAssignment: mockAssignTeamToAssignment,
    });
  });

  it('renders instructions when no operationalPeriodId is provided', () => {
    render(<PlanningDashboardPage operationalPeriodId={null} />);
    expect(screen.getByText(/Please select an operational period/i)).toBeInTheDocument();
  });

  it('calls fetchDashboardData on mount when operationalPeriodId is provided', () => {
    render(<PlanningDashboardPage operationalPeriodId="op-123" />);
    expect(mockFetchDashboardData).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when data is being fetched', () => {
    usePlanningDashboard.mockReturnValue({
      teams: [],
      assignments: [],
      responders: [],
      loading: true,
      error: null,
      fetchDashboardData: mockFetchDashboardData,
    });

    render(<PlanningDashboardPage operationalPeriodId="op-123" />);
    expect(screen.getByText(/Loading dashboard data.../i)).toBeInTheDocument();
    expect(screen.queryByTestId('planning-dashboard')).not.toBeInTheDocument();
  });

  it('renders PlanningDashboard when loading is finished', async () => {
    usePlanningDashboard.mockReturnValue({
      teams: [{ id: '1', name: 'Team Alpha' }],
      assignments: [],
      responders: [],
      loading: false,
      error: null,
      fetchDashboardData: mockFetchDashboardData,
    });

    render(<PlanningDashboardPage operationalPeriodId="op-123" />);
    
    expect(screen.getByTestId('planning-dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Dashboard Rendered with 1 teams/i)).toBeInTheDocument();
  });
});
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';
import ResponderDashboardPage from './ResponderDashboardPage';
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useResponderTeamAndAssignment', () => ({
  default: vi.fn(),
}));

const createSupabaseQueryMock = (data, error = null) => {
  const mock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data, error: error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data, error: error }),
    then: vi.fn((onFulfilled) => Promise.resolve({ data: data, error: error }).then(onFulfilled)),
  };
  return mock;
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => createSupabaseQueryMock([])), // Default mock
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    removeChannel: vi.fn()
  },
}));

afterEach(cleanup);

describe('ResponderDashboardPage', () => {
  it('shows empty state when responder has no team or assignment', () => {
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder'
    });
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
    
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder'
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      error: null,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText(/Your Team: Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Assignment: Area A/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder'
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      loading: true,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText(/Loading responder dashboard data/i)).toBeInTheDocument();
  });

  it('should show Deploy button for leader and cascade Deployed status to team and members', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Assigned' };
    const mockAsn = { assignment_id: 'a1', name: 'Area A', status: 'Assigned' };
    const mockRefetch = vi.fn();
    
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      responderName: 'Steve',
      accessLevel: 'responder'
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: mockRefetch,
    });

    // Override supabase mock to ensure member list is returned for the status cascade
    supabase.from.mockImplementation((table) => {
      if (table === 'team_responders') return createSupabaseQueryMock([{ responder_id: 'r1' }]);
      if (table === 'assignments' || table === 'teams' || table === 'responders') {
        const mock = createSupabaseQueryMock([]);
        mock.update = vi.fn().mockReturnThis();
        mock.eq = vi.fn().mockResolvedValue({ error: null });
        mock.in = vi.fn().mockResolvedValue({ error: null });
        return mock;
      }
      return createSupabaseQueryMock([]);
    });

    render(<ResponderDashboardPage />);
    
    const deployBtn = screen.getByRole('button', { name: /Deploy/i });
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('assignments');
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(supabase.from).toHaveBeenCalledWith('team_responders');
      expect(supabase.from).toHaveBeenCalledWith('responders');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should update the PAR status and timestamp when "PAR OK" is clicked', async () => {
    let mockTeam = { team_id: 't1', team_name_number: 'Team 1', status: 'Assigned', last_par_check: null, created_at: new Date().toISOString() };
    
    const mockRefetch = vi.fn(async () => {
      // Simulate the async update and then update the mock data
      await Promise.resolve(); // Simulate async operation
      mockTeam = { ...mockTeam, last_par_check: new Date().toISOString() };
    });

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      incidentId: 'inc-123', // Needed for fetchIncidentDetails
      incidentData: { opPeriodId: 'op-123' }, // Needed for fetchIncidentDetails
      accessLevel: 'responder'
    });

    // Mock supabase calls for fetchIncidentDetails and handleParResponse
    supabase.from.mockImplementation((table) => {
      if (table === 'operational_periods') return createSupabaseQueryMock({ par_check_interval: 60 });
      if (table === 'teams') {
        const mock = createSupabaseQueryMock(mockTeam); // Default data for select.single in refetch
        mock.update = vi.fn().mockReturnThis(); // update returns the chain
        mock.eq = vi.fn().mockResolvedValue({ error: null }); // eq resolves the promise for the update chain
        return mock;
      }
      return createSupabaseQueryMock([]);
    });
    
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      refetch: mockRefetch,
    });

    const { rerender } = render(<ResponderDashboardPage />);
    
    // Initially shows Never
    expect(screen.getByText('Never')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: /PAR OK/i });
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(mockRefetch).toHaveBeenCalled();
    });

    // After refetch is called, mockTeam is updated.
    // We need to rerender the component with the updated mockTeam data.
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam, // This is the updated mockTeam
      assignment: null,
      loading: false,
      refetch: mockRefetch,
    });
    rerender(<ResponderDashboardPage />);

    // Wait for the UI to update based on the new mockTeam data
    await waitFor(() => {
      // Check for optimistic UI update (which might display "just now")
      expect(screen.queryByText(/Never/i)).not.toBeInTheDocument();
      expect(screen.getByText('just now')).toBeInTheDocument();
    });
  });

  it('should reset PAR when clicking the overdue status chip', async () => {
    const mockTeam = { 
      team_id: 't1', 
      status: 'Assigned', 
      last_par_check: new Date(Date.now() - 120 * 60000).toISOString() // 2 hours ago
    };
    const mockRefetch = vi.fn();

    vi.mocked(useIncident).mockReturnValue({ responderId: 'r1', accessLevel: 'responder' });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      refetch: mockRefetch,
    });

    render(<ResponderDashboardPage />);
    
    const overdueChip = screen.getByText(/ago/i).closest('span'); // Specifically find the "Xh Xm ago" chip
    fireEvent.click(overdueChip);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
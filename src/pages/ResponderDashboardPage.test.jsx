import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';

import ResponderDashboardPage from './ResponderDashboardPage';
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { supabase } from '../lib/supabase';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useResponderTeamAndAssignment', () => ({
  default: vi.fn(),
}));

const createSupabaseMock = (data, error = null) => globalThis.createSupabaseQueryMock(data, error);

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    removeChannel: vi.fn()
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  // Re-establish the default mock implementation for from()
  vi.mocked(supabase.from).mockImplementation(() => globalThis.createSupabaseQueryMock([]));

  // Restore the chainable channel mock functionality lost after resetAllMocks
  vi.mocked(supabase.channel).mockReturnThis();
  vi.mocked(supabase.on).mockReturnThis();
  vi.mocked(supabase.subscribe).mockReturnThis();

  // Provide a default mock for useIncident to prevent destructuring errors
  vi.mocked(useIncident).mockReturnValue({
    responderId: 'r1',
    responderName: 'Steve',
    accessLevel: 'responder',
    incidentId: 'inc-123',
    incidentData: { opPeriodId: 'op-123', name: 'Test Incident' },
    parInterval: 60, // Default PAR interval
  });
});

afterEach(() => {
  cleanup();
});

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
    const mockAsn = { title: 'Area A', status: 'Planned', segment: 'A', resource_type: 'Ground', team_size: 2, frequency_primary: 'TAC 1', description: 'Test', probability_of_detection: null };
    
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
    expect(screen.getByText(/Division/i)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    const assignmentTypeLabel = screen.getByText(/Assignment Type/i);
    const assignmentTypeContainer = assignmentTypeLabel.closest('div'); // Get the parent div that contains both label and value
    // Use getAllByText and length check for disambiguation
    expect(screen.getAllByText('Ground').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Size/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/TAC Channel/i)).toBeInTheDocument();
    expect(screen.getByText('TAC 1')).toBeInTheDocument();
    expect(screen.getByText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
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
    const mockAsn = { assignment_id: 'a1', title: 'Area A', status: 'Assigned' };
    const mockRefetch = vi.fn();
    
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      responderName: 'Steve',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123', name: 'Test Incident' }
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: mockRefetch,
    });

    // Override supabase mock to ensure member list is returned for the status cascade
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'team_responders') data = [{ responder_id: 'r1' }];
      else if (table === 'assignments') data = [mockAsn];
      else if (table === 'teams') data = [mockTeam];
      else if (table === 'responders') data = [{ responder_id: 'r1' }];
      else if (table === 'operational_periods') data = { par_check_interval: 60 };
      
      return createSupabaseMock(data);
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
      // Return array of results to satisfy data.length check after .select()
      if (table === 'teams') return createSupabaseQueryMock([mockTeam]);
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
      team_name_number: 'Team 1',
      status: 'Assigned', 
      last_par_check: new Date(Date.now() - 120 * 60000).toISOString() // 2 hours ago
    };
    const mockRefetch = vi.fn();

    // Mock successful update response to satisfy the component's row-count check
    supabase.from.mockImplementation((table) => {
      if (table === 'teams') return createSupabaseMock([mockTeam]);
      return createSupabaseMock([]);
    });

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

  it('does not require PAR during the 3-minute grace period', async () => {
    const parInterval = 60;
    // Set last check to 62 minutes ago (interval is 60, so it's inside 60+3 grace)
    const sixtyTwoMinsAgo = new Date(Date.now() - 62 * 60000).toISOString();
    
    const mockTeam = { 
      team_id: 't1', 
      status: 'Assigned', 
      last_par_check: sixtyTwoMinsAgo 
    };

    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      incidentData: { opPeriodId: 'op-1' },
      accessLevel: 'responder' 
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn()
    });
    
    // Mock OP period interval
    supabase.from.mockImplementation((table) => 
      createSupabaseQueryMock({ par_check_interval: parInterval })
    );

    render(<ResponderDashboardPage />);
    
    // The "PAR OVERDUE" badge should not be present
    await waitFor(() => {
      expect(screen.queryByText(/PAR OVERDUE/i)).not.toBeInTheDocument();
    });
  });

  it('renders active warning UI when PAR is overdue after grace period', async () => {
    const parInterval = 60;
    // Set last check to 65 minutes ago (interval 60 + 3 grace = 63 threshold)
    const sixtyFiveMinsAgo = new Date(Date.now() - 65 * 60000).toISOString();
    
    const mockTeam = { 
      team_id: 't1', 
      status: 'Assigned', 
      last_par_check: sixtyFiveMinsAgo 
    };

    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      incidentData: { opPeriodId: 'op-1' },
      accessLevel: 'responder' 
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      refetch: vi.fn()
    });
    
    supabase.from.mockImplementation((table) => 
      createSupabaseQueryMock({ par_check_interval: parInterval })
    );

    render(<ResponderDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Check-in Required!/i)).toBeInTheDocument();
      expect(screen.getByText(/PAR OVERDUE/i)).toBeInTheDocument();
    });
  });

  it('prevents a Leader from leaving the team while Deployed', async () => {
    const mockTeam = { 
      team_id: 't1', 
      team_name_number: 'Team Alpha', 
      leader_responder_id: 'r1', 
      status: 'Deployed' 
    };
    const mockAsn = { assignment_id: 'a1', status: 'Deployed' };

    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder' 
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: vi.fn()
    });

    window.alert = vi.fn();
    render(<ResponderDashboardPage />);

    const leaveBtn = screen.getByRole('button', { name: /Leave Team/i });
    // Expect the button to be disabled and have the correct title, as the UI prevents the click
    expect(leaveBtn).toBeDisabled();
    expect(leaveBtn).toHaveAttribute('title', 'Cannot leave team while deployed');
    expect(supabase.from).not.toHaveBeenCalledWith('team_responders');
  });

  it('correctly formats the PAR timer string for different durations', async () => {
    const mockRefetch = vi.fn();
    const now = Date.now();
    
    // 1. Less than a minute
    let mockTeam = { status: 'Assigned', last_par_check: new Date(now - 30000).toISOString() }; // 30s ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    const { rerender } = render(<ResponderDashboardPage />);
    expect(screen.getByText('just now')).toBeInTheDocument();

    // 2. Multiple minutes
    mockTeam = { ...mockTeam, last_par_check: new Date(now - 15 * 60000).toISOString() }; // 15m ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    rerender(<ResponderDashboardPage />);
    expect(screen.getByText('15m ago')).toBeInTheDocument();

    // 3. Hours and minutes
    mockTeam = { ...mockTeam, last_par_check: new Date(now - 145 * 60000).toISOString() }; // 2h 25m ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    rerender(<ResponderDashboardPage />);
    expect(screen.getByText('2h 25m ago')).toBeInTheDocument();
  });

  it('updates the message list when a real-time message event is received', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Assigned' };
    let messageCallback;

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      responderName: 'Steve',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' }
    });

    // Mock responders list to satisfy lookups and triggers
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'responders') return globalThis.createSupabaseQueryMock([{ responder_id: 'r1', name: 'Steve' }]);
      return globalThis.createSupabaseQueryMock([]);
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam, assignment: null, loading: false, refetch: vi.fn()
    });

    // Capture the subscription callback with a robust chainable mock
    const mockOn = vi.fn().mockImplementation((event, config, callback) => {
      if (config?.table === 'team_messages') {
        messageCallback = callback;
      }
      return { on: mockOn, subscribe: vi.fn().mockReturnThis() };
    });

    vi.mocked(supabase.channel).mockReturnValue({
      on: mockOn,
      subscribe: vi.fn().mockReturnThis(),
    });

    render(<ResponderDashboardPage />);

    // Wait for the messaging section to settle after initial fetch (prevents race condition)
    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument();

    // Simulate incoming message event
    const newMessage = { 
      id: 'm1', 
      sender_name: 'Command', 
      message_text: 'Proceed to Sector Bravo', 
      created_at: new Date().toISOString() 
    };
    
    await act(async () => {
      if (messageCallback) messageCallback({ new: newMessage });
    });

    await waitFor(() => {
      expect(screen.getByText('Proceed to Sector Bravo')).toBeInTheDocument();
      expect(screen.getByText('Command')).toBeInTheDocument();
    });
  });

  it('displays a permission error if the deployment update is blocked by RLS', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Assigned' };
    const mockAsn = { assignment_id: 'a1', status: 'Assigned' };
    
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: vi.fn(),
    });

    // Mock an RLS block: Update returns success (200) but an empty array (0 rows affected)
    supabase.from.mockImplementation(() => createSupabaseMock([]));
    
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ResponderDashboardPage />);
    
    const deployBtn = screen.getByRole('button', { name: /Deploy/i });
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deployment blocked: You do not have permission')
      );
    });
    alertSpy.mockRestore();
  });
});
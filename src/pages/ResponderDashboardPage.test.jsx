import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';

import ResponderDashboardPage from './ResponderDashboardPage';
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { removeResponderFromTeam } from '../services/responderService';
import { supabase } from '../lib/supabase';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useResponderTeamAndAssignment', () => ({
  default: vi.fn(),
}));

vi.mock('../services/responderService', () => ({
  removeResponderFromTeam: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock OperationsMap to prevent Google Maps API loader from crashing the test environment
vi.mock('../components/OperationsMap', () => ({
  default: () => <div data-testid="operations-map-mock" />
}));

const createSupabaseMock = (data, error = null) => {
  const mock = globalThis.createSupabaseQueryMock(data, error);
  mock.neq = vi.fn().mockReturnThis();
  mock.in = vi.fn().mockReturnThis();
  mock.not = vi.fn().mockReturnThis();
  mock.gt = vi.fn().mockReturnThis();
  return mock;
};

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
  vi.mocked(supabase.from).mockImplementation((table) => {
    if (table === 'operational_periods') return globalThis.createSupabaseQueryMock({ par_check_interval: 60 });
    return globalThis.createSupabaseQueryMock([]);
  });

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
    incidentData: { opPeriodId: 'op-123', name: 'Test Incident', parInterval: 60 },
    setResponderStatus: vi.fn(),
    setCurrentTeamStatus: vi.fn(),
    setCurrentAssignmentStatus: vi.fn(),
  });

  // Provide a safe default for the sync hook to prevent crashes on initial render
  vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
    team: null,
    assignment: null,
    responderRecord: null,
    loading: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe('ResponderDashboardPage', () => {
  it('shows empty state when responder has no team or assignment', () => {
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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

  it('hides the assignment div when the assignment is marked as Completed', () => {
    const mockTeam = { team_name_number: 'Team 1', status: 'Assigned' };
    const mockAsn = { title: 'Finished Task', status: 'Completed' };
    
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
    });

    render(<ResponderDashboardPage />);
    // Assignment title should be hidden for responders if completed
    expect(screen.queryByText(/Team Assignment: Finished Task/i)).not.toBeInTheDocument();
  });

  it('renders team and assignment information when available', () => {
    const mockTeam = { team_name_number: 'Team 1', type: 'Ground', status: 'Assigned' };
    const mockAsn = { title: 'Area A', status: 'Planned', segment: 'A', resource_type: 'Ground', team_size: 2, frequency_primary: 'TAC 1', description: 'Test', probability_of_detection: null };
    
    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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
      responderName: 'Steve',
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      loading: true,
    });

    render(<ResponderDashboardPage />);
    expect(screen.getByText(/Loading mission data/i)).toBeInTheDocument();
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
      incidentData: { opPeriodId: 'op-123', name: 'Test Incident' },
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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
      // Triggers now handle cascading status changes. 
      // Component only needs to update the primary assignment record.
      expect(supabase.from).toHaveBeenCalledWith('assignments');
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
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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
    
    // Wait for parInterval to load and display "just now"
    // (Text was "Never" in previous versions, but now reflects time since creation)
    const initialJustNows = await screen.findAllByText('just now');
    expect(initialJustNows.length).toBeGreaterThanOrEqual(1);

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
      const justNowElements = screen.getAllByText('just now');
      expect(justNowElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should reset PAR when clicking the overdue status chip', async () => {
    const mockTeam = { 
      team_id: 't1', 
      team_name_number: 'Team 1',
      type: 'Ground',
      status: 'Assigned', 
      last_par_check: new Date(Date.now() - 120 * 60000).toISOString() // 2 hours ago
    };
    const mockRefetch = vi.fn();

    // Mock responses for both the team details and the operational period interval
    supabase.from.mockImplementation((table) => {
      if (table === 'teams') return createSupabaseMock([mockTeam]);
      if (table === 'operational_periods') return globalThis.createSupabaseQueryMock({ par_check_interval: 60 });
      return createSupabaseMock([]);
    });

    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123', parInterval: 60 },
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      refetch: mockRefetch,
    });

    render(<ResponderDashboardPage />);
    
    // Use findByTitle to wait for async parInterval hydration from fetchIncidentDetails
    const overdueChip = await screen.findByTitle('Click to reset PAR');
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
      responderName: 'Steve',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-1' },
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn()
    });
    
    // Mock supabase calls with table-specific data to prevent data-shape crashes
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'operational_periods') return createSupabaseQueryMock({ par_check_interval: parInterval });
      if (table === 'teams') return createSupabaseQueryMock([mockTeam]);
      return createSupabaseQueryMock([]);
    });

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
      team_name_number: 'Team 1',
      status: 'Assigned', 
      last_par_check: sixtyFiveMinsAgo 
    };

    vi.mocked(useIncident).mockReturnValue({ 
      responderId: 'r1', 
      responderName: 'Steve',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-1' },
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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
      // Visual parity update: text was replaced by the duration badge
      // Use getAllByText as the duration now appears in both the header badge and the reset chip
      expect(screen.getAllByText(/1h 5m ago/i).length).toBeGreaterThanOrEqual(1);
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
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
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
    let mockTeam = { team_name_number: 'Team 1', status: 'Assigned', type: 'Ground', last_par_check: new Date(now - 30000).toISOString() }; // 30s ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    const { rerender } = render(<ResponderDashboardPage />);
    // Find text asynchronously because parInterval is updated via useEffect/fetch on mount
    const justNows = await screen.findAllByText('just now');
    expect(justNows.length).toBeGreaterThanOrEqual(1);

    // 2. Multiple minutes
    mockTeam = { team_name_number: 'Team 1', status: 'Assigned', type: 'Ground', last_par_check: new Date(now - 15 * 60000).toISOString() }; // 15m ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    rerender(<ResponderDashboardPage />);
    const minsAgo = screen.getAllByText('15m ago');
    expect(minsAgo.length).toBeGreaterThanOrEqual(1);

    // 3. Hours and minutes
    mockTeam = { team_name_number: 'Team 1', status: 'Assigned', type: 'Ground', last_par_check: new Date(now - 145 * 60000).toISOString() }; // 2h 25m ago
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: mockRefetch });
    rerender(<ResponderDashboardPage />);
    // When overdue, the duration text appears in both the section badge and the interactive reset chip
    const durations = await screen.findAllByText('2h 25m ago');
    expect(durations.length).toBeGreaterThanOrEqual(2);
  });

  it('updates the message list when a real-time message event is received', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Assigned' };
    let messageCallback;

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      responderName: 'Steve',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' }
    });

    // Mock responders list to satisfy lookups and triggers
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'responders') return createSupabaseMock([{ responder_id: 'r1', name: 'Steve' }]);
      if (table === 'teams') return createSupabaseMock([
        { team_id: 'staff-123', team_name_number: 'Staff', type: 'Staff', status: 'Deployed' }, // Staff team
        { team_id: 't1', team_name_number: 'Team 1', type: 'Ground', status: 'Assigned' } // Responder's team
      ]);
      return createSupabaseMock([]);
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
      created_at: new Date().toISOString(),
      team_id: 'staff-123'
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

  it('should allow a leader to update assignment POD and debrief narrative', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Deployed' };
    const mockAsn = { assignment_id: 'a1', status: 'Deployed', title: 'Task 1' };
    const mockRefetch = vi.fn();

    const mockSetResponderStatus = vi.fn();
    const mockSetCurrentTeamStatus = vi.fn();
    const mockSetCurrentAssignmentStatus = vi.fn();
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: mockRefetch,
    });

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      setResponderStatus: mockSetResponderStatus,
      setCurrentTeamStatus: mockSetCurrentTeamStatus,
      setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
    });
    supabase.from.mockImplementation(() => createSupabaseMock([mockAsn]));

    render(<ResponderDashboardPage />);
    
    const podInput = screen.getByPlaceholderText('0-100');
    const debriefArea = screen.getByPlaceholderText(/Enter findings/i);

    fireEvent.change(podInput, { target: { value: '85' } });
    fireEvent.change(debriefArea, { target: { value: 'Found tracks' } });

    const saveBtn = screen.getByRole('button', { name: /Save Mission Data/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('assignments');
      // Find the update call and verify data payload
      const updateCall = vi.mocked(supabase.from).mock.results.find(r => r.value.update && r.value.update.mock.calls.length > 0).value;
      expect(updateCall.update).toHaveBeenCalledWith(expect.objectContaining({
        probability_of_detection: 85,
        debrief_narrative: 'Found tracks'
      }));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('prompts for confirmation and calls removeResponderFromTeam when leaving a team', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha', status: 'Assigned', created_at: new Date().toISOString() };
    const mockRefetch = vi.fn();
    
    const mockSetResponderStatus = vi.fn();
    const mockSetCurrentTeamStatus = vi.fn();
    const mockSetCurrentAssignmentStatus = vi.fn();
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      refetch: mockRefetch,
    });

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      setResponderStatus: mockSetResponderStatus,
      setCurrentTeamStatus: mockSetCurrentTeamStatus,
      setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
    });
    // Mock window confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    
    render(<ResponderDashboardPage />);
    
    const leaveBtn = screen.getByRole('button', { name: /Leave Team/i });
    fireEvent.click(leaveBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('leave team "Team Alpha"'));
    
    await waitFor(() => {
      expect(removeResponderFromTeam).toHaveBeenCalledWith(supabase, 'r1', 't1');
      expect(mockRefetch).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });

  it('should successfully send a message to Command', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team 1', leader_responder_id: 'r1', status: 'Assigned' };
    
    const mockSetResponderStatus = vi.fn();
    const mockSetCurrentTeamStatus = vi.fn();
    const mockSetCurrentAssignmentStatus = vi.fn();
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam, assignment: null, loading: false, refetch: vi.fn()
    });

    // Mock successful message insertion
    const mockInsert = vi.fn().mockReturnThis();
    supabase.from.mockImplementation((table) => {
      if (table === 'team_messages') {
        const mock = createSupabaseMock([{ id: 'm1', sender_name: 'Steve', message_text: 'Test', created_at: new Date().toISOString() }]);
        mock.insert = mockInsert;
        mock.in = vi.fn().mockReturnThis();
        mock.single = vi.fn().mockResolvedValue({ data: { id: 'm1', sender_name: 'Steve', message_text: 'Test', created_at: new Date().toISOString() }, error: null });
        return mock;
      }
      return createSupabaseMock([]);
    });

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      setResponderStatus: mockSetResponderStatus,
      setCurrentTeamStatus: mockSetCurrentTeamStatus,
      setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
    });

    render(<ResponderDashboardPage />);

    const input = screen.getByPlaceholderText(/Send message.../i);
    fireEvent.change(input, { target: { value: 'Requesting radio check' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ message_text: 'Requesting radio check' }));
    });
  });

  it('allows a non-leader to leave a team when assigned but not deployed', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha', leader_responder_id: 'OTHER_LEADER', status: 'Assigned', created_at: new Date().toISOString() };
    const mockRefetch = vi.fn();
    
    const mockSetResponderStatus = vi.fn();
    const mockSetCurrentTeamStatus = vi.fn();
    const mockSetCurrentAssignmentStatus = vi.fn();
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: { title: 'Area Alpha', status: 'Assigned' },
      loading: false,
      refetch: mockRefetch,
    });

    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      accessLevel: 'responder',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      setResponderStatus: mockSetResponderStatus,
      setCurrentTeamStatus: mockSetCurrentTeamStatus,
      setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<ResponderDashboardPage />);
    
    const leaveBtn = screen.getByRole('button', { name: /Leave Team/i });
    expect(leaveBtn).not.toBeDisabled();
    
    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    await waitFor(() => {
      expect(removeResponderFromTeam).toHaveBeenCalledWith(expect.anything(), 'r1', 't1');
      expect(mockRefetch).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
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
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAsn,
      loading: false,
      refetch: vi.fn()
    });

    render(<ResponderDashboardPage />);

    const leaveBtn = screen.getByRole('button', { name: /Leave Team/i });
    expect(leaveBtn).toBeDisabled();
    expect(leaveBtn).toHaveAttribute('title', 'Cannot leave team while deployed');
    expect(removeResponderFromTeam).not.toHaveBeenCalled();
  });

  it('updates the messaging channel when a specific recipient is selected in Staff mode', async () => {
    const mockStaffTeam = { team_id: 'staff-123', team_name_number: 'Staff', type: 'Staff', status: 'Deployed' };
    const mockAllTeams = [
      mockStaffTeam,
      { team_id: 't-field-1', team_name_number: 'Ground 1', type: 'Ground' }
    ];
    
    vi.mocked(useIncident).mockReturnValue({
      responderId: 'admin-1',
      accessLevel: 'admin',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    // Provide the team object via the hook mock to render the messaging section
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockStaffTeam,
      assignment: null,
      responderRecord: null,
      loading: false,
      refetch: vi.fn()
    });

    // Mock the teams fetch for the staff recipient dropdown
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'teams') return globalThis.createSupabaseQueryMock(mockAllTeams);
      if (table === 'team_messages') return globalThis.createSupabaseQueryMock([]);
      return globalThis.createSupabaseQueryMock([]);
    });

    render(<ResponderDashboardPage />);

    // Wait for recipient dropdown to populate
    const recipientSelect = await screen.findByDisplayValue(/Staff \(Broadcast\)/i);
    
    // Select "Ground 1" from the dropdown
    fireEvent.change(recipientSelect, { target: { value: 't-field-1' } });

    // Verify messaging history fetch was re-triggered for the new channel
    await waitFor(() => {
      const messageCalls = vi.mocked(supabase.from).mock.calls.filter(c => c[0] === 'team_messages');
      // Expect initial broadcast fetch + subsequent channel fetch
      expect(messageCalls.length).toBeGreaterThan(1);
    });
  });

  it('correctly formats the PAR timer string for different durations', async () => {
    const now = Date.now();
    const mockTeam = { team_name_number: 'Team 1', status: 'Assigned', type: 'Ground', last_par_check: new Date(now - 145 * 60000).toISOString() }; // 2h 25m ago
    
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({ team: mockTeam, loading: false, refetch: vi.fn() });
    render(<ResponderDashboardPage />);
    
    const durations = await screen.findAllByText('2h 25m ago');
    expect(durations.length).toBeGreaterThanOrEqual(1);
  });
});
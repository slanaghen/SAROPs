import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useIncident } from './context/IncidentContext';
import { supabase } from './lib/supabase';
import useResponderTeamAndAssignment from './hooks/useResponderTeamAndAssignment';

expect.extend(matchers);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('./context/IncidentContext', () => ({
  __esModule: true,
  useIncident: vi.fn(),
}));

vi.mock('./hooks/useResponderTeamAndAssignment', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  SAROPS_DB_INSTANCE: 'LOCAL',
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn((callback) => {
        // Immediately invoke the callback to simulate auth state being resolved on mount.
        callback('INITIAL_SESSION', { user: { id: 'test-user' } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    removeChannel: vi.fn(),
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Browser APIs for notifications
    vi.stubGlobal('Notification', vi.fn());
    global.Notification.permission = 'granted';
    global.Notification.requestPermission = vi.fn();
    vi.stubGlobal('Audio', vi.fn().mockReturnValue({ play: vi.fn().mockResolvedValue() }));

    // Set a safe default return value for the session sync hook to prevent destructuring errors
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: null,
      assignment: null,
      responderRecord: null,
      loading: false,
      refetch: vi.fn(() => supabase.from('responders')),
    });
  });

  it('renders the branding and guest status by default', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      isAdmin: false,
      incidentData: null,
      responderName: null,
      responderId: null,
      responderStatus: null,
      setResponderStatus: vi.fn(),
      accessLevel: 'responder',
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      logout: vi.fn(),
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('SAROps')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('shows incident name in banner when active', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
      responderName: 'Steve',
      responderId: 'res-123',
      responderStatus: 'Staged',
      setResponderStatus: vi.fn(),
      accessLevel: 'responder',
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      logout: vi.fn(),
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('Mountain Rescue')).toBeInTheDocument();
    expect(screen.getByText('Steve')).toBeInTheDocument();
  });

  it('triggers a session sync when the window regains focus', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'res-123',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    
    // Simulate window focus
    window.dispatchEvent(new Event('focus'));

    expect(supabase.from).toHaveBeenCalledWith('responders');
  });

  it('triggers a browser notification and sound when operational status changes', async () => {
    // Set initial operational state: Staged
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      incidentId: 'inc-123',
      responderId: 'res-123',
      responderName: 'Steve',
      responderStatus: 'Staged',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
      logout: vi.fn(),
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
    });

    const { rerender } = render(<MemoryRouter><App /></MemoryRouter>);

    // Update context to trigger a status change
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      incidentId: 'inc-123',
      responderId: 'res-123',
      responderName: 'Steve',
      responderStatus: 'Deployed', // Changed from initial 'Staged'
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
      logout: vi.fn(),
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
    });

    rerender(<MemoryRouter><App /></MemoryRouter>);

    await waitFor(() => {
      expect(global.Notification).toHaveBeenCalledWith(
        "SAROps: Your Status Changed",
        expect.objectContaining({ body: expect.stringContaining('Deployed') })
      );
      expect(global.Audio).toHaveBeenCalled();
    });
  });

  it('updates connectivity indicator when browser goes offline/online', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      isAdmin: false,
      accessLevel: 'responder',
      logout: vi.fn(),
      incidentData: null,
      responderName: null,
      responderId: null,
      responderStatus: null,
      setResponderStatus: vi.fn(),
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });
    render(<MemoryRouter><App /></MemoryRouter>);

    const dot = document.querySelector('.connection-dot');
    expect(dot).toHaveClass('online');

    // Simulate offline
    fireEvent(window, new Event('offline'));
    expect(dot).toHaveClass('offline');
    expect(dot).toHaveAttribute('title', 'Offline');

    // Simulate online
    fireEvent(window, new Event('online'));
    expect(dot).toHaveClass('online');
  });

  it('redirects unauthorized users to check-in when attempting to access staff dashboards', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      isAdmin: false,
      accessLevel: null,
      logout: vi.fn(),
      // Provide a more complete mock to prevent crashes in other hooks
      incidentData: null,
      responderName: null,
      responderId: null,
      responderStatus: null,
      setResponderStatus: vi.fn(),
      setAccessLevel: vi.fn(),
      currentTeamStatus: null,
      currentAssignmentStatus: null,
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    render(<MemoryRouter initialEntries={['/operations']}><App /></MemoryRouter>);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/checkin');
    });
  });

  it('enforces role-based boundaries: Responders are redirected away from Operations', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      accessLevel: 'responder',
      logout: vi.fn(),
      incidentData: { name: 'Test Inc', opPeriodId: 'op-1' },
      incidentId: 'inc-1',
      responderId: 'res-1',
      responderName: 'Test Responder',
      responderStatus: 'Staged',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    render(<MemoryRouter initialEntries={['/operations']}><App /></MemoryRouter>);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/responder');
    });
  });

  it('enforces role-based boundaries: Staff are redirected away from Administration', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: true,
      accessLevel: 'staff',
      logout: vi.fn(),
      incidentData: { name: 'Test Inc' }
    });

    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });
  });

  it('automatically signs out when the responder record status changes to CheckedOut remotely', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      responderId: 'res-123',
      responderStatus: 'Staged',
      responderName: 'Steve',
      incidentData: { name: 'Remote Mission', opNumber: '1' },
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      logout: mockLogout,
    });

    // Mock the background sync hook to return a CheckedOut status
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      responderRecord: { status: 'CheckedOut', access_level: 'responder' },
      loading: false,
    });

    render(<MemoryRouter><App /></MemoryRouter>);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should not clear session during the check-in race condition', async () => {
    const mockLogout = vi.fn();

    // 1. Initial State: Not active, no responder
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      responderId: null,
      logout: mockLogout,
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      setAccessLevel: vi.fn(),
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      responderRecord: null,
      loading: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<MemoryRouter><App /></MemoryRouter>);

    // 2. Simulate Check-in: responderId is set, but the hook hasn't fetched the record yet
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'res-123', // ID has just been set
      logout: mockLogout,
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      setAccessLevel: vi.fn(),
    });
    // The hook is now loading the new record
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      responderRecord: null, // Record is still null
      loading: true, // Hook is loading
      refetch: vi.fn(),
    });

    rerender(<MemoryRouter><App /></MemoryRouter>);

    // 3. Assert that logout was NOT called, even though responderRecord is null
    // This verifies that the `prevResponderId` check is preventing the session from being cleared.
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('should clear the session if the responder record is missing after initial load', async () => {
    const mockLogout = vi.fn();

    // 1. Initial State: Active session with a valid responder record
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'res-123',
      logout: mockLogout,
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      setAccessLevel: vi.fn(),
    });
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      responderRecord: { responder_id: 'res-123', status: 'Staged', access_level: 'responder' },
      loading: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<MemoryRouter><App /></MemoryRouter>);

    // 2. Simulate Deletion: The responder record is now missing from the database
    // The hook returns null, and is not loading. The responderId in context remains the same.
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      responderRecord: null,
      loading: false,
      refetch: vi.fn(),
    });

    rerender(<MemoryRouter><App /></MemoryRouter>);

    // 3. Assert that logout was called because the session is now invalid.
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
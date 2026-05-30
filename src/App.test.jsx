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
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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
      responderId: 'res-123',
      responderStatus: 'Staged',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
    });

    const { rerender } = render(<MemoryRouter><App /></MemoryRouter>);

    // Update context to trigger a status change
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'res-123',
      responderStatus: 'Deployed', // Changed from initial 'Staged'
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
      accessLevel: 'responder',
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
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
    vi.mocked(useIncident).mockReturnValue({ isActive: false, logout: vi.fn(), accessLevel: 'responder' });
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
      accessLevel: 'responder',
      logout: vi.fn(),
    });

    render(<MemoryRouter initialEntries={['/operations']}><App /></MemoryRouter>);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/checkin');
    });
  });

  it('enforces role-based boundaries: Responders are redirected away from Operations', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: true,
      accessLevel: 'responder', // Logged in but not staff
      logout: vi.fn(),
      incidentData: { name: 'Test Inc' }
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
});
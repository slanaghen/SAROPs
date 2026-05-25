import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useIncident } from './context/IncidentContext';
import { supabase } from './lib/supabase';

expect.extend(matchers);

vi.mock('./context/IncidentContext', () => ({
  __esModule: true,
  useIncident: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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
});
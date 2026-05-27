import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CheckOutPage from './CheckOutPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (cb: any) => Promise.resolve({ data: null, error: null }).then(cb)
    })),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('CheckOutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders a warning if no active session is found', () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: false, responderId: null } as any);
    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    expect(screen.getByText(/No Active Session/i)).toBeInTheDocument();
  });

  it('blocks check-out if the responder is currently Deployed', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'r1',
      responderName: 'Steve',
      responderStatus: 'Deployed',
      accessLevel: 'responder',
      logout: vi.fn(),
    } as any);

    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Confirm Check-Out/i));

    expect(await screen.findByText(/Check-out unsuccessful/i)).toBeInTheDocument();
    expect(screen.getByText(/current status is "Deployed"/i)).toBeInTheDocument();
  });

  it('allows check-out for Staged responders', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'r1',
      responderName: 'Steve',
      responderStatus: 'Staged',
      accessLevel: 'responder',
      logout: mockLogout,
    } as any);

    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Confirm Check-Out/i));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('responders');
      // Specifically find the mock result associated with the 'responders' table call
      const respondersCallIdx = vi.mocked(supabase.from).mock.calls.findIndex(c => c[0] === 'responders');
      const respondersQuery = vi.mocked(supabase.from).mock.results[respondersCallIdx].value;
      expect(respondersQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'CheckedOut' }));
      
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/checkin');
    });
  });

  it('allows check-out for Admins in Assigned status', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'admin-1',
      responderName: 'Steve Admin',
      responderStatus: 'Assigned', // Admins/Staff are Assigned by default
      accessLevel: 'admin',
      logout: mockLogout,
    } as any);

    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    const confirmBtn = screen.getByText(/Confirm Check-Out/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('responders');
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('nullifies leadership on active teams before completing checkout', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true, responderId: 'ldr-1', responderStatus: 'Staged', accessLevel: 'responder', logout: vi.fn()
    } as any);

    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Confirm Check-Out/i));
    expect(supabase.from).toHaveBeenCalledWith('teams');
  });

  it('blocks check-out if the responder is currently Attached to a team', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true, responderId: 'r1', responderName: 'Steve', responderStatus: 'Attached', accessLevel: 'responder', logout: vi.fn(),
    } as any);
    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Confirm Check-Out/i));
    expect(await screen.findByText(/Check-out unsuccessful/i)).toBeInTheDocument();
  });

  it('updates database status before signing out to ensure session is valid for the write', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true, responderId: 'r1', responderStatus: 'Staged', accessLevel: 'responder', logout: vi.fn(),
    } as any);
    
    render(<MemoryRouter><CheckOutPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Confirm Check-Out/i));

    // Wait for the asynchronous checkout process to reach the sign-out step
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());

    const signOutCallIdx = vi.mocked(supabase.auth.signOut).mock.invocationCallOrder[0];
    const dbUpdateCallIdx = vi.mocked(supabase.from).mock.invocationCallOrder[0];
    expect(dbUpdateCallIdx).toBeLessThan(signOutCallIdx);
  });
});
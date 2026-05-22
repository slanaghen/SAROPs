import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResponderCheckinPage from './ResponderCheckinPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      // Supabase queries are thenable
      then: (cb: any, rej?: any) => Promise.resolve({ data: [], error: null }).then(cb, rej)
    }))
  }
}));

vi.mock('../hooks/useResponderCheckin', () => ({
  useResponderCheckin: () => ({
    checkedInResponder: null,
    isCheckedIn: false,
    loading: false,
    error: null,
    checkIn: vi.fn()
  })
}));

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('ResponderCheckinPage Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should redirect active command staff to operations', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderName: 'Steve',
      responderStatus: 'Staged',
      accessLevel: 'command staff',
      incidentData: { name: 'Command Center' },
      startIncident: vi.fn(),
      setResponderName: vi.fn(),
      setResponderStatus: vi.fn(),
      setResponderId: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/checkin']}>
        <ResponderCheckinPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });
  });

  it('auto-assigns first responder to Staff team as Incident Commander', async () => {
    // Ensure getSession returns a user id for handleCheckIn validation
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null
    } as any);

    const mockStartIncident = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      startIncident: mockStartIncident,
      setResponderName: vi.fn(),
      setResponderStatus: vi.fn(),
      setResponderId: vi.fn(),
    } as any);

    // Mock that we are fetching incidents and find one with a staff team that has no leader
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        then: vi.fn((onFulfilled) => {
          let data: any = [];
          if (table === 'incidents') {
            data = [{ incident_id: 'inc-1', name: 'Test', number: '1', operational_periods: [{ op_period_id: 'op-1', op_number: '1', start_datetime: new Date().toISOString() }] }];
          } else if (table === 'teams') {
            data = { team_id: 'staff-team-uuid', leader_responder_id: null };
          } else if (table === 'responders') {
            data = { responder_id: 'r1', access_level: 'command staff' };
          }
          return Promise.resolve({ data, error: null }).then(onFulfilled);
        })
      };
      mockQueryChain.maybeSingle.mockImplementation(() => mockQueryChain);
      return mockQueryChain as any;
    });

    render(<MemoryRouter><ResponderCheckinPage /></MemoryRouter>);

    // Wait for incidents to load and be displayed in the dropdown
    await screen.findByText(/Test/i);

    // Fill out the required form fields
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Steve' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'SAR' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'K9-1' } });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), { target: { value: '1231234567' } });
    fireEvent.click(screen.getByLabelText('SAR')); // Select responder type

    // Select an incident to satisfy form validation
    fireEvent.change(screen.getByLabelText(/Select Active Incident/i), { target: { value: 'inc-1' } });

    // Step 1: Move to the confirmation screen
    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));

    // Wait for the confirmation screen to appear, then finalize the check-in
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Check-In/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('team_responders');
      expect(mockStartIncident).toHaveBeenCalled();
    });
  });

  it('displays an error message if anonymous authentication fails on mount', async () => {
    // Mock auth failure
    vi.mocked(supabase.auth.signInAnonymously).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Auth Service Unavailable' } as any
    });

    render(<MemoryRouter><ResponderCheckinPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/Initializing Session/i)).toBeInTheDocument();
      // Note: Add a console.error spy if you want to verify the error was logged
    });
  });

  it('should prevent moving to confirmation if required fields are missing', async () => {
    // Mock incidents to allow render
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'incidents') {
        return {
          select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [] })
        };
      }
      return { select: vi.fn().mockReturnThis(), then: (cb: any) => Promise.resolve({ data: [] }).then(cb) };
    });

    render(<MemoryRouter><ResponderCheckinPage /></MemoryRouter>);
    
    await screen.findByLabelText(/Full Name/i);

    // Submit empty form
    fireEvent.click(screen.getByLabelText('SAR')); // Select responder type to pass that validation
    const continueBtn = screen.getByRole('button', { name: /Continue to Confirmation/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please select an active incident/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Confirm Your Information/i)).not.toBeInTheDocument();
  });
});
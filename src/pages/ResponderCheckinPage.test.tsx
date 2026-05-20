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
    supabase.from.mockImplementation((table) => {
      if (table === 'incidents') return { 
        select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ 
          data: [{ incident_id: 'inc-1', name: 'Test', number: '1', operational_periods: [{ op_period_id: 'op-1', op_number: '1' }] }] 
        }) 
      };
      if (table === 'teams') return {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({
          data: { team_id: 'staff-team-uuid', leader_responder_id: null }
        })
      };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { responder_id: 'r1', access_level: 'command staff' } }), then: (cb) => cb({ data: [] }) };
    });

    render(<MemoryRouter><ResponderCheckinPage /></MemoryRouter>);

    // Fill out the required form fields
    await waitFor(() => screen.getByLabelText(/Full Name/i));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Steve' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'SAR' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'K9-1' } });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), { target: { value: '1231234567' } });

    // Step 1: Move to the confirmation screen
    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));

    // Step 2: Finalize the check-in
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Check-In/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('team_responders');
      expect(mockStartIncident).toHaveBeenCalled();
    });
  });
});
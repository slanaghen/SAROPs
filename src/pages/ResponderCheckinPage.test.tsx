import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ResponderCheckinPage from './ResponderCheckinPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

const mockNavigate = vi.fn();

// Mock dependencies
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: vi.fn(),
}));
vi.mock('../context/IncidentContext');
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock the child component to simplify testing the page logic
vi.mock('../components/responder/ResponderCheckin', () => ({
  default: ({ onCheckIn, incidents, onIncidentSelected, selectedIncidentId }) => (
    <div>
      <select value={selectedIncidentId} onChange={(e) => onIncidentSelected(e.target.value)}>
        {incidents.map(inc => <option key={inc.incident_id} value={inc.incident_id}>{inc.name}</option>)}
      </select>
      <button onClick={() => onCheckIn({ name: 'Test User', agency: 'Test Agency', identifier: 'T1' })}>
        Submit Check-in
      </button>
    </div>
  ),
}));

describe('ResponderCheckinPage', () => {
  const mockStartIncident = vi.fn();
  const mockSetResponderId = vi.fn();
  const mockSetResponderName = vi.fn();
  const mockSetAccessLevel = vi.fn();
  const mockSetResponderStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocation).mockReturnValue({ pathname: '/checkin', state: null });
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      responderName: null,
      responderStatus: null,
      accessLevel: null,
      isAdmin: false,
      startIncident: mockStartIncident,
      setResponderId: mockSetResponderId,
      setResponderName: mockSetResponderName,
      setAccessLevel: mockSetAccessLevel,
      setResponderStatus: mockSetResponderStatus,
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null });
  });

  it('fetches and displays active incidents on load', async () => {
    const mockIncidents = [{ incident_id: 'inc-1', name: 'Incident One' }];
    vi.mocked(supabase.from('incidents').order).mockResolvedValue({ data: mockIncidents, error: null });

    render(<MemoryRouter><ResponderCheckinPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Incident One' })).toBeInTheDocument();
    });
  });

  it('redirects if user is already active in an incident', async () => {
    vi.mocked(useIncident).mockReturnValue({
      ...useIncident(),
      isActive: true,
      responderName: 'Test User',
      responderStatus: 'Staged',
    });

    render(<MemoryRouter initialEntries={['/checkin']}><ResponderCheckinPage /></MemoryRouter>);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/responder'));
  });

});

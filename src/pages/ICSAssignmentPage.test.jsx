import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ICSAssignmentPage from './ICSAssignmentPage';
import { useIncident } from '../context/IncidentContext';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import { supabase } from '../lib/supabase';
import { updateResponderStatus } from '../services/responderService';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/usePlanningDashboard', () => ({
  usePlanningDashboard: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      then: (cb) => Promise.resolve({ data: [], error: null }).then(cb),
    })),
  },
}));

vi.mock('../services/responderService', () => ({
  updateResponderStatus: vi.fn().mockResolvedValue({ error: null }),
}));

describe('ICSAssignmentPage', () => {
  const mockResponders = [
    { responder_id: 'r1', name: 'Steve', agency: 'SAR', status: 'Staged' },
    { responder_id: 'r2', name: 'Bob', agency: 'Fire', status: 'Staged' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      responderName: 'Steve Admin',
      setResponderStatus: vi.fn(),
    });

    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [],
      responders: mockResponders,
      loading: false,
      error: null,
      fetchDashboardData: vi.fn(),
      setError: vi.fn(),
    });
  });

  afterEach(cleanup);

  it('renders all ICS functional boxes', () => {
    render(<ICSAssignmentPage />);
    expect(screen.getByText(/Incident Commander/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety Officer/i)).toBeInTheDocument();
    expect(screen.getByText(/Operations Section/i)).toBeInTheDocument();
    expect(screen.getByText(/Planning Section/i)).toBeInTheDocument();
  });

  it('loads existing assignments and renders names', async () => {
    const mockStaffTeam = {
      type: 'Staff',
      current_responders: [
        { responder_id: 'r1', role: 'Incident Commander' }
      ]
    };

    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [mockStaffTeam],
      responders: mockResponders,
      loading: false,
      error: null,
      fetchDashboardData: vi.fn(),
      setError: vi.fn(),
    });

    render(<ICSAssignmentPage />);

    await waitFor(() => {
      expect(screen.getByText(/Steve/)).toBeInTheDocument();
    });
  });

  it('correctly maps General Staff roles (Operations, Planning, Logistics)', async () => {
    const mockStaffTeam = {
      type: 'Staff',
      current_responders: [
        { responder_id: 'r1', role: 'Operations' },
        { responder_id: 'r2', role: 'Planning' }
      ]
    };

    vi.mocked(usePlanningDashboard).mockReturnValue({
      teams: [mockStaffTeam],
      responders: mockResponders,
      loading: false,
      error: null,
      fetchDashboardData: vi.fn(),
      setError: vi.fn(),
    });

    render(<ICSAssignmentPage />);

    await waitFor(() => {
      expect(screen.getByText(/Steve/)).toBeInTheDocument(); 
      expect(screen.getByText(/Bob/)).toBeInTheDocument();   
    });
  });
});
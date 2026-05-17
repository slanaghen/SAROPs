import { render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OperationsDashboardPage from './OperationsDashboardPage';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  },
}));

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('OperationsDashboardPage Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should combine a team and assignment into one row when linked', async () => {
    // Setup context mock
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123', name: 'Mock Incident' },
      incidentId: 'inc-123',
      responderName: 'Steve',
      user: { email: 'steve@example.com' },
      logout: vi.fn(),
    });

    const mockAsn = [{ assignment_id: 'a-uuid', name: 'Division Alpha', team_id: 't-uuid', op_period_id: 'op-123', status: 'Assigned' }];
    const mockTeams = [{ team_id: 't-uuid', team_name_number: 'Team 1', type: 'Ground', op_period_id: 'op-123' }];
    const mockResponders = [{ responder_id: 'r-uuid', name: 'Leader Name' }];

    // Set up mock data responses
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsn;
      if (table === 'teams') data = mockTeams;
      if (table === 'responders') data = mockResponders;

      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        // Supabase queries are thenable - this is crucial for Promise.all to work
        then: (onFullfilled, onRejected) => Promise.resolve({ data, error: null }).then(onFullfilled, onRejected)
      };
      return query;
    });

    render(<OperationsDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Division Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });
    
    // Ensure they are in the same row (this is a simple heuristic check)
    const row = screen.getByText('Division Alpha').closest('tr');
    expect(row).toHaveTextContent('Team 1');
  });

  it('should show message when no operational period is selected', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: null });
    
    render(<OperationsDashboardPage />);
    expect(screen.getByText(/Please select or start an incident/i)).toBeInTheDocument();
  });
});
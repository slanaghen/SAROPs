import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  // Helper to create a consistent Supabase query mock chain
  const createQueryMock = (data, error = null) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: data, error: error }), // Correctly mock insert to capture calls
      in: vi.fn().mockReturnThis(), 
      delete: vi.fn().mockReturnThis(),
      then: (onFulfilled, onRejected) => Promise.resolve({ data, error }).then(onFulfilled, onRejected)
    };
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set a default mock for useIncident that allows the dashboard to render
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123', name: 'Mock Incident' },
      incidentId: 'inc-123',
      responderName: 'Steve',
      user: { email: 'steve@example.com' },
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should combine a team and assignment into one row when linked', async () => {
    const mockAsn = [{ assignment_id: 'a-uuid', name: 'Division Alpha', team_id: 't-uuid', op_period_id: 'op-123', status: 'Assigned' }];
    const mockTeams = [{ team_id: 't-uuid', team_name_number: 'Team 1', type: 'Ground', op_period_id: 'op-123' }];
    const mockResponders = [{ responder_id: 'r-uuid', name: 'Leader Name' }];

    // Set up mock data responses
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsn;
      else if (table === 'teams') data = mockTeams;
      else if (table === 'responders') data = mockResponders;
      else if (table === 'operational_periods') data = { par_check_interval: 60 };

      return createQueryMock(data);
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

  it('should handle the unassign team action', async () => {
    const mockAsn = [{ assignment_id: 'a1', name: 'Asn 1', team_id: 't1', op_period_id: 'op-123', status: 'Assigned' }];
    const mockTeams = [{ team_id: 't1', team_name_number: 'Team 1', op_period_id: 'op-123' }];
    window.confirm = vi.fn().mockReturnValue(true);

    supabase.from.mockImplementation((table) => {
      let data = (table === 'assignments') ? mockAsn : (table === 'teams' ? mockTeams : []);
      return createQueryMock(data);
    });

    render(<OperationsDashboardPage />);

    await waitFor(() => screen.getByText('Asn 1'));
    
    const row = screen.getByText('Asn 1').closest('tr');
    const actions = within(row).getByDisplayValue('Actions...');
    fireEvent.change(actions, { target: { value: 'unassign' } });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('assignments');
      expect(supabase.from).toHaveBeenCalledWith('teams');
    });
  });

  it('should open the team form when "New Team" is selected for an assignment', async () => {
    const mockAsn = [{ assignment_id: 'a1', name: 'Unassigned Asn', team_id: null, op_period_id: 'op-123' }];
    
    supabase.from.mockImplementation((table) => {
      let data = (table === 'assignments') ? mockAsn : [];
      return createQueryMock(data);
    });

    render(<OperationsDashboardPage />);

    await waitFor(() => screen.getByText('Unassigned Asn'));
    
    const row = screen.getByText('Unassigned Asn').closest('tr');
    const actions = within(row).getByDisplayValue('Actions...');
    fireEvent.change(actions, { target: { value: 'new-team' } });

    // Use getByRole to disambiguate the modal heading from dropdown options
    expect(screen.getByRole('heading', { name: 'New Team' })).toBeInTheDocument();
  });

  it('should render the Team Status column with correct values and chip styling', async () => {
    // Mock team with a specific status
    const mockTeams = [{ 
      team_id: 't-99', 
      team_name_number: 'Alpha-1', 
      type: 'Ground', 
      op_period_id: 'op-123', 
      status: 'Deployed' 
    }];

    supabase.from.mockImplementation((table) => {
      const data = table === 'teams' ? mockTeams : [];
      return createQueryMock(data);
    });

    render(<OperationsDashboardPage />);

    // Verify header and data rendering
    await waitFor(() => {
      expect(screen.getByText(/Team Status/i)).toBeInTheDocument();
      const statusChip = screen.getByText('Deployed');
      expect(statusChip).toHaveClass('status-indicator');
      expect(statusChip).toHaveClass('deployed');
    });
  });

  it('should render a red chip with a clock icon when a PAR check is overdue', async () => {
    // Mock a team that checked in 2 hours ago with a 60 min interval
    const twoHoursAgo = new Date(Date.now() - 120 * 60000).toISOString();
    const mockTeams = [{ team_id: 't1', team_name_number: 'T1', status: 'Deployed', last_par_check: twoHoursAgo }];

    supabase.from.mockImplementation((table) => {
      if (table === 'operational_periods') return createQueryMock({ par_check_interval: 60 });
      return createQueryMock(table === 'teams' ? mockTeams : []);
    });

    render(<OperationsDashboardPage />);

    await waitFor(() => {
      const overdueChip = screen.getByText(/2h 0m ago/i).closest('span');
      expect(overdueChip).toHaveStyle({ backgroundColor: '#dc2626' }); // Red background
      expect(overdueChip.querySelector('svg')).toBeInTheDocument(); // Clock icon
    });
  });

  it('should disband team and unlink when assignment status is set to Completed', async () => {
    const mockAsn = [{ assignment_id: 'a1', name: 'Asn 1', team_id: 't1', status: 'Deployed' }];
    window.confirm = vi.fn().mockReturnValue(false); // "Cancel" the keep staged prompt -> Disband

    supabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createQueryMock(mockAsn);
      if (table === 'teams') return createQueryMock([{ team_id: 't1', team_name_number: 'Team 1', status: 'Deployed' }]);
      return createQueryMock([]);
    });

    render(<OperationsDashboardPage />);
    await waitFor(() => screen.getByDisplayValue('Deployed'));

    fireEvent.change(screen.getByDisplayValue('Deployed'), { target: { value: 'Completed' } });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(window.confirm).toHaveBeenCalled();
    });
  });

  it('should show message when no operational period is selected', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: null });
    
    render(<OperationsDashboardPage />);
    expect(screen.getByText(/Please select or start an incident/i)).toBeInTheDocument();
  });

  it('sends a broadcast message to all teams in the operational period', async () => {
    const mockTeams = [
      { team_id: 't1', team_name_number: 'Team 1', op_period_id: 'op-123' },
      { team_id: 't2', team_name_number: 'Team 2', op_period_id: 'op-123' }
    ];

    supabase.from.mockImplementation((table) => {
      if (table === 'teams') return createQueryMock(mockTeams);
      return createQueryMock([]);
    });

    render(<OperationsDashboardPage />);
    await waitFor(() => screen.getByText('Team 1'));

    // Open Broadcast Modal
    fireEvent.click(screen.getByTitle(/Send message to all teams/i));
    
    const textarea = screen.getByPlaceholderText(/Enter message for all teams/i);
    fireEvent.change(textarea, { target: { value: 'Return to Base' } });
    
    fireEvent.click(screen.getByText('Send Broadcast'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('team_messages');
      const insertArgs = vi.mocked(supabase.from).mock.results.find(r => r.value.insert)?.value.insert.mock.calls[0][0];
      expect(insertArgs).toHaveLength(2);
      expect(insertArgs[0]).objectContaining({ message_text: '[BROADCAST]: Return to Base' });
    });
  });
});
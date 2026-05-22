import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import { assignResponderToTeam, removeResponderFromTeam, updateResponderStatus } from '../services/responderService';

// Mock dependencies
vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(() => ({
    incidentId: 'inc-123',
    responderName: 'Steve',
    user: { email: 'steve@example.com' },
    responderId: 'res-123',
    setResponderStatus: vi.fn(),
    setAccessLevel: vi.fn(),
  })),
}));

vi.mock('../services/responderService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    assignResponderToTeam: vi.fn().mockResolvedValue({ success: true }),
    removeResponderFromTeam: vi.fn().mockResolvedValue({ success: true }),
    updateResponderStatus: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe('usePlanningDashboard Hook', () => {
  const opPeriodId = 'op-123';
  
  const createMockQuery = (data, error = null) => globalThis.createSupabaseQueryMock(data, error);

  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard data successfully', async () => {
    const mockTeams = [{ team_id: 't1', team_name_number: 'Team 1', op_period_id: opPeriodId, status: 'Staged' }];
    const mockAsns = [{ assignment_id: 'a1', title: 'Asn A', op_period_id: opPeriodId, team_id: null }];
    const mockResponders = [{ responder_id: 'r1', name: 'Steve' }];

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'teams') return createMockQuery(mockTeams);
      if (table === 'assignments') return createMockQuery(mockAsns);
      if (table === 'responders') return createMockQuery(mockResponders);
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.fetchDashboardData();
    });

    expect(result.current.teams).toEqual(mockTeams);
    expect(result.current.assignments[0]).toMatchObject(mockAsns[0]);
    expect(result.current.stagedTeams).toHaveLength(1);
    expect(result.current.availableAssignments).toHaveLength(1);
  });

  it('should handle team creation and logging', async () => {
    const newTeam = { team_id: 'new-t', team_name_number: 'Team abc', status: 'Staged' };
    
    // Use createMockQuery as a base to provide thenable behavior and standard chain methods.
    // This ensures internal list refreshes (fetchDashboardData) resolve with the new team data.
    const teamsMock = {
      ...createMockQuery([newTeam]),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      // maybeSingle resolves to null for the initial uniqueness check, then to the data for the insert result.
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValue({ data: newTeam, error: null }),
      single: vi.fn().mockResolvedValue({ data: newTeam, error: null }),
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'teams') return teamsMock;
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    let created;
    await act(async () => {
      created = await result.current.createTeam({ 
        op_period_id: opPeriodId, 
        team_name_number: 'Team xyz' 
      });
    });

    expect(created).toEqual(newTeam);
    expect(mockSupabase.from).toHaveBeenCalledWith('action_logs');
    expect(result.current.teams).toContainEqual(newTeam);
  });

  it('should handle assignment of a team to an assignment', async () => {
    // Setup initial state with a team and an assignment
    const mockTeams = [{ team_id: 't1', team_name_number: 'Team 1', status: 'Staged' }];
    const mockAsns = [{ assignment_id: 'a1', title: 'Asn A', team_id: null, status: 'Planned' }];
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery({ ...mockAsns[0], team_id: 't1', status: 'Assigned' });
      if (table === 'teams') return createMockQuery({ ...mockTeams[0], status: 'Assigned' });
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    // Populate state correctly via the mock responses set above
    await act(async () => {
      await result.current.fetchDashboardData();
    });

    await act(async () => {
      await result.current.assignTeamToAssignment('t1', 'a1');
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('assignments');
    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(mockSupabase.from).toHaveBeenCalledWith('action_logs');
  });

  it('should set an error if fetchDashboardData fails', async () => {
    mockSupabase.from.mockImplementation(() => createMockQuery(null, { message: 'Fetch failed' }));

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.fetchDashboardData();
    });

    expect(result.current.error).toBe('Fetch failed');
  });

  it('should enforce opPeriodId requirement for creating assignments', async () => {
    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, null));

    await expect(result.current.createAssignment({ name: 'Test' }))
      .rejects.toThrow('Cannot create assignment: No operational period selected.');
    
    await waitFor(() => {
      expect(result.current.error).toBe('Cannot create assignment: No operational period selected.');
    });
  });

  it('should update team details successfully', async () => {
    const existingTeam = { team_id: 't1', team_name_number: 'Team 1' };
    const updates = { team_name_number: 'Team 1 Revised' };
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'teams') return createMockQuery({ ...existingTeam, ...updates });
      return createMockQuery({});
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.updateTeam('t1', updates);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
  });

  it('should delete a team and update local state', async () => {
    mockSupabase.from.mockImplementation(() => createMockQuery([], null)); // Mock empty member list and success delete

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.deleteTeam('t1');
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(result.current.teams).toHaveLength(0);
  });

  it('should create and update assignments', async () => {
    const asn = { assignment_id: 'a1', title: 'Area 1' };
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery(asn);
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.createAssignment({ name: 'Area 1' });
    });
    
    expect(result.current.assignments).toContainEqual(expect.objectContaining(asn));
    
    const updates = { title: 'Area 1 Updated' };
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery({ ...asn, ...updates });
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    await act(async () => {
      await result.current.updateAssignment('a1', updates);
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('assignments');
  });

  it('should attach a responder to a team', async () => {
    const responderId = 'r1';
    const teamId = 't1';
    // Ensure the initial membership check returns null so the service call is triggered
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'team_responders') return createMockQuery(null);
      return createMockQuery({});
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.attachResponderToTeam(responderId, teamId);
    });

    expect(assignResponderToTeam).toHaveBeenCalledWith(mockSupabase, responderId, teamId);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');

    const respondersCallIdx = vi.mocked(mockSupabase.from).mock.calls.findIndex(c => c[0] === 'responders');
    const respondersQuery = vi.mocked(mockSupabase.from).mock.results[respondersCallIdx].value;
    expect(respondersQuery.update).toHaveBeenCalledWith({ status: 'Attached' });
    expect(respondersQuery.eq).toHaveBeenCalledWith('responder_id', responderId);
  });

  it('should detach a responder from a team', async () => {
    const responderId = 'r1';
    const teamId = 't1';
    mockSupabase.from.mockImplementation(() => createMockQuery({}));

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.detachResponderFromTeam(responderId, teamId);
    });

    const lastQuery = vi.mocked(mockSupabase.from).mock.results[0].value;
    expect(removeResponderFromTeam).toHaveBeenCalledWith(mockSupabase, responderId, teamId);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(lastQuery.update).toHaveBeenCalledWith({ status: 'Staged' });
  });

  it('should accurately calculate operational statistics', async () => {
    const mockTeams = [
      { team_id: 't1', status: 'Staged' },
      { team_id: 't2', status: 'Assigned' }
    ];
    const mockAsns = [
      { assignment_id: 'a1', status: 'Deployed' },
      { assignment_id: 'a2', status: 'Planned' },
      { assignment_id: 'a3', status: 'Completed' }
    ];

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'teams') return createMockQuery(mockTeams);
      if (table === 'assignments') return createMockQuery(mockAsns);
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));
    await act(async () => { await result.current.fetchDashboardData(); });

    expect(result.current.stats.assignments.deployed).toBe(1);
    expect(result.current.stats.teams.staged).toBe(1);
    expect(result.current.stats.assignments.complete).toBe(1);
  });

  it('should handle normalization of assignments with missing titles or null values', async () => {
    const brokenAsn = [{ assignment_id: 'a1', title: null, name: null, segment: null }];
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery(brokenAsn);
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));
    await act(async () => { await result.current.fetchDashboardData(); });

    expect(result.current.assignments[0].title).toBe('Untitled Assignment');
    expect(result.current.assignments[0].segment).toBe('');
  });
});
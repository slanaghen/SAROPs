import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlanningDashboard } from './usePlanningDashboard';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';

// Mock dependencies
vi.mock('../context/IncidentContext', () => ({
  useIncident: () => ({
    incidentId: 'inc-123',
    responderName: 'Steve',
    user: { email: 'steve@example.com' }
  }),
}));

vi.mock('../services/responderService', () => ({
  assignResponderToTeam: vi.fn().mockResolvedValue({ success: true }),
  removeResponderFromTeam: vi.fn().mockResolvedValue({ success: true }),
}));

describe('usePlanningDashboard Hook', () => {
  const opPeriodId = 'op-123';
  
  // Robust Supabase Mock
  const createMockQuery = (data, error = null) => {
    let isSingle = false;
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        isSingle = true;
        return query;
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        isSingle = true;
        return query;
      }),
      order: vi.fn().mockReturnThis(),
      then: (onFulfilled, onRejected) => {
        let resultData = data;
        if (isSingle && Array.isArray(data)) resultData = data[0];
        else if (!isSingle && !Array.isArray(data) && data !== null && typeof data === 'object') resultData = [data];
        return Promise.resolve({ data: resultData, error }).then(onFulfilled, onRejected);
      },
    };
    return query;
  };

  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard data successfully', async () => {
    const mockTeams = [{ team_id: 't1', team_name_number: 'Team 1', op_period_id: opPeriodId, status: 'Staged' }];
    const mockAsns = [{ assignment_id: 'a1', name: 'Asn A', op_period_id: opPeriodId, team_id: null }];
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
    expect(result.current.assignments).toEqual(mockAsns);
    expect(result.current.stagedTeams).toHaveLength(1);
    expect(result.current.availableAssignments).toHaveLength(1);
  });

  it('should handle team creation and logging', async () => {
    const newTeam = { team_id: 'new-t', team_name_number: 'Team 2', status: 'Staged' };
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'teams') return createMockQuery(newTeam);
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    let created;
    await act(async () => {
      created = await result.current.createTeam({ 
        op_period_id: opPeriodId, 
        team_name_number: 'Team 2' 
      });
    });

    expect(created).toEqual(newTeam);
    expect(mockSupabase.from).toHaveBeenCalledWith('action_logs');
    expect(result.current.teams).toContainEqual(newTeam);
  });

  it('should handle assignment of a team to an assignment', async () => {
    // Setup initial state with a team and an assignment
    const mockTeams = [{ team_id: 't1', team_name_number: 'Team 1', status: 'Staged' }];
    const mockAsns = [{ assignment_id: 'a1', name: 'Asn A', team_id: null, status: 'Planned' }];
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery({ ...mockAsns[0], team_id: 't1', status: 'Assigned' });
      if (table === 'teams') return createMockQuery({ ...mockTeams[0], status: 'Assigned' });
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));
    
    // Manually set state to simulate initial fetch
    act(() => {
      // Note: We'd normally use fetchDashboardData, but for brevity in this unit test:
      vi.spyOn(result.current, 'teams', 'get').mockReturnValue(mockTeams);
      vi.spyOn(result.current, 'assignments', 'get').mockReturnValue(mockAsns);
    });

    await act(async () => {
      await result.current.assignTeamToAssignment('t1', 'a1');
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('assignments');
    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(mockSupabase.from).toHaveBeenCalledWith('action_logs');
  });

  it('should set an error if fetchDashboardData fails', async () => {
    mockSupabase.from.mockReturnValue(createMockQuery(null, { message: 'Fetch failed' }));

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
    mockSupabase.from.mockReturnValue(createMockQuery([], null)); // Mock empty member list and success delete

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.deleteTeam('t1');
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(result.current.teams).toHaveLength(0);
  });

  it('should create and update assignments', async () => {
    const asn = { assignment_id: 'a1', name: 'Area 1' };
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'assignments') return createMockQuery(asn);
      if (table === 'action_logs') return createMockQuery({});
      return createMockQuery([]);
    });

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.createAssignment({ name: 'Area 1' });
    });
    
    expect(result.current.assignments).toContainEqual(asn);

    const updates = { name: 'Area 1 Updated' };
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
    const mockQuery = createMockQuery({});
    mockSupabase.from.mockReturnValue(mockQuery);

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.attachResponderToTeam(responderId, teamId);
    });

    expect(assignResponderToTeam).toHaveBeenCalledWith(mockSupabase, responderId, teamId);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockQuery.update).toHaveBeenCalledWith({ status: 'Attached' });
    expect(mockQuery.eq).toHaveBeenCalledWith('responder_id', responderId);
  });

  it('should detach a responder from a team', async () => {
    const responderId = 'r1';
    const teamId = 't1';
    const mockQuery = createMockQuery({});
    mockSupabase.from.mockReturnValue(mockQuery);

    const { result } = renderHook(() => usePlanningDashboard(mockSupabase, opPeriodId));

    await act(async () => {
      await result.current.detachResponderFromTeam(responderId, teamId);
    });

    expect(removeResponderFromTeam).toHaveBeenCalledWith(mockSupabase, responderId, teamId);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockQuery.update).toHaveBeenCalledWith({ status: 'Staged' });
  });
});
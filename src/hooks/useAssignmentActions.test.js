import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAssignmentActions } from './useAssignmentActions';

describe('useAssignmentActions Hook', () => {
  const mockTableChains = {
    assignments: globalThis.createSupabaseQueryMock({}),
    teams: globalThis.createSupabaseQueryMock({}),
    responders: globalThis.createSupabaseQueryMock({}),
    team_responders: globalThis.createSupabaseQueryMock([{ responder_id: 'r1' }]),
    responder_team_history: globalThis.createSupabaseQueryMock({})
  };

  const mockSupabase = {
    from: vi.fn((table) => mockTableChains[table])
  };

  const defaultProps = {
    supabaseClient: mockSupabase,
    operationalPeriodId: 'op-1',
    assignments: [{ assignment_id: 'a1', title: 'Task 1' }],
    teams: [{ team_id: 't1', team_name_number: 'Team 1' }],
    recordAction: vi.fn(),
    fetchDashboardData: vi.fn(),
    setAssignments: vi.fn(),
    setTeams: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setResponderStatus: vi.fn(),
    normalizeAssignment: vi.fn(a => a)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates resource status to Completed and disbands the team', async () => {
    const { result } = renderHook(() => useAssignmentActions(defaultProps));

    await act(async () => {
      await result.current.updateResourceStatus('a1', 't1', 'Completed');
    });

    // 1. Assignment updated to Completed
    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Completed', team_id: 't1' })
    );

    // 2. Team status updated to Disbanded (terminal cascade)
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Disbanded', last_par_check: null })
    );

    // 3. Responders release to Staged
    expect(mockTableChains.responders.update).toHaveBeenCalledWith({ status: 'Staged' });
  });

  it('sets last_par_check when resource status moves to Deployed', async () => {
    const { result } = renderHook(() => useAssignmentActions(defaultProps));

    await act(async () => {
      await result.current.updateResourceStatus('a1', 't1', 'Deployed');
    });

    expect(mockTableChains.teams.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Deployed', last_par_check: expect.any(String) })
    );
  });

  it('correctly unassigns a team from an assignment', async () => {
    const { result } = renderHook(() => useAssignmentActions(defaultProps));

    await act(async () => {
      await result.current.unassignTeam('a1');
    });

    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(expect.objectContaining({ team_id: null, status: 'Planned' }));
  });

  it('performs full operational cascade when assigning a team to an assignment', async () => {
    const { result } = renderHook(() => useAssignmentActions(defaultProps));

    await act(async () => {
      await result.current.assignTeamToAssignment('t1', 'a1');
    });

    // 1. Assignment updated with Team link
    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 't1', status: 'Assigned' })
    );

    // 2. Team record updated to Assigned and timer reset
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Assigned', last_par_check: expect.any(String) })
    );

    // 3. Responder records updated for all team members
    expect(mockTableChains.responders.update).toHaveBeenCalledWith({ status: 'Assigned' });
  });

  it('reverts team to Staged and unlinks when assignment status is set to Planned', async () => {
    const { result } = renderHook(() => useAssignmentActions(defaultProps));

    await act(async () => {
      await result.current.updateResourceStatus('a1', 't1', 'Planned');
    });

    // Assignment status Planned and team_id nullified
    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Planned', team_id: null })
    );

    // Team status reverted to Staged and timer cleared
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Staged', last_par_check: null })
    );
  });
});
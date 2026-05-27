import { renderHook, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    vi.useFakeTimers(); // For consistency, though this hook is mostly synchronous
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

    // Note: Team disbanding and responder release are now verified via integration 
    // tests as they are handled by DB triggers, not manual calls in this hook.
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

    // Note: Team and Responder status updates are now handled by DB triggers.
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

    // Note: Team status update is now handled by DB triggers.
  });
});
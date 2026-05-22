import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useTeamActions } from './useTeamActions';

describe('useTeamActions Cascading Logic', () => {
  it('properly orphans assignments and releases responders when a team is disbanded', async () => {
    const mockTableChains = {
      team_responders: globalThis.createSupabaseQueryMock([{ responder_id: 'r1' }]),
      assignments: globalThis.createSupabaseQueryMock({}),
      responders: globalThis.createSupabaseQueryMock({}),
      responder_team_history: globalThis.createSupabaseQueryMock({}),
      teams: globalThis.createSupabaseQueryMock({})
    };

    const mockSupabase = {
      from: vi.fn((table) => mockTableChains[table])
    };

    const { result } = renderHook(() => useTeamActions({
      supabaseClient: mockSupabase,
      operationalPeriodId: 'op-1',
      recordAction: vi.fn(),
      fetchDashboardData: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setResponderStatus: vi.fn()
    }));

    await act(async () => {
      await result.current.detachTeam('t1');
    });

    // Verify Assignment Orphaning: assignments NOT completed should become orphaned
    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(expect.objectContaining({ 
      is_orphaned: true 
    }));
    expect(mockTableChains.assignments.not).toHaveBeenCalledWith('status', 'in', '("Completed")');

    // Verify Responder Release
    expect(mockTableChains.responders.update).toHaveBeenCalledWith({ status: 'Staged' });

    // Verify History Closure
    expect(mockTableChains.responder_team_history.update).toHaveBeenCalledWith(expect.objectContaining({
      detached_datetime: expect.any(String)
    }));

    // Verify Team Disbanding
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Disbanded'
    }));
  });

  it('idempotently attaches a responder to a team', async () => {
    const mockTableChains = {
      team_responders: globalThis.createSupabaseQueryMock({ team_id: 't1' }), // Simulate existing record
      responders: globalThis.createSupabaseQueryMock({})
    };

    const mockSupabase = {
      from: vi.fn((table) => mockTableChains[table])
    };

    const { result } = renderHook(() => useTeamActions({
      supabaseClient: mockSupabase,
      fetchDashboardData: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn()
    }));

    await act(async () => {
      await result.current.attachResponderToTeam('r1', 't1', 'Medic');
    });

    // Should have checked if membership exists
    expect(mockTableChains.team_responders.match).toHaveBeenCalledWith({ team_id: 't1', responder_id: 'r1' });
    // Should update the role and status regardless of whether insert was needed
    expect(mockTableChains.team_responders.update).toHaveBeenCalledWith({ role: 'Medic' });
  });

  it('detaches a responder from a team and reverts their operational status', async () => {
    const mockRespondersTable = globalThis.createSupabaseQueryMock({});
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'responders') return mockRespondersTable;
        return globalThis.createSupabaseQueryMock({});
      })
    };

    const { result } = renderHook(() => useTeamActions({
      supabaseClient: mockSupabase,
      fetchDashboardData: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn()
    }));

    await act(async () => {
      await result.current.detachResponderFromTeam('r1', 't1');
    });

    expect(mockRespondersTable.update).toHaveBeenCalledWith({ status: 'Staged' });
    expect(mockRespondersTable.eq).toHaveBeenCalledWith('responder_id', 'r1');
  });
});
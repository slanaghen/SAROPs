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
      await result.current.disbandTeam('t1');
    });

    // Verify Assignment Orphaning: assignments NOT completed should become orphaned
    expect(mockTableChains.assignments.update).toHaveBeenCalledWith(expect.objectContaining({ 
      is_orphaned: true 
    }));
    expect(mockTableChains.assignments.not).toHaveBeenCalledWith('status', 'in', '("Completed")');

    // Verify Team Disbanding
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Disbanded'
    }));
    // NOTE: Responder status and history are now handled by database triggers,
    // so we no longer test for client-side updates to those tables here.
  });

  it('idempotently attaches a responder to a team', async () => {
    const mockTeamRespondersTable = globalThis.createSupabaseQueryMock({});
    const mockSupabase = { from: vi.fn(() => mockTeamRespondersTable) };

    const { result } = renderHook(() => useTeamActions({
      supabaseClient: mockSupabase,
      setLoading: vi.fn(),
      setError: vi.fn()
    }));

    await act(async () => {
      await result.current.attachResponderToTeam('r1', 't1', 'Medic');
    });

    // Verify that upsert is used to handle both new and existing memberships efficiently,
    // and that the responder's status change is correctly handled by a database trigger.
    expect(mockTeamRespondersTable.upsert).toHaveBeenCalledWith(
      { team_id: 't1', responder_id: 'r1', role: 'Medic' },
      { onConflict: 'team_id, responder_id' }
    );
  });

  it('detaches a responder from a team', async () => {
    const mockTeamRespondersTable = globalThis.createSupabaseQueryMock({});
    const mockSupabase = { from: vi.fn(() => mockTeamRespondersTable) };

    const { result } = renderHook(() => useTeamActions({ supabaseClient: mockSupabase, setLoading: vi.fn(), setError: vi.fn() }));

    await act(async () => {
      await result.current.detachResponderFromTeam('r1', 't1');
    });

    // Verify the correct record is deleted from the junction table.
    // The responder's status change is handled by a database trigger.
    expect(mockTeamRespondersTable.delete).toHaveBeenCalled();
    expect(mockTeamRespondersTable.match).toHaveBeenCalledWith({ team_id: 't1', responder_id: 'r1' });
  });
});
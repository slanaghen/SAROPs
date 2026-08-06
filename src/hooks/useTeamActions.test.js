import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useTeamActions } from './useTeamActions';

describe('useTeamActions Cascading Logic', () => {
  let mockTableChains;
  let mockSupabase;
  let defaultProps;

  beforeEach(() => {
    // Reset mocks before each test
    mockTableChains = {
      team_responders: globalThis.createSupabaseQueryMock([]),
      assignments: globalThis.createSupabaseQueryMock({}),
      responders: globalThis.createSupabaseQueryMock({}),
      responder_team_history: globalThis.createSupabaseQueryMock({}),
      teams: globalThis.createSupabaseQueryMock({}),
      vehicles: globalThis.createSupabaseQueryMock({}),
    };
    mockSupabase = {
      from: vi.fn((table) => mockTableChains[table]),
      rpc: vi.fn(),
    };
    defaultProps = {
      supabaseClient: mockSupabase,
      recordAction: vi.fn(),
      fetchDashboardData: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setResponderStatus: vi.fn(),
      operationalPeriodId: 'op-1',
    };
  });

  it('properly orphans assignments and releases responders when a team is disbanded', async () => {

    const { result } = renderHook(() => useTeamActions(defaultProps));

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
  it('passes the equipment array directly to the create_team_with_resources RPC during team creation', async () => {
    const { result } = renderHook(() => useTeamActions(defaultProps));

    const teamPayload = {
      team_name_number: 'Test Team',
      type: 'Ground',
      leader_responder_id: 'res-leader',
      equipment: ['GPS', 'Radio', 'First Aid Kit'],
      responder_ids: [],
      responder_roles: {},
    };

    // Team creation is an atomic RPC (create_team_with_resources), not a direct
    // table insert, to avoid the race conditions of a client-side read-modify-write.
    mockSupabase.rpc.mockResolvedValueOnce({ data: { team_id: 'new-team-id', ...teamPayload }, error: null });

    await act(async () => {
      await result.current.createTeam(teamPayload);
    });

    // p_equipment must be the raw array: the RPC parameter is JSONB (matching
    // teams.equipment), so it must not be JSON.stringify'd into a bracket-string.
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_team_with_resources',
      expect.objectContaining({
        p_equipment: teamPayload.equipment,
      })
    );
    expect(defaultProps.recordAction).toHaveBeenCalled();
    expect(defaultProps.fetchDashboardData).toHaveBeenCalled();
  });

  it('sends the equipment array as-is (not stringified) for the direct teams table update', async () => {
    const { result } = renderHook(() => useTeamActions(defaultProps));

    const teamId = 't1';
    const updates = {
      team_name_number: 'Updated Team Name',
      equipment: ['Map', 'Compass'],
      responder_ids: [],
      leader_responder_id: 'res-leader',
    };

    // Mock the initial fetch for original team state. This is crucial for the
    // reconciliation logic inside updateTeam to work without crashing.
    mockTableChains.teams.single.mockResolvedValueOnce({
      data: {
        team_name_number: 'Original Team',
        current_responders: [], // Must be an array to prevent .map() error
        current_vehicles: [],   // Must be an array to prevent .map() error
      },
      error: null,
    });
    // Membership/vehicle reconciliation is a separate atomic RPC.
    mockSupabase.rpc.mockResolvedValueOnce({ error: null });

    await act(async () => {
      // Pass a copy of updates to prevent mutation of the original object
      // allowing the assertion below to correctly stringify the original array for comparison.
      await result.current.updateTeam(teamId, { ...updates });
    });

    // Unlike creation, the core team update goes through a direct REST update
    // to the teams table. equipment is JSONB, so it must be sent as a real
    // array — JSON.stringify-ing it here would double-encode it into a JSON
    // string scalar instead of an array, breaking every consumer that calls
    // .join()/.map() on team.equipment.
    expect(mockTableChains.teams.update).toHaveBeenCalledWith(
      expect.objectContaining({
        equipment: updates.equipment,
      })
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'reconcile_team_resources',
      expect.objectContaining({ p_team_id: teamId })
    );
    expect(defaultProps.recordAction).toHaveBeenCalled();
    expect(defaultProps.fetchDashboardData).toHaveBeenCalled();
  });
});
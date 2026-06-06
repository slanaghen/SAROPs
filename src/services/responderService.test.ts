/** @vitest-environment node */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  assignResponderToTeam,
  bulkUpdateResponderStatus,
  checkInResponder,
  checkOutResponder,
  getCheckedInResponders,
  getResponder,
  getResponderByIdentifier,
  getResponderCurrentTeam,
  getResponderStats,
  getResponderTeamHistory,
  getRespondersByAgency,
  getRespondersByDeviceId,
  getRespondersByStatus,
  getTeamResponders,
  searchResponders,
  updateResponderStatus
} from './responderService';

describe('Responder Service Unit Tests', () => {
  // Requirement: Use the global createSupabaseQueryMock for consistency.
  // We attach a 'from' method to the mock to satisfy service function calls.
  const createMockSupabase = (data: any = null, error: any = null) => {
    const mock = globalThis.createSupabaseQueryMock(data, error);
    (mock as any).from = vi.fn().mockReturnValue(mock);
    return mock as any;
  };

  it('updateResponderStatus should call update with correct access level', async () => {
    const mockSupabase = createMockSupabase([{ responder_id: 'r1' }]);
    await updateResponderStatus(mockSupabase, 'r1', 'Assigned', 'command staff');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.update).toHaveBeenCalledWith({ 
      status: 'Assigned', 
      access_level: 'command staff' 
    });
  });

  it('assignResponderToTeam should perform three distinct operations', async () => {
    const mockSupabase = createMockSupabase([]);

    await assignResponderToTeam(mockSupabase, 'res-1', 'team-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.from).toHaveBeenCalledWith('responder_team_history');
    
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'Attached' });
  });

  it('getResponderStats should aggregate counts from multiple queries', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (cb: any) => {
          let data: any[] = [];
          // Simulate different result lengths for different stats
          if (table === 'responders') data = Array(10).fill({}); 
          return Promise.resolve({ data, error: null }).then(cb);
        }
      }))
    } as any;

    const stats = await getResponderStats(mockSupabase);
    
    expect(stats.total).toBe(10);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
  });

  it('handles database errors gracefully', async () => {
    const mockSupabase = createMockSupabase(null, { message: 'DB Error' });
    
    await expect(updateResponderStatus(mockSupabase, 'r1', 'Staged'))
      .rejects.toThrow('Failed to update responder status: DB Error');
  });

  it('getResponderCurrentTeam should fetch membership with team details via inner join', async () => {
    const mockMembership = {
      team_id: 't1',
      teams: { team_id: 't1', team_name_number: 'Alpha', status: 'Assigned' }
    };
    const mockSupabase = createMockSupabase(mockMembership);
    
    const result = await getResponderCurrentTeam(mockSupabase, 'r1');

    expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
    // Verify the inner join syntax is correct
    expect(mockSupabase.select).toHaveBeenCalledWith('*, teams!inner(*)');
    expect(result).toEqual(mockMembership);
  });

  it('checkOutResponder should set CheckedOut status and current ISO timestamp', async () => {
    const mockSupabase = createMockSupabase([{ responder_id: 'r1' }]);
    const result = await checkOutResponder(mockSupabase, 'r1');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'CheckedOut',
      checkout_datetime: expect.any(String)
    }));
    
    // Verify the date is valid ISO
    const date = new Date(vi.mocked(mockSupabase.update).mock.calls[0][0].checkout_datetime);
    expect(date.getTime()).not.toBeNaN();
    expect(result.responder_id).toBe('r1');
  });

  it('getResponderTeamHistory should return a list of previous assignments', async () => {
    const mockHistory = [
      { history_id: 'h1', team_id: 't1', teams: { team_name_number: 'Alpha', type: 'Ground' } }
    ];
    const mockSupabase = createMockSupabase(mockHistory);
    
    const result = await getResponderTeamHistory(mockSupabase, 'r1');

    expect(mockSupabase.from).toHaveBeenCalledWith('responder_team_history');
    expect(mockSupabase.select).toHaveBeenCalledWith('*, teams(team_name_number, type)');
    expect(result).toEqual(mockHistory);
  });

  it('checkInResponder should insert a new record and return it', async () => {
    const mockRes: any = { name: 'Test', incident_id: 'i1' };
    const mockSupabase = createMockSupabase([mockRes]);
    const result = await checkInResponder(mockSupabase, mockRes);

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.insert).toHaveBeenCalledWith([mockRes]);
    expect(result).toEqual(mockRes);
  });

  it('searchResponders should use ilike or filters for name and identifier', async () => {
    const mockSupabase = createMockSupabase([]);
    await searchResponders(mockSupabase, 'K9');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.or).toHaveBeenCalledWith(expect.stringContaining('name.ilike.%K9%'));
  });

  it('bulkUpdateResponderStatus should update multiple IDs using the "in" operator', async () => {
    const mockSupabase = createMockSupabase([]);

    await bulkUpdateResponderStatus(mockSupabase, ['r1', 'r2'], 'Deployed');
    expect(mockSupabase.in).toHaveBeenCalledWith('responder_id', ['r1', 'r2']);
  });

  it('getResponder should return a single responder by ID', async () => {
    const mockRes = { responder_id: 'r1', name: 'Steve' };
    const mockSupabase = createMockSupabase(mockRes);
    const result = await getResponder(mockSupabase, 'r1');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.eq).toHaveBeenCalledWith('responder_id', 'r1');
    expect(result).toEqual(mockRes);
  });

  it('getResponderByIdentifier should return a single responder by identifier', async () => {
    const mockRes = { responder_id: 'r1', identifier: 'K9-1' };
    const mockSupabase = createMockSupabase(mockRes);
    const result = await getResponderByIdentifier(mockSupabase, 'K9-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.eq).toHaveBeenCalledWith('identifier', 'K9-1');
    expect(result).toEqual(mockRes);
  });

  it('getCheckedInResponders should filter by null checkout_datetime', async () => {
    const mockSupabase = createMockSupabase([]);
    await getCheckedInResponders(mockSupabase);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.is).toHaveBeenCalledWith('checkout_datetime', null);
  });

  it('getRespondersByStatus should filter by status', async () => {
    const mockSupabase = createMockSupabase([]);
    await getRespondersByStatus(mockSupabase, 'Deployed');
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'Deployed');
  });

  it('getTeamResponders should perform a join and map results correctly', async () => {
    const mockData = [{ responders: { responder_id: 'r1', name: 'Steve' } }];
    const mockSupabase = createMockSupabase(mockData);
    const result = await getTeamResponders(mockSupabase, 't1');

    expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
    expect(mockSupabase.select).toHaveBeenCalledWith('responders(*)');
    expect(result[0].name).toBe('Steve');
  });

  it('getRespondersByAgency should filter by agency name', async () => {
    const mockSupabase = createMockSupabase([]);
    await getRespondersByAgency(mockSupabase, 'Mountain Rescue');
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.eq).toHaveBeenCalledWith('agency', 'Mountain Rescue');
  });

  it('getRespondersByDeviceId should return a single responder by device ID', async () => {
    const mockRes = { responder_id: 'r1', device_id: 'dev_123' };
    const mockSupabase = createMockSupabase(mockRes);
    const result = await getRespondersByDeviceId(mockSupabase, 'dev_123');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.eq).toHaveBeenCalledWith('device_id', 'dev_123');
    expect(result).toEqual(mockRes);
  });
});
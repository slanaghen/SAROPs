import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  updateResponderStatus, 
  assignResponderToTeam, 
  getResponderStats 
} from '../services/responderService';

describe('Responder Service Unit Tests', () => {
  const createMockSupabase = (data: any = null, error: any = null) => {
    const query = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error }),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
      then: (cb: any) => Promise.resolve({ data, error }).then(cb)
    };
    return query as any;
  };

  it('updateResponderStatus should call update with correct access level', async () => {
    const mockSupabase = createMockSupabase({ responder_id: 'r1' });
    await updateResponderStatus(mockSupabase, 'r1', 'Assigned', 'command staff');

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.update).toHaveBeenCalledWith({ 
      status: 'Assigned', 
      access_level: 'command staff' 
    });
  });

  it('assignResponderToTeam should perform three distinct operations', async () => {
    const mockSupabase = createMockSupabase({});
    // Mock insert specifically for this chain
    mockSupabase.insert = vi.fn().mockReturnThis();
    
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
});
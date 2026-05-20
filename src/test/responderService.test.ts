import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';

const mockSupabase = {
  from: vi.fn(),
};

const createMockChain = (data = null, error = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
});

describe('responderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assignResponderToTeam', () => {
    it('should add a responder to a team and update their status to Attached', async () => {
      const chain = createMockChain({ responder_id: 'r1' });
      mockSupabase.from.mockReturnValue(chain);

      await assignResponderToTeam(mockSupabase as any, 'r1', 't1');

      // Check junction table insert
      expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
      expect(chain.insert).toHaveBeenCalledWith({ team_id: 't1', responder_id: 'r1' });

      // Check status update
      expect(mockSupabase.from).toHaveBeenCalledWith('responders');
      expect(chain.update).toHaveBeenCalledWith({ status: 'Attached' });

      // Check history logging
      expect(mockSupabase.from).toHaveBeenCalledWith('responder_team_history');
      expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        responder_id: 'r1',
        team_id: 't1'
      }));
    });
  });

  describe('removeResponderFromTeam', () => {
    it('should remove responder association and close the history log entry', async () => {
      const mockHistory = { history_id: 'h1', attached_datetime: 'some-date' };
      const chain = createMockChain(mockHistory);
      mockSupabase.from.mockReturnValue(chain);

      await removeResponderFromTeam(mockSupabase as any, 'r1', 't1');

      // 1. Check deletion from junction
      expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
      expect(chain.delete).toHaveBeenCalled();

      // 2. Check status reverted to Staged
      expect(mockSupabase.from).toHaveBeenCalledWith('responders');
      expect(chain.update).toHaveBeenCalledWith({ status: 'Staged' });

      // 3. Check history log closure
      expect(mockSupabase.from).toHaveBeenCalledWith('responder_team_history');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
        detached_datetime: expect.any(String)
      }));
    });
  });
});
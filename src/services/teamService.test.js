import { vi, describe, it, expect, beforeEach } from 'vitest';
import { prepareTeamForEditing, disbandTeam } from './teamService';
import { TEAM_STATUS } from '../constants/operationalConstants';

describe('Team Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareTeamForEditing', () => {
    it('should throw an error if no team is provided', async () => {
      await expect(prepareTeamForEditing(mockSupabase, null)).rejects.toThrow(
        'A valid team object with a team_id must be provided.'
      );
    });

    it('should fetch members and vehicles and attach them to the team object', async () => {
      const initialTeam = { team_id: 't1', team_name_number: 'Alpha' };
      const mockMembers = [
        { responder_id: 'r1', role: 'Leader' },
        { responder_id: 'r2', role: 'Member' },
      ];
      const mockVehicles = [{ vehicle_id: 'v1' }];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'team_responders') {
          return {
            ...mockSupabase,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
          };
        }
        if (table === 'vehicles') {
          return {
            ...mockSupabase,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockVehicles, error: null }),
          };
        }
        return mockSupabase;
      });

      const result = await prepareTeamForEditing(mockSupabase, initialTeam);

      expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(result).toEqual({
        ...initialTeam,
        responder_ids: ['r1', 'r2'],
        responder_roles: { r1: 'Leader', r2: 'Member' },
        vehicle_ids: ['v1'],
      });
    });

    it('should handle empty members and vehicles correctly', async () => {
      const initialTeam = { team_id: 't2', team_name_number: 'Bravo' };

      mockSupabase.from.mockImplementation((table) => ({
        ...mockSupabase,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const result = await prepareTeamForEditing(mockSupabase, initialTeam);

      expect(result).toEqual({
        ...initialTeam,
        responder_ids: [],
        responder_roles: {},
        vehicle_ids: [],
      });
    });
  });

  describe('disbandTeam', () => {
    const mockAddToast = vi.fn();
    const mockRecordAction = vi.fn();
    const mockRefreshDashboardData = vi.fn();

    it('should update team status to Disbanded and trigger unassignment of assignments', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await disbandTeam({
        supabase: mockSupabase,
        teamId: 't-disband',
        teamName: 'Disband Team',
        teamType: 'Ground',
        recordAction: mockRecordAction,
        addToast: mockAddToast,
        refreshDashboardData: mockRefreshDashboardData,
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: TEAM_STATUS.DISBANDED, last_par_check: null });
      expect(mockEq).toHaveBeenCalledWith('team_id', 't-disband');
      expect(mockRecordAction).toHaveBeenCalledWith(expect.stringContaining('Admin disbanded team "Disband Team"'));
      expect(mockAddToast).toHaveBeenCalledWith('Team disbanded.', 'success');
      expect(mockRefreshDashboardData).toHaveBeenCalled();
    });
  });
});
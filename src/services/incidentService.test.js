import { vi, describe, it, expect, beforeEach } from 'vitest';
import { endIncidentAndCleanup, deleteIncident } from './incidentService';
import { ASSIGNMENT_STATUS } from '../utils/constants';

describe('Incident Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  const mockAddToast = vi.fn();
  const mockNavigate = vi.fn();
  const mockEndIncident = vi.fn();
  const mockLogout = vi.fn();
  const mockRefreshDashboardData = vi.fn();
  const mockRecordAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true); // Auto-confirm prompts
  });

  describe('endIncidentAndCleanup', () => {
    it('should end an incident with no active resources without confirmation', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments' || table === 'responders') {
          return {
            ...mockSupabase,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return mockSupabase;
      });
      mockSupabase.update.mockResolvedValue({ error: null });

      await endIncidentAndCleanup({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        responderName: 'Admin',
        endIncident: mockEndIncident,
        addToast: mockAddToast,
        navigate: mockNavigate,
        currentIncidentId: 'inc-1',
      });

      expect(window.confirm).not.toHaveBeenCalled();
      expect(mockSupabase.update).toHaveBeenCalledWith({ end_datetime: expect.any(String) });
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ action: expect.stringContaining('Incident ended') }));
      expect(mockEndIncident).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith('Incident ended and resources cleaned up.', 'success');
      expect(mockNavigate).toHaveBeenCalledWith('/checkin');
    });

    it('should prompt for confirmation when active resources exist', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') {
          return {
            ...mockSupabase,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ status: ASSIGNMENT_STATUS.DEPLOYED }], error: null }),
          };
        }
        if (table === 'responders') {
          return {
            ...mockSupabase,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [{ responder_id: 'r-1' }], error: null }),
          };
        }
        return mockSupabase;
      });
      mockSupabase.update.mockResolvedValue({ error: null });

      await endIncidentAndCleanup({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        endIncident: mockEndIncident,
        addToast: mockAddToast,
        navigate: mockNavigate,
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('1 active assignments and 1 responders still checked in'));
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should not proceed if user cancels confirmation', async () => {
      window.confirm.mockReturnValue(false);
      mockSupabase.from.mockImplementation((table) => ({
        ...mockSupabase,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [{ status: ASSIGNMENT_STATUS.DEPLOYED }], error: null }),
        is: vi.fn().mockResolvedValue({ data: [{ responder_id: 'r-1' }], error: null }),
      }));

      await endIncidentAndCleanup({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        opPeriodId: 'op-1',
        endIncident: mockEndIncident,
        addToast: mockAddToast,
        navigate: mockNavigate,
      });

      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(mockEndIncident).not.toHaveBeenCalled();
    });
  });

  describe('deleteIncident', () => {
    it('should delete an incident and call logout if it was the active session', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });

      await deleteIncident({
        supabase: mockSupabase,
        incidentId: 'inc-1',
        incidentName: 'Test Incident',
        recordAction: mockRecordAction,
        logout: mockLogout,
        addToast: mockAddToast,
        currentIncidentId: 'inc-1',
        refreshDashboardData: mockRefreshDashboardData,
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Permanently delete this incident?'));
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('incident_id', 'inc-1');
      expect(mockRecordAction).toHaveBeenCalledWith(expect.stringContaining('Admin initiated permanent deletion'));
      expect(mockLogout).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith('Incident and all associated data deleted.', 'success');
      expect(mockRefreshDashboardData).toHaveBeenCalled();
    });

    it('should not call logout if deleting an inactive incident', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });

      await deleteIncident({
        supabase: mockSupabase,
        incidentId: 'inc-2',
        incidentName: 'Old Incident',
        recordAction: mockRecordAction,
        logout: mockLogout,
        addToast: mockAddToast,
        currentIncidentId: 'inc-1', // A different active incident
      });

      expect(mockLogout).not.toHaveBeenCalled();
    });
  });
});
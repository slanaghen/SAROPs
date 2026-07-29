import { vi, describe, it, expect, beforeEach } from 'vitest';
import { saveAssignment, deleteAssignment, completeAssignment, deployAssignment } from './assignmentService';
import { ASSIGNMENT_STATUS, RESPONDER_STATUS, TEAM_STATUS } from '../utils/constants';

describe('Assignment Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  const mockAddToast = vi.fn();
  const mockRecordAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  describe('saveAssignment', () => {
    it('should auto-generate a title for a new assignment if title is blank', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ data: [{ title: 'AA' }], error: null }); // Simulate 'AA' is taken
      const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
      const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') {
          return {
            select: mockSelect,
            insert: mockInsert,
          };
        }
        return mockSupabase;
      });

      await saveAssignment({
        supabase: mockSupabase,
        formData: { segment: 'A', title: ' ' }, // Blank title
        opPeriodId: 'op-1',
        addToast: mockAddToast,
      });

      expect(mockEq1).toHaveBeenCalledWith('op_period_id', 'op-1');
      expect(mockEq2).toHaveBeenCalledWith('segment', 'A');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'AB' }) // Should generate the next available suffix
      );
      expect(mockAddToast).toHaveBeenCalledWith('Assignment AB created.', 'success');
    });

    it('should call updateAssignmentHook when editing an existing assignment', async () => {
      const mockUpdateHook = vi.fn();
      const formData = { assignment_id: 'a-1', title: 'Updated Task' };

      await saveAssignment({
        supabase: mockSupabase,
        formData,
        addToast: mockAddToast,
        updateAssignmentHook: mockUpdateHook,
      });

      expect(mockUpdateHook).toHaveBeenCalledWith('a-1', expect.objectContaining({ title: 'Updated Task' }));
      expect(mockSupabase.update).not.toHaveBeenCalled(); // Hook should be used instead of direct call
      expect(mockAddToast).toHaveBeenCalledWith('Assignment Updated Task updated successfully.', 'success');
    });

    it('should call createAssignmentHook for a new assignment', async () => {
      const mockCreateHook = vi.fn();
      const formData = { title: 'New Task From Hook' };

      await saveAssignment({
        supabase: mockSupabase,
        formData,
        opPeriodId: 'op-1',
        addToast: mockAddToast,
        createAssignmentHook: mockCreateHook,
      });

      expect(mockCreateHook).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Task From Hook' }));
      expect(mockSupabase.insert).not.toHaveBeenCalled(); // Hook should be used
    });
  });

  describe('deleteAssignment', () => {
    it('should delete an assignment after confirmation', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') return { delete: mockDelete };
        return mockSupabase;
      });

      await deleteAssignment({
        supabase: mockSupabase,
        assignmentId: 'a-1',
        assignmentName: 'Task To Delete',
        recordAction: mockRecordAction,
        addToast: mockAddToast,
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete assignment "Task To Delete"'));
      expect(mockSupabase.from).toHaveBeenCalledWith('assignments');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('assignment_id', 'a-1');
      expect(mockRecordAction).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith('Assignment record deleted.', 'success');
    });
  });

  describe('completeAssignment', () => {
    it('should update statuses and call context setters', async () => {
      const mockSetResponderStatus = vi.fn();
      const mockSetCurrentTeamStatus = vi.fn();
      const mockSetCurrentAssignmentStatus = vi.fn();
      const mockSelect = vi.fn().mockResolvedValue({ data: [{ assignment_id: 'a-1' }], error: null });
      const mockEq = vi.fn(() => ({ select: mockSelect }));
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') return { update: mockUpdate };
        return mockSupabase;
      });

      await completeAssignment({
        supabase: mockSupabase,
        assignmentId: 'a-1',
        teamId: 't-1',
        podValue: '80',
        debriefValue: 'Area cleared.',
        addToast: mockAddToast,
        setResponderStatus: mockSetResponderStatus,
        setCurrentTeamStatus: mockSetCurrentTeamStatus,
        setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: ASSIGNMENT_STATUS.COMPLETED,
        probability_of_detection: 80,
        debrief_narrative: 'Area cleared.',
      });
      expect(mockEq).toHaveBeenCalledWith('assignment_id', 'a-1');
      expect(mockSetResponderStatus).toHaveBeenCalledWith(RESPONDER_STATUS.STAGED);
      expect(mockSetCurrentTeamStatus).toHaveBeenCalledWith(null);
      expect(mockSetCurrentAssignmentStatus).toHaveBeenCalledWith(null);
      expect(mockAddToast).toHaveBeenCalledWith('Assignment completed successfully.', 'success');
    });
  });

  describe('deployAssignment', () => {
    it('should update statuses and call context setters on deploy', async () => {
      const mockSetResponderStatus = vi.fn();
      const mockSetCurrentTeamStatus = vi.fn();
      const mockSetCurrentAssignmentStatus = vi.fn();
      const mockSelect = vi.fn().mockResolvedValue({ data: [{ assignment_id: 'a-1' }], error: null });
      const mockEq = vi.fn(() => ({ select: mockSelect }));
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'assignments') return { update: mockUpdate };
        return mockSupabase;
      });

      await deployAssignment({
        supabase: mockSupabase,
        assignmentId: 'a-1',
        teamId: 't-1',
        addToast: mockAddToast,
        setResponderStatus: mockSetResponderStatus,
        setCurrentTeamStatus: mockSetCurrentTeamStatus,
        setCurrentAssignmentStatus: mockSetCurrentAssignmentStatus,
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: ASSIGNMENT_STATUS.DEPLOYED });
      expect(mockEq).toHaveBeenCalledWith('assignment_id', 'a-1');
      expect(mockSetResponderStatus).toHaveBeenCalledWith(RESPONDER_STATUS.DEPLOYED);
      expect(mockSetCurrentTeamStatus).toHaveBeenCalledWith(TEAM_STATUS.DEPLOYED);
      expect(mockSetCurrentAssignmentStatus).toHaveBeenCalledWith(ASSIGNMENT_STATUS.DEPLOYED);
      expect(mockAddToast).toHaveBeenCalledWith('Assignment deployed successfully.', 'success');
    });
  });
});
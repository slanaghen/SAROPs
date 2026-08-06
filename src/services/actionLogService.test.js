import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as actionLogService from './actionLogService';

describe('Action Log Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should insert a new action log with the correct data', async () => {
    mockSupabase.insert.mockResolvedValue({ error: null });

    const params = {
      supabase: mockSupabase,
      incidentId: 'inc-123',
      action: 'User logged in.',
      userName: 'testuser',
    };

    await actionLogService.recordAction(params);

    expect(mockSupabase.from).toHaveBeenCalledWith('action_logs');
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      incident_id: 'inc-123',
      action: 'User logged in.',
      user_name: 'testuser',
    });
  });

  it('should not throw an error if the database insert fails', async () => {
    const dbError = new Error('Insert failed');
    mockSupabase.insert.mockResolvedValue({ error: dbError });
    console.error = vi.fn(); // Suppress console.error output in test results

    const params = {
      supabase: mockSupabase,
      incidentId: 'inc-123',
      action: 'This will fail.',
      userName: 'testuser',
    };

    // We expect the function to complete without throwing
    await expect(actionLogService.recordAction(params)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith('Failed to record action log:', dbError);
  });

  it('should not call insert if required parameters are missing', async () => {
    await actionLogService.recordAction({ supabase: mockSupabase, action: 'test' }); // Missing incidentId and userName
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should not call insert if the action parameter is missing or empty', async () => {
    // Test with empty string
    await actionLogService.recordAction({ supabase: mockSupabase, incidentId: 'inc-123', userName: 'testuser', action: '' });
    // Test with missing property
    await actionLogService.recordAction({ supabase: mockSupabase, incidentId: 'inc-123', userName: 'testuser' });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should not call insert if userName is an empty string', async () => {
    await actionLogService.recordAction({
      supabase: mockSupabase,
      incidentId: 'inc-123',
      userName: '', // Empty string for userName
      action: 'A valid action'
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should not call insert if incidentId is an empty string', async () => {
    await actionLogService.recordAction({
      supabase: mockSupabase,
      incidentId: '', // Empty string for incidentId
      userName: 'testuser',
      action: 'A valid action'
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
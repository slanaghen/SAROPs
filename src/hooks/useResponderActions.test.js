import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useResponderActions } from './useResponderActions';

describe('useResponderActions Hook', () => {
  const mockChain = globalThis.createSupabaseQueryMock({ responder_id: 'r1', name: 'Steve' });
  const mockSupabase = {
    from: vi.fn(() => mockChain)
  };

  const defaultProps = {
    supabaseClient: mockSupabase,
    recordAction: vi.fn(),
    fetchDashboardData: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates responder details successfully', async () => {
    const { result } = renderHook(() => useResponderActions(defaultProps));
    const updates = { name: 'Steve Updated' };

    await act(async () => {
      await result.current.updateResponder('r1', updates);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockChain.update).toHaveBeenCalledWith(updates);
    expect(defaultProps.recordAction).toHaveBeenCalled();
  });

  it('performs full checkout procedure for a responder', async () => {
    const { result } = renderHook(() => useResponderActions(defaultProps));

    await act(async () => {
      await result.current.checkOutResponder('r1', 'Steve');
    });

    // Verify complex checkout flow: delete team memberships -> clear leadership -> update status
    expect(mockSupabase.from).toHaveBeenCalledWith('team_responders');
    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'CheckedOut' }));
  });
});
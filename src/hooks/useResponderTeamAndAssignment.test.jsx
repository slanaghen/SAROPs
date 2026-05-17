import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import useResponderTeamAndAssignment from './useResponderTeamAndAssignment';

describe('useResponderTeamAndAssignment Hook', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to mock Supabase "thenable" query chain
  const mockQuery = (data, error = null) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled),
  });

  it('starts in a loading state', () => {
    const hangingPromise = new Promise(() => {});
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(hangingPromise),
      maybeSingle: vi.fn().mockReturnValue(hangingPromise), // Hangs to keep loading true
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-123'));
    expect(result.current.loading).toBe(true);
  });

  it('successfully fetches team and assignment for a responder', async () => {
    const mockTeam = { team_id: 't-1', team_name_number: 'Team Alpha' };
    const mockAssignment = { assignment_id: 'a-1', name: 'Division A', team_id: 't-1' };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'team_responders') return mockQuery({ 
        team_id: 't-1', 
        teams: mockTeam // The hook expects team details nested under 'teams' from the join
      });
      if (table === 'assignments') return mockQuery(mockAssignment);
      return mockQuery(null);
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.team).toEqual(mockTeam);
      expect(result.current.assignment).toEqual(mockAssignment);
      expect(result.current.error).toBeNull();
    });
  });

  it('handles errors gracefully if membership fetch fails', async () => {
    mockSupabase.from.mockReturnValue(mockQuery(null, { message: 'Database error' }));

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Database error');
    });
  });

  it('handles case where responder is not in a team', async () => {
    mockSupabase.from.mockImplementation((table) => {
        if (table === 'team_responders') return mockQuery(null); // No membership found
        return mockQuery(null);
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-123'));

    await waitFor(() => {
      expect(result.current.team).toBeNull();
      expect(result.current.assignment).toBeNull();
    });
  });
});
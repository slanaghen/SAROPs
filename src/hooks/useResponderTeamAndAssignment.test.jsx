import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';

describe('useResponderTeamAndAssignment Hook', () => {
  const mockSupabase = {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-establish mock implementations inside beforeEach to prevent leakage 
    // or environment reset issues.
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  // Use the global helper for consistent Supabase Query Mocks
  const mockQuery = (data, error = null) => globalThis.createSupabaseQueryMock(data, error);

  it('starts in a loading state', () => {
    // Mock a hanging promise to ensure loading stays true
    const hangingQuery = {
      ...mockQuery([]),
      maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})),
      then: vi.fn().mockReturnValue(new Promise(() => {}))
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue(hangingQuery),
      then: vi.fn().mockReturnValue(hangingQuery)
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-loading'));
    expect(result.current.loading).toBe(true);
  });

  it('successfully fetches team and assignment for a responder', async () => {
    const mockAssignment = { assignment_id: 'a-1', title: 'Division A', team_id: 't-1', segment: 'A' };
    const mockTeam = { 
      team_id: 't-1', 
      team_name_number: 'Team Alpha', 
      status: 'Assigned',
      assignments: [mockAssignment] 
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'responders') return mockQuery({ status: 'Assigned', access_level: 'responder' });
      if (table === 'team_responders') return mockQuery({ 
        team_id: 't-1', 
        teams: mockTeam // The hook expects team details nested under 'teams' from the join
      });
      return mockQuery(null);
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-success'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.team).toEqual(mockTeam);
      expect(result.current.assignment).toEqual(mockAssignment);
      expect(result.current.error).toBeNull();
    });
  });

  it('handles errors gracefully if membership fetch fails', async () => {
    mockSupabase.from.mockReturnValue(mockQuery(null, { message: 'Database error' }));

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-error'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Database error');
    });
  });

  it('handles case where responder is not in a team', async () => {
    mockSupabase.from.mockImplementation((table) => {
        if (table === 'responders') return mockQuery({ status: 'Staged' });
        if (table === 'team_responders') return mockQuery(null);
        return mockQuery(null);
    });

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, 'res-none'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.team).toBeNull();
      expect(result.current.assignment).toBeNull();
    });
  });
});
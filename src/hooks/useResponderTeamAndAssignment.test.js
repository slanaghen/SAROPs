import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import useResponderTeamAndAssignment from './useResponderTeamAndAssignment';

describe('useResponderTeamAndAssignment Hook', () => {
  const mockResponderId = 'res-123';
  
  const createMockSupabase = (responderData, membershipData) => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    return {
      from: vi.fn((table) => {
        // Handle multiple table fetches within the same hook call
        if (table === 'responders') return globalThis.createSupabaseQueryMock(responderData);
        if (table === 'team_responders') return globalThis.createSupabaseQueryMock(membershipData);
        return globalThis.createSupabaseQueryMock(null);
      }),
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn()
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully joins team and assignment data for a responder', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha' };
    const mockAsn = { assignment_id: 'a1', title: 'Search Area 1' };
    // The refactored hook expects assignments to be nested under teams from the join
    mockTeam.assignments = [mockAsn];
    
    // Mock team_responders join return
    const teamResponderEntry = { teams: mockTeam };
    const responderRecord = { status: 'Assigned', access_level: 'responder' };
    
    const mockSupabase = createMockSupabase(responderRecord, teamResponderEntry);
    
    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, mockResponderId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.team).toEqual(mockTeam);
    expect(result.current.assignment).toEqual(mockAsn);
    expect(result.current.error).toBeNull();
  });

  it('handles responders who are not currently on a team', async () => {
    const mockSupabase = createMockSupabase({ status: 'Staged' }, null);

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, mockResponderId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.team).toBeNull();
    expect(result.current.assignment).toBeNull();
  });
});
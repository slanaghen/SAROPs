import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useResponderTeamAndAssignment } from './useResponderTeamAndAssignment';

describe('useResponderTeamAndAssignment Hook', () => {
  const mockResponderId = 'res-123';
  
  const createMockSupabase = (teamData, assignmentData) => ({
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: teamData, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: assignmentData, error: null }),
    }))
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully joins team and assignment data for a responder', async () => {
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha' };
    const mockAsn = { assignment_id: 'a1', title: 'Search Area 1' };
    
    // Mock team_responders join return
    const teamResponderEntry = { teams: mockTeam };
    
    const mockSupabase = createMockSupabase(teamResponderEntry, mockAsn);
    
    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, mockResponderId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.team).toEqual(mockTeam);
    expect(result.current.assignment).toEqual(mockAsn);
    expect(result.current.error).toBeNull();
  });

  it('handles responders who are not currently on a team', async () => {
    // Mock team_responders returning no rows (PGRST116 handled in hook)
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }))
    };

    const { result } = renderHook(() => useResponderTeamAndAssignment(mockSupabase, mockResponderId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.team).toBeNull();
    expect(result.current.assignment).toBeNull();
  });
});
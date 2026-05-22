import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useIncidentStats } from './useIncidentStats';

describe('useIncidentStats Hook', () => {
  it('correctly calculates counts for various resource statuses', () => {
    const mockTeams = [
      { status: 'Staged' },
      { status: 'Assigned' },
      { status: 'Deployed' }
    ];
    const mockAssignments = [
      { status: 'Planned' },
      { status: 'Assigned' },
      { status: 'Deployed' },
      { status: 'Completed' },
      { status: 'Incomplete' }
    ];
    const mockResponders = [
      { status: 'Staged' },
      { status: 'Attached' },
      { status: 'Assigned' },
      { status: 'Deployed' }
    ];

    const { result } = renderHook(() => useIncidentStats(mockTeams, mockAssignments, mockResponders));

    expect(result.current.teams.total).toBe(3);
    expect(result.current.teams.staged).toBe(1);
    
    expect(result.current.assignments.total).toBe(5);
    expect(result.current.assignments.complete).toBe(1);
    expect(result.current.assignments.incomplete).toBe(1);

    expect(result.current.responders.total).toBe(4);
    expect(result.current.responders.deployed).toBe(1);
  });

  it('handles empty data gracefully', () => {
    const { result } = renderHook(() => useIncidentStats([], [], []));
    expect(result.current.teams.total).toBe(0);
    expect(result.current.assignments.total).toBe(0);
    expect(result.current.responders.total).toBe(0);
  });
});
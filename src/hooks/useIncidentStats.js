import { useMemo } from 'react';

/**
 * useIncidentStats Hook
 * Specifically for the memoized stats used in dashboard footers.
 */
export const useIncidentStats = (teams, assignments, responders) => {
  return useMemo(() => ({
    teams: {
      staged: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Staged').length,
      assigned: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Assigned').length,
      deployed: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Deployed').length,
      total: (Array.isArray(teams) ? teams : []).length,
    },
    assignments: {
      planned: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Planned').length,
      assigned: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Assigned').length,
      deployed: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Deployed').length,
      complete: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Completed').length,
      incomplete: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Incomplete').length,
      total: (Array.isArray(assignments) ? assignments : []).length,
    },
    responders: {
      staged: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Staged').length,
      attached: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Attached').length,
      assigned: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Assigned').length,
      deployed: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Deployed').length,
      total: (Array.isArray(responders) ? responders : []).length,
    }
  }), [assignments, teams, responders]);
};
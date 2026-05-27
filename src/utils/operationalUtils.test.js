import { describe, it, expect } from 'vitest';
import { checkIsParOverdue, formatTimeSince } from './operationalUtils.js';

describe('operationalUtils', () => {
  describe('checkIsParOverdue', () => {
    const currentTime = new Date('2026-05-27T10:00:00Z').getTime();

    it('returns false if interval is 0 or team is exempt (Staged/Staff)', () => {
      const team = { status: 'Staged', type: 'Ground', last_par_check: '2026-05-27T08:00:00Z' };
      expect(checkIsParOverdue(team, 60, currentTime)).toBe(false);

      const staffTeam = { status: 'Deployed', type: 'Staff', last_par_check: '2026-05-27T08:00:00Z' };
      expect(checkIsParOverdue(staffTeam, 60, currentTime)).toBe(false);
    });

    it('returns true only after interval + 3 minute grace period', () => {
      const interval = 60;
      
      // 62 minutes ago - should be false (inside grace)
      const recentCheck = { 
        status: 'Deployed', type: 'Ground', 
        last_par_check: new Date(currentTime - 62 * 60000).toISOString() 
      };
      expect(checkIsParOverdue(recentCheck, interval, currentTime)).toBe(false);

      // 64 minutes ago - should be true (outside grace)
      const overdueCheck = { 
        status: 'Deployed', type: 'Ground', 
        last_par_check: new Date(currentTime - 64 * 60000).toISOString() 
      };
      expect(checkIsParOverdue(overdueCheck, interval, currentTime)).toBe(true);
    });

    it('handles 1-minute interval with 3-minute grace period correctly', () => {
      const interval = 1; // 1 minute interval

      // 3 minutes 59 seconds ago (inside grace: 1 + 3 = 4 minutes)
      const justBeforeOverdue = {
        status: 'Deployed', type: 'Ground',
        last_par_check: new Date(currentTime - (3 * 60 + 59) * 1000).toISOString()
      };
      expect(checkIsParOverdue(justBeforeOverdue, interval, currentTime)).toBe(false);

      // 4 minutes 1 second ago (outside grace)
      const clearlyOverdue = {
        status: 'Deployed', type: 'Ground',
        last_par_check: new Date(currentTime - (4 * 60 + 1) * 1000).toISOString()
      };
      expect(checkIsParOverdue(clearlyOverdue, interval, currentTime)).toBe(true);
    });

  });

  describe('formatTimeSince', () => {
    const currentTime = new Date('2026-05-27T10:00:00Z').getTime();

    it('returns "just now" for very recent timestamps', () => {
      const timestamp = new Date(currentTime - 30000).toISOString();
      expect(formatTimeSince(timestamp, null, currentTime)).toBe('just now');
    });

    it('formats minutes correctly', () => {
      const timestamp = new Date(currentTime - 15 * 60000).toISOString();
      expect(formatTimeSince(timestamp, null, currentTime)).toBe('15m ago');
    });

    it('formats hours and minutes correctly', () => {
      const timestamp = new Date(currentTime - (2 * 60 + 15) * 60000).toISOString();
      expect(formatTimeSince(timestamp, null, currentTime)).toBe('2h 15m ago');
    });
  });
});
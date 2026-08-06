/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { checkIsParOverdue, formatTimeSince, generateTeamName } from './operationalUtils.js';

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
      expect(formatTimeSince(timestamp, currentTime)).toBe('just now');
    });

    it('formats minutes correctly', () => {
      const timestamp = new Date(currentTime - 15 * 60000).toISOString();
      expect(formatTimeSince(timestamp, currentTime)).toBe('15m ago');
    });

    it('formats hours and minutes correctly', () => {
      const timestamp = new Date(currentTime - (2 * 60 + 15) * 60000).toISOString();
      expect(formatTimeSince(timestamp, currentTime)).toBe('2h 15m ago');
    });
  });

  describe('generateTeamName', () => {
    it('names the first team in an operational period {OP}01', () => {
      expect(generateTeamName(1, [])).toBe('101');
    });

    it('increments a single sequence shared across all team types', () => {
      const teams = [
        { team_name_number: '101', type: 'Ground' },
        { team_name_number: '102', type: 'Water' },
      ];
      expect(generateTeamName(1, teams)).toBe('103');
    });

    it('uses the operational period number as the leading digit(s)', () => {
      expect(generateTeamName(2, [])).toBe('201');
      const teams = [{ team_name_number: '201', type: 'Ground' }];
      expect(generateTeamName(2, teams)).toBe('202');
    });

    it('defaults to operational period 1 when no op number is provided', () => {
      expect(generateTeamName(undefined, [])).toBe('101');
    });

    it('skips over a collision to keep names unique even if the naive next number is taken', () => {
      // 3 teams -> naive next number is 4 ("104"), but a team already has that
      // name (e.g. manually assigned out of the normal sequence) -- must skip
      // to the next free one instead of colliding.
      const teams = [
        { team_name_number: '101', type: 'Ground' },
        { team_name_number: '102', type: 'Ground' },
        { team_name_number: '104', type: 'Ground' },
      ];
      expect(generateTeamName(1, teams)).toBe('105');
    });
  });
});
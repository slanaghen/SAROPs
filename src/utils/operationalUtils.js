/**
 * Checks if a PAR (Personnel Accountability Report) check is overdue for a team.
 * 
 * @param {Object} team - The team object containing status, type, and last_par_check.
 * @param {number} parIntervalMinutes - The global PAR interval in minutes.
 * @param {number} [now] - Optional current timestamp for testing.
 * @returns {boolean} - True if the PAR check is overdue.
 */
export const checkIsParOverdue = (team, parIntervalMinutes, now = Date.now()) => {
  // If no team is provided, or interval is 0, PAR is disabled/not applicable
  if (!team || !parIntervalMinutes || parIntervalMinutes <= 0) return false;

  // Staged teams and Staff teams are exempt from PAR checks
  if (team.status === 'Staged' || team.type === 'Staff' || team.status === 'Disbanded') {
    return false;
  }

  // Only Deployed or Assigned teams are tracked for PAR
  if (team.status !== 'Deployed' && team.status !== 'Assigned') return false;

  if (!team.last_par_check) return false;

  const lastCheck = new Date(team.last_par_check).getTime();
  const diffMinutes = (now - lastCheck) / 60000;

  // Overdue if it's past the interval plus a 3-minute grace period
  return diffMinutes > (parIntervalMinutes + 3);
};

/**
 * Formats a timestamp as a human-readable duration since it occurred.
 * 
 * @param {string|Date} timestamp - The ISO string or Date object.
 * @param {number} [now] - Optional current timestamp for testing.
 * @returns {string} - Formatted string (e.g., "15m ago", "2h 15m ago").
 */
export const formatTimeSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return 'never';
  
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  return `${hours}h ${minutes}m ago`;
};
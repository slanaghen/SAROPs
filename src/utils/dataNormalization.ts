/**
 * Maps legacy "Search" suffixed enums to current shortened versions.
 */
export const normalizeResourceTypeName = (type: string | undefined | null): string => {
  if (!type) return 'Ground';
  
  const legacyMapping: Record<string, string> = {
    'Ground Search': 'Ground',
    'Vehicle Search': 'Vehicle',
    'Water Search': 'Water',
    'Aerial Search': 'UAS'
  };

  return legacyMapping[type] || type;
};

/**
 * Normalizes the teams.equipment JSONB column into a string array.
 * Tolerates legacy rows where it was accidentally persisted as a JSON-encoded
 * string (e.g. '["Radio","GPS"]') instead of a real array.
 */
export const normalizeEquipmentList = (equipment: unknown): string[] => {
  if (Array.isArray(equipment)) return equipment;
  if (typeof equipment === 'string') {
    try {
      const parsed = JSON.parse(equipment);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON-encoded — nothing sensible to recover.
    }
  }
  return [];
};
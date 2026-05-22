/**
 * Maps legacy "Search" suffixed enums to current shortened versions.
 */
export const normalizeResourceTypeName = (type: string | undefined | null): string => {
  if (!type) return 'Ground';
  
  const legacyMapping: Record<string, string> = {
    'Ground Search': 'Ground',
    'Vehicle Search': 'Vehicle',
    'Water Search': 'Water',
    'Aerial Search': 'Aerial'
  };

  return legacyMapping[type] || type;
};
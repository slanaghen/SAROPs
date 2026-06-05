/**
 * GIS Utilities for SARTopo Integration
 * 
 * Provides mapping functions between SARTopo GeoJSON features and SAROps 
 * database assignments to ensure data consistency across platforms.
 */

/**
 * Maps a SARTopo GeoJSON feature to a SAROps Assignment database payload.
 * 
 * @param {Object} feature - GeoJSON feature from SARTopo
 * @param {string} opPeriodId - UUID of the operational period
 * @param {Object|null} existing - Existing assignment record if performing an update
 * @param {string|null} origin - Optional override for origin (defaults to SARTopo)
 * @returns {Object} Payload for Supabase upsert
 */
export const mapSartopoToAssignment = (feature, opPeriodId, existing = null, baseline = null, origin = 'SARTopo') => {
  const p = feature.properties || {};
  const b = baseline?.properties || {};

  // Helper to extract value using standard SARTopo aliases
  const getSartopoValue = (props, keys) => {
    const key = keys.find(k => Object.prototype.hasOwnProperty.call(props, k));
    return key ? props[key] : undefined;
  };

  /**
   * Logic: Merge property by property.
   * 1. If property changed in SARTopo (Incoming != Baseline): SARTopo wins.
   * 2. If property NOT changed in SARTopo: SAROps wins (keeping local modifications).
   * 3. If new assignment: SARTopo wins.
   */
  const resolve = (keys, saropsField, transform = (v) => v) => {
    const incoming = getSartopoValue(p, keys);
    const prev = getSartopoValue(b, keys);
    
    // Property changed in SARTopo if it's different from the baseline (or baseline is unknown)
    const changedInSartopo = incoming !== undefined && (prev === undefined || String(incoming) !== String(prev));

    if (!existing || changedInSartopo) {
      return transform(incoming !== undefined ? incoming : prev);
    }
    
    // If SARTopo didn't change it, respect the current SAROps value
    const current = existing[saropsField];
    return current !== undefined ? current : transform(incoming);
  };

  const transformPriority = (raw) => {
    if (raw === undefined || raw === null) return null;
    const pStr = String(raw).toLowerCase();
    if (pStr === '1' || pStr.includes('high')) return 'High';
    if (pStr === '2' || pStr.includes('medium') || pStr.includes('normal')) return 'Medium';
    if (pStr === '3' || pStr.includes('low')) return 'Low';
    return raw;
  };

  const transformInt = (v) => {
    const val = parseInt(v, 10);
    return isNaN(val) ? null : val;
  };

  const payload = {
    op_period_id: opPeriodId,
    sartopo_id: feature.id,
    status: existing?.status || 'Planned',
    origin: existing?.origin || origin,
    is_orphaned: false,
    
    title: resolve(['title', 'name'], 'title', (v) => v || 'Untitled SARTopo Object'),
    segment: resolve(['segment', 'division', 'sector'], 'segment'),
    resource_type: resolve(['resource_type', 'resourceType', 'class', 'type'], 'resource_type'),
    team_size: resolve(['teamSize', 'team_size', 'personnel', 'size', 'personnel_count'], 'team_size', transformInt),
    frequency_primary: resolve(['primary_frequency', 'primaryFrequency', 'frequency', 'tac', 'tac_channel', 'comms'], 'frequency_primary'),
    description: resolve(['description', 'comments', 'notes'], 'description'),
    priority: resolve(['priority', 'Priority', 'importance', 'priority_level'], 'priority', transformPriority),
    hazards: resolve(['hazards', 'safety'], 'hazards'),
    transportation: resolve(['transportation', 'travel_method'], 'transportation'),
    time_allocated: resolve(['time_allocated', 'timeAllocated', 'duration'], 'time_allocated'),
    prepared_by: resolve(['prepared_by', 'preparedBy', 'author'], 'prepared_by'),
    probability_of_detection: resolve(['unresponsive_pod', 'unresponsivePOD', 'pod', 'probabilityOfDetection', 'POD', 'cluePOD', 'clue_pod'], 'probability_of_detection', transformInt),

    updated_at: new Date().toISOString()
  };

  return payload;
};

/**
 * Maps a SAROps Assignment record to a SARTopo GeoJSON feature property set.
 * Useful for future implementation of bidirectional sync or map exports.
 * 
 * @param {Object} assignment - SAROps Assignment record
 * @param {Object} baseProperties - Existing SARTopo feature properties to use as template
 * @returns {Object} GeoJSON properties for SARTopo
 */
export const mapAssignmentToSartopo = (assignment, baseProperties = {}) => {
  // Start with existing properties to ensure no data loss (styling, folders, color, pattern, etc)
  const p = { ...baseProperties };
  
  // Intelligent key update helper: Finds the key SARTopo was using and updates it.
  const updateProperty = (keys, value) => {
    // Requirement: Every field present in the download MUST be present in the upload.
    // If the value is null/undefined in SAROps, we do not overwrite the existing SARTopo value.
    if (value === undefined || value === null) return;

    const existingKey = keys.find(k => Object.prototype.hasOwnProperty.call(p, k));
    if (existingKey) {
      p[existingKey] = value;
    } else if (keys.length > 0) {
      p[keys[0]] = value; // Default to first key in list if none exist
    }
  };

  p.class = 'Assignment';
  
  p.status = assignment.status;

  // Field-by-field substitution using resilient key matching aligned with download patterns.
  // This ensures that variations like 'cluePOD' or 'personnel' are correctly updated.
  updateProperty(['title', 'name'], assignment.title);
  updateProperty(['segment', 'division', 'sector'], assignment.segment);
  updateProperty(['resource_type', 'resourceType', 'type'], assignment.resource_type);
  updateProperty(['teamSize', 'team_size', 'personnel', 'size', 'personnel_count'], assignment.team_size);
  updateProperty(['primary_frequency', 'primaryFrequency', 'frequency', 'tac', 'tac_channel', 'comms'], assignment.frequency_primary);
  updateProperty(['description', 'comments', 'notes'], assignment.description);
  updateProperty(['unresponsive_pod', 'unresponsivePOD', 'pod', 'probabilityOfDetection', 'POD', 'cluePOD', 'clue_pod'], assignment.probability_of_detection);
  updateProperty(['priority', 'Priority', 'importance', 'priority_level'], assignment.priority);
  updateProperty(['hazards', 'safety'], assignment.hazards);
  updateProperty(['transportation', 'travel_method'], assignment.transportation);
  updateProperty(['time_allocated', 'timeAllocated', 'duration'], assignment.time_allocated);
  updateProperty(['prepared_by', 'preparedBy', 'author'], assignment.prepared_by);

  return p;
};
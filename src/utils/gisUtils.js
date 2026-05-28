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
export const mapSartopoToAssignment = (feature, opPeriodId, existing = null, origin = 'SARTopo') => {
  const p = feature.properties || {};

  console.debug('[mapSartopoToAssignment] Incoming SARTopo properties:', p);
  console.debug('[mapSartopoToAssignment] Existing SAROps assignment:', existing);
  
  // Extract values with fallbacks matching SARTopo's standard JSON structure (fixed p variable not defined)
  const title = p.title || p.name || 'Untitled SARTopo Object';
  
  // Map SARTopo priority integers or variations to SAROps labels
  const rawPriority = p.priority || p.Priority || p.importance || p.priority_level;
  let mappedPriority = existing?.priority || null;
  
  if (rawPriority !== undefined && rawPriority !== null) {
    const pStr = String(rawPriority).toLowerCase();
    if (pStr === '1' || pStr.includes('high')) mappedPriority = 'High';
    else if (pStr === '2' || pStr.includes('medium') || pStr.includes('normal')) mappedPriority = 'Medium';
    else if (pStr === '3' || pStr.includes('low')) mappedPriority = 'Low';
    else mappedPriority = rawPriority; // Preserve other string values
  }

  // Normalize numeric fields (SARTopo often returns these as strings)
  const podValue = parseInt(p.unresponsive_pod || p.unresponsivePOD || p.pod || p.probabilityOfDetection, 10);
  const teamSizeValue = parseInt(p.teamSize || p.team_size || p.personnel || p.size || p.personnel_count, 10);

  const payload = {
    // Primary/Foreign Keys
    // Omit assignment_id (PK) to ensure uniform payloads in bulk upsert operations.
    // Conflict resolution is handled via the natural unique key (op_period_id, sartopo_id).
    op_period_id: opPeriodId,
    sartopo_id: feature.id,
    
    // Operational State
    status: existing?.status || 'Planned',
    origin: existing?.origin || origin,
    is_orphaned: false,
    
    // Core Data
    title: title, // Title is NOT NULL in DB, so always provide a value
    segment: p.segment || p.division || p.sector || existing?.segment || null,
    resource_type: p.resource_type || p.resourceType || p.class || p.type || existing?.resource_type || null,
    team_size: isNaN(teamSizeValue) ? (existing?.team_size || null) : teamSizeValue,
    frequency_primary: p.primary_frequency || p.primaryFrequency || p.frequency || p.tac || p.tac_channel || p.comms || existing?.frequency_primary || null,
    description: p.description || p.comments || p.notes || existing?.description || null,
    priority: mappedPriority,
    hazards: p.hazards || p.safety || existing?.hazards || null,
    
    // Extended SARTopo Fields
    transportation: p.transportation || p.travel_method || existing?.transportation || null,
    time_allocated: p.time_allocated || p.timeAllocated || p.duration || existing?.time_allocated || null,
    prepared_by: p.prepared_by || p.preparedBy || p.author || existing?.prepared_by || null,

    // Calculations
    probability_of_detection: isNaN(podValue) ? (existing?.probability_of_detection || null) : podValue,
    
    // Metadata
    updated_at: new Date().toISOString()
  };

  console.debug('[mapSartopoToAssignment] Final generated payload:', payload);
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
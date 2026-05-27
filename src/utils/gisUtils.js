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
 * @returns {Object} Payload for Supabase upsert
 */
export const mapSartopoToAssignment = (feature, opPeriodId, existing = null) => {
  const p = feature.properties || {};
  
  // Extract values with fallbacks matching SARTopo's standard JSON structure
  const title = p.title || p.name || 'Untitled SARTopo Object';
  
  // Normalize numeric fields (SARTopo often returns these as strings)
  const pod = parseInt(p.unresponsive_pod || p.pod, 10) || 0;
  const teamSize = parseInt(p.teamSize || p.personnel, 10) || 0;

  return {
    // Primary/Foreign Keys
    // Use assignment_id if we are updating an existing record, otherwise let DB generate UUID
    ...(existing?.id && { assignment_id: existing.id }),
    op_period_id: opPeriodId,
    sartopo_id: feature.id,
    
    // Operational State
    status: existing?.status || 'Planned',
    origin: 'SARTopo',
    is_orphaned: false,
    
    // Core Data
    title: title,
    segment: p.segment || '',
    resource_type: p.resource_type || p.class || 'Search Team',
    team_size: teamSize,
    frequency_primary: p.primary_frequency || p.frequency || '',
    description: p.description || p.comments || '',
    priority: p.priority || 'Normal',
    
    // Style/GIS Metadata (Used for syncing back to SARTopo)
    folder_id: p.folderId || null,
    color: p.color || null,
    stroke: p.stroke || null,
    fill: p.fill || null,
    
    // Calculations
    probability_of_detection: pod,
    
    // Metadata
    updated_at: new Date().toISOString()
  };
};

/**
 * Maps a SAROps Assignment record to a SARTopo GeoJSON feature property set.
 * Useful for future implementation of bidirectional sync or map exports.
 * 
 * @param {Object} assignment - SAROps Assignment record
 * @returns {Object} GeoJSON properties for SARTopo
 */
export const mapAssignmentToSartopo = (assignment) => {
  return {
    title: assignment.title,
    name: assignment.title,
    class: 'Assignment',
    status: assignment.status,
    segment: assignment.segment || '',
    resource_type: assignment.resource_type || '',
    teamSize: assignment.team_size,
    primary_frequency: assignment.frequency_primary || '',
    description: assignment.description || '',
    unresponsive_pod: assignment.probability_of_detection || 0,
    priority: assignment.priority || 'Normal',
    folderId: assignment.folder_id,
    color: assignment.color,
    stroke: assignment.stroke,
    fill: assignment.fill
  };
};
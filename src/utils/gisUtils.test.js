import { describe, it, expect } from 'vitest';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from './gisUtils';

describe('gisUtils', () => {
  describe('mapSartopoToAssignment', () => {
    const opPeriodId = 'op-123';
    const baseFeature = {
      id: 'f1',
      properties: {
        class: 'Assignment',
        title: 'Test Task',
        resource_type: 'Ground',
        priority: 'High',
        team_size: 3,
      },
    };

    it('should map basic SARTopo properties to a SAROps assignment', () => {
      const result = mapSartopoToAssignment(baseFeature, opPeriodId);
      expect(result).toMatchObject({
        op_period_id: opPeriodId,
        sartopo_id: 'f1',
        title: 'Test Task',
        resource_type: 'Ground',
        priority: 'High',
        team_size: 3,
        status: 'Planned',
        origin: 'SARTopo',
      });
    });

    it('should use "name" if "title" is not present', () => {
      const feature = { id: 'f2', properties: { class: 'Assignment', name: 'Alternate Name' } };
      const result = mapSartopoToAssignment(feature, opPeriodId);
      expect(result.title).toBe('Alternate Name');
    });

    it('should default resource_type to "Ground" if not provided', () => {
      const feature = { id: 'f3', properties: { class: 'Assignment', title: 'No Type' } };
      const result = mapSartopoToAssignment(feature, opPeriodId);
      expect(result.resource_type).toBe('Ground');
    });

    it('should correctly transform priority values', () => {
      const highPrio = mapSartopoToAssignment({ properties: { priority: '1' } }, opPeriodId);
      const medPrio = mapSartopoToAssignment({ properties: { priority: 'normal' } }, opPeriodId);
      const lowPrio = mapSartopoToAssignment({ properties: { priority: 3 } }, opPeriodId);
      expect(highPrio.priority).toBe('High');
      expect(medPrio.priority).toBe('Medium');
      expect(lowPrio.priority).toBe('Low');
    });

    it('should correctly parse integer values and handle non-numeric input', () => {
      const podFeature = { properties: { unresponsive_pod: '85' } };
      const sizeFeature = { properties: { teamSize: '4-5' } };
      const podResult = mapSartopoToAssignment(podFeature, opPeriodId);
      const sizeResult = mapSartopoToAssignment(sizeFeature, opPeriodId);
      expect(podResult.probability_of_detection).toBe(85);
      expect(sizeResult.team_size).toBeNull(); // '4-5' is not a valid integer
    });

    it('should respect existing SAROps data if SARTopo data has not changed', () => {
      const existingAssignment = { title: 'Local Title', resource_type: 'Local Type' };
      const baselineFeature = { id: 'f1', properties: { title: 'SARTopo Title' } };
      const incomingFeature = { id: 'f1', properties: { title: 'SARTopo Title' } }; // No change
      
      const result = mapSartopoToAssignment(incomingFeature, opPeriodId, existingAssignment, baselineFeature);
      
      expect(result.title).toBe('Local Title'); // Should keep local title
      expect(result.resource_type).toBe('Local Type'); // Should keep local type
    });

    it('should take SARTopo data if it has changed from the baseline', () => {
      const existingAssignment = { title: 'Local Title' };
      const baselineFeature = { id: 'f1', properties: { title: 'Old SARTopo Title' } };
      const incomingFeature = { id: 'f1', properties: { title: 'New SARTopo Title' } }; // Changed
      
      const result = mapSartopoToAssignment(incomingFeature, opPeriodId, existingAssignment, baselineFeature);
      
      expect(result.title).toBe('New SARTopo Title'); // SARTopo wins
    });
  });

  describe('mapAssignmentToSartopo', () => {
    const baseAssignment = {
      title: 'SAROps Task',
      resource_type: 'Hasty',
      priority: 'Medium',
      team_size: 2,
      frequency_primary: 'TAC 5',
      description: 'SAROps description',
      probability_of_detection: 90,
    };

    it('should map SAROps fields to SARTopo properties', () => {
      const result = mapAssignmentToSartopo(baseAssignment);
      expect(result).toMatchObject({
        class: 'Assignment',
        title: 'SAROps Task',
        resource_type: 'Hasty',
        priority: 'Medium',
        teamSize: 2,
        primary_frequency: 'TAC 5',
        description: 'SAROps description',
        unresponsive_pod: 90,
      });
    });

    it('should preserve existing base properties that are not being mapped', () => {
      const baseProperties = { color: 'blue', folderId: 'folder-123', someOtherProp: 'value' };
      const result = mapAssignmentToSartopo(baseAssignment, baseProperties);
      expect(result.color).toBe('blue');
      expect(result.folderId).toBe('folder-123');
      expect(result.someOtherProp).toBe('value');
      expect(result.title).toBe('SAROps Task'); // Ensure it still maps new values
    });

    it('should update an existing SARTopo key instead of creating a new one', () => {
      const baseProperties = { name: 'Old Name', size: 1 };
      const result = mapAssignmentToSartopo(baseAssignment, baseProperties);
      expect(result.name).toBe('SAROps Task'); // Updated 'name'
      expect(result.size).toBe(2); // Updated 'size'
      expect(result).not.toHaveProperty('title'); // Did not create 'title'
      expect(result).not.toHaveProperty('teamSize'); // Did not create 'teamSize'
    });

    it('should not add null or undefined values for unmapped fields', () => {
      const assignment = { title: 'Minimal Task' };
      const result = mapAssignmentToSartopo(assignment);
      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('teamSize');
    });
  });
});
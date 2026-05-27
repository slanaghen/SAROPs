import { describe, it, expect } from 'vitest';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from './gisUtils';

describe('gisUtils', () => {
  describe('mapSartopoToAssignment', () => {
    const mockOpId = 'op-123';
    const mockFeature = {
      id: 's-456',
      properties: {
        title: 'Search Area Alpha',
        class: 'Assignment',
        unresponsive_pod: '80',
        teamSize: '3',
        primary_frequency: '155.125',
        description: 'Sweep the creek bed',
        priority: 'High',
        color: '#ff0000'
      }
    };

    it('correctly maps a SARTopo feature to a SAROps assignment payload', () => {
      const result = mapSartopoToAssignment(mockFeature, mockOpId);
      
      expect(result).toMatchObject({
        op_period_id: mockOpId,
        sartopo_id: 's-456',
        title: 'Search Area Alpha',
        probability_of_detection: 80,
        team_size: 3,
        frequency_primary: '155.125',
        description: 'Sweep the creek bed',
        priority: 'High',
        color: '#ff0000',
        origin: 'SARTopo',
        status: 'Planned'
      });
    });

    it('uses fallback titles if title property is missing', () => {
      const featureWithNoTitle = {
        id: 's-1',
        properties: { name: 'Fallback Name', class: 'Assignment' }
      };
      const result = mapSartopoToAssignment(featureWithNoTitle, mockOpId);
      expect(result.title).toBe('Fallback Name');
    });
  });

  describe('mapAssignmentToSartopo', () => {
    const mockAssignment = {
      sartopo_id: 's-123',
      title: 'Mission 1',
      status: 'Deployed',
      segment: 'Area 1',
      resource_type: 'Ground',
      team_size: 4,
      frequency_primary: 'TAC 2',
      probability_of_detection: 90,
      color: '#00ff00'
    };

    it('correctly maps a SAROps assignment back to a SARTopo GeoJSON feature properties', () => {
      const result = mapAssignmentToSartopo(mockAssignment);
      
      expect(result).toMatchObject({
        title: 'Mission 1',
        class: 'Assignment',
        status: 'Deployed',
        teamSize: 4,
        unresponsive_pod: 90,
        color: '#00ff00'
      });
    });
  });
});
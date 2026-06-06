/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from './gisUtils';

describe('gisUtils Unit Tests', () => {
  describe('mapSartopoToAssignment', () => {
    const opPeriodId = 'op-123';
    const mockFeature = {
      id: 'feat-abc',
      properties: {
        title: 'Search Sector Alpha',
        class: 'Assignment',
        unresponsive_pod: '80',
        primary_frequency: '155.125',
        Priority: '1',
        teamSize: '2'
      }
    };

    it('correctly maps SARTopo properties to SAROps assignment payload', () => {
      const payload = mapSartopoToAssignment(mockFeature, opPeriodId);
      
      expect(payload).toMatchObject({
        op_period_id: opPeriodId,
        sartopo_id: 'feat-abc',
        title: 'Search Sector Alpha',
        probability_of_detection: 80,
        frequency_primary: '155.125',
        priority: 'High',
        team_size: 2,
        origin: 'SARTopo'
      });
    });

    it('handles numeric priority variations from SARTopo', () => {
      const featMed = { properties: { importance: '2' } };
      const featLow = { properties: { priority_level: '3' } };
      
      expect(mapSartopoToAssignment(featMed, opPeriodId).priority).toBe('Medium');
      expect(mapSartopoToAssignment(featLow, opPeriodId).priority).toBe('Low');
    });

    it('preserves existing SAROps data when SARTopo properties are null or missing', () => {
      const existingAsn = {
        priority: 'High',
        segment: 'Division A',
        status: 'Assigned'
      };
      const sparseFeature = { id: 's1', properties: { title: 'New Title' } };
      
      const payload = mapSartopoToAssignment(sparseFeature, opPeriodId, existingAsn);
      
      expect(payload.title).toBe('New Title');
      expect(payload.priority).toBe('High'); // From existing
      expect(payload.segment).toBe('Division A'); // From existing
      expect(payload.status).toBe('Assigned'); // From existing
    });
  });

  describe('mapAssignmentToSartopo', () => {
    it('intelligently updates existing SARTopo keys without losing metadata', () => {
      const baseProperties = {
        id: 's1',
        color: '#FF0000', // SARTopo specific
        folder: 'assignments-folder', // SARTopo specific
        unresponsive_pod: 50,
        title: 'Old Title'
      };
      
      const assignment = {
        title: 'Updated Title',
        status: 'Deployed',
        probability_of_detection: 95
      };

      const result = mapAssignmentToSartopo(assignment, baseProperties);

      expect(result.title).toBe('Updated Title');
      expect(result.unresponsive_pod).toBe(95);
      expect(result.status).toBe('Deployed');
      expect(result.color).toBe('#FF0000'); // Metadata preserved
      expect(result.folder).toBe('assignments-folder'); // Metadata preserved
    });

    it('uses standard default keys when base properties are empty', () => {
      const assignment = {
        title: 'New Mission Object',
        team_size: 4,
        frequency_primary: 'TAC 1'
      };

      const result = mapAssignmentToSartopo(assignment, {});

      expect(result.class).toBe('Assignment');
      expect(result.title).toBe('New Mission Object');
      expect(result.teamSize).toBe(4);
      expect(result.primary_frequency).toBe('TAC 1');
    });

    it('does not overwrite SARTopo values if SAROps fields are null', () => {
      const base = { hazards: 'Bees' };
      const asn = { hazards: null };
      expect(mapAssignmentToSartopo(asn, base).hazards).toBe('Bees');
    });
  });
});
/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { normalizeResourceTypeName } from './dataNormalization';

describe('dataNormalization', () => {
  describe('normalizeResourceTypeName', () => {
    it('strips legacy "Search" suffix and maps to modern enums', () => {
      expect(normalizeResourceTypeName('Ground Search')).toBe('Ground');
      expect(normalizeResourceTypeName('Aerial Search')).toBe('UAS');
    });

    it('preserves existing modern enum names', () => {
      expect(normalizeResourceTypeName('Dog')).toBe('Dog');
    });

    it('defaults to "Ground" for missing values', () => {
      expect(normalizeResourceTypeName(null)).toBe('Ground');
    });
  });
});
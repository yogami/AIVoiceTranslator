/**
 * Validation Middleware Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  validateRequiredFields, 
  parseLimit, 
  validateClassroomCode 
} from '../../../server/middleware/validation.middleware.js';

describe('Validation Middleware', () => {
  describe('validateRequiredFields', () => {
    it('should pass validation when all required fields are present', () => {
      const body = {
        name: 'John',
        email: 'john@example.com',
        age: 30
      };
      const fields = ['name', 'email'];

      expect(() => validateRequiredFields(body, fields)).not.toThrow();
    });

    it('should throw error when required fields are missing', () => {
      const body = {
        name: 'John'
      };
      const fields = ['name', 'email', 'age'];

      expect(() => validateRequiredFields(body, fields))
        .toThrow('Missing required fields: email, age');
    });

    it('should handle empty body', () => {
      const body = {};
      const fields = ['name', 'email'];

      expect(() => validateRequiredFields(body, fields))
        .toThrow('Missing required fields: name, email');
    });

    it('should handle null/undefined values as missing', () => {
      const body = {
        name: 'John',
        email: null,
        age: undefined
      };
      const fields = ['name', 'email', 'age'];

      expect(() => validateRequiredFields(body, fields))
        .toThrow('Missing required fields: email, age');
    });

    it('should handle empty string values as present', () => {
      const body = {
        name: '',
        email: 'john@example.com'
      };
      const fields = ['name', 'email'];

      expect(() => validateRequiredFields(body, fields)).not.toThrow();
    });
  });

  describe('parseLimit', () => {
    it('should return default limit when no parameter provided', () => {
      expect(parseLimit(undefined)).toBe(10);
      expect(parseLimit(null)).toBe(10);
      expect(parseLimit('')).toBe(10);
    });

    it('should return custom default limit', () => {
      expect(parseLimit(undefined, 20)).toBe(20);
      expect(parseLimit(null, 5)).toBe(5);
    });

    it('should parse valid numeric string', () => {
      expect(parseLimit('25')).toBe(25);
      expect(parseLimit('1')).toBe(1);
      expect(parseLimit('50')).toBe(50);
    });

    it('should cap limit at 100', () => {
      expect(parseLimit('150')).toBe(100);
      expect(parseLimit('1000')).toBe(100);
      expect(parseLimit('999')).toBe(100);
    });

    it('should allow limit up to 100', () => {
      expect(parseLimit('100')).toBe(100);
      expect(parseLimit('99')).toBe(99);
    });

    it('should throw error for invalid numeric strings', () => {
      expect(() => parseLimit('abc')).toThrow('Limit must be a positive integer');
      expect(() => parseLimit('12.5')).toThrow('Limit must be a positive integer');
      expect(() => parseLimit('-5')).toThrow('Limit must be a positive integer');
      expect(() => parseLimit('0')).toThrow('Limit must be a positive integer');
    });

    it('should handle numeric input directly', () => {
      expect(parseLimit(25)).toBe(25);
      expect(parseLimit(150)).toBe(100); // Capped
    });
  });

  describe('validateClassroomCode', () => {
    it('should validate correct classroom code format', () => {
      expect(validateClassroomCode('ABC123')).toBe(true);
      expect(validateClassroomCode('XYZ789')).toBe(true);
      expect(validateClassroomCode('123456')).toBe(true);
      expect(validateClassroomCode('ABCDEF')).toBe(true);
    });

    it('should reject invalid classroom code formats', () => {
      expect(validateClassroomCode('abc123')).toBe(false); // lowercase
      expect(validateClassroomCode('ABC12')).toBe(false); // too short
      expect(validateClassroomCode('ABC1234')).toBe(false); // too long
      expect(validateClassroomCode('ABC-123')).toBe(false); // invalid character
      expect(validateClassroomCode('ABC 123')).toBe(false); // space
      expect(validateClassroomCode('')).toBe(false); // empty
      expect(validateClassroomCode('ABC@23')).toBe(false); // special character
    });

    it('should handle edge cases', () => {
      expect(validateClassroomCode('000000')).toBe(true); // all zeros
      expect(validateClassroomCode('ZZZZZZ')).toBe(true); // all letters
      expect(validateClassroomCode('A1B2C3')).toBe(true); // mixed
    });
  });
});

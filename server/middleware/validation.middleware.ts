/**
 * Validation Middleware
 * 
 * Centralized input validation utilities for API routes
 */

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, fields: string[]): void {
  const missingFields = fields.filter(field => body[field] === undefined || body[field] === null);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Parse and validate limit parameter
 */
export function parseLimit(limitParam: any, defaultLimit: number = 10): number {
  if (!limitParam) return defaultLimit;

  const limit = parseInt(limitParam as string, 10);
  if (isNaN(limit) || limit < 1 || !Number.isInteger(parseFloat(limitParam as string))) {
    throw new Error('Limit must be a positive integer');
  }

  return Math.min(limit, 100); // Cap at 100 for performance
}

/**
 * Validate classroom code format
 */
export function validateClassroomCode(code: string): boolean {
  const CLASSROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
  return CLASSROOM_CODE_PATTERN.test(code);
}

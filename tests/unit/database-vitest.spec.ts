/**
 * Database Operations Tests (Vitest Version)
 * 
 * Tests for database operations using the storage implementation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database response data
const MOCK_LANGUAGES = [
  { id: 1, code: 'en-US', name: 'English', isActive: true },
  { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
  { id: 3, code: 'fr-FR', name: 'French', isActive: false }
];

// Mock the drizzle-orm
vi.mock('drizzle-orm/neon-serverless', () => {
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(MOCK_LANGUAGES),
      returning: vi.fn().mockReturnThis()
    }))
  };
});

// Mock the database module
vi.mock('../../server/db', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockImplementation(() => [MOCK_LANGUAGES[0]])
    }
  };
});

// Import the storage module after mocking
import { storage } from '../../server/storage';

describe('Database Operations Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should have database storage implementation', () => {
    expect(storage).toBeDefined();
  });
  
  it('should implement the IStorage interface', () => {
    // Required methods for IStorage
    expect(typeof storage.getLanguages).toBe('function');
    expect(typeof storage.getActiveLanguages).toBe('function');
    expect(typeof storage.createUser).toBe('function');
    expect(typeof storage.addTranslation).toBe('function');
    expect(typeof storage.getTranscriptsBySession).toBe('function');
  });
});
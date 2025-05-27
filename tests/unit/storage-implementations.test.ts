/**
 * Storage Implementations Tests
 * 
 * Tests for MemStorage and DatabaseStorage implementations.
 * Only the database module is mocked as it's an external dependency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IStorage, MemStorage, DatabaseStorage } from '../../server/storage';
import { db } from '../../server/db';

// Mock only the external database dependency
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([]))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),
    transaction: vi.fn((callback) => callback(db))
  }
}));

describe('Storage Implementations', () => {
  describe('MemStorage - In-Memory Storage Implementation', () => {
    let storage: IStorage;

    beforeEach(() => {
      storage = new MemStorage();
    });

    it('should provide default languages on initialization', async () => {
      const languages = await storage.getLanguages();
      
      expect(languages.length).toBeGreaterThan(0);
      expect(languages.some(lang => lang.code === 'en-US')).toBe(true);
      expect(languages.some(lang => lang.code === 'es')).toBe(true);
    });

    it('should create and retrieve users', async () => {
      const userData = { username: 'testuser', password: 'password123' };
      
      const createdUser = await storage.createUser(userData);
      const retrievedUser = await storage.getUserByUsername('testuser');
      
      expect(createdUser.username).toBe(userData.username);
      expect(retrievedUser?.username).toBe(userData.username);
      expect(retrievedUser?.id).toBe(createdUser.id);
    });

    it('should update language activation status', async () => {
      const languages = await storage.getLanguages();
      const targetLanguage = languages[0];
      
      const updatedLanguage = await storage.updateLanguageStatus(targetLanguage.code, false);
      const activeLanguages = await storage.getActiveLanguages();
      
      expect(updatedLanguage?.isActive).toBe(false);
      expect(activeLanguages.some(lang => lang.code === targetLanguage.code)).toBe(false);
    });
  });
  
  // DatabaseStorage tests are skipped since database is not implemented
  describe.skip('DatabaseStorage - Database-backed Storage Implementation', () => {
    // Tests would go here when database is implemented
  });
});

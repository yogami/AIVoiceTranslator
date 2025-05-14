/**
 * Tests for Database Storage Implementation
 *
 * These tests cover the functionality of the DatabaseStorage class
 * which is planned to replace the MemStorage implementation for production.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { type User, type InsertUser } from "@shared/schema";

// Mock the database client
vi.mock('../../server/db', () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  
  // Create a chainable mock
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue([])
    })
  });
  
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue([])
    })
  });
  
  return {
    db: {
      select: mockSelect,
      insert: mockInsert
    }
  };
});

// Import the schema with types
vi.mock('@shared/schema', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    users: {
      id: 'id',
      username: 'username',
      email: 'email'
    }
  };
});

describe('DatabaseStorage', () => {
  let DatabaseStorage: any;
  let storage: any;
  let mockDb: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module dynamically to ensure mocks are applied
    const storageModule = await import('../../server/storage');
    DatabaseStorage = storageModule.DatabaseStorage;
    storage = new DatabaseStorage();
    
    // Get reference to the mocked db object
    const { db } = await import('../../server/db');
    mockDb = db;
  });
  
  describe('User operations', () => {
    it('should retrieve a user by ID', async () => {
      // Setup mock return value
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
      mockDb.select().from().where.mockReturnValueOnce([mockUser]);
      
      // Call the method
      const result = await storage.getUser(1);
      
      // Verify the result
      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
    });
    
    it('should return undefined when user ID is not found', async () => {
      // Setup mock to return empty array
      mockDb.select().from().where.mockReturnValueOnce([]);
      
      // Call the method
      const result = await storage.getUser(999);
      
      // Verify the result
      expect(result).toBeUndefined();
    });
    
    it('should retrieve a user by username', async () => {
      // Setup mock return value
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
      mockDb.select().from().where.mockReturnValueOnce([mockUser]);
      
      // Call the method
      const result = await storage.getUserByUsername('testuser');
      
      // Verify the result
      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
    });
    
    it('should create a new user', async () => {
      // Setup mock return value
      const mockUser = { id: 1, username: 'newuser', email: 'new@example.com' };
      mockDb.insert().values().returning.mockReturnValueOnce([mockUser]);
      
      // Create user data
      const userData: InsertUser = { 
        username: 'newuser', 
        email: 'new@example.com'
      };
      
      // Call the method
      const result = await storage.createUser(userData);
      
      // Verify the result
      expect(result).toEqual(mockUser);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
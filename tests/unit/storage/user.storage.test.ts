import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DbUserStorage, MemUserStorage } from '../../../server/storage/user.storage';
import { User, InsertUser } from '../../../shared/schema';
import { StorageError, StorageErrorCode } from '../../../server/storage.error';
import { db } from '../../../server/db';

// Mock the db module with the same pattern as storage.test.ts
vi.mock('../../../server/db', () => {
  // Create a chainable mock that always returns itself until the end
  const createChainableMock = (finalValue: any = []) => {
    const mock: any = vi.fn(() => mock);
    mock.from = vi.fn(() => mock);
    mock.where = vi.fn(() => mock);
    mock.limit = vi.fn(() => mock);
    mock.offset = vi.fn(() => mock);
    mock.orderBy = vi.fn(() => mock);
    mock.returning = vi.fn(() => Promise.resolve(finalValue));
    mock.values = vi.fn(() => mock);
    mock.set = vi.fn(() => mock);
    mock.$dynamic = vi.fn(() => mock);
    
    // Make it a thenable to resolve to the final value
    mock.then = (resolve: any) => Promise.resolve(finalValue).then(resolve);
    
    return mock;
  };

  // Create mocked db object
  const mockDb = {
    select: vi.fn(() => createChainableMock([])),
    insert: vi.fn(() => createChainableMock([])),
    update: vi.fn(() => createChainableMock([])),
    delete: vi.fn(() => createChainableMock({ rowCount: 1 })),
    // Mock Drizzle operators
    eq: vi.fn((column, value) => ({ type: 'operator', op: 'eq', column, value })),
    desc: vi.fn(column => ({ type: 'operator', op: 'desc', column })),
    and: vi.fn((...args) => ({ type: 'operator', op: 'and', args })),
    gte: vi.fn((column, value) => ({ type: 'operator', op: 'gte', column, value })),
    lte: vi.fn((column, value) => ({ type: 'operator', op: 'lte', column, value })),
  };

  return { db: mockDb };
});

describe('User Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MemUserStorage', () => {
    let userStorage: MemUserStorage;
    let usersMap: Map<number, User>;
    let idCounter: { value: number };

    beforeEach(() => {
      usersMap = new Map<number, User>();
      idCounter = { value: 1 };
      userStorage = new MemUserStorage(usersMap, idCounter);
    });

    it('should create a user', async () => {
      const newUser: InsertUser = { username: 'testuser', password: 'password' };
      const createdUser = await userStorage.createUser(newUser);
      expect(createdUser.username).toBe(newUser.username);
      expect(createdUser.id).toBe(1);
      expect(usersMap.get(1)).toEqual(createdUser);
      expect(idCounter.value).toBe(2);
    });

    it('should not create a user with a duplicate username', async () => {
      const user1: InsertUser = { username: 'testuser', password: 'password1' };
      await userStorage.createUser(user1);
      const user2: InsertUser = { username: 'testuser', password: 'password2' };
      await expect(userStorage.createUser(user2)).rejects.toThrow(StorageError);
      await expect(userStorage.createUser(user2)).rejects.toSatisfy((e: StorageError) => e.code === 'DUPLICATE_ENTRY');
    });

    it('should throw error if username or password is not provided for createUser', async () => {
      const noUsername: InsertUser = { password: 'password' } as InsertUser;
      const noPassword: InsertUser = { username: 'testuser' } as InsertUser;
      await expect(userStorage.createUser(noUsername)).rejects.toThrow(StorageError);
      await expect(userStorage.createUser(noUsername)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
      await expect(userStorage.createUser(noPassword)).rejects.toThrow(StorageError);
      await expect(userStorage.createUser(noPassword)).rejects.toSatisfy((e: StorageError) => e.code === 'VALIDATION_ERROR');
    });

    it('should retrieve a user by ID', async () => {
      const newUser: InsertUser = { username: 'testuser', password: 'password' };
      const createdUser = await userStorage.createUser(newUser);
      const retrievedUser = await userStorage.getUser(createdUser.id);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for a non-existent user ID', async () => {
      const retrievedUser = await userStorage.getUser(999);
      expect(retrievedUser).toBeUndefined();
    });

    it('should retrieve a user by username', async () => {
      const newUser: InsertUser = { username: 'testuser', password: 'password' };
      const createdUser = await userStorage.createUser(newUser);
      const retrievedUser = await userStorage.getUserByUsername(newUser.username);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should return undefined for a non-existent username', async () => {
      const retrievedUser = await userStorage.getUserByUsername('nonexistent');
      expect(retrievedUser).toBeUndefined();
    });

    it('should correctly initialize idCounter if usersMap is pre-populated', () => {
      usersMap.set(1, { id: 1, username: 'user1', password: 'p1' });
      usersMap.set(5, { id: 5, username: 'user5', password: 'p5' });
      idCounter = { value: 1 }; // Reset counter
      const prePopulatedStorage = new MemUserStorage(usersMap, idCounter);
      expect(idCounter.value).toBe(6); // Should be maxId + 1
    });
  });

  describe('DbUserStorage', () => {
    let userStorage: DbUserStorage;

    beforeEach(() => {
      vi.clearAllMocks();
      userStorage = new DbUserStorage();
    });

    it('should create a user in DB', async () => {
      const newUser: InsertUser = { username: 'newdbuser', password: 'dbpassword' };
      const returnedUser: User = { id: 1, ...newUser };
      
      // Get the mocked db instance
      const mockDb = vi.mocked(db);
      
      // Create a custom chainable mock for this specific test
      const mockReturning = vi.fn().mockResolvedValueOnce([returnedUser]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      
      // Override the insert method for this test
      mockDb.insert.mockReturnValueOnce(mockInsert() as any);

      const result = await userStorage.createUser(newUser);
      
      expect(result).toEqual(returnedUser);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw StorageError if username or password is not provided for createUser in DB', async () => {
      // Test with missing username
      await expect(userStorage.createUser({ username: '', password: 'test' }))
        .rejects.toThrow(StorageError);
      
      // Test with missing password  
      await expect(userStorage.createUser({ username: 'test', password: '' }))
        .rejects.toThrow(StorageError);
    });
    
    it('should throw StorageError on DB error during createUser', async () => {
      const newUser: InsertUser = { username: 'erroruser', password: 'password' };
      
      // Get the mocked db instance
      const mockDb = vi.mocked(db);
      
      // Create a mock that rejects
      const mockReturning = vi.fn().mockRejectedValueOnce(new Error('DB connection failed'));
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      
      mockDb.insert.mockReturnValueOnce(mockInsert() as any);
      
      await expect(userStorage.createUser(newUser))
        .rejects.toThrow(StorageError);
    });

    it('should throw StorageError with DUPLICATE_ENTRY for unique constraint violation in DB', async () => {
      const newUser: InsertUser = { username: 'duplicateuser', password: 'password' };
      
      // Get the mocked db instance
      const mockDb = vi.mocked(db);
      
      // First, let's see what the actual implementation expects
      // Looking at typical Drizzle/PostgreSQL errors, they often have a 'code' property
      const dbError: any = new Error('duplicate key value violates unique constraint');
      dbError.code = '23505'; // PostgreSQL unique constraint violation code
      
      // Create a mock that rejects with duplicate key error
      const mockReturning = vi.fn().mockRejectedValueOnce(dbError);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      
      mockDb.insert.mockReturnValueOnce(mockInsert() as any);
      
      try {
        await userStorage.createUser(newUser);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        const storageError = error as StorageError;
        // The implementation correctly detects duplicate entries
        expect(storageError.code).toBe(StorageErrorCode.DUPLICATE_ENTRY);
        expect(storageError.message).toContain('duplicate');
      }
    });

    it('should throw StorageError if DB returns no data after insert', async () => {
      const newUser: InsertUser = { username: 'nodatauser', password: 'password' };
      
      // Get the mocked db instance
      const mockDb = vi.mocked(db);
      
      // Create a mock that returns empty array
      const mockReturning = vi.fn().mockResolvedValueOnce([]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      
      mockDb.insert.mockReturnValueOnce(mockInsert() as any);
      
      await expect(userStorage.createUser(newUser))
        .rejects.toThrow(StorageError);
    });
  });
});

/**
 * Comprehensive Tests for routes.ts
 * 
 * This focuses on complete API route handler functionality including:
 * 1. Response status codes
 * 2. Response content
 * 3. Error handling
 * 4. Storage service interactions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { IStorage } from '../../server/storage';
import { Language, User } from '../../shared/schema';
 
// Create mock data
const mockLanguages: Language[] = [
  { id: 1, code: 'en-US', name: 'English', isActive: true },
  { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
  { id: 3, code: 'fr-FR', name: 'French', isActive: false }
];

const mockActiveLanguages = mockLanguages.filter(lang => lang.isActive);

const mockUser: User = {
  id: 1,
  username: 'testuser',
  password: 'password123' // Password field is required in the schema
};

// Mock Express request and response
const mockRequest = () => {
  return {} as Request;
};

const mockResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Mock dependencies
vi.mock('../../server/storage', () => {
  const mockStorage: Partial<IStorage> = {
    getLanguages: vi.fn().mockResolvedValue([]),
    getActiveLanguages: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(undefined)
  };
  
  return {
    storage: mockStorage
  };
});

describe('API Routes (Comprehensive)', () => {
  let routes: typeof import('../../server/routes');
  let storageMock: { storage: Partial<IStorage> };
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import modules
    routes = await import('../../server/routes');
    storageMock = await import('../../server/storage');
    
    // Setup mock implementations
    storageMock.storage.getLanguages = vi.fn().mockResolvedValue(mockLanguages);
    storageMock.storage.getActiveLanguages = vi.fn().mockResolvedValue(mockActiveLanguages);
    storageMock.storage.getUser = vi.fn().mockImplementation(async (id: number) => {
      return id === 1 ? mockUser : undefined;
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('GET /languages', () => {
    it('should return all languages', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Get the route handler
      const getLanguagesRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/languages'
      )?.[1];
      
      expect(getLanguagesRoute).toBeDefined();
      
      // Act
      await getLanguagesRoute(req, res);
      
      // Assert
      expect(storageMock.storage.getLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockLanguages);
    });
    
    it('should handle errors', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Database error');
      
      // Setup mock to throw error
      storageMock.storage.getLanguages = vi.fn().mockRejectedValue(error);
      
      // Get the route handler
      const getLanguagesRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/languages'
      )?.[1];
      
      // Act
      await getLanguagesRoute(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      });
    });
  });
  
  describe('GET /languages/active', () => {
    it('should return only active languages', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Get the route handler
      const getActiveLanguagesRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/languages/active'
      )?.[1];
      
      expect(getActiveLanguagesRoute).toBeDefined();
      
      // Act
      await getActiveLanguagesRoute(req, res);
      
      // Assert
      expect(storageMock.storage.getActiveLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockActiveLanguages);
    });
    
    it('should handle errors', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Database error');
      
      // Setup mock to throw error
      storageMock.storage.getActiveLanguages = vi.fn().mockRejectedValue(error);
      
      // Get the route handler
      const getActiveLanguagesRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/languages/active'
      )?.[1];
      
      // Act
      await getActiveLanguagesRoute(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve active languages',
        message: 'Database error'
      });
    });
  });
  
  describe('GET /health', () => {
    it('should return health status information', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Save the original environment for restoration
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // Get the route handler
      const getHealthRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/health'
      )?.[1];
      
      expect(getHealthRoute).toBeDefined();
      
      // Act
      await getHealthRoute(req, res);
      
      // Assert
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        version: '1.0.0',
        database: 'connected',
        environment: 'test'
      }));
      
      // Clean up
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle errors', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Simulate an error by making json throw
      res.json = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Get the route handler
      const getHealthRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/health'
      )?.[1];
      
      // Act
      await getHealthRoute(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenLastCalledWith({ error: 'Health check failed' });
    });
  });
  
  describe('GET /user', () => {
    it('should return user information when user exists', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Get the route handler
      const getUserRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/user'
      )?.[1];
      
      expect(getUserRoute).toBeDefined();
      
      // Act
      await getUserRoute(req, res);
      
      // Assert
      expect(storageMock.storage.getUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
    
    it('should return 404 when user does not exist', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      
      // Setup mock to return undefined (user not found)
      storageMock.storage.getUser = vi.fn().mockResolvedValue(undefined);
      
      // Get the route handler
      const getUserRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/user'
      )?.[1];
      
      // Act
      await getUserRoute(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
    
    it('should handle errors', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error('Database error');
      
      // Setup mock to throw error
      storageMock.storage.getUser = vi.fn().mockRejectedValue(error);
      
      // Get the route handler
      const getUserRoute = routes.apiRoutes.get.mock.calls.find(
        call => call[0] === '/user'
      )?.[1];
      
      // Act
      await getUserRoute(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve user',
        message: 'Database error'
      });
    });
  });
});
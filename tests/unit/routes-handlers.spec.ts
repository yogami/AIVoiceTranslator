/**
 * Handler-level tests for routes.ts
 * 
 * This test file directly extracts and tests the route handler functions
 * by mocking the Express Router registration methods.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { Router } from 'express';
import { IStorage } from '../../server/storage';
import { Language, User } from '../../shared/schema';

// Mock data
const mockLanguages: Language[] = [
  { id: 1, code: 'en-US', name: 'English', isActive: true },
  { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
  { id: 3, code: 'fr-FR', name: 'French', isActive: false }
];

const mockActiveLanguages = mockLanguages.filter(lang => lang.isActive);

const mockUser: User = {
  id: 1,
  username: 'testuser',
  password: 'password123'
};

// Create mock request/response factory
const createMockReq = (): Request => ({} as Request);
const createMockRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Mock express Router to capture route handlers
const handlers: Record<string, Record<string, Function>> = {
  get: {},
  post: {},
  put: {},
  delete: {}
};

vi.mock('express', () => {
  // Create a mock router that captures handlers
  const router = {
    get: vi.fn((path, handler) => {
      handlers.get[path] = handler;
      return router;
    }),
    post: vi.fn((path, handler) => {
      handlers.post[path] = handler;
      return router;
    }),
    put: vi.fn((path, handler) => {
      handlers.put[path] = handler;
      return router;
    }),
    delete: vi.fn((path, handler) => {
      handlers.delete[path] = handler;
      return router;
    })
  };
  
  return {
    Router: vi.fn(() => router)
  };
});

// Mock storage
vi.mock('../../server/storage', () => {
  const mockStorage: Partial<IStorage> = {
    getLanguages: vi.fn(),
    getActiveLanguages: vi.fn(),
    getUser: vi.fn()
  };
  
  return {
    storage: mockStorage
  };
});

// Original console.error
const originalConsoleError = console.error;

describe('API Routes Handlers', () => {
  let storageMock: { storage: Partial<IStorage> };
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Replace console.error to reduce test noise
    console.error = vi.fn();
    
    // Reset the captured handlers
    Object.keys(handlers).forEach(method => {
      Object.keys(handlers[method]).forEach(path => {
        delete handlers[method][path];
      });
    });
    
    // Import the routes module to register handlers
    await import('../../server/routes');
    
    // Debug the handlers that were captured
    console.log('Captured handlers:', Object.keys(handlers.get));
    
    // Import storage mock
    storageMock = await import('../../server/storage');
    
    // Set up mock implementations
    storageMock.storage.getLanguages = vi.fn().mockResolvedValue(mockLanguages);
    storageMock.storage.getActiveLanguages = vi.fn().mockResolvedValue(mockActiveLanguages);
    storageMock.storage.getUser = vi.fn().mockImplementation(async (id: number) => {
      return id === 1 ? mockUser : undefined;
    });
  });
  
  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  describe('GET /languages', () => {
    it('should return all languages', async () => {
      // Get the handler
      const handler = handlers.get['/languages'];
      expect(handler).toBeDefined();
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Call the handler
      await handler(req, res);
      
      // Verify the expected behavior
      expect(storageMock.storage.getLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockLanguages);
    });
    
    it('should handle errors', async () => {
      // Get the handler
      const handler = handlers.get['/languages'];
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Set up mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getLanguages = vi.fn().mockRejectedValue(error);
      
      // Call the handler
      await handler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('GET /languages/active', () => {
    it('should return only active languages', async () => {
      // Get the handler
      const handler = handlers.get['/languages/active'];
      expect(handler).toBeDefined();
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Call the handler
      await handler(req, res);
      
      // Verify the expected behavior
      expect(storageMock.storage.getActiveLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockActiveLanguages);
    });
    
    it('should handle errors', async () => {
      // Get the handler
      const handler = handlers.get['/languages/active'];
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Set up mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getActiveLanguages = vi.fn().mockRejectedValue(error);
      
      // Call the handler
      await handler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve active languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('GET /health', () => {
    it('should return health status information', async () => {
      // Get the handler
      const handler = handlers.get['/health'];
      expect(handler).toBeDefined();
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Save original environment for restoration
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // Call the handler
      await handler(req, res);
      
      // Verify health response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        database: 'connected',
        environment: 'test'
      }));
      
      // Check for version property
      const healthData = (res.json as any).mock.calls[0][0];
      expect(healthData).toHaveProperty('version');
      expect(healthData).toHaveProperty('timestamp');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle errors', async () => {
      // Get the handler
      const handler = handlers.get['/health'];
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Simulate an error by making json throw
      res.json = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Call the handler
      await handler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Health check failed' });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('GET /user', () => {
    it('should return user information when user exists', async () => {
      // Get the handler
      const handler = handlers.get['/user'];
      expect(handler).toBeDefined();
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Call the handler
      await handler(req, res);
      
      // Verify user is returned
      expect(storageMock.storage.getUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
    
    it('should return 404 when user does not exist', async () => {
      // Get the handler
      const handler = handlers.get['/user'];
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Setup mock to return undefined (user not found)
      storageMock.storage.getUser = vi.fn().mockResolvedValue(undefined);
      
      // Call the handler
      await handler(req, res);
      
      // Verify 404 response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
    
    it('should handle errors', async () => {
      // Get the handler
      const handler = handlers.get['/user'];
      
      // Create mock request/response
      const req = createMockReq();
      const res = createMockRes();
      
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getUser = vi.fn().mockRejectedValue(error);
      
      // Call the handler
      await handler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve user',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
});
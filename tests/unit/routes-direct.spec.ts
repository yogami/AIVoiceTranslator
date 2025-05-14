/**
 * Direct Tests for routes.ts
 * 
 * This approach directly tests the route handlers by calling them
 * without relying on mocking Express internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { IStorage } from '../../server/storage';
import { Language, User } from '../../shared/schema';

// Create mock data for tests
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

// Mock Express request and response
const mockRequest = (): Request => {
  return {} as Request;
};

const mockResponse = (): Response => {
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

// Save original console.error to restore later
const originalConsoleError = console.error;

describe('API Routes (Direct Testing)', () => {
  let storageMock: { storage: Partial<IStorage> };
  
  // Setup before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Mock console.error to prevent test output noise
    console.error = vi.fn();
    
    // Import and setup storage mock
    storageMock = await import('../../server/storage');
    
    // Setup mock implementations
    storageMock.storage.getLanguages = vi.fn().mockResolvedValue(mockLanguages);
    storageMock.storage.getActiveLanguages = vi.fn().mockResolvedValue(mockActiveLanguages);
    storageMock.storage.getUser = vi.fn().mockImplementation(async (id: number) => {
      return id === 1 ? mockUser : undefined;
    });
  });
  
  // Cleanup after each test
  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });
  
  describe('/languages endpoint', () => {
    it('should return all languages', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const languagesHandler = extractRouteHandler(routes.apiRoutes, 'get', '/languages');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Call the handler directly
      await languagesHandler(req, res);
      
      // Verify the expected behavior
      expect(storageMock.storage.getLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockLanguages);
    });
    
    it('should handle errors', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const languagesHandler = extractRouteHandler(routes.apiRoutes, 'get', '/languages');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getLanguages = vi.fn().mockRejectedValue(error);
      
      // Call the handler directly
      await languagesHandler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('/languages/active endpoint', () => {
    it('should return only active languages', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const activeLanguagesHandler = extractRouteHandler(routes.apiRoutes, 'get', '/languages/active');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Call the handler directly
      await activeLanguagesHandler(req, res);
      
      // Verify the expected behavior
      expect(storageMock.storage.getActiveLanguages).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockActiveLanguages);
    });
    
    it('should handle errors', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const activeLanguagesHandler = extractRouteHandler(routes.apiRoutes, 'get', '/languages/active');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getActiveLanguages = vi.fn().mockRejectedValue(error);
      
      // Call the handler directly
      await activeLanguagesHandler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve active languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('/health endpoint', () => {
    it('should return health status information', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const healthHandler = extractRouteHandler(routes.apiRoutes, 'get', '/health');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Save original environment for restoration
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // Call the handler directly
      await healthHandler(req, res);
      
      // Verify health response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        version: '1.0.0',
        database: 'connected',
        environment: 'test'
      }));
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle errors', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const healthHandler = extractRouteHandler(routes.apiRoutes, 'get', '/health');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Simulate an error by making json throw
      res.json = vi.fn().mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      
      // Call the handler
      await healthHandler(req, res);
      
      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenLastCalledWith({ error: 'Health check failed' });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('/user endpoint', () => {
    it('should return user information when user exists', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const userHandler = extractRouteHandler(routes.apiRoutes, 'get', '/user');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Call the handler directly
      await userHandler(req, res);
      
      // Verify user is returned
      expect(storageMock.storage.getUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
    
    it('should return 404 when user does not exist', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const userHandler = extractRouteHandler(routes.apiRoutes, 'get', '/user');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Setup mock to return undefined (user not found)
      storageMock.storage.getUser = vi.fn().mockResolvedValue(undefined);
      
      // Call the handler directly
      await userHandler(req, res);
      
      // Verify 404 response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
    
    it('should handle errors', async () => {
      // Import routes module for this test
      const routes = await import('../../server/routes');
      const userHandler = extractRouteHandler(routes.apiRoutes, 'get', '/user');
      
      // Create mocks
      const req = mockRequest();
      const res = mockResponse();
      
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getUser = vi.fn().mockRejectedValue(error);
      
      // Call the handler directly
      await userHandler(req, res);
      
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

/**
 * Helper function to extract route handlers from an Express router
 * This works because we are mocking the Express Router to capture the handlers
 */
function extractRouteHandler(router: any, method: string, path: string): Function {
  // We need to redefine the router methods to return the handlers
  const mockExpressRouter = () => {
    const routes: Map<string, Map<string, Function>> = new Map();
    
    const mockRouter: any = {};
    
    ['get', 'post', 'put', 'delete', 'patch'].forEach(m => {
      routes.set(m, new Map());
      
      mockRouter[m] = (routePath: string, handler: Function) => {
        routes.get(m)!.set(routePath, handler);
        return mockRouter;
      };
    });
    
    // Add a method to get a specific handler
    mockRouter._getHandler = (m: string, p: string) => {
      return routes.get(m)?.get(p);
    };
    
    return mockRouter;
  };
  
  // Replace the router with our mock
  vi.doMock('express', () => {
    return {
      Router: mockExpressRouter
    };
  });
  
  // Re-import the routes module to use our custom Router mock
  const routesModule = require('../../server/routes');
  
  // Get the handler using our special _getHandler method
  const handler = routesModule.apiRoutes._getHandler(method, path);
  
  if (!handler) {
    throw new Error(`No handler found for ${method.toUpperCase()} ${path}`);
  }
  
  return handler;
}
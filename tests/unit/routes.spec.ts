import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { apiRoutes } from '../../server/routes';
import { storage } from '../../server/storage';
import { Language, User } from '../../shared/schema';

// Mock storage module
vi.mock('../../server/storage', () => ({
  storage: {
    getLanguages: vi.fn(),
    getActiveLanguages: vi.fn(),
    getUser: vi.fn()
  }
}));

// Mock Express objects
function mockRequest() {
  return {} as Request;
}

function mockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('API Routes', () => {
  let req: Request;
  let res: Response;
  
  // Mock data
  const mockLanguages: Language[] = [
    { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
    { id: 2, code: 'es', name: 'Spanish', isActive: true },
    { id: 3, code: 'de', name: 'German', isActive: false }
  ];
  
  const mockActiveLanguages: Language[] = mockLanguages.filter(l => l.isActive);
  
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    password: 'password123'
  };

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    vi.resetAllMocks();
    
    // Setup console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test for /languages route
  describe('GET /languages', () => {
    it('should return all languages on success', async () => {
      // Arrange
      vi.mocked(storage.getLanguages).mockResolvedValue(mockLanguages);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getLanguages).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(mockLanguages);
    });

    it('should handle errors and return 500 status', async () => {
      // Arrange
      const error = new Error('Database error');
      vi.mocked(storage.getLanguages).mockRejectedValue(error);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getLanguages).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });

  // Test for /languages/active route
  describe('GET /languages/active', () => {
    it('should return only active languages on success', async () => {
      // Arrange
      vi.mocked(storage.getActiveLanguages).mockResolvedValue(mockActiveLanguages);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages/active' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getActiveLanguages).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(mockActiveLanguages);
    });

    it('should handle errors and return 500 status', async () => {
      // Arrange
      const error = new Error('Database error');
      vi.mocked(storage.getActiveLanguages).mockRejectedValue(error);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages/active' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getActiveLanguages).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve active languages',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });

  // Test for /health route
  describe('GET /health', () => {
    it('should return health status', async () => {
      // Arrange
      // Preserve original environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // Mock Date to have consistent timestamp
      const realDateNow = Date.now;
      const mockDate = new Date('2023-01-01T12:00:00Z');
      global.Date = class extends Date {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as typeof global.Date;
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/health' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        timestamp: mockDate.toISOString(),
        version: '1.0.0',
        database: 'connected',
        environment: 'test'
      });
      
      // Restore originals
      global.Date = Date;
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle errors and return 500 status', async () => {
      // Arrange
      vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('JSON error');
      });
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/health' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Health check failed' });
      expect(console.error).toHaveBeenCalled();
      
      // Restore JSON.stringify
      vi.restoreAllMocks();
    });
  });

  // Test for /user route
  describe('GET /user', () => {
    it('should return user data when user exists', async () => {
      // Arrange
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 when user is not found', async () => {
      // Arrange
      vi.mocked(storage.getUser).mockResolvedValue(undefined);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getUser).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should handle errors and return 500 status', async () => {
      // Arrange
      const error = new Error('Database error');
      vi.mocked(storage.getUser).mockRejectedValue(error);
      
      // Get route handler
      const handler = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods.get
      )?.route.stack[0].handle;
      
      if (!handler) {
        throw new Error('Route handler not found');
      }
      
      // Act
      await handler(req, res);
      
      // Assert
      expect(storage.getUser).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve user',
        message: 'Database error'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
});
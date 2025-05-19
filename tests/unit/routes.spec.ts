/**
 * API Routes Tests (Consolidated)
 * 
 * This file consolidates tests for the API routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { apiRoutes } from '../../server/routes';

// Mock the storage dependency
vi.mock('../../server/storage', () => {
  const mockStorage = {
    getLanguages: vi.fn().mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
      { id: 3, code: 'fr-FR', name: 'French', isActive: false }
    ]),
    getActiveLanguages: vi.fn().mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true }
    ]),
    getUser: vi.fn().mockResolvedValue({
      id: 1,
      username: 'testuser',
      password: 'hashedpassword'
    }),
    getUserByUsername: vi.fn().mockResolvedValue({
      id: 1,
      username: 'testuser',
      password: 'hashedpassword'
    })
  };
  
  return {
    storage: mockStorage
  };
});

describe('API Routes', () => {
  // Test helpers for request and response
  let req: Partial<Request>;
  let res: Partial<Response>;
  
  beforeEach(() => {
    // Reset request and response mocks before each test
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });
  
  describe('GET /languages', () => {
    it('should return all languages', async () => {
      // Find the route handler for GET /languages
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /languages route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response
      // Express sets 200 implicitly when using res.json(), so we check that json was called
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ code: 'en-US' }),
        expect.objectContaining({ code: 'es-ES' }),
        expect.objectContaining({ code: 'fr-FR' })
      ]));
    });
    
    it('should handle errors when fetching languages fails', async () => {
      // Setup: Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getLanguages as any).mockRejectedValueOnce(new Error('Database error'));
      
      // Find the route handler for GET /languages
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /languages route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response for error case
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      }));
    });
  });
  
  describe('GET /languages/active', () => {
    it('should return only active languages', async () => {
      // Find the route handler for GET /languages/active
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages/active' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /languages/active route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response
      // Express sets 200 implicitly when using res.json()
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ code: 'en-US', isActive: true }),
        expect.objectContaining({ code: 'es-ES', isActive: true })
      ]));
      
      // Should not include inactive languages
      const responseData = (res.json as any).mock.calls[0][0];
      const hasInactiveLanguage = responseData.some(lang => lang.code === 'fr-FR');
      expect(hasInactiveLanguage).toBe(false);
    });
    
    it('should handle errors when fetching active languages fails', async () => {
      // Setup: Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getActiveLanguages as any).mockRejectedValueOnce(new Error('Database connection failed'));
      
      // Find the route handler for GET /languages/active
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages/active' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /languages/active route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response for error case
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to retrieve active languages',
        message: 'Database connection failed'
      }));
    });
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      // Find the route handler for GET /health
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/health' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /health route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response
      // Express sets 200 implicitly when using res.json()
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String),
        database: expect.any(String),
        environment: expect.any(String)
      }));
    });
    
    it('should handle errors in health check', async () => {
      // Find the route handler for GET /health
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/health' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /health route');
      
      // Mock JSON method to throw an error when called
      res.json = vi.fn().mockImplementationOnce(() => {
        throw new Error('JSON serialization error');
      });
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Health check failed'
      }));
    });
  });
  
  describe('GET /user', () => {
    it('should return user information', async () => {
      // Find the route handler for GET /user
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /user route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response
      // Express sets 200 implicitly when using res.json()
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        username: 'testuser'
      }));
    });
    
    it('should handle user not found scenario', async () => {
      // Setup: Mock storage to return null (user not found)
      const { storage } = await import('../../server/storage');
      (storage.getUser as any).mockResolvedValueOnce(null);
      
      // Find the route handler for GET /user
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /user route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response for user not found
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'User not found'
      }));
    });
    
    it('should handle database errors when fetching user', async () => {
      // Setup: Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getUser as any).mockRejectedValueOnce(new Error('Database connection error'));
      
      // Find the route handler for GET /user
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods?.get
      );
      
      // Extract the handler function
      const handler = route?.route?.stack[0].handle;
      if (!handler) throw new Error('Handler not found for /user route');
      
      // Call the handler
      await handler(req as Request, res as Response, () => {});
      
      // Assert response for error case
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to retrieve user',
        message: 'Database connection error'
      }));
    });
  });
});
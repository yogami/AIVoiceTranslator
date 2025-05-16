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
  return {
    storage: {
      getLanguages: vi.fn().mockResolvedValue([
        { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
        { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
        { id: 3, code: 'fr-FR', name: 'French', isActive: false }
      ]),
      getActiveLanguages: vi.fn().mockResolvedValue([
        { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
        { id: 2, code: 'es-ES', name: 'Spanish', isActive: true }
      ]),
      getUserByUsername: vi.fn().mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword'
      })
    }
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
        layer.route && layer.route.path === '/languages' && layer.route.methods.get
      );
      
      // Extract the handler function
      const handler = route.route.stack[0].handle;
      
      // Call the handler
      await handler(req as Request, res as Response);
      
      // Assert response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ code: 'en-US' }),
        expect.objectContaining({ code: 'es-ES' }),
        expect.objectContaining({ code: 'fr-FR' })
      ]));
    });
  });
  
  describe('GET /languages/active', () => {
    it('should return only active languages', async () => {
      // Find the route handler for GET /languages/active
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/languages/active' && layer.route.methods.get
      );
      
      // Extract the handler function
      const handler = route.route.stack[0].handle;
      
      // Call the handler
      await handler(req as Request, res as Response);
      
      // Assert response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ code: 'en-US', isActive: true }),
        expect.objectContaining({ code: 'es-ES', isActive: true })
      ]));
      
      // Should not include inactive languages
      const responseData = (res.json as any).mock.calls[0][0];
      const hasInactiveLanguage = responseData.some(lang => lang.code === 'fr-FR');
      expect(hasInactiveLanguage).toBe(false);
    });
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      // Find the route handler for GET /health
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/health' && layer.route.methods.get
      );
      
      // Extract the handler function
      const handler = route.route.stack[0].handle;
      
      // Call the handler
      await handler(req as Request, res as Response);
      
      // Assert response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(Number)
      }));
    });
  });
  
  describe('GET /user', () => {
    it('should return user information', async () => {
      // Find the route handler for GET /user
      const route = apiRoutes.stack.find(layer => 
        layer.route && layer.route.path === '/user' && layer.route.methods.get
      );
      
      // Extract the handler function
      const handler = route.route.stack[0].handle;
      
      // Call the handler
      await handler(req as Request, res as Response);
      
      // Assert response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        username: 'testuser'
      }));
      
      // Should not include password in response
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData).not.toHaveProperty('password');
    });
  });
});
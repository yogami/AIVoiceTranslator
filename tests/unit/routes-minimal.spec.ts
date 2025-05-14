/**
 * Minimal tests for routes.ts
 * 
 * This focuses on testing API route handlers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, Router } from 'express';
import { IStorage } from '../../server/storage';

// Mock storage
vi.mock('../../server/storage', () => {
  // Mock implementation of IStorage
  const mockStorage: Partial<IStorage> = {
    getLanguages: vi.fn().mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
      { id: 3, code: 'fr-FR', name: 'French', isActive: false }
    ]),
    getActiveLanguages: vi.fn().mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true }
    ]),
    getUser: vi.fn().mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User'
    })
  };
  
  return {
    storage: mockStorage
  };
});

// Mock Express
vi.mock('express', () => {
  const mockRouter = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };
  
  return {
    Router: vi.fn(() => mockRouter)
  };
});

describe('API Routes', () => {
  let routes;
  let mockRouter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Setup mock request/response
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn()
    };
    
    // Import the module
    routes = await import('../../server/routes');
    mockRouter = Router();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Route initialization', () => {
    it('should export apiRoutes', () => {
      expect(routes.apiRoutes).toBeDefined();
    });
    
    it('should register route handlers', () => {
      // Count registered routes
      const registerCount = (mockRouter.get as vi.Mock).mock.calls.length +
                            (mockRouter.post as vi.Mock).mock.calls.length +
                            (mockRouter.put as vi.Mock).mock.calls.length +
                            (mockRouter.delete as vi.Mock).mock.calls.length;
      
      // We expect at least one route handler to be registered
      expect(registerCount).toBeGreaterThan(0);
    });
  });
  
  describe('Route handlers', () => {
    it('should handle GET /languages', async () => {
      // Find the handler for GET /languages
      const getHandler = (mockRouter.get as vi.Mock).mock.calls.find(
        call => call[0] === '/languages'
      );
      
      // Ensure we found the handler
      expect(getHandler).toBeDefined();
      
      // Execute the handler
      const handler = getHandler[1];
      await handler(mockRequest, mockResponse);
      
      // Verify response
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ code: 'en-US' }),
          expect.objectContaining({ code: 'es-ES' }),
          expect.objectContaining({ code: 'fr-FR' })
        ])
      );
    });
    
    it('should handle GET /languages/active', async () => {
      // Find the handler for GET /languages/active
      const getHandler = (mockRouter.get as vi.Mock).mock.calls.find(
        call => call[0] === '/languages/active'
      );
      
      // Ensure we found the handler
      expect(getHandler).toBeDefined();
      
      // Execute the handler
      const handler = getHandler[1];
      await handler(mockRequest, mockResponse);
      
      // Verify response only includes active languages
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ code: 'en-US', isActive: true }),
          expect.objectContaining({ code: 'es-ES', isActive: true })
        ])
      );
      
      // Verify inactive languages are not included
      const responseData = (mockResponse.json as vi.Mock).mock.calls[0][0];
      const hasFrench = responseData.some(lang => lang.code === 'fr-FR');
      expect(hasFrench).toBe(false);
    });
    
    it('should handle GET /health', async () => {
      // Find the health handler
      const getHandler = (mockRouter.get as vi.Mock).mock.calls.find(
        call => call[0] === '/health'
      );
      
      // Execute the handler
      const handler = getHandler[1];
      await handler(mockRequest, mockResponse);
      
      // Verify response includes health status
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ 
          status: 'ok',
          timestamp: expect.any(Number)
        })
      );
    });
    
    it('should handle GET /user', async () => {
      // Find the user handler
      const getHandler = (mockRouter.get as vi.Mock).mock.calls.find(
        call => call[0] === '/user'
      );
      
      // Execute the handler
      const handler = getHandler[1];
      await handler(mockRequest, mockResponse);
      
      // Verify response includes user data
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        })
      );
    });
  });
});
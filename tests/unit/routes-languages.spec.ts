/**
 * Tests for API Routes - Languages Endpoints
 *
 * These tests verify the language-related API endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the storage module
vi.mock('../../server/storage', () => {
  return {
    storage: {
      getLanguages: vi.fn().mockResolvedValue([
        { id: 1, code: 'en-US', name: 'English (US)', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true },
        { id: 3, code: 'fr', name: 'French', isActive: false },
        { id: 4, code: 'de', name: 'German', isActive: true }
      ]),
      getActiveLanguages: vi.fn().mockResolvedValue([
        { id: 1, code: 'en-US', name: 'English (US)', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true },
        { id: 4, code: 'de', name: 'German', isActive: true }
      ]),
      getLanguageByCode: vi.fn().mockImplementation(async (code) => {
        const languages = [
          { id: 1, code: 'en-US', name: 'English (US)', isActive: true },
          { id: 2, code: 'es', name: 'Spanish', isActive: true },
          { id: 3, code: 'fr', name: 'French', isActive: false },
          { id: 4, code: 'de', name: 'German', isActive: true }
        ];
        return languages.find(lang => lang.code === code);
      }),
      updateLanguageStatus: vi.fn().mockImplementation(async (code, isActive) => {
        const language = await getLanguageByCodeMock(code);
        if (!language) return undefined;
        return { ...language, isActive };
      })
    }
  };
});

// Helper functions for mocks
const getLanguageByCodeMock = async (code) => {
  const languages = [
    { id: 1, code: 'en-US', name: 'English (US)', isActive: true },
    { id: 2, code: 'es', name: 'Spanish', isActive: true },
    { id: 3, code: 'fr', name: 'French', isActive: false },
    { id: 4, code: 'de', name: 'German', isActive: true }
  ];
  return languages.find(lang => lang.code === code);
};

describe('API Routes - Languages', () => {
  let apiRoutes: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseData: any;
  let responseStatus: number;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Reset mock response
    responseData = null;
    responseStatus = 200;
    
    // Create mock request/response
    mockRequest = {};
    mockResponse = {
      json: vi.fn().mockImplementation(data => {
        responseData = data;
        return mockResponse;
      }),
      status: vi.fn().mockImplementation(code => {
        responseStatus = code;
        return mockResponse;
      })
    };
    
    // Import the module
    const routesModule = await import('../../server/routes');
    apiRoutes = routesModule.apiRoutes;
  });
  
  it('should handle GET /languages', async () => {
    // Get the route handler
    const routeHandlers = apiRoutes.stack
      .filter(layer => layer.route && layer.route.path === '/languages' && layer.route.methods.get);
    
    expect(routeHandlers.length).toBeGreaterThan(0);
    
    // Execute the route handler
    const handler = routeHandlers[0].route.stack[0].handle;
    await handler(mockRequest as Request, mockResponse as Response);
    
    // Check response
    expect(mockResponse.json).toHaveBeenCalled();
    expect(responseData).toBeDefined();
    expect(responseData.languages).toHaveLength(4);
  });
  
  it('should handle GET /languages/active', async () => {
    // Get the route handler
    const routeHandlers = apiRoutes.stack
      .filter(layer => layer.route && layer.route.path === '/languages/active' && layer.route.methods.get);
    
    expect(routeHandlers.length).toBeGreaterThan(0);
    
    // Execute the route handler
    const handler = routeHandlers[0].route.stack[0].handle;
    await handler(mockRequest as Request, mockResponse as Response);
    
    // Check response
    expect(mockResponse.json).toHaveBeenCalled();
    expect(responseData).toBeDefined();
    expect(responseData.languages).toHaveLength(3);
    expect(responseData.languages.every(lang => lang.isActive)).toBe(true);
  });
});
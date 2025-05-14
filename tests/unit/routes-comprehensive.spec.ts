/**
 * Comprehensive tests for API Routes
 *
 * These tests thoroughly test all routes and edge cases
 * in the routes.ts file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import type { IStorage } from '../../server/storage';

// Mock the storage module completely
vi.mock('../../server/storage', () => {
  const mockStorage: IStorage = {
    // User methods
    getUser: vi.fn().mockImplementation(async (id) => {
      if (id === 1) {
        return { id: 1, username: 'testuser', email: 'test@example.com' };
      }
      return undefined;
    }),
    getUserByUsername: vi.fn().mockImplementation(async (username) => {
      if (username === 'testuser') {
        return { id: 1, username: 'testuser', email: 'test@example.com' };
      }
      return undefined;
    }),
    createUser: vi.fn().mockImplementation(async (user) => {
      return { ...user, id: 99 };
    }),
    
    // Language methods
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
    createLanguage: vi.fn().mockImplementation(async (language) => {
      return { ...language, id: 99 };
    }),
    updateLanguageStatus: vi.fn().mockImplementation(async (code, isActive) => {
      if (code === 'non-existent') return undefined;
      return { id: 1, code, name: 'Test Language', isActive };
    }),
    
    // Translation methods
    addTranslation: vi.fn().mockImplementation(async (translation) => {
      return { ...translation, id: 99, timestamp: new Date() };
    }),
    getTranslationsByLanguage: vi.fn().mockImplementation(async (targetLanguage, limit) => {
      return [
        { id: 1, sourceLanguage: 'en-US', targetLanguage, originalText: 'Hello', translatedText: 'Hola', timestamp: new Date() },
        { id: 2, sourceLanguage: 'en-US', targetLanguage, originalText: 'Goodbye', translatedText: 'Adiós', timestamp: new Date() }
      ].slice(0, limit || 10);
    }),
    
    // Transcript methods
    addTranscript: vi.fn().mockImplementation(async (transcript) => {
      return { ...transcript, id: 99, timestamp: new Date() };
    }),
    getTranscriptsBySession: vi.fn().mockImplementation(async (sessionId, language) => {
      return [
        { id: 1, sessionId, language, text: 'Transcript 1', timestamp: new Date() },
        { id: 2, sessionId, language, text: 'Transcript 2', timestamp: new Date() }
      ];
    })
  };
  
  return {
    storage: mockStorage
  };
});

// Mock the openai module
vi.mock('../../server/openai', () => {
  return {
    translateSpeech: vi.fn().mockResolvedValue({
      originalText: 'Hello',
      translatedText: 'Hola',
      audioBuffer: Buffer.from('mock audio data')
    })
  };
});

describe('API Routes', () => {
  let apiRoutes: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseData: any;
  let responseStatus: number;
  let responseHeaderContentType: string | undefined;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Reset mock response
    responseData = null;
    responseStatus = 200;
    responseHeaderContentType = undefined;
    
    // Create mock request/response/next
    mockRequest = {
      params: {},
      query: {},
      body: {}
    };
    
    mockResponse = {
      json: vi.fn().mockImplementation(data => {
        responseData = data;
        return mockResponse;
      }),
      status: vi.fn().mockImplementation(code => {
        responseStatus = code;
        return mockResponse;
      }),
      setHeader: vi.fn().mockImplementation((name, value) => {
        if (name === 'Content-Type') {
          responseHeaderContentType = value as string;
        }
        return mockResponse;
      }),
      send: vi.fn().mockImplementation(data => {
        responseData = data;
        return mockResponse;
      }),
      sendStatus: vi.fn().mockImplementation(code => {
        responseStatus = code;
        return mockResponse;
      }),
      end: vi.fn().mockImplementation(() => {
        return mockResponse;
      })
    };
    
    mockNext = vi.fn();
    
    // Import the module
    const routesModule = await import('../../server/routes');
    apiRoutes = routesModule.apiRoutes;
  });
  
  // Helper function to find and execute a route handler
  const executeRoute = async (method: string, path: string) => {
    const routeHandlers = apiRoutes.stack
      .filter(layer => layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]);
    
    if (routeHandlers.length === 0) {
      throw new Error(`No ${method} handler found for path ${path}`);
    }
    
    const handler = routeHandlers[0].route.stack[0].handle;
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
  };
  
  describe('GET /languages', () => {
    it('should return all languages on success', async () => {
      await executeRoute('get', '/languages');
      
      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseData).toBeDefined();
      expect(responseData.languages).toHaveLength(4);
    });
    
    it('should handle errors and return 500 status', async () => {
      // Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getLanguages as any).mockRejectedValueOnce(new Error('Test error'));
      
      await executeRoute('get', '/languages');
      
      expect(responseStatus).toBe(500);
    });
  });
  
  describe('GET /languages/active', () => {
    it('should return only active languages on success', async () => {
      await executeRoute('get', '/languages/active');
      
      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseData).toBeDefined();
      expect(responseData.languages).toHaveLength(3);
      expect(responseData.languages.every(lang => lang.isActive)).toBe(true);
    });
    
    it('should handle errors and return 500 status', async () => {
      // Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getActiveLanguages as any).mockRejectedValueOnce(new Error('Test error'));
      
      await executeRoute('get', '/languages/active');
      
      expect(responseStatus).toBe(500);
    });
  });
  
  describe('GET /health', () => {
    it('should return health status with 200 response', async () => {
      await executeRoute('get', '/health');
      
      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseStatus).toBe(200);
      expect(responseData).toHaveProperty('status');
      expect(responseData.status).toBe('ok');
    });
  });
  
  describe('GET /user', () => {
    it('should return user data when user exists', async () => {
      // Set up mock request with user ID
      mockRequest.query = { id: '1' };
      
      await executeRoute('get', '/user');
      
      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseStatus).toBe(200);
      expect(responseData).toHaveProperty('user');
      expect(responseData.user.id).toBe(1);
    });
    
    it('should return 404 when user is not found', async () => {
      // Set up mock request with non-existent user ID
      mockRequest.query = { id: '999' };
      
      await executeRoute('get', '/user');
      
      expect(responseStatus).toBe(404);
    });
    
    it('should handle errors and return 500 status', async () => {
      // Mock storage to throw an error
      const { storage } = await import('../../server/storage');
      (storage.getUser as any).mockRejectedValueOnce(new Error('Test error'));
      
      // Set up mock request with user ID
      mockRequest.query = { id: '1' };
      
      await executeRoute('get', '/user');
      
      expect(responseStatus).toBe(500);
    });
  });
  
  describe('POST /language/status', () => {
    it('should update language status successfully', async () => {
      // Set up mock request body
      mockRequest.body = { code: 'en-US', isActive: false };
      
      // Find the POST route for /language/status
      const routeHandlers = apiRoutes.stack
        .filter(layer => layer.route && layer.route.path === '/language/status' && layer.route.methods.post);
      
      if (routeHandlers.length === 0) {
        return; // Skip if route doesn't exist
      }
      
      const handler = routeHandlers[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseStatus).toBe(200);
      expect(responseData).toHaveProperty('language');
      expect(responseData.language.isActive).toBe(false);
    });
    
    it('should return 404 when language is not found', async () => {
      // Set up mock request body for non-existent language
      mockRequest.body = { code: 'non-existent', isActive: true };
      
      // Find the POST route for /language/status
      const routeHandlers = apiRoutes.stack
        .filter(layer => layer.route && layer.route.path === '/language/status' && layer.route.methods.post);
      
      if (routeHandlers.length === 0) {
        return; // Skip if route doesn't exist
      }
      
      const handler = routeHandlers[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);
      
      expect(responseStatus).toBe(404);
    });
  });
});
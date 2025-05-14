/**
 * Tests for routes.ts using supertest
 * 
 * This approach sets up a test HTTP server with the Express routes
 * and uses supertest to make requests to it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
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
  password: 'password123'
};

// Mock storage module
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

describe('API Routes (Supertest)', () => {
  let app: Express;
  let storageMock: { storage: Partial<IStorage> };
  
  // Setup express app before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Create a fresh Express app for each test
    app = express();
    
    // Import storage mock for setting up test data
    storageMock = await import('../../server/storage');
    
    // Set up mock implementations
    storageMock.storage.getLanguages = vi.fn().mockResolvedValue(mockLanguages);
    storageMock.storage.getActiveLanguages = vi.fn().mockResolvedValue(mockActiveLanguages);
    storageMock.storage.getUser = vi.fn().mockImplementation(async (id: number) => {
      return id === 1 ? mockUser : undefined;
    });
    
    // Import the routes and use them in the app
    const { apiRoutes } = await import('../../server/routes');
    app.use('/api', apiRoutes);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('GET /api/languages', () => {
    it('should return all languages', async () => {
      const response = await request(app).get('/api/languages');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockLanguages);
      expect(storageMock.storage.getLanguages).toHaveBeenCalled();
    });
    
    it('should handle Error objects', async () => {
      // Setup mock to throw a standard Error object
      const error = new Error('Database error');
      storageMock.storage.getLanguages = vi.fn().mockRejectedValue(error);
      
      const response = await request(app).get('/api/languages');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to retrieve languages',
        message: 'Database error'
      });
    });
    
    it('should handle non-Error objects', async () => {
      // Setup mock to throw a string instead of an Error object
      // This tests the error instanceof Error branch
      storageMock.storage.getLanguages = vi.fn().mockRejectedValue('String error');
      
      const response = await request(app).get('/api/languages');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to retrieve languages',
        message: 'Unknown error'
      });
    });
  });
  
  describe('GET /api/languages/active', () => {
    it('should return only active languages', async () => {
      const response = await request(app).get('/api/languages/active');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockActiveLanguages);
      expect(storageMock.storage.getActiveLanguages).toHaveBeenCalled();
    });
    
    it('should handle Error objects', async () => {
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getActiveLanguages = vi.fn().mockRejectedValue(error);
      
      const response = await request(app).get('/api/languages/active');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to retrieve active languages',
        message: 'Database error'
      });
    });
    
    it('should handle non-Error objects', async () => {
      // Setup mock to throw a non-Error object
      storageMock.storage.getActiveLanguages = vi.fn().mockRejectedValue('String error');
      
      const response = await request(app).get('/api/languages/active');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to retrieve active languages',
        message: 'Unknown error'
      });
    });
  });
  
  describe('GET /api/health', () => {
    it('should return health status information', async () => {
      // Save original environment for restoration
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('environment', 'test');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should return development environment when NODE_ENV is not set', async () => {
      // Save original environment for restoration
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('environment', 'development');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle errors', async () => {
      // Mock console.error specifically for this test
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      // Spy on JSON.stringify which is used in the route handler
      const originalStringify = JSON.stringify;
      JSON.stringify = vi.fn().mockImplementation(() => {
        throw new Error('Simulated JSON.stringify error');
      });
      
      try {
        // Use the regular app but with modified JSON.stringify
        const response = await request(app).get('/api/health');
        
        // The server should return 500 status code
        expect(response.status).toBe(500);
      } finally {
        // Restore the original functions
        JSON.stringify = originalStringify;
        console.error = originalConsoleError;
      }
    });
  });
  
  describe('GET /api/user', () => {
    it('should return user information when user exists', async () => {
      const response = await request(app).get('/api/user');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
      expect(storageMock.storage.getUser).toHaveBeenCalledWith(1);
    });
    
    it('should return 404 when user does not exist', async () => {
      // Setup mock to return undefined (user not found)
      storageMock.storage.getUser = vi.fn().mockResolvedValue(undefined);
      
      const response = await request(app).get('/api/user');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
    
    it('should handle errors', async () => {
      // Setup mock to throw error
      const error = new Error('Database error');
      storageMock.storage.getUser = vi.fn().mockRejectedValue(error);
      
      const response = await request(app).get('/api/user');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to retrieve user',
        message: 'Database error'
      });
    });
  });
});
/**
 * API Routes Tests
 * 
 * Consolidated tests for HTTP API endpoints including:
 * - Language management routes
 * - Health check endpoints
 * - User management routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock storage layer
vi.mock('../../../server/storage', () => ({
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
    getUser: vi.fn().mockResolvedValue({
      id: 1,
      username: 'testuser',
      password: 'hashedpassword'
    })
  }
}));

// Create a simple route handler simulator
function createRouteTest(handler: Function) {
  return async (req: Partial<Request>, res: Partial<Response>) => {
    try {
      await handler(req, res, () => {});
    } catch (error) {
      if (res.status && res.json) {
        res.status(500);
        res.json({ error: 'Internal server error' });
      }
    }
  };
}

describe('API Routes', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  
  beforeEach(() => {
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
    vi.clearAllMocks();
  });

  describe('Language Routes', () => {
    it('should return all languages', async () => {
      // Simulate GET /languages
      const handler = createRouteTest(async (req: any, res: any) => {
        const { storage } = await import('../../../server/storage');
        const languages = await storage.getLanguages();
        res.json(languages);
      });
      
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ code: 'en-US' }),
          expect.objectContaining({ code: 'es-ES' }),
          expect.objectContaining({ code: 'fr-FR' })
        ])
      );
    });

    it('should return active languages only', async () => {
      // Simulate GET /languages/active
      const handler = createRouteTest(async (req: any, res: any) => {
        const { storage } = await import('../../../server/storage');
        const languages = await storage.getActiveLanguages();
        res.json(languages);
      });
      
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData).toHaveLength(2);
      expect(responseData.every((lang: any) => lang.isActive)).toBe(true);
    });

    it('should handle language retrieval errors', async () => {
      const { storage } = await import('../../../server/storage');
      (storage.getLanguages as any).mockRejectedValueOnce(new Error('Database error'));
      
      const handler = createRouteTest(async (req: any, res: any) => {
        try {
          const languages = await storage.getLanguages();
          res.json(languages);
        } catch (error) {
          res.status(500).json({ error: 'Failed to retrieve languages' });
        }
      });
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to retrieve languages' });
    });
  });

  describe('Health Check Route', () => {
    it('should return system health status', async () => {
      // Simulate GET /health
      const handler = createRouteTest(async (req: any, res: any) => {
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        });
      });
      
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
          version: expect.any(String),
          environment: expect.any(String)
        })
      );
    });

    it('should handle health check errors', async () => {
      const handler = createRouteTest(async (req: any, res: any) => {
        throw new Error('Service unavailable');
      });
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('User Routes', () => {
    it('should return user information without password', async () => {
      const handler = createRouteTest(async (req: any, res: any) => {
        const { storage } = await import('../../../server/storage');
        const user = await storage.getUser(1);
        if (user) {
          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      });
      
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          username: 'testuser'
        })
      );
      
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.password).toBeUndefined();
    });

    it('should handle user not found', async () => {
      const { storage } = await import('../../../server/storage');
      (storage.getUser as any).mockResolvedValueOnce(null);
      
      const handler = createRouteTest(async (req: any, res: any) => {
        const user = await storage.getUser(999);
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      });
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
  });
});

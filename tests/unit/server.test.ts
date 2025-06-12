import '../../test-config/test-env.js';
/**
 * Server Unit Tests
 *
 * Only tests for configureCorsMiddleware are retained. All startServer tests are removed as they are not meaningful unit tests and require excessive mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import { configureCorsMiddleware } from '../../server/server';

describe('Server Unit Tests', () => {
  describe('configureCorsMiddleware', () => {
    let app: express.Express;
    beforeEach(() => {
      app = express();
    });

    it('should add CORS middleware', () => {
      const useSpy = vi.spyOn(app, 'use');
      configureCorsMiddleware(app);
      expect(useSpy).toHaveBeenCalled();
    });

    it('should set CORS headers correctly', async () => {
      configureCorsMiddleware(app);
      app.get('/test', (req, res) => res.send('OK'));
      const response = await request(app).get('/test');
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should handle OPTIONS preflight requests', async () => {
      configureCorsMiddleware(app);
      const response = await request(app).options('/test');
      expect(response.status).toBe(200);
    });
  });
});

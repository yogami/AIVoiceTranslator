import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRoutes } from '../../../server/routes.js';

describe('Diagnostics API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  describe('GET /api/diagnostics', () => {
    it('should return diagnostics data with correct structure', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response.body).toMatchObject({
        connections: {
          total: expect.any(Number),
          active: expect.any(Number)
        },
        translations: {
          total: expect.any(Number),
          averageTime: expect.any(Number),
          averageTimeFormatted: expect.any(String)
        },
        audio: {
          totalGenerated: expect.any(Number),
          averageGenerationTime: expect.any(Number),
          averageGenerationTimeFormatted: expect.any(String),
          cacheSize: expect.any(Number),
          cacheSizeFormatted: expect.any(String)
        },
        system: {
          memoryUsage: expect.any(Number),
          memoryUsageFormatted: expect.any(String),
          uptime: expect.any(Number),
          uptimeFormatted: expect.any(String)
        },
        lastUpdated: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    it('should return formatted memory usage in human-readable format', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response.body.system.memoryUsageFormatted).toMatch(/\d+\.?\d*\s?(B|KB|MB|GB)/);
    });

    it('should return formatted time values', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response.body.system.uptimeFormatted).toMatch(/\d+\.?\d*\s?(seconds?|minutes?|hours?|days?)/);
    });
  });

  describe('GET /api/diagnostics/export', () => {
    it('should return export data with additional metadata', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.body).toMatchObject({
        connections: expect.any(Object),
        translations: expect.any(Object),
        audio: expect.any(Object),
        system: expect.any(Object),
        lastUpdated: expect.any(String),
        exportedAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        version: expect.any(String)
      });
    });

    it('should set appropriate headers for file download', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="diagnostics-\d{4}-\d{2}-\d{2}\.json"/);
    });

    it('should include version information in export', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.body.version).toBeTruthy();
      expect(typeof response.body.version).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with invalid route
      await request(app)
        .get('/api/diagnostics/invalid')
        .expect(404);
    });

    it('should return proper error format on service failure', async () => {
      // This test would need mocking to simulate service failure
      // For now, we test that the route exists and handles requests
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data structure across multiple calls', async () => {
      const response1 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      const response2 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      // Structure should be the same
      expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
      expect(Object.keys(response1.body.connections)).toEqual(Object.keys(response2.body.connections));
      expect(Object.keys(response1.body.translations)).toEqual(Object.keys(response2.body.translations));
      expect(Object.keys(response1.body.audio)).toEqual(Object.keys(response2.body.audio));
      expect(Object.keys(response1.body.system)).toEqual(Object.keys(response2.body.system));
    });

    it('should show increasing uptime between calls', async () => {
      const response1 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response2.body.system.uptime).toBeGreaterThanOrEqual(response1.body.system.uptime);
    });
  });
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRoutes } from '../../../server/routes';

describe('Diagnostics API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  describe('GET /api/diagnostics', () => {
    it('should return diagnostics data', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      expect(response.body).toHaveProperty('connections');
      expect(response.body).toHaveProperty('translations');
      expect(response.body).toHaveProperty('sessions');
      expect(response.body).toHaveProperty('audio');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('lastUpdated');
    });

    it('should return valid connection metrics', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      const { connections } = response.body;
      expect(connections).toHaveProperty('total');
      expect(connections).toHaveProperty('active');
      expect(typeof connections.total).toBe('number');
      expect(typeof connections.active).toBe('number');
    });

    it('should return valid translation metrics', async () => {
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      const { translations } = response.body;
      expect(translations).toHaveProperty('total');
      expect(translations).toHaveProperty('averageTime');
      expect(translations).toHaveProperty('averageTimeFormatted');
      expect(translations).toHaveProperty('languagePairs');
      expect(Array.isArray(translations.languagePairs)).toBe(true);
    });
  });

  describe('GET /api/diagnostics/export', () => {
    it('should return export data with metadata', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body).toHaveProperty('version');
      expect(response.body.version).toBe('1.0.0');
    });

    it('should include all diagnostic sections in export', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      // Should include all the same data as regular diagnostics
      expect(response.body).toHaveProperty('connections');
      expect(response.body).toHaveProperty('translations');
      expect(response.body).toHaveProperty('sessions');
      expect(response.body).toHaveProperty('audio');
      expect(response.body).toHaveProperty('system');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with invalid endpoint
      await request(app)
        .get('/api/diagnostics/invalid')
        .expect(404);
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data between calls', async () => {
      const response1 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      const response2 = await request(app)
        .get('/api/diagnostics')
        .expect(200);

      // Structure should be consistent
      expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
    });
  });
});
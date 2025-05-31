import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { storage } from '../../server/storage';
import { apiRoutes } from '../../server/routes';

describe('Diagnostics API Integration Tests', () => {
  let app: express.Application;
  let server: any;

  beforeEach(() => {
    // Create a test app instance
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    server = createServer(app);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
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
  });

  describe('GET /api/diagnostics/export', () => {
    it('should return export data with additional metadata', async () => {
      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.body).toHaveProperty('exportTimestamp');
      expect(response.body).toHaveProperty('exportVersion');
      expect(response.body).toHaveProperty('applicationInfo');
      expect(response.body).toHaveProperty('currentMetrics');
      expect(response.body).toHaveProperty('historicalData');
      expect(response.body).toHaveProperty('systemInfo');
      expect(response.body).toHaveProperty('configurationSnapshot');
    });
  });

  describe('GET /api/diagnostics/adoption', () => {
    it('should return adoption metrics with default 30-day period', async () => {
      const response = await request(app)
        .get('/api/diagnostics/adoption')
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('userTrends');
      expect(response.body).toHaveProperty('engagement');
      expect(response.body).toHaveProperty('usage');
      
      expect(response.body.summary).toHaveProperty('totalUsers');
      expect(response.body.summary).toHaveProperty('activeUsers24h');
      expect(response.body.summary).toHaveProperty('growthRate7d');
      expect(response.body.summary).toHaveProperty('growthRate30d');
    });

    it('should accept period parameter', async () => {
      const response = await request(app)
        .get('/api/diagnostics/adoption?period=7')
        .expect(200);

      expect(response.body).toBeDefined();
      // Data should be for 7-day period
      expect(response.body.userTrends.daily.length).toBeLessThanOrEqual(7);
    });

    it('should handle invalid period gracefully', async () => {
      const response = await request(app)
        .get('/api/diagnostics/adoption?period=invalid')
        .expect(200);

      // Should default to 30 days
      expect(response.body).toBeDefined();
    });

    it('should return correct structure for charts', async () => {
      const response = await request(app)
        .get('/api/diagnostics/adoption?period=7')
        .expect(200);

      // Check daily trends structure
      if (response.body.userTrends.daily.length > 0) {
        const dailyItem = response.body.userTrends.daily[0];
        expect(dailyItem).toHaveProperty('date');
        expect(dailyItem).toHaveProperty('teachers');
        expect(dailyItem).toHaveProperty('students');
        expect(dailyItem).toHaveProperty('sessions');
      }

      // Check hourly trends structure
      if (response.body.userTrends.hourly.length > 0) {
        const hourlyItem = response.body.userTrends.hourly[0];
        expect(hourlyItem).toHaveProperty('hour');
        expect(hourlyItem).toHaveProperty('avgSessions');
        expect(hourlyItem).toHaveProperty('avgUsers');
      }
    });

    it('should calculate metrics correctly with test data', async () => {
      // Create test sessions using the real storage
      await storage.createSession({
        sessionId: 'test-session-1',
        teacherLanguage: 'en-US',
        studentsCount: 5,
        isActive: true
      });

      await storage.createSession({
        sessionId: 'test-session-2',
        teacherLanguage: 'es',
        studentsCount: 3,
        isActive: true
      });

      const response = await request(app)
        .get('/api/diagnostics/adoption?period=1')
        .expect(200);

      expect(response.body.summary.totalUsers).toBeGreaterThan(0);
      expect(response.body.userTrends.daily.length).toBeGreaterThan(0);
    });
  });

  describe('Real world scenarios', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        request(app).get('/api/diagnostics').expect(200)
      );
      
      const responses = await Promise.all(promises);
      responses.forEach((response: any) => {
        expect(response.body).toHaveProperty('lastUpdated');
      });
    });

    it('should maintain data consistency across requests', async () => {
      // Create session
      await storage.createSession({
        sessionId: 'consistency-test',
        teacherLanguage: 'en-US',
        studentsCount: 5,
        isActive: true
      });

      // First request
      const response1 = await request(app)
        .get('/api/diagnostics/adoption?period=1')
        .expect(200);

      // Second request should have same data
      const response2 = await request(app)
        .get('/api/diagnostics/adoption?period=1')
        .expect(200);

      expect(response1.body.summary.totalUsers)
        .toBe(response2.body.summary.totalUsers);
    });

    it('should handle large data sets', async () => {
      // Create many sessions
      for (let i = 0; i < 100; i++) {
        await storage.createSession({
          sessionId: `bulk-test-${i}`,
          teacherLanguage: 'en-US',
          studentsCount: Math.floor(Math.random() * 10) + 1,
          isActive: true
        });
      }

      const response = await request(app)
        .get('/api/diagnostics/adoption?period=1')
        .expect(200);

      expect(response.body.summary.totalUsers).toBeGreaterThan(50);
    });
  });
});
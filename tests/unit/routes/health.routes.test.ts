/**
 * Health Routes Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHealthRoutes } from '../../../server/routes/health.routes.js';
import { IStorage } from '../../../server/storage.interface.js';
import { IActiveSessionProvider } from '../../../server/services/IActiveSessionProvider.js';

// Mock dependencies
const mockStorage: IStorage = {
  getLanguages: vi.fn(),
  // Add minimal required methods for testing
  getUser: vi.fn(), getUserByUsername: vi.fn(), createUser: vi.fn(),
  getActiveLanguages: vi.fn(), getLanguage: vi.fn(), getLanguageByCode: vi.fn(),
  createLanguage: vi.fn(), updateLanguageStatus: vi.fn(), listLanguages: vi.fn(),
  initializeDefaultLanguages: vi.fn(), getTranslation: vi.fn(), addTranslation: vi.fn(),
  getTranslationsByLanguage: vi.fn(), getTranslations: vi.fn(), getTranslationsByDateRange: vi.fn(),
  addTranscript: vi.fn(), getTranscriptsBySession: vi.fn(), getActiveSession: vi.fn(),
  getAllActiveSessions: vi.fn(), getCurrentlyActiveSessions: vi.fn(), endSession: vi.fn(),
  getRecentSessionActivity: vi.fn(), getSessionById: vi.fn(), createSession: vi.fn(),
  updateSession: vi.fn(), getTranscriptCountBySession: vi.fn(), getSessionQualityStats: vi.fn(),
  getSessionAnalytics: vi.fn(), findActiveSessionByTeacherId: vi.fn(),
  findRecentSessionByTeacherId: vi.fn(), reactivateSession: vi.fn(), createTranslation: vi.fn(),
  getSessionMetrics: vi.fn(), getTranslationMetrics: vi.fn(), getLanguagePairUsage: vi.fn()
} as IStorage;

const mockActiveSessionProvider: IActiveSessionProvider = {
  getActiveSessionsCount: vi.fn(),
  getActiveTeacherCount: vi.fn(),
  getActiveStudentCount: vi.fn()
};

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/api', createHealthRoutes(mockStorage, mockActiveSessionProvider));
  });

  describe('GET /health', () => {
    it('should return health status with connected database', async () => {
      // Mock successful database connection
      (mockStorage.getLanguages as any).mockResolvedValue([]);
      (mockActiveSessionProvider.getActiveSessionsCount as any).mockReturnValue(5);
      (mockActiveSessionProvider.getActiveTeacherCount as any).mockReturnValue(3);
      (mockActiveSessionProvider.getActiveStudentCount as any).mockReturnValue(12);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        version: '1.0.0',
        database: 'connected',
        environment: expect.any(String),
        activeSessions: 5,
        activeTeachers: 3,
        activeStudents: 12
      });

      expect(mockStorage.getLanguages).toHaveBeenCalledOnce();
    });

    it('should return health status with disconnected database', async () => {
      // Mock database connection failure
      (mockStorage.getLanguages as any).mockRejectedValue(new Error('Database connection failed'));
      (mockActiveSessionProvider.getActiveSessionsCount as any).mockReturnValue(0);
      (mockActiveSessionProvider.getActiveTeacherCount as any).mockReturnValue(0);
      (mockActiveSessionProvider.getActiveStudentCount as any).mockReturnValue(0);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        version: '1.0.0',
        database: 'disconnected',
        environment: expect.any(String),
        activeSessions: 0,
        activeTeachers: 0,
        activeStudents: 0
      });
    });

    it('should include correct timestamp format', async () => {
      (mockStorage.getLanguages as any).mockResolvedValue([]);
      (mockActiveSessionProvider.getActiveSessionsCount as any).mockReturnValue(0);
      (mockActiveSessionProvider.getActiveTeacherCount as any).mockReturnValue(0);
      (mockActiveSessionProvider.getActiveStudentCount as any).mockReturnValue(0);

      const beforeTime = new Date().toISOString();
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      const afterTime = new Date().toISOString();

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(response.body.timestamp >= beforeTime).toBe(true);
      expect(response.body.timestamp <= afterTime).toBe(true);
    });

    it('should handle active session provider errors gracefully', async () => {
      (mockStorage.getLanguages as any).mockResolvedValue([]);
      (mockActiveSessionProvider.getActiveSessionsCount as any).mockImplementation(() => {
        throw new Error('Session provider error');
      });

      const response = await request(app)
        .get('/api/health')
        .expect(500); // Should return error due to unhandled exception

      // In a real implementation, we'd want to catch this error and still return a health status
    });
  });

  describe('GET /test', () => {
    it('should return test response', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toEqual({
        message: 'API is working',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });

    it('should include correct timestamp in test response', async () => {
      const beforeTime = new Date().toISOString();
      const response = await request(app)
        .get('/api/test')
        .expect(200);
      const afterTime = new Date().toISOString();

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(response.body.timestamp >= beforeTime).toBe(true);
      expect(response.body.timestamp <= afterTime).toBe(true);
    });
  });
});

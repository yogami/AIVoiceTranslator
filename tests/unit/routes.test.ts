// Set all required env vars for strict config at the very top (no fallbacks)
process.env.PORT = '5001';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/testdb';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.VITE_API_URL = 'http://127.0.0.1:5001';
process.env.VITE_WS_URL = 'ws://127.0.0.1:5001';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';

['PORT','HOST','DATABASE_URL','OPENAI_API_KEY','VITE_API_URL','VITE_WS_URL','NODE_ENV','LOG_LEVEL'].forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

/**
 * API Routes Tests (Consolidated)
 *
 * This file consolidates tests for the API routes
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express, Router } from 'express';
import { createApiRoutes, apiErrorHandler } from '../../server/routes';
import { type IStorage } from '../../server/storage.interface';
import { type SessionCleanupService } from '../../server/services/SessionCleanupService';
import { type IActiveSessionProvider } from '../../server/services/IActiveSessionProvider';
import type { Language, Translation, Transcript, User, Session, InsertSession, InsertTranslation, InsertTranscript, InsertUser, InsertLanguage } from '../../shared/schema';

// Mocks for dependencies
const mockStorage: IStorage = {
  // User methods
  getUser: vi.fn(),
  getUserByUsername: vi.fn(),
  createUser: vi.fn(),

  // Language methods
  getLanguages: vi.fn(),
  getActiveLanguages: vi.fn(),
  getLanguageByCode: vi.fn(),
  createLanguage: vi.fn(),
  updateLanguageStatus: vi.fn(),

  // Translation methods
  addTranslation: vi.fn(),
  getTranslationsByLanguage: vi.fn(),
  getTranslations: vi.fn(),
  getTranslationsByDateRange: vi.fn(),

  // Transcript methods
  addTranscript: vi.fn(),
  getTranscriptsBySession: vi.fn(),

  // Session methods
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getActiveSession: vi.fn(),
  getAllActiveSessions: vi.fn(),
  getCurrentlyActiveSessions: vi.fn(),
  endSession: vi.fn(),
  getRecentSessionActivity: vi.fn(),
  getSessionById: vi.fn(),
  getTranscriptCountBySession: vi.fn(),
  getSessionQualityStats: vi.fn(),

  // Teacher ID session methods
  findActiveSessionByTeacherId: vi.fn(),
  findRecentSessionByTeacherId: vi.fn(),
  reactivateSession: vi.fn(),

  // Analytics methods
  getSessionAnalytics: vi.fn(),
  getSessionMetrics: vi.fn(),
  getTranslationMetrics: vi.fn(),
  getLanguagePairUsage: vi.fn(),
};

const mockCleanupService = {
  start: vi.fn(),
  stop: vi.fn(),
} as unknown as SessionCleanupService;

const mockActiveSessionProvider: IActiveSessionProvider = {
  getActiveSessionsCount: vi.fn().mockReturnValue(0),
  getActiveTeacherCount: vi.fn().mockReturnValue(0),
  getActiveStudentCount: vi.fn().mockReturnValue(0),
};

describe('API Routes', () => {
  let app: Express;

  beforeEach(async () => {
    // Reset all method mocks on mockStorage
    for (const key in mockStorage) {
      if (typeof (mockStorage as any)[key].mockClear === 'function') {
        (mockStorage as any)[key].mockClear();
      }
    }
    // Setup default resolves for commonly used storage methods
    vi.mocked(mockStorage.getLanguages).mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
      { id: 3, code: 'fr-FR', name: 'French', isActive: false }
    ] as Language[]);
    vi.mocked(mockStorage.getActiveLanguages).mockResolvedValue([
      { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
      { id: 2, code: 'es-ES', name: 'Spanish', isActive: true }
    ] as Language[]);
    vi.mocked(mockStorage.getUser).mockResolvedValue(
      { id: 1, username: 'testuser', password: 'hashedpassword' } as User
    );
    vi.mocked(mockStorage.addTranslation).mockImplementation(async (data: InsertTranslation) => (
      { id: 1, ...data, timestamp: new Date() } as unknown as Translation
    ));
    vi.mocked(mockStorage.getTranslationsByLanguage).mockResolvedValue([]);
    vi.mocked(mockStorage.addTranscript).mockImplementation(async (data: InsertTranscript) => (
      { id: 1, ...data, timestamp: new Date() } as unknown as Transcript
    ));
    vi.mocked(mockStorage.getTranscriptsBySession).mockResolvedValue([]);
    vi.mocked(mockStorage.updateLanguageStatus).mockImplementation(async (code: string, isActive: boolean) => (
      { id: 1, code, name: 'Test Language', isActive } as Language
    ));
    vi.mocked(mockStorage.getRecentSessionActivity).mockResolvedValue([]);


    vi.mocked(mockCleanupService.start).mockClear();
    vi.mocked(mockCleanupService.stop).mockClear();

    vi.mocked(mockActiveSessionProvider.getActiveSessionsCount).mockClear().mockReturnValue(0);
    vi.mocked(mockActiveSessionProvider.getActiveTeacherCount).mockClear().mockReturnValue(0);
    vi.mocked(mockActiveSessionProvider.getActiveStudentCount).mockClear().mockReturnValue(0);

    app = express();
    app.use(express.json());

    const apiRouter: Router = createApiRoutes(
      mockStorage,
      mockActiveSessionProvider,
      mockCleanupService
    );
    app.use('/api', apiRouter);
    // Mount the error handler globally, after other routes
    app.use(apiErrorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/languages', () => {
    it('should return all languages', async () => {
      const expectedLanguages = [
        { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
        { id: 2, code: 'es-ES', name: 'Spanish', isActive: true },
        { id: 3, code: 'fr-FR', name: 'French', isActive: false }
      ];
      // The default mock in beforeEach already sets this up, but we can override if needed for a specific test
      // For this test, the default is fine.
      const response = await request(app)
        .get('/api/languages')
        .expect(200);

      expect(response.body).toEqual(expectedLanguages);
      expect(mockStorage.getLanguages).toHaveBeenCalledTimes(1);
    });

    it('should return only active languages for /active', async () => {
      const expectedActiveLanguages = [
        { id: 1, code: 'en-US', name: 'English (United States)', isActive: true },
        { id: 2, code: 'es-ES', name: 'Spanish', isActive: true }
      ];
      const response = await request(app)
        .get('/api/languages/active')
        .expect(200);

      expect(response.body).toEqual(expectedActiveLanguages);
      expect(response.body.every((lang: any) => lang.isActive)).toBe(true);
      expect(mockStorage.getActiveLanguages).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/translations', () => {
    it('should save translation with valid data', async () => {
      const translationData = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 100
      };
      // Default addTranslation mock in beforeEach is sufficient
      const response = await request(app)
        .post('/api/translations')
        .send(translationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.sourceLanguage).toBe(translationData.sourceLanguage);
      expect(response.body.targetLanguage).toBe(translationData.targetLanguage);
      expect(response.body.originalText).toBe(translationData.originalText);
      expect(response.body.translatedText).toBe(translationData.translatedText);
      // Ensure timestamp is a string (as it's serialized over HTTP)
      expect(response.body.timestamp).toEqual(expect.any(String)); 
      expect(mockStorage.addTranslation).toHaveBeenCalledWith(translationData);
    });

    it('should return 400 if required fields are missing for translation', async () => {
      const invalidData = {
        sourceLanguage: 'en-US',
      };
      const response = await request(app)
        .post('/api/translations')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/translations/:language', () => {
    it('should return translations if language exists', async () => {
      const mockTranslations = [
        {
          id: 1,
          sourceLanguage: 'en-US',
          targetLanguage: 'es-ES',
          originalText: 'Hello',
          translatedText: 'Hola',
          latency: 100,
          timestamp: new Date().toISOString() // Match stringified date
        }
      ];
      vi.mocked(mockStorage.getTranslationsByLanguage).mockResolvedValueOnce(mockTranslations as any);

      const response = await request(app)
        .get('/api/translations/es-ES')
        .expect(200);

      expect(response.body).toEqual(mockTranslations);
      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('es-ES', 10);
    });

    it('should return empty array if no translations exist for language', async () => {
      vi.mocked(mockStorage.getTranslationsByLanguage).mockResolvedValueOnce([]);
      const response = await request(app)
        .get('/api/translations/zh-CN')
        .expect(200);

      expect(response.body).toEqual([]);
      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('zh-CN', 10);
    });

    it('should limit results when limit query param is provided', async () => {
      const mockLimitedTranslations = [
        { id: 1, targetLanguage: 'fr-FR', timestamp: new Date().toISOString() },
        { id: 2, targetLanguage: 'fr-FR', timestamp: new Date().toISOString() }
      ];
      vi.mocked(mockStorage.getTranslationsByLanguage).mockResolvedValueOnce(mockLimitedTranslations as any);

      const response = await request(app)
        .get('/api/translations/fr-FR?limit=2')
        .expect(200);

      expect(response.body).toEqual(mockLimitedTranslations);
      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('fr-FR', 2);
    });
  });

  describe('POST /api/transcripts', () => {
    it('should save transcript with valid data', async () => {
      const transcriptData = {
        sessionId: 'test-session-123',
        language: 'en-US',
        text: 'This is a test transcript'
      };
      const response = await request(app)
        .post('/api/transcripts')
        .send(transcriptData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.sessionId).toBe(transcriptData.sessionId);
      expect(response.body.language).toBe(transcriptData.language);
      expect(response.body.text).toBe(transcriptData.text);
      expect(response.body.timestamp).toEqual(expect.any(String));
      expect(mockStorage.addTranscript).toHaveBeenCalledWith(transcriptData);
    });
  });

  describe('GET /api/transcripts/:sessionId/:language', () => {
    it('should return transcripts if session exists', async () => {
      const sessionId = 'test-session-456';
      const language = 'en-US';
      const mockTranscripts = [
        {
          id: 1,
          sessionId,
          language,
          text: 'Test transcript',
          timestamp: new Date().toISOString()
        }
      ];
      vi.mocked(mockStorage.getTranscriptsBySession).mockResolvedValueOnce(mockTranscripts as any);

      const response = await request(app)
        .get(`/api/transcripts/${sessionId}/${language}`)
        .expect(200);

      expect(response.body).toEqual(mockTranscripts);
      expect(mockStorage.getTranscriptsBySession).toHaveBeenCalledWith(sessionId, language);
    });
  });

  describe('PUT /api/languages/:code/status', () => {
    it('should update language status with valid data', async () => {
      const expectedUpdatedLanguage = {
        id: 1, code: 'en-US', name: 'Test Language', isActive: false
      };
      const response = await request(app)
        .put('/api/languages/en-US/status')
        .send({ isActive: false })
        .expect(200);

      expect(response.body).toEqual(expectedUpdatedLanguage);
      expect(mockStorage.updateLanguageStatus).toHaveBeenCalledWith('en-US', false);
    });

    it('should return 404 if language not found for status update', async () => {
      vi.mocked(mockStorage.updateLanguageStatus).mockResolvedValueOnce(undefined as any);

      const response = await request(app)
        .put('/api/languages/invalid-code/status')
        .send({ isActive: true })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
      expect(mockStorage.updateLanguageStatus).toHaveBeenCalledWith('invalid-code', true);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status with DI counts', async () => {
      vi.mocked(mockActiveSessionProvider.getActiveSessionsCount).mockReturnValueOnce(5);
      vi.mocked(mockActiveSessionProvider.getActiveTeacherCount).mockReturnValueOnce(2);
      vi.mocked(mockActiveSessionProvider.getActiveStudentCount).mockReturnValueOnce(3);
      vi.mocked(mockStorage.getLanguages).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body.environment).toBe(process.env.NODE_ENV || 'development');
      expect(response.body.activeSessions).toBe(5);
      expect(response.body.activeTeachers).toBe(2);
      expect(response.body.activeStudents).toBe(3);
      expect(mockStorage.getLanguages).toHaveBeenCalled();
    });
  });

  describe('GET /api/test', () => {
    it('should return a test message', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'API is working');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/user', () => {
    it('should return user data if user exists', async () => {
      const expectedUser = {
        id: 1, username: 'testuser', password: 'hashedpassword'
      };
      // Default getUser mock is fine
      const response = await request(app)
        .get('/api/user')
        .expect(200);

      expect(response.body).toEqual(expectedUser);
      expect(mockStorage.getUser).toHaveBeenCalledWith(1);
    });

    it('should return 404 if user does not exist', async () => {
      vi.mocked(mockStorage.getUser).mockResolvedValueOnce(undefined as any);
      const response = await request(app)
        .get('/api/user')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'User not found');
      expect(mockStorage.getUser).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /api/join/:classCode', () => {
    it('should redirect to student page with valid class code', async () => {
      const classCode = 'ABC123';
      const response = await request(app)
        .get(`/api/join/${classCode}`)
        .expect(302);

      expect(response.headers.location).toBe(`/student?code=${classCode}`);
    });

    it('should return 400 for invalid class code format (too short)', async () => {
      const response = await request(app)
        .get('/api/join/ABC')
        .expect(400);
      expect(response.body).toEqual({ error: 'Invalid classroom code format' });
    });

    it('should return 400 for invalid class code format (invalid characters)', async () => {
      const response = await request(app)
        .get('/api/join/ABC!23')
        .expect(400);
      expect(response.body).toEqual({ error: 'Invalid classroom code format' });
    });
  });

});
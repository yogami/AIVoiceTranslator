/**
 * API Routes Tests (Consolidated)
 * 
 * This file consolidates tests for the API routes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

// Mock the storage module completely since routes.ts imports it directly
vi.mock('../../server/storage', () => ({
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
    }),
    addTranslation: vi.fn().mockImplementation(async (data) => ({
      id: 1,
      ...data,
      createdAt: new Date()
    })),
    getTranslationsByLanguage: vi.fn().mockResolvedValue([]),
    addTranscript: vi.fn().mockImplementation(async (data) => ({
      id: 1,
      ...data,
      createdAt: new Date()
    })),
    getTranscriptsBySession: vi.fn().mockResolvedValue([]),
    updateLanguageStatus: vi.fn().mockImplementation(async (code, isActive) => ({
      id: 1,
      code,
      name: 'Test Language',
      isActive
    }))
  }
}));

// Mock DiagnosticsService
const mockGetMetrics = vi.fn();
const mockGetExportData = vi.fn(); // For the export route
vi.mock('../../server/services/DiagnosticsService.js', () => ({
  DiagnosticsService: vi.fn().mockImplementation(() => ({
    getMetrics: mockGetMetrics,
    getExportData: mockGetExportData 
  }))
}));

describe('API Routes', () => {
  let app: Express;

  beforeEach(async () => {
    // Create fresh app for each test
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up - apiRoutes is already a Router instance
    const { apiRoutes, apiErrorHandler } = await import('../../server/routes');
    app.use('/api', apiRoutes);
    app.use('/api', apiErrorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/languages', () => {
    it('should return all languages', async () => {
      // Act
      const response = await request(app)
        .get('/api/languages')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body[0]).toHaveProperty('code');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('isActive');
    });

    it('should return only active languages for /active', async () => {
      // Act
      const response = await request(app)
        .get('/api/languages/active')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);
      expect(response.body.every((lang: any) => lang.isActive)).toBe(true);
    });
  });

  describe('POST /api/translations', () => {
    it('should save translation with valid data', async () => {
      // Arrange
      const translationData = {
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello',
        translatedText: 'Hola',
        latency: 100
      };
      
      // Act
      const response = await request(app)
        .post('/api/translations')
        .send(translationData)
        .expect(201);
      
      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body.sourceLanguage).toBe(translationData.sourceLanguage);
      expect(response.body.targetLanguage).toBe(translationData.targetLanguage);
      expect(response.body.originalText).toBe(translationData.originalText);
      expect(response.body.translatedText).toBe(translationData.translatedText);
    });

    it('should return 400 if required fields are missing for translation', async () => {
      // Arrange
      const invalidData = {
        sourceLanguage: 'en-US',
        // missing other required fields
      };
      
      // Act
      const response = await request(app)
        .post('/api/translations')
        .send(invalidData)
        .expect(400);
      
      // Assert
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/translations/:language', () => {
    it('should return translations if language exists', async () => {
      // Arrange - mock some translations
      const { storage } = await import('../../server/storage');
      (storage.getTranslationsByLanguage as any).mockResolvedValueOnce([
        {
          id: 1,
          sourceLanguage: 'en-US',
          targetLanguage: 'es-ES',
          originalText: 'Hello',
          translatedText: 'Hola',
          latency: 100
        }
      ]);
      
      // Act
      const response = await request(app)
        .get('/api/translations/es-ES')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].targetLanguage).toBe('es-ES');
    });

    it('should return empty array if no translations exist for language', async () => {
      // Act
      const response = await request(app)
        .get('/api/translations/zh-CN')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it('should limit results when limit query param is provided', async () => {
      // Arrange - mock limited results
      const { storage } = await import('../../server/storage');
      (storage.getTranslationsByLanguage as any).mockResolvedValueOnce([
        { id: 1, targetLanguage: 'fr-FR' },
        { id: 2, targetLanguage: 'fr-FR' },
        { id: 3, targetLanguage: 'fr-FR' },
        { id: 4, targetLanguage: 'fr-FR' },
        { id: 5, targetLanguage: 'fr-FR' }
      ]);
      
      // Act
      const response = await request(app)
        .get('/api/translations/fr-FR?limit=5')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(5);
    });
  });

  describe('POST /api/transcripts', () => {
    it('should save transcript with valid data', async () => {
      // Arrange
      const transcriptData = {
        sessionId: 'test-session-123',
        language: 'en-US',
        text: 'This is a test transcript'
      };
      
      // Act
      const response = await request(app)
        .post('/api/transcripts')
        .send(transcriptData)
        .expect(201);
      
      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body.sessionId).toBe(transcriptData.sessionId);
      expect(response.body.language).toBe(transcriptData.language);
      expect(response.body.text).toBe(transcriptData.text);
    });
  });

  describe('GET /api/transcripts/:sessionId/:language', () => {
    it('should return transcripts if session exists', async () => {
      // Arrange
      const sessionId = 'test-session-456';
      const language = 'en-US';
      const { storage } = await import('../../server/storage');
      (storage.getTranscriptsBySession as any).mockResolvedValueOnce([
        {
          id: 1,
          sessionId,
          language,
          text: 'Test transcript'
        }
      ]);
      
      // Act
      const response = await request(app)
        .get(`/api/transcripts/${sessionId}/${language}`)
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].sessionId).toBe(sessionId);
      expect(response.body[0].language).toBe(language);
    });
  });

  describe('PUT /api/languages/:code/status', () => {
    it('should update language status with valid data', async () => {
      // Act
      const response = await request(app)
        .put('/api/languages/en-US/status')
        .send({ isActive: false })
        .expect(200);
      
      // Assert
      expect(response.body.code).toBe('en-US');
      expect(response.body.isActive).toBe(false);
    });

    it('should return 404 if language not found for status update', async () => {
      // Arrange - mock language not found
      const { storage } = await import('../../server/storage');
      (storage.updateLanguageStatus as any).mockResolvedValueOnce(null);
      
      // Act
      const response = await request(app)
        .put('/api/languages/invalid-code/status')
        .send({ isActive: true })
        .expect(404);
      
      // Assert
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      // NODE_ENV in test is 'test', check if health reflects this or a default
      expect(response.body.environment).toBe(process.env.NODE_ENV || 'development');
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
      // The global storage mock is already set up to return a user for ID 1
      const response = await request(app)
        .get('/api/user')
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should return 404 if user does not exist', async () => {
      // Need to make storage.getUser return undefined for this test case
      const { storage } = await import('../../server/storage');
      vi.mocked(storage.getUser).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .get('/api/user')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('GET /api/join/:classCode', () => {
    it('should redirect to student page with valid class code', async () => {
      const classCode = 'ABC123';
      const response = await request(app)
        .get(`/api/join/${classCode}`)
        .expect(302); // Expect a redirect
      
      expect(response.headers.location).toBe(`/student?code=${classCode}`);
    });

    it('should return 400 for invalid class code format (too short)', async () => {
      const response = await request(app)
        .get('/api/join/ABC')
        .expect(400);
      expect(response.body).toEqual({ error: "Invalid classroom code format" });
    });

    it('should return 400 for invalid class code format (invalid characters)', async () => {
      const response = await request(app)
        .get('/api/join/ABC!23')
        .expect(400);
      expect(response.body).toEqual({ error: "Invalid classroom code format" });
    });
  });

  describe('GET /api/diagnostics', () => {
    beforeEach(() => {
      // Reset mocks for each test
      mockGetMetrics.mockReset();
      mockGetExportData.mockReset();
    });

    it('should return diagnostics data from DiagnosticsService for /diagnostics', async () => {
      const mockMetricsData = { system: 'all green', connections: 10 };
      mockGetMetrics.mockResolvedValueOnce(mockMetricsData);

      const response = await request(app)
        .get('/api/diagnostics')
        .expect(200);
      
      expect(response.body).toEqual(mockMetricsData);
      expect(mockGetMetrics).toHaveBeenCalledTimes(1);
    });

    it('should return export data from DiagnosticsService for /diagnostics/export', async () => {
      const mockExportPayload = { data: 'exported', timestamp: new Date().toISOString() };
      mockGetExportData.mockResolvedValueOnce(mockExportPayload);

      const response = await request(app)
        .get('/api/diagnostics/export')
        .expect(200);

      expect(response.body).toEqual(mockExportPayload);
      expect(mockGetExportData).toHaveBeenCalledTimes(1);
    });

    it('should handle error if getMetrics fails', async () => {
      mockGetMetrics.mockRejectedValueOnce(new Error('Metrics service failed'));
      const response = await request(app)
        .get('/api/diagnostics')
        .expect(500);
      expect(response.body).toHaveProperty('error', 'Failed to get diagnostics');
    });

  });

});
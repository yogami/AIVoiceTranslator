/**
 * API Routes Tests (Consolidated)
 * 
 * This file consolidates tests for the API routes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @ts-ignore - supertest types not available
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

describe('API Routes', () => {
  let app: Express;

  beforeEach(async () => {
    // Create fresh app for each test
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up - apiRoutes is already a Router instance
    const { apiRoutes } = await import('../../server/routes');
    app.use('/api', apiRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/languages', () => {
    it('should_ReturnActiveLanguages_When_Requested', async () => {
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

    it('should_ReturnOnlyActiveLanguages_When_SomeAreInactive', async () => {
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
    it('should_SaveTranslation_When_ValidDataProvided', async () => {
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

    it('should_ReturnError_When_RequiredFieldsMissing', async () => {
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
    it('should_ReturnTranslations_When_LanguageExists', async () => {
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

    it('should_ReturnEmptyArray_When_NoTranslationsExist', async () => {
      // Act
      const response = await request(app)
        .get('/api/translations/zh-CN')
        .expect(200);
      
      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it('should_LimitResults_When_LimitProvided', async () => {
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
    it('should_SaveTranscript_When_ValidDataProvided', async () => {
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
    it('should_ReturnTranscripts_When_SessionExists', async () => {
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
    it('should_UpdateLanguageStatus_When_ValidDataProvided', async () => {
      // Act
      const response = await request(app)
        .put('/api/languages/en-US/status')
        .send({ isActive: false })
        .expect(200);
      
      // Assert
      expect(response.body.code).toBe('en-US');
      expect(response.body.isActive).toBe(false);
    });

    it('should_ReturnError_When_LanguageNotFound', async () => {
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
});
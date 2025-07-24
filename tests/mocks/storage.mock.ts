/**
 * Mock Storage Implementation for Tests
 */

import { vi } from 'vitest';
import { IStorage } from '../../server/storage.interface.js';

export const createMockStorage = (): IStorage => ({
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
  getSessionAnalytics: vi.fn(),
  findActiveSessionByTeacherId: vi.fn(),
  findRecentSessionByTeacherId: vi.fn(),
  reactivateSession: vi.fn(),
  getSessionMetrics: vi.fn(),
  getTranslationMetrics: vi.fn(),
  getLanguagePairUsage: vi.fn()
});

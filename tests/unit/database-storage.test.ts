// Set all required env vars for strict config at the very top (no fallbacks)
process.env.PORT = '5001';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8VHatecgqv4Z@ep-silent-sun-a29jrxc7-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.VITE_API_URL = 'http://127.0.0.1:5001';
process.env.VITE_WS_URL = 'ws://127.0.0.1:5001';
process.env.NODE_ENV = 'test';
process.env.TEST_REDIS_URL = 'redis://localhost:6379/1';
process.env.LOG_LEVEL = 'info'; // Set LOG_LEVEL for tests, ensuring it's defined before the check

// Strictly require all env vars for config
['PORT','HOST','DATABASE_URL','OPENAI_API_KEY','VITE_API_URL','VITE_WS_URL', 'NODE_ENV', 'LOG_LEVEL', 'TEST_REDIS_URL'].forEach(key => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { DatabaseStorage } from '../../server/database-storage';
import { DbSessionStorage } from '../../server/storage/session.storage';
import { IStorage } from '../../server/storage.interface';
import { Session, sessions, translations } from '../../shared/schema';

// Mock the sub-storages
vi.mock('../../server/storage/user.storage');
vi.mock('../../server/storage/language.storage');
vi.mock('../../server/storage/translation.storage');
vi.mock('../../server/storage/transcript.storage');
vi.mock('../../server/storage/session.storage');

// Mock logger
vi.mock('../../server/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

vi.mock('../../server/db', async (importOriginal) => {
  // DEFINE mocks as const inside the factory
  const mockDbExecute = vi.fn();
  const mockSqlMapWith = vi.fn().mockImplementation(transformer => transformer);
  const mockDbPrepare = vi.fn((queryName?: string) => ({ execute: mockDbExecute }));
  const mockDbGroupBy = vi.fn().mockReturnThis();

  const originalModule = await importOriginal() as any;

  const dbInstance = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: mockDbGroupBy,
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    prepare: mockDbPrepare,
  };

  const sqlInstance = vi.fn((strings, ...values) => {
    const constructedSql = (strings && Array.isArray(strings)) ? strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] || ''), '') : String(strings);
    return {
      mapWith: mockSqlMapWith,
      toString: () => constructedSql,
      getSQL: () => constructedSql,
    };
  });

  // CREATE and EXPORT __testHooks
  const __testHooks = {
    mockDbExecute,
    mockSqlMapWith,
    mockDbPrepare,
    mockDbGroupBy,
  };

  return {
    ...originalModule,
    db: dbInstance,
    sql: sqlInstance,
    __testHooks, // Export the hooks
  };
});

// Import db, sql, AND __testHooks AFTER the mock setup.
// import { db, sql, __testHooks } from '../../server/db'; // OLD IMPORT
import * as dbModule from '../../server/db';
const { db, sql, __testHooks } = dbModule as any; // NEW IMPORT ACCESS

// Set required env vars for config strictness
beforeAll(() => {
  process.env.PORT = '1234';
  process.env.HOST = 'localhost';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'info';
  process.env.TEST_REDIS_URL = 'redis://localhost:6379';
});

describe('DatabaseStorage Metrics', () => {
  let storage: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    // Access mocks via __testHooks after clearing if necessary for setup,
    // though clearAllMocks should reset their state (calls, etc.)
    storage = new DatabaseStorage();
  });

  describe('getSessionMetrics', () => {
    it('should return zero metrics if no sessions exist', async () => {
      __testHooks.mockDbExecute // USE __testHooks
        .mockResolvedValueOnce([{ totalSessions: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const metrics = await storage.getSessionMetrics();
      expect(metrics).toEqual({
        totalSessions: 0,
        averageSessionDuration: 0,
        activeSessions: 0,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_without_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query_unique_name');
    });

    it('should calculate session metrics correctly with a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');

      __testHooks.mockDbExecute // USE __testHooks
        .mockResolvedValueOnce([{ totalSessions: 5 }])
        .mockResolvedValueOnce([{ totalDuration: 5000, countSessions: 5 }])
        .mockResolvedValueOnce([{ count: 2 }]);

      const metrics = await storage.getSessionMetrics({ startDate, endDate });
      expect(metrics).toEqual({
        totalSessions: 5,
        averageSessionDuration: 1000,
        activeSessions: 2,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_with_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sum_duration_query_with_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query_unique_name');
      
      expect(__testHooks.mockDbExecute.mock.calls[0][0]).toEqual({ startDate, endDate }); // USE __testHooks
      expect(__testHooks.mockDbExecute.mock.calls[1][0]).toEqual({ startDate, endDate }); // USE __testHooks
      expect(__testHooks.mockDbExecute.mock.calls[2][0]).toBeUndefined(); // USE __testHooks
    });
  });

  describe('getTranslationMetrics', () => {
    it('should return zero metrics if no translations exist', async () => {
      __testHooks.mockDbExecute.mockResolvedValueOnce([{ totalTranslations: 0, averageLatency: null }]); // USE __testHooks
      const metrics = await storage.getTranslationMetrics();
      expect(metrics).toEqual({
        totalTranslations: 0,
        averageLatency: 0,
        recentTranslations: 0,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_query_without_time_range');
    });

    it('should calculate translation metrics correctly with a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');
      __testHooks.mockDbExecute.mockResolvedValueOnce([{ totalTranslations: 10, averageLatency: 150 }]); // USE __testHooks
      
      const metrics = await storage.getTranslationMetrics({ startDate, endDate });
      expect(metrics).toEqual({
        totalTranslations: 10,
        averageLatency: 150,
        recentTranslations: 10, // Ensure this is expected
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_query_with_time_range');
      expect(__testHooks.mockDbExecute).toHaveBeenCalledWith({ startDate, endDate }); // USE __testHooks
    });
  });

  describe('getLanguagePairMetrics', () => {
    it('should return empty array if no translations exist', async () => {
      __testHooks.mockDbExecute.mockResolvedValueOnce([]); // USE __testHooks
      const metrics = await storage.getLanguagePairMetrics();
      expect(metrics).toEqual([]);
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_metrics_query_without_time_range');
    });

    it('should return language pair metrics correctly with a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');
      const mockPairData = [
        { sourceLanguage: 'en', targetLanguage: 'es', count: 100, averageLatency: '120' },
        { sourceLanguage: 'en', targetLanguage: 'fr', count: 50, averageLatency: '150' },
      ];
      __testHooks.mockDbExecute.mockResolvedValueOnce(mockPairData); // USE __testHooks

      const metrics = await storage.getLanguagePairMetrics({ startDate, endDate });
      expect(metrics).toEqual([
        { sourceLanguage: 'en', targetLanguage: 'es', count: 100, averageLatency: 120 },
        { sourceLanguage: 'en', targetLanguage: 'fr', count: 50, averageLatency: 150 },
      ]);
      expect(__testHooks.mockDbGroupBy).toHaveBeenCalledWith(translations.sourceLanguage, translations.targetLanguage);
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_metrics_query_with_time_range');
      expect(__testHooks.mockDbExecute).toHaveBeenCalledWith({ startDate, endDate }); // USE __testHooks
    });

     it('should handle null source/target languages by mapping to "unknown"', async () => {
      const mockPairData = [
        { sourceLanguage: null, targetLanguage: 'es', count: 5, averageLatency: '100' },
        { sourceLanguage: 'en', targetLanguage: null, count: 3, averageLatency: '200' },
        { sourceLanguage: null, targetLanguage: null, count: 1, averageLatency: '300' },
      ];
      __testHooks.mockDbExecute.mockResolvedValueOnce(mockPairData); // USE __testHooks

      const metrics = await storage.getLanguagePairMetrics();
      expect(metrics).toEqual([
        { sourceLanguage: 'unknown', targetLanguage: 'es', count: 5, averageLatency: 100 },
        { sourceLanguage: 'en', targetLanguage: 'unknown', count: 3, averageLatency: 200 },
        { sourceLanguage: 'unknown', targetLanguage: 'unknown', count: 1, averageLatency: 300 },
      ]);
       expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_metrics_query_without_time_range');
       expect(__testHooks.mockDbExecute).toHaveBeenCalledWith({}); // Changed from no arguments to an empty object
    });
  });

  describe('getSessionById', () => {
    // storage is an instance of DatabaseStorage, as per outer beforeEach
    // DbSessionStorage is mocked via vi.mock('../../server/storage/session.storage');
    // So, (storage as any).sessionStorage will be a mock instance of DbSessionStorage.
    // Its methods like getSessionById will be vi.fn() by default.

    it('should delegate to sessionStorage.getSessionById and return a session if found', async () => {
      const mockSessionData: Session = {
        id: 1,
        sessionId: 'test-session-db-1',
        isActive: true,
        startTime: new Date(),
        endTime: null,
        teacherLanguage: 'en-US',
        studentsCount: 0,
        totalTranslations: 0, 
        averageLatency: null,
      };
      
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      // The method on the auto-mocked instance is already a vi.fn()
      (mockSessionStorageInstance.getSessionById as import('vitest').Mock).mockResolvedValue(mockSessionData);

      const session = await storage.getSessionById('test-session-db-1');
      expect(session).toEqual(mockSessionData);
      expect(mockSessionStorageInstance.getSessionById).toHaveBeenCalledWith('test-session-db-1');
    });

    it('should delegate to sessionStorage.getSessionById and return undefined if not found', async () => {
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      (mockSessionStorageInstance.getSessionById as import('vitest').Mock).mockResolvedValue(undefined);

      const session = await storage.getSessionById('non-existent-db-session');
      expect(session).toBeUndefined();
      expect(mockSessionStorageInstance.getSessionById).toHaveBeenCalledWith('non-existent-db-session');
    });
  });
});

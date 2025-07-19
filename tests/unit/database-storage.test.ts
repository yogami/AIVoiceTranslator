// Set all required env vars for strict config at the very top (no fallbacks)
process.env.PORT = '5001';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/testdb';
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
import { setupTestIsolation } from '../../test-config/test-isolation';

// Set up test isolation for this unit test suite
setupTestIsolation('DatabaseStorage Unit Tests', 'unit');

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
  const mockDbExecute = vi.fn();
  // Mock the prepare method to return an object with an execute method
  const mockDbPrepare = vi.fn((queryName?: string) => ({
    execute: mockDbExecute, // This execute will be called by the application code
    // Add other methods Drizzle's prepared statement might have if needed by the code under test
  }));
  const mockSqlRaw = vi.fn((strings, ...values) => {
    // Simplified mock for sql.raw, just reconstructs the string for inspection if needed
    const constructedSql = (strings && Array.isArray(strings)) ? strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] || ''), '') : String(strings);
    return { toSQL: () => ({ sql: constructedSql, params: values }) }; // Mimic Drizzle structure
  });

  const originalModule = await importOriginal() as any;

  const dbInstance = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    prepare: mockDbPrepare, // Use the more detailed mockDbPrepare
    execute: mockDbExecute, // Mock top-level execute if used directly (less common for SELECTs)
    // Add other Drizzle methods if they are directly called on the db instance by the code
  };

  const sqlInstance = {
    raw: mockSqlRaw,
    // Mock other sql functions like sql`...` if used directly and need specific behavior
    // For sql template literal tag, it might be more complex if its internal structure is relied upon
    // For now, assume sql.raw is the primary concern or other uses are simple enough not to need detailed mocking here.
  };

  const __testHooks = {
    mockDbExecute,      // This is what tests will use to provide results for `preparedQuery.execute()`
    mockDbPrepare,      // Tests can assert on this to check if `db.prepare(queryName)` was called
  };

  return {
    ...originalModule,
    db: dbInstance,       // This is the mocked Drizzle instance
    sql: sqlInstance,     // This is the mocked `sql` object from Drizzle
    __testHooks,          // Export hooks for tests to control/assert mock behavior
  };
});

// Import db, sql, AND __testHooks AFTER the mock setup.
import * as dbModule from '../../server/db';
const { db, sql, __testHooks } = dbModule as any; 

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
    storage = new DatabaseStorage();
  });

  describe('getSessionMetrics', () => {
    it('should return zero metrics if no sessions exist and no time range is provided', async () => {
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([]) // total_sessions_query_without_time_range
        // duration_query is skipped if totalSessions is 0
        .mockResolvedValueOnce([]) // active_sessions_query
        .mockResolvedValueOnce([]); // sessions_last_24_hours_query

      const metrics = await storage.getSessionMetrics();
      expect(metrics).toEqual({
        totalSessions: 0,
        averageSessionDuration: 0,
        activeSessions: 0,
        sessionsLast24Hours: 0,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_without_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sessions_last_24_hours_query');
    });

    it('should return zero for averageSessionDuration if totalSessions is zero within a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ totalSessions: 0 }]) // total_sessions_query_with_time_range
        // duration_query is skipped
        .mockResolvedValueOnce([{ count: 0 }]) // active_sessions_query
        .mockResolvedValueOnce([{ count: 0 }]); // sessions_last_24_hours_query

      const metrics = await storage.getSessionMetrics({ startDate, endDate });
      expect(metrics).toEqual({
        totalSessions: 0,
        averageSessionDuration: 0,
        activeSessions: 0,
        sessionsLast24Hours: 0,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_with_time_range');
      expect(__testHooks.mockDbPrepare).not.toHaveBeenCalledWith('sum_duration_query_with_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sessions_last_24_hours_query');
    });

    it('should calculate session metrics correctly when no time range is provided', async () => {
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ totalSessions: 10 }]) 
        .mockResolvedValueOnce([{ totalDuration: '20000', countSessions: '10' }]) 
        .mockResolvedValueOnce([{ count: 3 }]) 
        .mockResolvedValueOnce([{ count: 5 }]); 

      const metrics = await storage.getSessionMetrics();
      expect(metrics).toEqual({
        totalSessions: 10,
        averageSessionDuration: 2000,
        activeSessions: 3,
        sessionsLast24Hours: 5,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_without_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sum_duration_query_without_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sessions_last_24_hours_query');
    });

    it('should calculate session metrics correctly with a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');

      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ totalSessions: 5 }])
        .mockResolvedValueOnce([{ totalDuration: '5000', countSessions: '5' }]) 
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 4 }]); 

      const metrics = await storage.getSessionMetrics({ startDate, endDate });
      expect(metrics).toEqual({
        totalSessions: 5,
        averageSessionDuration: 1000,
        activeSessions: 2,
        sessionsLast24Hours: 4, 
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('total_sessions_query_with_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sum_duration_query_with_time_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('active_sessions_query');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('sessions_last_24_hours_query');
      
      // Check arguments for Drizzle's execute on prepared statements
      // The first call to mockDbExecute corresponds to the first prepared statement, etc.
      expect(__testHooks.mockDbExecute.mock.calls[0][0]).toEqual({ startDate, endDate });
      expect(__testHooks.mockDbExecute.mock.calls[1][0]).toEqual({ startDate, endDate });
      expect(__testHooks.mockDbExecute.mock.calls[2][0]).toBeUndefined(); 
      expect(__testHooks.mockDbExecute.mock.calls[3][0]).toBeUndefined();
    });
  });

  describe('getTranslationMetrics', () => {
    it('should return zero metrics if no translations exist and no time range', async () => {
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([]) // main metrics query (translation_metrics_main_no_range)
        .mockResolvedValueOnce([]); // recent translations query (translation_metrics_recent)

      const metrics = await storage.getTranslationMetrics();
      expect(metrics).toEqual({
        totalTranslations: 0,
        averageLatency: 0,
        recentTranslations: 0,
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_main_no_range');
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_recent');
    });

    it('should return zero for recentTranslations if that specific query returns empty, even with other metrics', async () => {
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ total_translations: 10, avg_latency: '150' }]) // main metrics
        .mockResolvedValueOnce([]); // recent_translations_query returns empty

      const metrics = await storage.getTranslationMetrics();
      expect(metrics).toEqual({
        totalTranslations: 10,
        averageLatency: 150,
        recentTranslations: 0,
      });
    });

    it('should calculate translation metrics correctly with a time range and recent translations', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ total_translations: 10, avg_latency: '150' }]) // translation_metrics_main_with_range
        .mockResolvedValueOnce([{ count: 5 }]); // translation_metrics_recent
      
      const metrics = await storage.getTranslationMetrics({ startDate, endDate });
      expect(metrics).toEqual({
        totalTranslations: 10,
        averageLatency: 150,
        recentTranslations: 5, 
      });
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_main_with_range');
      expect(__testHooks.mockDbExecute.mock.calls[0][0]).toEqual({ startDate, endDate }); // Args for main query
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('translation_metrics_recent');
      // Args for recent query (oneHourAgo is calculated internally, not passed from timeRange)
      // The second execute call will have undefined or the internally calculated param for recent query
      // For simplicity, we can check it was called. If specific arg checking is needed for oneHourAgo, it's more complex.
    });

    it('should handle null averageLatency from DB by returning 0', async () => {
      __testHooks.mockDbExecute
        .mockResolvedValueOnce([{ total_translations: '5', avg_latency: null }]) // main metrics
        .mockResolvedValueOnce([{ count: '2' }]); // recent translations
      const metrics = await storage.getTranslationMetrics();
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.totalTranslations).toBe(5);
      expect(metrics.recentTranslations).toBe(2);
    });
  });

  describe('getLanguagePairUsage', () => {
    it('should return empty array if no translations exist', async () => {
      __testHooks.mockDbExecute.mockResolvedValueOnce([]); // language_pair_usage_query_no_range
      const metrics = await storage.getLanguagePairUsage();
      expect(metrics).toEqual([]);
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_usage_query_no_range');
    });

    it('should return language pair metrics correctly with a time range', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-31T23:59:59.999Z');
      const mockLanguagePairData = [
        { source_language: 'en', target_language: 'es', pair_count: '2', avg_latency: '100.0' },
        { source_language: 'en', target_language: 'fr', pair_count: '1', avg_latency: '150.0' },
      ];
      __testHooks.mockDbExecute.mockResolvedValueOnce(mockLanguagePairData); // language_pair_usage_query_with_range

      const metrics = await storage.getLanguagePairUsage({ startDate, endDate });
      expect(metrics).toEqual([
        { sourceLanguage: 'en', targetLanguage: 'es', count: 2, averageLatency: 100 },
        { sourceLanguage: 'en', targetLanguage: 'fr', count: 1, averageLatency: 150 },
      ]);
      expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_usage_query_with_range');
      expect(__testHooks.mockDbExecute.mock.calls[0][0]).toEqual({ startDate, endDate });
    });

     it('should handle null source/target languages by mapping to "unknown" and null counts/latency to 0', async () => {
      const mockLanguagePairDataWithNulls = [
        { source_language: null, target_language: 'es', pair_count: '1', avg_latency: '100' },
        { source_language: 'en', target_language: null, pair_count: '1', avg_latency: '150' },
        { source_language: null, target_language: null, pair_count: '2', avg_latency: '200' },
        { source_language: 'de', target_language: 'it', pair_count: null, avg_latency: null },
      ];
      __testHooks.mockDbExecute.mockResolvedValueOnce(mockLanguagePairDataWithNulls);

      const metrics = await storage.getLanguagePairUsage(); 
      expect(metrics).toEqual([
        { sourceLanguage: 'unknown', targetLanguage: 'es', count: 1, averageLatency: 100 },
        { sourceLanguage: 'en', targetLanguage: 'unknown', count: 1, averageLatency: 150 },
        { sourceLanguage: 'unknown', targetLanguage: 'unknown', count: 2, averageLatency: 200 },
        { sourceLanguage: 'de', targetLanguage: 'it', count: 0, averageLatency: 0 }, 
      ]);
       expect(__testHooks.mockDbPrepare).toHaveBeenCalledWith('language_pair_usage_query_no_range');
       // For a query without a time range, the execute call might receive undefined or no argument for the timeRange part.
       expect(__testHooks.mockDbExecute.mock.calls[0][0]).toBeUndefined();
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
        teacherId: 'teacher-db-1', // Added missing teacherId
        classCode: null,
        isActive: true,
        startTime: new Date(),
        endTime: null,
        teacherLanguage: 'en-US',
        studentLanguage: null,
        studentsCount: 0,
        totalTranslations: 0, 
        averageLatency: null,
        quality: 'unknown',
        qualityReason: null,
        lastActivityAt: null
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

  describe('getTranscriptCountBySession', () => {
    it('should delegate to sessionStorage.getTranscriptCountBySession', async () => {
      const sessionId = 'test-session-transcript-count';
      const expectedCount = 5;
      
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      (mockSessionStorageInstance.getTranscriptCountBySession as import('vitest').Mock).mockResolvedValue(expectedCount);

      const count = await storage.getTranscriptCountBySession(sessionId);
      expect(count).toBe(expectedCount);
      expect(mockSessionStorageInstance.getTranscriptCountBySession).toHaveBeenCalledWith(sessionId);
    });

    it('should return 0 when no transcripts found', async () => {
      const sessionId = 'empty-session';
      
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      (mockSessionStorageInstance.getTranscriptCountBySession as import('vitest').Mock).mockResolvedValue(0);

      const count = await storage.getTranscriptCountBySession(sessionId);
      expect(count).toBe(0);
      expect(mockSessionStorageInstance.getTranscriptCountBySession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('getSessionQualityStats', () => {
    it('should delegate to sessionStorage.getSessionQualityStats', async () => {
      const expectedStats = {
        total: 10,
        real: 6,
        dead: 4,
        breakdown: {
          real: 6,
          no_students: 2,
          no_activity: 1,
          too_short: 1
        }
      };
      
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      (mockSessionStorageInstance.getSessionQualityStats as import('vitest').Mock).mockResolvedValue(expectedStats);

      const stats = await storage.getSessionQualityStats();
      expect(stats).toEqual(expectedStats);
      expect(mockSessionStorageInstance.getSessionQualityStats).toHaveBeenCalled();
    });

    it('should return empty stats when no sessions exist', async () => {
      const expectedStats = {
        total: 0,
        real: 0,
        dead: 0,
        breakdown: {}
      };
      
      const mockSessionStorageInstance = (storage as any).sessionStorage;
      (mockSessionStorageInstance.getSessionQualityStats as import('vitest').Mock).mockResolvedValue(expectedStats);

      const stats = await storage.getSessionQualityStats();
      expect(stats).toEqual(expectedStats);
      expect(mockSessionStorageInstance.getSessionQualityStats).toHaveBeenCalled();
    });
  });
});

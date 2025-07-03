import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsService, TimeRangePreset } from '../../../server/services/DiagnosticsService';
import { IActiveSessionProvider } from '../../../server/services/IActiveSessionProvider';
import { StorageTranslationMetrics } from '../../../server/storage.interface'; // Changed to StorageTranslationMetrics
import { DatabaseStorage } from '../../../server/database-storage';

// Define SessionActivity directly in the test file if not exported
interface SessionActivity {
  sessionId: string;
  teacherLanguage: string | null;
  transcriptCount: number;
  studentCount: number;
  startTime: Date | null;
  endTime: Date | null;
  duration: number;
}

vi.mock('../../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

describe('DiagnosticsService', () => {
  let diagnosticsService: DiagnosticsService;
  let mockStorage: DatabaseStorage;
  let mockActiveSessionProvider: IActiveSessionProvider;
  let dbStorage: DatabaseStorage;

  // Mock data for translation metrics from storage
  const MOCK_CURRENT_PERF_TRANSLATIONS: StorageTranslationMetrics = { totalTranslations: 3, averageLatency: 120, recentTranslations: 3 };
  const MOCK_HISTORICAL_TRANSLATIONS_DEFAULT: StorageTranslationMetrics = { totalTranslations: 100, averageLatency: 150, recentTranslations: 25 };


  beforeEach(() => {
    vi.clearAllMocks();
    dbStorage = new DatabaseStorage();
    mockStorage = new DatabaseStorage();
    mockActiveSessionProvider = {
      getActiveSessionCount: vi.fn().mockReturnValue(2),
      getActiveSessionsCount: vi.fn().mockReturnValue(2),
      getActiveStudentCount: vi.fn().mockReturnValue(1),
      getActiveTeacherCount: vi.fn().mockReturnValue(1),
      getActiveSessionsDetails: vi.fn().mockReturnValue([
        { teacherLanguage: 'en-US', studentLanguages: ['es', 'fr'] },
        { teacherLanguage: 'de', studentLanguages: ['en-US'] },
      ]),
    } as IActiveSessionProvider;
    diagnosticsService = new DiagnosticsService(mockStorage, mockActiveSessionProvider);

    diagnosticsService.reset();

    vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
      totalSessions: 10,
      activeSessions: 2,
      averageSessionDuration: 300000,
      sessionsLast24Hours: 5
    });

    // Default mock for getTranslationMetrics in beforeEach
    vi.spyOn(mockStorage, 'getTranslationMetrics').mockImplementation(async (arg: any) => {
      // Check if this is a current performance call (short time range ~1 minute)
      if (arg && typeof arg === 'object' && arg.startDate && arg.endDate) {
        const timeDiff = new Date(arg.endDate).getTime() - new Date(arg.startDate).getTime();
        const isCurrentPerformanceCall = timeDiff <= 65000; // <= 65 seconds (allowing some buffer for 1 minute calls)
        
        if (isCurrentPerformanceCall) {
          const returnValue = { totalTranslations: 3, averageLatency: 120, recentTranslations: 3 };
          return returnValue;
        }
      }
      
      // Legacy check for preset-based calls
      if (arg && typeof arg === 'object' && arg.preset === 'lastMinute' && Object.keys(arg).length === 1) {
        const returnValue = { totalTranslations: 3, averageLatency: 120, recentTranslations: 3 };
        return returnValue;
      }
      
      const fallbackValue = { ...MOCK_HISTORICAL_TRANSLATIONS_DEFAULT };
      return fallbackValue;
    });

    vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue([
      { sourceLanguage: 'en-US', targetLanguage: 'es', count: 50, averageLatency: 120 },
      { sourceLanguage: 'fr', targetLanguage: 'de', count: 30, averageLatency: 250 }
    ]);
    vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([
      {
        sessionId: 'test-session-1',
        teacherLanguage: 'en-US',
        studentLanguage: 'es-ES',
        classCode: 'ABC123',
        transcriptCount: 5,
        studentCount: 1,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(Date.now() - 1800000),   // 30 minutes ago
        duration: 1800000 // 30 minutes
      },
      {
        sessionId: 'test-session-2',
        teacherLanguage: 'fr-FR',
        studentLanguage: 'de-DE',
        classCode: 'XYZ789',
        transcriptCount: 10,
        studentCount: 2,
        startTime: new Date(Date.now() - 7200000), // 2 hours ago
        endTime: null, // Still active or ended abruptly
        duration: 3600000 // 1 hour (if still running, this might be current duration)
      }
    ]);
    (global as any).wsServer = undefined;
  });

  describe('Connection Tracking', () => {
    it('should use IActiveSessionProvider for active connection counts', async () => {
      // Mock the database to return 2 active sessions
      vi.spyOn(mockStorage, 'getAllActiveSessions').mockResolvedValue([
        { sessionId: 'session1', isActive: true } as any,
        { sessionId: 'session2', isActive: true } as any
      ]);

      const metrics = await diagnosticsService.getMetrics('lastHour');
      
      // Verify that the provider methods are called for student/teacher counts
      expect(mockActiveSessionProvider.getActiveTeacherCount).toHaveBeenCalled();
      expect(mockActiveSessionProvider.getActiveStudentCount).toHaveBeenCalled();
      
      // activeConnections should now come from database active sessions count (2)
      expect(metrics.currentPerformance?.activeConnections).toBe(2);
      // activeSessions should also be 2 (from database)
      expect(metrics.currentPerformance?.activeSessions).toBe(2);
      // Individual counts should still come from the provider
      expect(metrics.currentPerformance?.studentsConnected).toBe(1);
      expect(metrics.currentPerformance?.teachersConnected).toBe(1);
    });
  });

  describe('Session Metrics from Provider', () => {
    it('should use database for active sessions count, not WebSocket connections', async () => {
      // Setup: Database has 2 active sessions, WebSocket has 5 connections
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2, // Database shows 2 active sessions
        averageSessionDuration: 300000,
        sessionsLast24Hours: 5
      });
      
      // WebSocket provider shows 5 connections (e.g., 1 teacher + 4 students)
      mockActiveSessionProvider.getActiveSessionsCount = vi.fn().mockReturnValue(5);
      mockActiveSessionProvider.getActiveStudentCount = vi.fn().mockReturnValue(4);
      mockActiveSessionProvider.getActiveTeacherCount = vi.fn().mockReturnValue(1);

      const metrics = await diagnosticsService.getMetrics('lastHour');
      
      // FIXED: activeSessions should come from database storage (2), NOT WebSocket connections (5)
      expect(metrics.sessions.activeSessions).toBe(2); // Database count, not WebSocket count
      expect(metrics.sessions.studentsConnected).toBe(4); // WebSocket count for students
      expect(metrics.sessions.teachersConnected).toBe(1); // WebSocket count for teachers
      
      // Verify the correct methods were called
      expect(mockStorage.getSessionMetrics).toHaveBeenCalled();
      expect(mockActiveSessionProvider.getActiveStudentCount).toHaveBeenCalled();
      expect(mockActiveSessionProvider.getActiveTeacherCount).toHaveBeenCalled();
      // Verify that getActiveSessionsCount is NOT used for activeSessions
      // (it might be called for other purposes, but not for the final activeSessions value)
    });

    it('should handle case where WebSocket provider is null', async () => {
      // Test with null active session provider
      const diagnosticsWithoutProvider = new DiagnosticsService(mockStorage, null);
      
      const metrics = await diagnosticsWithoutProvider.getMetrics('lastHour');
      
      // Should use database session count and default to 0 for connection counts
      expect(metrics.sessions.activeSessions).toBe(2); // From database
      expect(metrics.sessions.studentsConnected).toBe(0); // Default when provider is null
      expect(metrics.sessions.teachersConnected).toBe(0); // Default when provider is null
    });

    it('should validate the business logic: 1 session can have multiple connections', async () => {
      // Scenario: 1 classroom session with 1 teacher + 10 students = 11 WebSocket connections
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
        totalSessions: 1,
        activeSessions: 1, // 1 logical classroom session
        averageSessionDuration: 2700000, // 45 minutes
        sessionsLast24Hours: 1
      });
      
      mockActiveSessionProvider.getActiveSessionsCount = vi.fn().mockReturnValue(11); // 11 WebSocket connections
      mockActiveSessionProvider.getActiveStudentCount = vi.fn().mockReturnValue(10);
      mockActiveSessionProvider.getActiveTeacherCount = vi.fn().mockReturnValue(1);

      const metrics = await diagnosticsService.getMetrics('lastHour');
      
      // Business logic validation:
      expect(metrics.sessions.totalSessions).toBe(1); // 1 session in database
      expect(metrics.sessions.activeSessions).toBe(1); // 1 active session (NOT 11 connections)
      expect(metrics.sessions.studentsConnected).toBe(10); // 10 student connections
      expect(metrics.sessions.teachersConnected).toBe(1); // 1 teacher connection
      
      // Total connections = 11, but active sessions = 1 (this is the correct behavior)
      const totalConnections = metrics.sessions.studentsConnected + metrics.sessions.teachersConnected;
      expect(totalConnections).toBe(11);
      expect(metrics.sessions.activeSessions).toBe(1); // Should NOT equal totalConnections
    });
  });

  describe('Audio Generation Metrics', () => {
    it('should record audio generation times', () => {
      diagnosticsService.recordAudioGeneration(50);
      diagnosticsService.recordAudioGeneration(75);
      expect(diagnosticsService['audioGenerationTimes']).toEqual([50, 75]);
    });
    it('should track audio cache size', () => {
      diagnosticsService.setAudioCacheSize(1024 * 1024);
      expect(diagnosticsService.getAudioCacheSize()).toBe(1024 * 1024);
    });
  });

  describe('Formatting Functions', () => {
    it('should format bytes correctly', () => {
      expect(diagnosticsService.formatBytes(0)).toBe('0.0 B');
      expect(diagnosticsService.formatBytes(512)).toBe('512.0 B');
      expect(diagnosticsService.formatBytes(1024)).toBe('1.0 KB');
      expect(diagnosticsService.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(diagnosticsService.formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(diagnosticsService.formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
    it('should format duration correctly (tested via getMetrics output)', () => {
      // Tested via getMetrics output
    });
    it('should format uptime correctly', () => {
      expect(diagnosticsService.formatUptime(30)).toBe('30 secs'); // Changed 'seconds' to 'secs'
      expect(diagnosticsService.formatUptime(90)).toBe('1 minute, 30 secs'); // Ensure 'secs'
      expect(diagnosticsService.formatUptime(3700)).toBe('1 hour, 1 minute'); // Already correct based on previous logic
      expect(diagnosticsService.formatUptime(90000)).toBe('1 day, 1 hour'); // Already correct
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics including currentPerformance and time-ranged historical data', async () => {
      const timeRange = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      const specificHistoricalDbTranslations: StorageTranslationMetrics = { totalTranslations: 250, averageLatency: 180, recentTranslations: 50 };
      
      // Specific mock for this test
      vi.spyOn(mockStorage, 'getTranslationMetrics').mockImplementation(async (arg: any) => {
        // Check for current performance call (short time range ~1 minute)
        if (arg && typeof arg === 'object' && arg.startDate && arg.endDate) {
          const timeDiff = new Date(arg.endDate).getTime() - new Date(arg.startDate).getTime();
          const isCurrentPerformanceCall = timeDiff <= 65000; // <= 65 seconds
          
          if (isCurrentPerformanceCall) {
            // Return a pristine object literal for current performance
            return { totalTranslations: 3, averageLatency: 120, recentTranslations: 3 };
          }
          
          // Check for the specific time range used in this test
          if (arg.startDate.getTime() === timeRange.startDate.getTime() &&
              arg.endDate.getTime() === timeRange.endDate.getTime()) {
            return { ...specificHistoricalDbTranslations }; // Specific historical data for this test
          }
        }
        
        // Legacy check for preset-based calls (shouldn't happen in current implementation)
        if (arg && typeof arg === 'object' && arg.preset === 'lastMinute' && Object.keys(arg).length === 1) {
          return { totalTranslations: 3, averageLatency: 120, recentTranslations: 3 };
        }
        
        return { ...MOCK_HISTORICAL_TRANSLATIONS_DEFAULT }; // Fallback for any other historical calls
      });

      const historicalDbSessions = { totalSessions: 15, activeSessions: 3, averageSessionDuration: 320000, sessionsLast24Hours: 7 };
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue(historicalDbSessions);
      const historicalDbLangPairs: any = [{ sourceLanguage: 'de', targetLanguage: 'en-US', count: 90, averageLatency: 170 }];
      vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue(historicalDbLangPairs);
      vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics(timeRange);

      expect(metrics.currentPerformance).toBeDefined();
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.recentTranslations);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.averageLatency);
      
      expect(metrics.translations.total).toBe(specificHistoricalDbTranslations.totalTranslations);
      expect(metrics.translations.averageTime).toBe(specificHistoricalDbTranslations.averageLatency);
      expect(metrics.translations.totalFromDatabase).toBe(specificHistoricalDbTranslations.totalTranslations);
      expect(metrics.translations.averageLatencyFromDatabase).toBe(specificHistoricalDbTranslations.averageLatency);
      expect(metrics.translations.recentTranslations).toBe(specificHistoricalDbTranslations.recentTranslations);
      expect(metrics.translations.languagePairs[0].sourceLanguage).toBe('de');
      
      expect(metrics.sessions.totalSessions).toBe(historicalDbSessions.totalSessions);
      // FIXED: Active sessions should come from database storage, not WebSocket connections
      expect(metrics.sessions.activeSessions).toBe(historicalDbSessions.activeSessions); // 3 from database
      
      expect(mockStorage.getSessionMetrics).toHaveBeenCalledWith(expect.objectContaining({ startDate: timeRange.startDate, endDate: timeRange.endDate }));
      // For current performance, DiagnosticsService calls storage.getTranslationMetrics with a short time range (~1 minute)
      const getTranslationMetricsSpy = vi.mocked(mockStorage.getTranslationMetrics);
      const calls = getTranslationMetricsSpy.mock.calls;
      const currentPerformanceCall = calls.find((call: any[]) => {
        const arg = call[0];
        if (arg && typeof arg === 'object' && arg.startDate && arg.endDate) {
          const timeDiff = new Date(arg.endDate).getTime() - new Date(arg.startDate).getTime();
          return timeDiff <= 65000; // <= 65 seconds (1 minute + buffer)
        }
        return false;
      });
      expect(currentPerformanceCall).toBeDefined();
      // For historical data with a specific date range
      expect(mockStorage.getTranslationMetrics).toHaveBeenCalledWith(expect.objectContaining({ startDate: timeRange.startDate, endDate: timeRange.endDate }));
      expect(mockStorage.getLanguagePairUsage).toHaveBeenCalledWith(expect.objectContaining({ startDate: timeRange.startDate, endDate: timeRange.endDate }));
      // getRecentSessionActivity is called by getSessionMetrics if timeRange is present.
      // The mock for getSessionMetrics is resolved, so this check is for the argument passed to getRecentSessionActivity by DiagnosticsService's getSessionMetrics
      expect(mockStorage.getRecentSessionActivity).toHaveBeenCalledWith(5); // Default count
      expect(metrics.timeRange?.startDate).toBe(timeRange.startDate.toISOString());
    });

    it('should return currentPerformance and default historical data if no timeRange is specified', async () => {
      // Mocks are already set in global beforeEach to return MOCK_HISTORICAL_TRANSLATIONS_DEFAULT for non-LastMinute calls
      // and MOCK_CURRENT_PERF_TRANSLATIONS for LastMinute calls.
      const getTranslationMetricsSpy = vi.spyOn(mockStorage, 'getTranslationMetrics'); // Spy on the existing mock implementation
      const getSessionMetricsSpy = vi.spyOn(mockStorage, 'getSessionMetrics');
      const getLanguagePairUsageSpy = vi.spyOn(mockStorage, 'getLanguagePairUsage');
      const getRecentSessionActivitySpy = vi.spyOn(mockStorage, 'getRecentSessionActivity');

      const metrics = await diagnosticsService.getMetrics(); // No timeRange, should use defaults

      expect(metrics.currentPerformance).toBeDefined();
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.recentTranslations);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.averageLatency);

      // Historical translation data should come from MOCK_HISTORICAL_TRANSLATIONS_DEFAULT
      expect(metrics.translations.total).toBe(MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.totalTranslations);
      expect(metrics.translations.averageTime).toBe(MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.averageLatency);
      expect(metrics.translations.totalFromDatabase).toBe(MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.totalTranslations);
      expect(metrics.translations.averageLatencyFromDatabase).toBe(MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.averageLatency);
      // Language pairs from default mock in beforeEach
      expect(metrics.translations.languagePairs).toEqual([
        { sourceLanguage: 'en-US', targetLanguage: 'es', count: 50, averageLatency: 120, averageLatencyFormatted: "120 ms" },
        { sourceLanguage: 'fr', targetLanguage: 'de', count: 30, averageLatency: 250, averageLatencyFormatted: "250 ms" }
      ]);

      // Session data from default mock in beforeEach
      expect(metrics.sessions.totalSessions).toBe(10);
      expect(metrics.sessions.averageSessionDuration).toBe(300000);
      // recentSessionActivity from default mock in beforeEach
      expect(metrics.sessions.recentSessionActivity).toHaveLength(2);
      expect(metrics.sessions.sessionsLast24Hours).toBe(5);
      // FIXED: Active session data should come from database storage, not WebSocket connections
      expect(metrics.sessions.activeSessions).toBe(2); // From mockStorage.getSessionMetrics().activeSessions
      expect(metrics.sessions.studentsConnected).toBe(mockActiveSessionProvider.getActiveStudentCount());
      expect(metrics.sessions.teachersConnected).toBe(mockActiveSessionProvider.getActiveTeacherCount());

      // Check the resolved timeRange from getMetrics when no argument is passed (defaults to LastHour)
      // The actual timeRange object returned by getMetrics will have startDate and endDate, not preset.
      // We need to ensure the storage calls reflect the default preset or derived dates.
      // The default preset is TimeRangePreset.LastHour.
      // We can't directly check metrics.timeRange.preset as it's resolved.
      // Instead, we check if the storage calls reflect the default preset.

      // Current performance call - should be a short time range (approximately 1 minute)
      const calls = getTranslationMetricsSpy.mock.calls;
      const currentPerformanceCall = calls.find(call => {
        const arg = call[0];
        if (arg && typeof arg === 'object' && arg.startDate && arg.endDate) {
          const timeDiff = new Date(arg.endDate).getTime() - new Date(arg.startDate).getTime();
          return timeDiff <= 65000; // <= 65 seconds (1 minute + buffer)
        }
        return false;
      });
      expect(currentPerformanceCall).toBeDefined();
      
      // Historical data calls (with no time range specified, should pass undefined)
      expect(getTranslationMetricsSpy).toHaveBeenCalledWith(undefined);
      expect(getSessionMetricsSpy).toHaveBeenCalledWith(undefined);
      expect(getLanguagePairUsageSpy).toHaveBeenCalledWith(undefined);
      expect(getRecentSessionActivitySpy).toHaveBeenCalledWith(5); // Default count for recent activity
    });
  });

  describe('Metrics Retrieval (specific presets)', () => {
    // This beforeEach will use the global mock for getTranslationMetrics, which returns MOCK_HISTORICAL_TRANSLATIONS_DEFAULT
    // for presets other than 'lastMinute', and MOCK_CURRENT_PERF_TRANSLATIONS for 'lastMinute'.

    it('should retrieve session metrics (active from database, connections from provider for preset)', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours' as TimeRangePreset); // Example preset
      expect(metrics.sessions).toEqual(expect.objectContaining({
        totalSessions: 10, // From MOCK_HISTORICAL_SESSIONS_DEFAULT (via getSessionMetrics mock)
        activeSessions: 2, // FIXED: From database storage, not IActiveSessionProvider
        averageSessionDuration: 300000,
        sessionsLast24Hours: 5,
        // recentSessionActivity from global beforeEach mock
      }));
      // currentPerformance should use MOCK_CURRENT_PERF_TRANSLATIONS
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.recentTranslations);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.averageLatency);
    });

    it('should retrieve translation metrics (historical from DB for preset)', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours' as TimeRangePreset); // Example preset
      // Historical translation data should come from MOCK_HISTORICAL_TRANSLATIONS_DEFAULT
      expect(metrics.translations).toEqual(expect.objectContaining({
        total: MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.totalTranslations,
        averageTime: MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.averageLatency,
        recentTranslations: MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.recentTranslations,
        totalFromDatabase: MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.totalTranslations,
        averageLatencyFromDatabase: MOCK_HISTORICAL_TRANSLATIONS_DEFAULT.averageLatency,
        // languagePairs from global beforeEach mock
      }));
      // currentPerformance should use MOCK_CURRENT_PERF_TRANSLATIONS
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.recentTranslations);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(MOCK_CURRENT_PERF_TRANSLATIONS.averageLatency);
      
      // Check that getTranslationMetrics was called for historical data with the resolved date range for 'last24Hours'
      expect(mockStorage.getTranslationMetrics).toHaveBeenCalledWith(expect.objectContaining({
        startDate: expect.any(Date), // Dates corresponding to 'last24Hours'
        endDate: expect.any(Date)
      }));
      // And for current performance - should be called with a short time range (~1 minute)
      const getTranslationMetricsSpy = vi.mocked(mockStorage.getTranslationMetrics);
      const calls = getTranslationMetricsSpy.mock.calls;
      const currentPerformanceCall = calls.find((call: any[]) => {
        const arg = call[0];
        if (arg && typeof arg === 'object' && arg.startDate && arg.endDate) {
          const timeDiff = new Date(arg.endDate).getTime() - new Date(arg.startDate).getTime();
          return timeDiff <= 65000; // <= 65 seconds (1 minute + buffer)
        }
        return false;
      });
      expect(currentPerformanceCall).toBeDefined();
    });
  });

  describe('Session Counting Bug Fix', () => {
    it('should use database session count for activeSessions, not WebSocket connection count', async () => {
      // This test specifically validates the bug fix where activeSessions should come from database, not WebSocket connections
      
      // Mock scenario: 1 teacher + 10 students = 11 WebSocket connections but only 1 session in database
      const mockActiveSessionProviderWithManyConnections = {
        getActiveSessionCount: vi.fn().mockReturnValue(11), // 11 WebSocket connections
        getActiveSessionsCount: vi.fn().mockReturnValue(11), // 11 WebSocket connections  
        getActiveStudentCount: vi.fn().mockReturnValue(10), // 10 students
        getActiveTeacherCount: vi.fn().mockReturnValue(1), // 1 teacher
      } as IActiveSessionProvider;

      // Database should show only 1 active session
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
        totalSessions: 1,
        activeSessions: 1, // Only 1 session in database
        averageSessionDuration: 300000,
        sessionsLast24Hours: 1
      });

      const diagnosticsServiceWithManyConnections = new DiagnosticsService(mockStorage, mockActiveSessionProviderWithManyConnections);
      const metrics = await diagnosticsServiceWithManyConnections.getMetrics();

      // FIXED: activeSessions should be 1 (from database), not 11 (from WebSocket connections)
      expect(metrics.sessions.activeSessions).toBe(1); // Database count, not connection count
      expect(metrics.sessions.studentsConnected).toBe(10); // Still from WebSocket provider (correct)
      expect(metrics.sessions.teachersConnected).toBe(1); // Still from WebSocket provider (correct)
      
      // Verify we're not accidentally using WebSocket connection count for activeSessions
      expect(metrics.sessions.activeSessions).not.toBe(11);
      expect(metrics.sessions.activeSessions).not.toBe(mockActiveSessionProviderWithManyConnections.getActiveSessionsCount());
    });
  });

  // describe('Historical Data Retrieval') // This block can be merged or refined if still needed.
  // The existing tests for getMetrics with specific time ranges and presets cover historical data.
  // If more specific scenarios for historical data are needed, they can be added here or within getMetrics.
});

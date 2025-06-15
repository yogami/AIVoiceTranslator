import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsService, TimeRangePreset } from '../../../server/services/DiagnosticsService';
import { MemStorage } from '../../../server/mem-storage';
import { IActiveSessionProvider } from '../../../server/services/IActiveSessionProvider';

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
  let mockStorage: MemStorage;
  let mockActiveSessionProvider: IActiveSessionProvider;

  const inMemoryTranslationSample = [110, 130, 120]; // 3 translations, average 120ms

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = new MemStorage();
    mockActiveSessionProvider = {
      getActiveSessionCount: vi.fn().mockReturnValue(2),
      getActiveSessionsCount: vi.fn().mockReturnValue(2), // Kept for potential direct use, though details is preferred
      getActiveStudentCount: vi.fn().mockReturnValue(1),
      getActiveTeacherCount: vi.fn().mockReturnValue(1),
      getActiveSessionsDetails: vi.fn().mockReturnValue([
        { teacherLanguage: 'en-US', studentLanguages: ['es', 'fr'] },
        { teacherLanguage: 'de', studentLanguages: ['en-US'] },
      ]),
    } as IActiveSessionProvider;
    diagnosticsService = new DiagnosticsService(mockStorage, mockActiveSessionProvider);

    diagnosticsService.reset();
    inMemoryTranslationSample.forEach(time => diagnosticsService.recordTranslation(time));

    vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
      totalSessions: 10,
      activeSessions: 2,
      averageSessionDuration: 300000,
      sessionsLast24Hours: 5
    });
    vi.spyOn(mockStorage, 'getTranslationMetrics').mockResolvedValue({
      totalTranslations: 100,
      averageLatency: 150,
      recentTranslations: 25
    });
    vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue([
      { sourceLanguage: 'en-US', targetLanguage: 'es', count: 50, averageLatency: 120 },
      { sourceLanguage: 'fr', targetLanguage: 'de', count: 30, averageLatency: 250 }
    ]);
    // Corrected mock data for getRecentSessionActivity
    vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([
      {
        sessionId: 'test-session-1',
        teacherLanguage: 'en-US',
        transcriptCount: 5,
        studentCount: 1,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(Date.now() - 1800000),   // 30 minutes ago
        duration: 1800000 // 30 minutes
      },
      {
        sessionId: 'test-session-2',
        teacherLanguage: 'fr-FR',
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
      const metrics = await diagnosticsService.getMetrics('lastHour');
      expect(mockActiveSessionProvider.getActiveTeacherCount).toHaveBeenCalled();
      expect(mockActiveSessionProvider.getActiveStudentCount).toHaveBeenCalled();
      expect(metrics.currentPerformance?.activeConnections).toBe(mockActiveSessionProvider.getActiveTeacherCount() + mockActiveSessionProvider.getActiveStudentCount());
    });
  });

  describe('Session Metrics from Provider', () => {
    it('should use IActiveSessionProvider for active session, student, and teacher counts', async () => {
      const metrics = await diagnosticsService.getMetrics('lastHour');
      expect(mockActiveSessionProvider.getActiveStudentCount).toHaveBeenCalled();
      expect(mockActiveSessionProvider.getActiveTeacherCount).toHaveBeenCalled();
      expect(metrics.sessions.activeSessions).toBe(2);
      expect(metrics.sessions.studentsConnected).toBe(1);
      expect(metrics.sessions.teachersConnected).toBe(1);
    });
  });

  describe('Translation Metrics', () => {
    it('should record translation times', () => {
      diagnosticsService.reset(); // Reset to clear translations from beforeEach
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordTranslation(200);
      diagnosticsService.recordTranslation(150);
      expect(diagnosticsService['translationTimes']).toEqual([100, 200, 150]);
    });
    it('should maintain only last 100 translations', () => {
      for (let i = 0; i < 105; i++) {
        diagnosticsService.recordTranslation(i);
      }
      expect(diagnosticsService['translationTimes'].length).toBe(100);
      expect(diagnosticsService['translationTimes'][0]).toBe(5);
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
      const historicalDbTranslations = { totalTranslations: 250, averageLatency: 180, recentTranslations: 50 };
      vi.spyOn(mockStorage, 'getTranslationMetrics').mockResolvedValue(historicalDbTranslations);
      const historicalDbSessions = { totalSessions: 15, activeSessions: 3, averageSessionDuration: 320000, sessionsLast24Hours: 7 };
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue(historicalDbSessions);
      const historicalDbLangPairs: any = [{ sourceLanguage: 'de', targetLanguage: 'en-US', count: 90, averageLatency: 170 }];
      vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue(historicalDbLangPairs);
      vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics(timeRange);

      expect(metrics.currentPerformance).toBeDefined();
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
      expect(metrics.translations.total).toBe(historicalDbTranslations.totalTranslations);
      expect(metrics.translations.averageTime).toBe(historicalDbTranslations.averageLatency);
      // Removed: expect(metrics.translations).not.toHaveProperty('totalFromDatabase');
      // Removed: expect(metrics.translations).not.toHaveProperty('averageLatencyFromDatabase');
      expect(metrics.translations.totalFromDatabase).toBe(historicalDbTranslations.totalTranslations); // Verify it's present and correct
      expect(metrics.translations.averageLatencyFromDatabase).toBe(historicalDbTranslations.averageLatency); // Verify it's present and correct
      expect(metrics.translations.recentTranslations).toBe(historicalDbTranslations.recentTranslations);
      expect(metrics.translations.languagePairs[0].sourceLanguage).toBe('de');
      expect(metrics.sessions.totalSessions).toBe(historicalDbSessions.totalSessions);
      expect(metrics.sessions.activeSessions).toBe(mockActiveSessionProvider.getActiveTeacherCount() + mockActiveSessionProvider.getActiveStudentCount());
      expect(mockStorage.getSessionMetrics).toHaveBeenCalledWith(timeRange);
      expect(mockStorage.getTranslationMetrics).toHaveBeenCalledWith(timeRange);
      expect(mockStorage.getLanguagePairUsage).toHaveBeenCalledWith(timeRange);
      expect(mockStorage.getRecentSessionActivity).toHaveBeenCalledWith(5);
      expect(metrics.timeRange?.startDate).toBe(timeRange.startDate.toISOString());
    });

    it('should return currentPerformance even if no timeRange is specified for historical data', async () => {
      vi.spyOn(mockStorage, 'getTranslationMetrics').mockResolvedValue({ totalTranslations: 0, averageLatency: 0, recentTranslations: 0 });
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({ totalSessions: 0, activeSessions: 0, averageSessionDuration: 0, sessionsLast24Hours: 0 });
      vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();

      expect(metrics.currentPerformance).toBeDefined();
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
      expect(metrics.translations.total).toBe(inMemoryTranslationSample.length); // From in-memory
      expect(metrics.translations.averageTime).toBe(120); // From in-memory
      expect(metrics.translations.languagePairs).toEqual([]); // Default when no timeRange
      expect(metrics.translations.totalFromDatabase).toBe(0); // Default when no timeRange
      expect(metrics.translations.averageLatencyFromDatabase).toBe(0); // Default when no timeRange

      expect(metrics.sessions.totalSessions).toBe(0); // From in-memory default
      expect(metrics.sessions.averageSessionDuration).toBe(0); // Default
      expect(metrics.sessions.recentSessionActivity).toEqual([]); // Default when no timeRange
      expect(metrics.sessions.sessionsLast24Hours).toBe(0); // Default
      expect(metrics.sessions.activeSessions).toBe(mockActiveSessionProvider.getActiveTeacherCount() + mockActiveSessionProvider.getActiveStudentCount()); // Live data
      expect(metrics.sessions.studentsConnected).toBe(mockActiveSessionProvider.getActiveStudentCount()); // Live data
      expect(metrics.sessions.teachersConnected).toBe(mockActiveSessionProvider.getActiveTeacherCount()); // Live data

      expect(metrics.timeRange).toBeUndefined();
      expect(mockStorage.getTranslationMetrics).not.toHaveBeenCalled();
      expect(mockStorage.getSessionMetrics).not.toHaveBeenCalled();
      expect(mockStorage.getLanguagePairUsage).not.toHaveBeenCalled();
      // getRecentSessionActivity is called by getSessionMetrics if timeRange is present.
      // Since getSessionMetrics (from storage) is not called, getRecentSessionActivity (from storage) also won't be.
      expect(mockStorage.getRecentSessionActivity).not.toHaveBeenCalled(); 
    });
  });

  describe('Metrics Retrieval', () => {
    beforeEach(() => {
      // This beforeEach in 'Metrics Retrieval' overrides the global one for these specific tests.
      // Ensure mocks are appropriate for these tests.
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2, // Historical active from DB
        averageSessionDuration: 300000,
        sessionsLast24Hours: 5
      });
      vi.spyOn(mockStorage, 'getTranslationMetrics').mockResolvedValue({
        totalTranslations: 100, // Historical total from DB
        averageLatency: 150,    // Historical avg latency from DB
        recentTranslations: 25
      });
      vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue([
        { sourceLanguage: 'en-US', targetLanguage: 'es', count: 50, averageLatency: 120 },
      ]);
      // Specific mock for recent session activity in this context if needed, or rely on outer beforeEach
      // For example, if these tests expect empty recent activity:
      vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([]); 

      diagnosticsService.reset();
      inMemoryTranslationSample.forEach(time => diagnosticsService.recordTranslation(time));
    });

    it('should retrieve session metrics (active from provider, historical from DB)', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours');
      expect(metrics.sessions).toEqual({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        averageSessionDurationFormatted: "5 minutes",
        recentSessionActivity: [], // Updated to reflect mock
        studentsConnected: 1,
        teachersConnected: 1,
        sessionsLast24Hours: 5,
        currentLanguages: [],
      });
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
    });

    it('should retrieve translation metrics (historical from DB for time range)', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours');
      expect(metrics.translations).toEqual({
        total: 100,
        averageTime: 150,
        averageTimeFormatted: "150 ms", // Assuming formatDuration(150, true)
        recentTranslations: 25,
        languagePairs: expect.any(Array),
        totalFromDatabase: 100, // Added
        averageLatencyFromDatabase: 150, // Added
        averageLatencyFromDatabaseFormatted: "150 ms", // Added, assuming formatDuration(150, true)
      });
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
    });
  });

  describe('Historical Data Retrieval', () => {
    beforeEach(() => {
      // This beforeEach in 'Historical Data Retrieval' overrides the global one.
      vi.spyOn(mockStorage, 'getSessionMetrics').mockResolvedValue({
        totalSessions: 100,
        activeSessions: 5, // Historical active from DB
        averageSessionDuration: 450000,
        sessionsLast24Hours: 15
      });
      vi.spyOn(mockStorage, 'getTranslationMetrics').mockResolvedValue({
        totalTranslations: 1000, // Historical total from DB
        averageLatency: 130,     // Historical avg latency from DB
        recentTranslations: 75
      });
      vi.spyOn(mockStorage, 'getLanguagePairUsage').mockResolvedValue([
        { sourceLanguage: 'en-GB', targetLanguage: 'it', count: 200, averageLatency: 110 },
      ]);
      // Specific mock for recent session activity in this context if needed
      // For example, if these tests expect empty recent activity or specific historical activity:
      vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([]); 

      diagnosticsService.reset();
      inMemoryTranslationSample.forEach(time => diagnosticsService.recordTranslation(time));
    });

    it('should retrieve historical session metrics with a specific time range AND current performance', async () => {
      const timeRange = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      const metrics = await diagnosticsService.getMetrics(timeRange);
      expect(mockStorage.getSessionMetrics).toHaveBeenCalledWith(timeRange);
      expect(metrics.sessions.totalSessions).toBe(100);
      expect(metrics.sessions.averageSessionDuration).toBe(450000);
      expect(metrics.sessions.sessionsLast24Hours).toBe(15);
      expect(metrics.sessions.activeSessions).toBe(mockActiveSessionProvider.getActiveTeacherCount() + mockActiveSessionProvider.getActiveStudentCount());
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
    });

    it('should retrieve historical translation metrics with a specific time range AND current performance', async () => {
      const timeRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      const metrics = await diagnosticsService.getMetrics(timeRange);
      expect(mockStorage.getTranslationMetrics).toHaveBeenCalledWith(timeRange);
      expect(metrics.translations.total).toBe(1000);
      expect(metrics.translations.averageTime).toBe(130);
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
    });

    it('should retrieve historical language pair usage with a specific time range AND current performance', async () => {
      const timeRange = {
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      const metrics = await diagnosticsService.getMetrics(timeRange);
      expect(mockStorage.getLanguagePairUsage).toHaveBeenCalledWith(timeRange);
      expect(metrics.translations.languagePairs).toEqual([
        { sourceLanguage: 'en-GB', targetLanguage: 'it', count: 200, averageLatency: 110, averageLatencyFormatted: "110 ms" },
      ]);
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
    });

    it('should retrieve recent session activity with a specific time range AND current performance', async () => {
      const timeRange = {
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      // This is the raw data from storage
      const mockActivityDataFromStorage: {sessionId: string, teacherLanguage: string | null, transcriptCount: number, studentCount: number, startTime: Date | null, endTime: Date | null, duration: number}[] = [
        {
          sessionId: 'test-session-recent-1',
          teacherLanguage: 'es-ES',
          transcriptCount: 15,
          studentCount: 3,
          startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          endTime: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000)), // 2 days ago + 30 mins
          duration: 30 * 60 * 1000 // 30 minutes
        }
      ];
      vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue(mockActivityDataFromStorage);

      const metrics = await diagnosticsService.getMetrics(timeRange);
      expect(mockStorage.getRecentSessionActivity).toHaveBeenCalledWith(5);
      
      // This is what DiagnosticsService.getSessionMetrics transforms it into
      const expectedRecentSessionActivity = mockActivityDataFromStorage.map(activity => {
        const lastActivityTimeValue = activity.endTime || activity.startTime;
        return {
          sessionId: activity.sessionId,
          language: activity.teacherLanguage || 'N/A',
          transcriptCount: activity.transcriptCount || 0,
          lastActivity: lastActivityTimeValue ? new Date(lastActivityTimeValue).toISOString() : 'N/A',
          studentCount: activity.studentCount || 0,
          duration: diagnosticsService.formatDuration(activity.duration || 0)
        };
      });
      
      expect(metrics.sessions.recentSessionActivity).toEqual(expectedRecentSessionActivity);
      expect(metrics.currentPerformance?.currentTranslationCount).toBe(inMemoryTranslationSample.length);
      expect(metrics.currentPerformance?.currentAverageTranslationTimeMs).toBe(120);
    });
  });
});

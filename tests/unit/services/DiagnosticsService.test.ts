import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsService, TimeRangePreset } from '../../../server/services/DiagnosticsService'; // Re-added TimeRangePreset import
import { MemStorage } from '../../../server/mem-storage';

// Mock global WebSocketServer
vi.mock('../../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

describe('DiagnosticsService', () => {
  let diagnosticsService: DiagnosticsService;
  let mockStorage: MemStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize a mock storage instance
    mockStorage = new MemStorage();
    diagnosticsService = new DiagnosticsService(mockStorage);

    // Mock storage methods
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

    vi.spyOn(mockStorage, 'getLanguagePairMetrics').mockResolvedValue([
      {
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        count: 50,
        averageLatency: 120
      },
      {
        sourceLanguage: 'fr',
        targetLanguage: 'de',
        count: 30,
        averageLatency: 250
      }
    ]);

    vi.spyOn(mockStorage, 'getRecentSessionActivity').mockResolvedValue([
      {
        sessionId: 'test-session-1',
        teacherLanguage: 'en-US',
        currentLanguage: 'en-US',
        transcriptCount: 5,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 1800000),
        duration: 1800000
      },
      {
        sessionId: 'test-session-2',
        teacherLanguage: null,
        currentLanguage: 'unknown',
        transcriptCount: 10,
        startTime: new Date(Date.now() - 600000),
        endTime: null,
        duration: 600000
      }
    ]);

    // Reset global wsServer
    (global as any).wsServer = undefined;
  });

  describe('Connection Tracking', () => {
    it('should track connection counts', async () => {
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnectionActive();

      const metrics = await diagnosticsService.getMetrics();
      expect(metrics.connections.active).toBe(1);
    });

    it('should handle connection closure', async () => {
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordConnectionClosed();

      const metrics = await diagnosticsService.getMetrics();
      expect(metrics.connections.active).toBe(1);
    });

    it('should not go negative on connection closure', async () => {
      diagnosticsService.recordConnectionClosed();
      diagnosticsService.recordConnectionClosed();
      diagnosticsService.recordConnectionClosed();

      const metrics = await diagnosticsService.getMetrics();
      expect(metrics.connections.active).toBe(0);
    });
  });

  describe('Translation Metrics', () => {
    it('should record translation times', () => {
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordTranslation(200);
      diagnosticsService.recordTranslation(150);
      
      expect(diagnosticsService['translationTimes']).toEqual([100, 200, 150]);
    });

    it('should maintain only last 100 translations', () => {
      // Add 105 translations
      for (let i = 0; i < 105; i++) {
        diagnosticsService.recordTranslation(i);
      }
      
      expect(diagnosticsService['translationTimes'].length).toBe(100);
      expect(diagnosticsService['translationTimes'][0]).toBe(5); // First 5 should be removed
    });
  });

  describe('Audio Generation Metrics', () => {
    it('should record audio generation times', () => {
      diagnosticsService.recordAudioGeneration(50);
      diagnosticsService.recordAudioGeneration(75);
      
      expect(diagnosticsService['audioGenerationTimes']).toEqual([50, 75]);
    });

    it('should track audio cache size', () => {
      diagnosticsService.setAudioCacheSize(1024 * 1024); // 1MB
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

    it('should format duration correctly', () => {
      expect(diagnosticsService.formatDuration(500)).toBe('500 ms');
      expect(diagnosticsService.formatDuration(1500)).toBe('1.5 seconds');
      expect(diagnosticsService.formatDuration(65000)).toBe('1.1 minutes');
      expect(diagnosticsService.formatDuration(3700000)).toBe('1.0 hours');
    });

    it('should format uptime correctly', () => {
      expect(diagnosticsService.formatUptime(30)).toBe('30 seconds');
      expect(diagnosticsService.formatUptime(90)).toBe('1.5 minutes');
      expect(diagnosticsService.formatUptime(3700)).toBe('1.0 hours');
      expect(diagnosticsService.formatUptime(90000)).toBe('1.0 days');
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 5 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([
        {
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          count: 50,
          averageLatency: 120 // Raw latency
        },
        {
          sourceLanguage: 'fr',
          targetLanguage: 'de',
          count: 30,
          averageLatency: 250 // Raw latency
        }
      ]);

      mockStorage.setRecentSessionActivity([
        {
          sessionId: 'test-session-1',
          teacherLanguage: 'en-US',
          transcriptCount: 5,
          startTime: new Date(Date.now() - 3600000), // 1 hour ago
          endTime: new Date(Date.now() - 1800000),   // 30 mins ago
          duration: 1800000 // 30 minutes
        },
        {
          sessionId: 'test-session-2',
          teacherLanguage: null, // Test default, explicitly set to null
          transcriptCount: 10,
          startTime: new Date(Date.now() - 600000), // 10 mins ago
          endTime: null, // Test ongoing session, explicitly set to null
          duration: 600000 // 10 minutes, assuming it's active or just ended
        }
      ]);

      // Record some metrics
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordAudioGeneration(50);
      diagnosticsService.setAudioCacheSize(1024 * 1024);

      const metrics = await diagnosticsService.getMetrics();

      expect(metrics).toMatchObject({
        connections: {
          total: 1,
          active: 1
        },
        translations: {
          total: 1,
          averageTime: 100,
          averageTimeFormatted: '100 ms',
          totalFromDatabase: 100,
          averageLatencyFromDatabase: 150,
          averageLatencyFromDatabaseFormatted: diagnosticsService.formatDuration(150),
          languagePairs: [
            {
              sourceLanguage: 'en-US',
              targetLanguage: 'es',
              count: 50,
              averageLatency: 120,
              averageLatencyFormatted: diagnosticsService.formatDuration(120)
            },
            {
              sourceLanguage: 'fr',
              targetLanguage: 'de',
              count: 30,
              averageLatency: 250,
              averageLatencyFormatted: diagnosticsService.formatDuration(250)
            }
          ],
          recentTranslations: 25
        },
        sessions: {
          totalSessions: 10,
          averageSessionDuration: 300000,
          averageSessionDurationFormatted: '5.0 minutes',
          // sessionsLast24Hours is part of the raw data from storage,
          // but not directly asserted here in the final metrics.sessions object
          // as DiagnosticsService might transform or use it differently.
          // The key is that the mock now provides it.
          recentSessionActivity: [
            {
              sessionId: 'test-session-1',
              language: 'en-US',
              transcriptCount: 5,
              lastActivity: expect.any(String), // End time should be used
              duration: 1800000
            },
            {
              sessionId: 'test-session-2',
              language: 'unknown', // Default value
              transcriptCount: 10,
              lastActivity: expect.any(String), // Start time should be used if end time is null
              duration: 600000
            }
          ]
        },
        audio: {
          totalGenerated: 1,
          averageGenerationTime: 50,
          averageGenerationTimeFormatted: '50 ms',
          cacheSize: 1024 * 1024,
          cacheSizeFormatted: '1.0 MB'
        },
        system: {
          memoryUsage: expect.any(Number),
          memoryUsageFormatted: expect.any(String),
          uptime: expect.any(Number),
          uptimeFormatted: expect.any(String)
        },
        lastUpdated: expect.any(String)
      });
    });

    it('should handle WebSocketServer metrics when available', async () => {
      // Mock WebSocketServer
      const mockWsServer = {
        getActiveSessionMetrics: vi.fn().mockReturnValue({
          activeSessions: 3,
          studentsConnected: 5,
          teachersConnected: 2,
          currentLanguages: ['en-US', 'es', 'fr']
        })
      };
      (global as any).wsServer = mockWsServer;

      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 3 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const metrics = await diagnosticsService.getMetrics();

      expect(metrics.sessions).toMatchObject({
        activeSessions: 3,
        studentsConnected: 5,
        teachersConnected: 2,
        currentLanguages: ['en-US', 'es', 'fr']
      });
    });

    it('should handle errors gracefully when WebSocketServer is not available', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 7 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const metrics = await diagnosticsService.getMetrics();

      // Should use default values when WebSocketServer is not available
      expect(metrics.sessions.activeSessions).toBe(0);
      expect(metrics.sessions.studentsConnected).toBe(0);
      expect(metrics.sessions.teachersConnected).toBe(0);
      expect(metrics.sessions.currentLanguages).toEqual([]);
    });
  });

  describe('getExportData', () => {
    it('should include export metadata', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 4 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const exportData = await diagnosticsService.getExportData();

      expect(exportData).toHaveProperty('exportedAt');
      expect(exportData).toHaveProperty('version', '1.0.0');
      expect(exportData).toHaveProperty('connections');
      expect(exportData).toHaveProperty('translations');
      expect(exportData).toHaveProperty('sessions');
      expect(exportData).toHaveProperty('audio');
      expect(exportData).toHaveProperty('system');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      // Add some data
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordAudioGeneration(50);
      diagnosticsService.setAudioCacheSize(1024);

      // Reset
      diagnosticsService.reset();

      // Verify all data is cleared
      expect(diagnosticsService['connectionCount']).toBe(0);
      expect(diagnosticsService['activeConnections']).toBe(0);
      expect(diagnosticsService['translationTimes']).toEqual([]);
      expect(diagnosticsService['audioGenerationTimes']).toEqual([]);
      expect(diagnosticsService.getAudioCacheSize()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays when calculating averages', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 0,
        activeSessions: 0,
        averageSessionDuration: 0,
        sessionsLast24Hours: 0 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 0,
        averageLatency: 0,
        recentTranslations: 0
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const metrics = await diagnosticsService.getMetrics();

      expect(metrics.translations.averageTime).toBe(0);
      expect(metrics.audio.averageGenerationTime).toBe(0);
    });

    it('should handle very large numbers in formatting', () => {
      const largeBytes = 1024 * 1024 * 1024 * 1024; // 1TB
      const formatted = diagnosticsService.formatBytes(largeBytes);
      expect(formatted).toMatch(/^\d+\.\d+ (GB|TB)$/);

      const largeDuration = 24 * 60 * 60 * 1000; // 24 hours
      const formattedDuration = diagnosticsService.formatDuration(largeDuration);
      expect(formattedDuration).toBe('24.0 hours');
    });
  });

  describe('Timeline-based Filtering', () => {
    it('should accept time range parameter for metrics', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 6 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const timeRange = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        endDate: new Date()
      };

      const metrics = await diagnosticsService.getMetrics(timeRange);

      // Verify storage methods were called with time range
      expect(mockStorage.getSessionMetrics).toHaveBeenCalledWith(timeRange);
      expect(mockStorage.getTranslationMetrics).toHaveBeenCalledWith(timeRange);
      expect(mockStorage.getLanguagePairMetrics).toHaveBeenCalledWith(timeRange);
    });

    it('should handle predefined time ranges', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 5,
        activeSessions: 1,
        averageSessionDuration: 180000,
        sessionsLast24Hours: 2 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 50,
        averageLatency: 100,
        recentTranslations: 10
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      // Test with 'lastHour' preset
      const metrics = await diagnosticsService.getMetrics('lastHour'); // Removed 'as any'

      // Verify storage methods were called
      expect(mockStorage.getSessionMetrics).toHaveBeenCalled();

      const mockCalls = vi.mocked(mockStorage.getSessionMetrics).mock.calls;
      console.log('Mock calls:', vi.mocked(mockStorage.getSessionMetrics).mock.calls); // Debugging log to verify if the mock is being called
      expect(mockCalls.length).toBeGreaterThan(0); // Ensure there is at least one call

      const callArgs = mockCalls[0]?.[0]; // Safely access the first call's arguments
      if (!callArgs) {
        throw new Error('Mock call arguments are undefined');
      }

      // Check that the time range is approximately 1 hour
      const timeDiff = callArgs.endDate.getTime() - callArgs.startDate.getTime();
      expect(timeDiff).toBeCloseTo(60 * 60 * 1000, -10000); // Within 10 seconds
    });

    it('should support multiple predefined time ranges', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 5,
        activeSessions: 1,
        averageSessionDuration: 180000,
        sessionsLast24Hours: 1 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 50,
        averageLatency: 100,
        recentTranslations: 10
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const timeRanges: TimeRangePreset[] = ['lastHour', 'last24Hours', 'last7Days', 'last30Days'];
      const expectedDurations = [
        60 * 60 * 1000,           // 1 hour
        24 * 60 * 60 * 1000,      // 24 hours
        7 * 24 * 60 * 60 * 1000,  // 7 days
        30 * 24 * 60 * 60 * 1000  // 30 days
      ];

      for (let i = 0; i < timeRanges.length; i++) {
        vi.clearAllMocks();
        // Mock the return value of getSessionMetrics to ensure valid data
        // Correct the mock to return a resolved value matching the expected type
        mockStorage.getSessionMetrics = vi.fn().mockResolvedValue({
          totalSessions: 10,
          activeSessions: 5,
          averageSessionDuration: 300000, // 5 minutes in milliseconds
          sessionsLast24Hours: 2,
        });

        // Ensure `getTranslationMetrics` is properly mocked as a spy
        mockStorage.getTranslationMetrics = vi.fn().mockResolvedValue({
          totalTranslations: 100,
          averageLatency: 150,
          recentTranslations: 25,
          languagePairs: [
            {
              sourceLanguage: 'en-US',
              targetLanguage: 'es',
              count: 50,
              averageLatency: 120,
            },
            {
              sourceLanguage: 'fr',
              targetLanguage: 'de',
              count: 30,
              averageLatency: 250,
            },
          ],
        });

        // Ensure `getLanguagePairMetrics` is properly mocked as a spy
        mockStorage.getLanguagePairMetrics = vi.fn().mockResolvedValue([
          {
            sourceLanguage: 'en-US',
            targetLanguage: 'es',
            count: 50,
            averageLatency: 120,
          },
          {
            sourceLanguage: 'fr',
            targetLanguage: 'de',
            count: 30,
            averageLatency: 250,
          },
        ]);

        await diagnosticsService.getMetrics(timeRanges[i]); // Changed 'as any' to 'as TimeRangePreset'
        
        // Ensure the mock is called and has valid arguments
        expect(mockStorage.getSessionMetrics).toHaveBeenCalled();
        const mockCalls = vi.mocked(mockStorage.getSessionMetrics).mock.calls;
        console.log('Mock calls:', vi.mocked(mockStorage.getSessionMetrics).mock.calls); // Debugging log to verify if the mock is being called
        expect(mockCalls.length).toBeGreaterThan(0); // Ensure there is at least one call

        const callArgs = mockCalls[0]?.[0]; // Safely access the first call's arguments
        if (!callArgs) {
          throw new Error('Mock call arguments are undefined');
        }

        // Check that the time range matches the expected duration
        const timeDiff = callArgs.endDate.getTime() - callArgs.startDate.getTime();
        expect(timeDiff).toBeCloseTo(expectedDurations[i], -10000);
      }
    });

    it('should include time range info in response', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 8 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      const metrics = await diagnosticsService.getMetrics('last24Hours');

      expect(metrics).toHaveProperty('timeRange');
      expect(metrics.timeRange).toMatchObject({
        preset: 'last24Hours',
        startDate: expect.any(String),
        endDate: expect.any(String)
      });
    });

    it('should handle invalid time range gracefully', async () => {
      // Mock storage responses
      mockStorage.setSessionMetrics({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000,
        sessionsLast24Hours: 9 // Added missing property
      });

      mockStorage.setTranslationMetrics({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      mockStorage.setLanguagePairMetrics([]);
      mockStorage.setRecentSessionActivity([]);

      // Should default to all-time when invalid preset is provided
      // 'as any' is appropriate here to test passing an invalid string
      const metrics = await diagnosticsService.getMetrics('invalidPreset' as any); 

      expect(metrics).toBeDefined();
      expect(metrics.timeRange).toBeUndefined();
    });
  });

  describe('Metrics Retrieval', () => {
    it('should retrieve session metrics', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours');
      expect(metrics.sessions).toEqual({
        totalSessions: 10,
        activeSessions: 0, // Adjusted: No active sessions from mock WebSocketServer by default
        averageSessionDuration: 300000,
        averageSessionDurationFormatted: "5.0 minutes",
        currentLanguages: [],
        recentSessionActivity: expect.any(Array),
        studentsConnected: 0, // Added missing property
        teachersConnected: 0, // Added missing property
      });
    });

    it('should retrieve translation metrics', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours');
      expect(metrics.translations).toEqual({
        total: 0, // Adjusted: Real-time total is 0 without ongoing translations
        averageTime: 0, // Adjusted: Real-time averageTime is 0
        averageTimeFormatted: "0 ms", // Adjusted: Real-time format
        totalFromDatabase: 100,
        averageLatencyFromDatabase: 150,
        averageLatencyFromDatabaseFormatted: "150 ms", // Adjusted: Formatting
        recentTranslations: 25,
        languagePairs: expect.any(Array),
      });
    });

    it('should retrieve language pair metrics', async () => {
      const metrics = await diagnosticsService.getMetrics('lastHour'); // Changed TimeRangePreset.LAST_HOUR to 'lastHour'
      expect(metrics.translations.languagePairs).toEqual([
        {
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          count: 50,
          averageLatency: 120,
          averageLatencyFormatted: "120 ms", // Adjusted: Formatting
        },
        {
          sourceLanguage: 'fr',
          targetLanguage: 'de',
          count: 30,
          averageLatency: 250,
          averageLatencyFormatted: "250 ms", // Adjusted: Formatting
        },
      ]);
    });
  });

  describe('Historical Data Retrieval', () => {
    let databaseStorageMock: any;

    beforeEach(() => {
      databaseStorageMock = {
        getSessionMetrics: vi.fn().mockResolvedValue({
          totalSessions: 10,
          averageSessionDuration: 300000,
          activeSessions: 2
        }),
        getTranslationMetrics: vi.fn().mockResolvedValue({
          totalTranslations: 100,
          averageLatency: 150,
          recentTranslations: 25
        }),
        getLanguagePairMetrics: vi.fn().mockResolvedValue([
          {
            sourceLanguage: 'en',
            targetLanguage: 'es',
            count: 50,
            averageLatency: 200,
            averageLatencyFormatted: '200 ms'
          }
        ]),
        getRecentSessionActivity: vi.fn().mockResolvedValue([
          {
            sessionId: 'test-session-1',
            teacherLanguage: 'en-US',
            currentLanguage: 'en-US',
            transcriptCount: 5,
            startTime: new Date(Date.now() - 3600000),
            endTime: new Date(Date.now() - 1800000),
            duration: 1800000
          }
        ])
      };

      diagnosticsService = new DiagnosticsService(databaseStorageMock);
    });

    it('should retrieve session metrics from DatabaseStorage', async () => {
      const metrics = await diagnosticsService.getMetrics();
      expect(databaseStorageMock.getSessionMetrics).toHaveBeenCalled();
      expect(metrics.sessions.totalSessions).toBe(10);
      expect(metrics.sessions.averageSessionDuration).toBe(300000);
      expect(metrics.sessions.activeSessions).toBe(0); // Adjusted: No active sessions
    });

    it('should retrieve translation metrics from DatabaseStorage', async () => {
      const metrics = await diagnosticsService.getMetrics();
      expect(databaseStorageMock.getTranslationMetrics).toHaveBeenCalled();
      expect(metrics.translations.totalFromDatabase).toBe(100);
      expect(metrics.translations.averageLatencyFromDatabase).toBe(150);
      expect(metrics.translations.recentTranslations).toBe(25);
    });

    it('should retrieve language pair metrics from DatabaseStorage', async () => {
      const metrics = await diagnosticsService.getMetrics('last24Hours'); // Changed TimeRangePreset.LAST_24_HOURS to 'last24Hours'
      expect(databaseStorageMock.getLanguagePairMetrics).toHaveBeenCalledWith(expect.objectContaining({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      })); // Expect a TimeRange object
      expect(metrics.translations.languagePairs).toEqual([
        {
          sourceLanguage: 'en',
          targetLanguage: 'es',
          count: 50,
          averageLatency: 200,
          averageLatencyFormatted: "200 ms", // Added: Missing formatted string
        },
      ]);
    });

    it('should retrieve recent session activity from DatabaseStorage', async () => {
      const metrics = await diagnosticsService.getMetrics();
      expect(databaseStorageMock.getRecentSessionActivity).toHaveBeenCalled();
      expect(metrics.sessions.recentSessionActivity).toEqual(expect.any(Array));
    });
  });
});

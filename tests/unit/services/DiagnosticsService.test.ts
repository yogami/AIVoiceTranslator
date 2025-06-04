import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsService } from '../../../server/services/DiagnosticsService';
import { storage } from '../../../server/storage';

// Mock the storage module
vi.mock('../../../server/storage', () => ({
  storage: {
    getSessionMetrics: vi.fn(),
    getTranslationMetrics: vi.fn(),
    getLanguagePairMetrics: vi.fn(),
    getRecentSessionActivity: vi.fn()
  }
}));

// Mock global WebSocketServer
vi.mock('../../../server/services/WebSocketServer', () => ({
  WebSocketServer: vi.fn()
}));

describe('DiagnosticsService', () => {
  let diagnosticsService: DiagnosticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsService = new DiagnosticsService();
    
    // Reset global wsServer
    (global as any).wsServer = undefined;
  });

  describe('Connection Tracking', () => {
    it('should track connection counts', () => {
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnection();
      diagnosticsService.recordConnectionActive();
      
      expect(diagnosticsService['connectionCount']).toBe(2);
      expect(diagnosticsService['activeConnections']).toBe(1);
    });

    it('should handle connection closure', () => {
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordConnectionActive();
      diagnosticsService.recordConnectionClosed();
      
      expect(diagnosticsService['activeConnections']).toBe(1);
    });

    it('should not go negative on connection closure', () => {
      diagnosticsService.recordConnectionClosed();
      diagnosticsService.recordConnectionClosed();
      
      expect(diagnosticsService['activeConnections']).toBe(0);
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
      vi.mocked(storage.getSessionMetrics).mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000
      });

      vi.mocked(storage.getTranslationMetrics).mockResolvedValue({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      vi.mocked(storage.getLanguagePairMetrics).mockResolvedValue([
        {
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          count: 50,
          averageLatency: 120
        }
      ]);

      vi.mocked(storage.getRecentSessionActivity).mockResolvedValue([
        {
          sessionId: 'test-session',
          teacherLanguage: 'en-US',
          transcriptCount: 5,
          startTime: new Date(),
          endTime: new Date(),
          duration: 60000
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
          languagePairs: expect.any(Array),
          recentTranslations: 25
        },
        sessions: {
          totalSessions: 10,
          averageSessionDuration: 300000,
          averageSessionDurationFormatted: '5.0 minutes'
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
      vi.mocked(storage.getSessionMetrics).mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000
      });

      vi.mocked(storage.getTranslationMetrics).mockResolvedValue({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      vi.mocked(storage.getLanguagePairMetrics).mockResolvedValue([]);
      vi.mocked(storage.getRecentSessionActivity).mockResolvedValue([]);

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
      vi.mocked(storage.getSessionMetrics).mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000
      });

      vi.mocked(storage.getTranslationMetrics).mockResolvedValue({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      vi.mocked(storage.getLanguagePairMetrics).mockResolvedValue([]);
      vi.mocked(storage.getRecentSessionActivity).mockResolvedValue([]);

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
      vi.mocked(storage.getSessionMetrics).mockResolvedValue({
        totalSessions: 10,
        activeSessions: 2,
        averageSessionDuration: 300000
      });

      vi.mocked(storage.getTranslationMetrics).mockResolvedValue({
        totalTranslations: 100,
        averageLatency: 150,
        recentTranslations: 25
      });

      vi.mocked(storage.getLanguagePairMetrics).mockResolvedValue([]);
      vi.mocked(storage.getRecentSessionActivity).mockResolvedValue([]);

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
      vi.mocked(storage.getSessionMetrics).mockResolvedValue({
        totalSessions: 0,
        activeSessions: 0,
        averageSessionDuration: 0
      });

      vi.mocked(storage.getTranslationMetrics).mockResolvedValue({
        totalTranslations: 0,
        averageLatency: 0,
        recentTranslations: 0
      });

      vi.mocked(storage.getLanguagePairMetrics).mockResolvedValue([]);
      vi.mocked(storage.getRecentSessionActivity).mockResolvedValue([]);

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
});

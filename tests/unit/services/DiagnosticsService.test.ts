import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiagnosticsService } from '../../../server/services/DiagnosticsService';
import { storage } from '../../../server/storage';

// Mock the storage module
vi.mock('../../../server/storage', () => ({
  storage: {
    getTranslationsByDateRange: vi.fn(),
    getAllActiveSessions: vi.fn(),
    createSession: vi.fn(),
    addTranslation: vi.fn(),
    addTranscript: vi.fn()
  }
}));

describe('DiagnosticsService', () => {
  let diagnosticsService: DiagnosticsService;

  beforeEach(() => {
    diagnosticsService = new DiagnosticsService();
    vi.clearAllMocks();
    vi.useFakeTimers(); // Enable fake timers
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
  });

  describe('Connection tracking', () => {
    it('should record new connections', () => {
      diagnosticsService.recordConnection('conn1', 'teacher');
      diagnosticsService.recordConnection('conn2', 'student');
      diagnosticsService.recordConnection('conn3', 'student');

      // Can't directly test private state, but we can test through getMetrics
      // This is a limitation we'll address by testing the metrics output
    });

    it('should track unique teachers and students', async () => {
      // Record connections
      diagnosticsService.recordConnection('teacher1', 'teacher');
      diagnosticsService.recordConnection('teacher2', 'teacher');
      diagnosticsService.recordConnection('student1', 'student');
      diagnosticsService.recordConnection('student2', 'student');
      diagnosticsService.recordConnection('student3', 'student');

      // Mock storage responses
      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();

      expect(metrics.connections.total).toBe(5);
      expect(metrics.connections.active).toBe(5);
      expect(metrics.connections.teachers).toBe(2);
      expect(metrics.connections.students).toBe(3);
      expect(metrics.usage.uniqueTeachersToday).toBe(2);
      expect(metrics.usage.uniqueStudentsToday).toBe(3);
    });

    it('should track peak concurrent users', async () => {
      // Add connections
      diagnosticsService.recordConnection('conn1', 'teacher');
      diagnosticsService.recordConnection('conn2', 'student');
      diagnosticsService.recordConnection('conn3', 'student');
      diagnosticsService.recordConnection('conn4', 'student');
      diagnosticsService.recordConnection('conn5', 'student');
      
      // Remove one
      diagnosticsService.recordConnectionClosed('conn2');
      
      // Add more (but peak should remain 5)
      diagnosticsService.recordConnection('conn6', 'student');

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.connections.active).toBe(5); // 5 active (removed conn2, added conn6)
      expect(metrics.usage.peakConcurrentUsers).toBe(5); // Peak was 5
    });

    it('should handle connection closure', async () => {
      diagnosticsService.recordConnection('conn1', 'teacher');
      diagnosticsService.recordConnection('conn2', 'student');
      diagnosticsService.recordConnectionClosed('conn1');

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.connections.active).toBe(1);
      expect(metrics.connections.teachers).toBe(0);
      expect(metrics.connections.students).toBe(1);
    });
  });

  describe('Session tracking', () => {
    it('should track session start and end', () => {
      const sessionId = 'ABC123';
      
      diagnosticsService.recordSessionStart(sessionId);
      
      // Simulate session duration
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      diagnosticsService.recordSessionEnd(sessionId);
      
      // Session tracking is internal, we'll verify through metrics
    });

    it('should calculate average session length', async () => {
      // Use fake Date.now() for consistent timing
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      
      // Start and end first session
      diagnosticsService.recordSessionStart('session1');
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      diagnosticsService.recordSessionEnd('session1');

      // Start and end second session
      diagnosticsService.recordSessionStart('session2');
      vi.advanceTimersByTime(20 * 60 * 1000); // 20 minutes
      diagnosticsService.recordSessionEnd('session2');

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      // Average should be 15 minutes (900000 ms)
      expect(metrics.sessions.averageSessionDuration).toBeCloseTo(15 * 60 * 1000);
      expect(metrics.usage.averageSessionLengthFormatted).toContain('15.0 minutes');
    });
  });

  describe('Translation tracking', () => {
    it('should record translation times', () => {
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordTranslation(200);
      diagnosticsService.recordTranslation(300);
      
      // Verify through metrics
    });

    it('should calculate average translation time', async () => {
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordTranslation(200);
      diagnosticsService.recordTranslation(300);

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.translations.averageTime).toBe(200);
      expect(metrics.translations.averageTimeFormatted).toBe('200 ms');
    });

    it('should limit translation history to last 100', async () => {
      // Record 150 translations
      for (let i = 0; i < 150; i++) {
        diagnosticsService.recordTranslation(100);
      }

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.translations.total).toBe(100); // Should be capped at 100
    });
  });

  describe('Transcription tracking', () => {
    it('should count total transcriptions', async () => {
      diagnosticsService.recordTranscription();
      diagnosticsService.recordTranscription();
      diagnosticsService.recordTranscription();

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.usage.totalTranscriptions).toBe(3);
    });
  });

  describe('Audio generation tracking', () => {
    it('should record audio generation times', async () => {
      diagnosticsService.recordAudioGeneration(50);
      diagnosticsService.recordAudioGeneration(100);
      diagnosticsService.recordAudioGeneration(150);

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.audio.totalGenerated).toBe(3);
      expect(metrics.audio.averageGenerationTime).toBe(100);
      expect(metrics.audio.averageGenerationTimeFormatted).toBe('100 ms');
    });

    it('should track audio cache size', async () => {
      diagnosticsService.setAudioCacheSize(1024 * 1024); // 1 MB

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.audio.cacheSize).toBe(1024 * 1024);
      expect(metrics.audio.cacheSizeFormatted).toBe('1.0 MB');
    });
  });

  describe('Database metrics integration', () => {
    it('should fetch translations from database', async () => {
      const mockTranslations = [
        {
          id: 1,
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          originalText: 'Hello',
          translatedText: 'Hola',
          latency: 150,
          timestamp: new Date()
        },
        {
          id: 2,
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: 'World',
          translatedText: 'Monde',
          latency: 200,
          timestamp: new Date()
        }
      ];

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue(mockTranslations);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.translations.totalFromDatabase).toBe(2);
      expect(metrics.translations.averageLatencyFromDatabase).toBe(175);
      expect(metrics.translations.translationsLast24Hours).toBe(2);
    });

    it('should calculate language pair metrics', async () => {
      const mockTranslations = [
        {
          id: 1,
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          originalText: 'Hello',
          translatedText: 'Hola',
          latency: 100,
          timestamp: new Date()
        },
        {
          id: 2,
          sourceLanguage: 'en-US',
          targetLanguage: 'es',
          originalText: 'World',
          translatedText: 'Mundo',
          latency: 200,
          timestamp: new Date()
        },
        {
          id: 3,
          sourceLanguage: 'en-US',
          targetLanguage: 'fr',
          originalText: 'Test',
          translatedText: 'Test',
          latency: 150,
          timestamp: new Date()
        }
      ];

      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue(mockTranslations);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.translations.languagePairs).toHaveLength(2);
      expect(metrics.translations.languagePairs[0]).toEqual({
        sourceLanguage: 'en-US',
        targetLanguage: 'es',
        count: 2,
        averageLatency: 150,
        averageLatencyFormatted: '150 ms'
      });
      expect(metrics.translations.languagePairs[1]).toEqual({
        sourceLanguage: 'en-US',
        targetLanguage: 'fr',
        count: 1,
        averageLatency: 150,
        averageLatencyFormatted: '150 ms'
      });
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(storage.getTranslationsByDateRange).mockRejectedValue(new Error('DB Error'));
      vi.mocked(storage.getAllActiveSessions).mockRejectedValue(new Error('DB Error'));

      const metrics = await diagnosticsService.getMetrics();
      
      // Should return default values when storage fails
      expect(metrics.translations.totalFromDatabase).toBe(0);
      expect(metrics.translations.averageLatencyFromDatabase).toBe(0);
      expect(metrics.sessions.activeSessions).toBe(0);
    });
  });

  describe('Formatting utilities', () => {
    it('should format bytes correctly', () => {
      expect(diagnosticsService.formatBytes(0)).toBe('0.0 B');
      expect(diagnosticsService.formatBytes(512)).toBe('512.0 B');
      expect(diagnosticsService.formatBytes(1024)).toBe('1.0 KB');
      expect(diagnosticsService.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(diagnosticsService.formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format duration correctly', () => {
      expect(diagnosticsService.formatDuration(500)).toBe('500 ms');
      expect(diagnosticsService.formatDuration(1500)).toBe('1.5 seconds');
      expect(diagnosticsService.formatDuration(90000)).toBe('1.5 minutes');
      expect(diagnosticsService.formatDuration(5400000)).toBe('1.5 hours');
    });

    it('should format uptime correctly', () => {
      expect(diagnosticsService.formatUptime(30)).toBe('30 seconds');
      expect(diagnosticsService.formatUptime(90)).toBe('1.5 minutes');
      expect(diagnosticsService.formatUptime(5400)).toBe('1.5 hours');
      expect(diagnosticsService.formatUptime(129600)).toBe('1.5 days');
    });
  });

  describe('System metrics', () => {
    it('should track memory usage and uptime', async () => {
      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.system.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memoryUsageFormatted).toMatch(/\d+\.\d+ [KMGB]B/);
      expect(metrics.system.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.system.uptimeFormatted).toBeTruthy();
    });
  });

  describe('Export functionality', () => {
    it('should export diagnostics data with metadata', async () => {
      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const exportData = await diagnosticsService.getExportData();
      
      expect(exportData).toHaveProperty('exportedAt');
      expect(exportData).toHaveProperty('version', '1.0.0');
      expect(exportData).toHaveProperty('connections');
      expect(exportData).toHaveProperty('translations');
      expect(exportData).toHaveProperty('sessions');
      expect(exportData).toHaveProperty('audio');
      expect(exportData).toHaveProperty('system');
      expect(exportData).toHaveProperty('usage');
    });
  });

  describe('Reset functionality', () => {
    it('should reset all metrics', async () => {
      // Add some data
      diagnosticsService.recordConnection('conn1', 'teacher');
      diagnosticsService.recordTranslation(100);
      diagnosticsService.recordTranscription();
      diagnosticsService.recordAudioGeneration(50);
      
      // Reset
      diagnosticsService.reset();
      
      vi.mocked(storage.getTranslationsByDateRange).mockResolvedValue([]);
      vi.mocked(storage.getAllActiveSessions).mockResolvedValue([]);

      const metrics = await diagnosticsService.getMetrics();
      
      expect(metrics.connections.total).toBe(0);
      expect(metrics.connections.active).toBe(0);
      expect(metrics.translations.total).toBe(0);
      expect(metrics.audio.totalGenerated).toBe(0);
      expect(metrics.usage.totalTranscriptions).toBe(0);
    });
  });
}); 
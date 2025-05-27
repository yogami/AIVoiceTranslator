import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsService } from '../../../server/services/DiagnosticsService';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;

  beforeEach(() => {
    service = new DiagnosticsService();
    vi.clearAllMocks();
  });

  describe('Translation Metrics', () => {
    it('should record translation times and calculate averages', () => {
      // Given: No translations recorded yet
      expect(service.getMetrics().translations.total).toBe(0);
      expect(service.getMetrics().translations.averageTime).toBe(0);

      // When: We record some translations
      service.recordTranslation(100);
      service.recordTranslation(200);
      service.recordTranslation(300);

      // Then: Metrics should be calculated correctly
      const metrics = service.getMetrics();
      expect(metrics.translations.total).toBe(3);
      expect(metrics.translations.averageTime).toBe(200); // (100+200+300)/3
    });

    it('should format translation times in human-readable format', () => {
      // Given: Various translation times
      service.recordTranslation(500);   // 500ms
      service.recordTranslation(1500);  // 1.5 seconds
      service.recordTranslation(2000);  // 2 seconds

      // When: We get formatted metrics
      const metrics = service.getMetrics();

      // Then: Times should be formatted appropriately
      expect(metrics.translations.averageTimeFormatted).toMatch(/1\.3\s?seconds?/);
    });
  });

  describe('Audio Generation Metrics', () => {
    it('should record audio generation times by service type', () => {
      // When: We record audio generation for different services
      service.recordAudioGeneration(300, 'openai');
      service.recordAudioGeneration(150, 'browser');
      service.recordAudioGeneration(400, 'openai');

      // Then: Metrics should be tracked correctly
      const metrics = service.getMetrics();
      expect(metrics.audio.totalGenerated).toBe(3);
      expect(metrics.audio.averageGenerationTime).toBe(283); // (300+150+400)/3
    });

    it('should track audio cache information', () => {
      // Given: Mock audio cache size
      service.setAudioCacheSize(1024 * 1024 * 5); // 5MB

      // When: We get metrics
      const metrics = service.getMetrics();

      // Then: Cache size should be formatted properly
      expect(metrics.audio.cacheSize).toBe(1024 * 1024 * 5);
      expect(metrics.audio.cacheSizeFormatted).toMatch(/5\.0\s?MB/);
    });
  });

  describe('Connection Metrics', () => {
    it('should track total and active connections', () => {
      // Given: Initial state
      expect(service.getMetrics().connections.total).toBe(0);
      expect(service.getMetrics().connections.active).toBe(0);

      // When: We record connections
      service.recordConnection();
      service.recordConnection();
      service.recordConnectionActive();

      // Then: Counts should be updated
      const metrics = service.getMetrics();
      expect(metrics.connections.total).toBe(2);
      expect(metrics.connections.active).toBe(1);
    });

    it('should handle connection closures', () => {
      // Given: Some active connections
      service.recordConnection();
      service.recordConnectionActive();
      service.recordConnectionActive();

      // When: A connection closes
      service.recordConnectionClosed();

      // Then: Active count should decrease
      const metrics = service.getMetrics();
      expect(metrics.connections.total).toBe(1);
      expect(metrics.connections.active).toBe(1);
    });
  });

  describe('System Metrics', () => {
    it('should provide memory usage information', () => {
      // When: We get system metrics
      const metrics = service.getMetrics();

      // Then: Memory information should be present and formatted
      expect(metrics.system.memoryUsage).toBeGreaterThan(0);
      expect(metrics.system.memoryUsageFormatted).toMatch(/\d+\.?\d*\s?(MB|GB)/);
    });

    it('should track application uptime', async () => {
      // Given: A service that has been running for a short time
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
      
      // When: We get uptime
      const metrics = service.getMetrics();

      // Then: Uptime should be positive and formatted
      expect(metrics.system.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.system.uptimeFormatted).toMatch(/\d+\s?(seconds?|minutes?|hours?|days?)/);
    });
  });

  describe('Formatting Utilities', () => {
    it('should format bytes to human-readable sizes', () => {
      // Test various byte sizes
      expect(service.formatBytes(500)).toBe('500.0 B');
      expect(service.formatBytes(1024)).toBe('1.0 KB');
      expect(service.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(service.formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format duration to human-readable time', () => {
      // Test various durations in milliseconds
      expect(service.formatDuration(500)).toBe('500 ms');
      expect(service.formatDuration(1500)).toBe('1.5 seconds');
      expect(service.formatDuration(65000)).toBe('1.1 minutes');
      expect(service.formatDuration(3700000)).toBe('1.0 hours');
    });

    it('should format uptime appropriately', () => {
      // Test various uptime values in seconds
      expect(service.formatUptime(30)).toBe('30 seconds');
      expect(service.formatUptime(90)).toBe('1.5 minutes');
      expect(service.formatUptime(3700)).toBe('1.0 hours');
      expect(service.formatUptime(90000)).toBe('1.0 days');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics to initial state', () => {
      // Given: Service with recorded metrics
      service.recordTranslation(100);
      service.recordAudioGeneration(200, 'openai');
      service.recordConnection();

      // When: We reset
      service.reset();

      // Then: All counters should be zero
      const metrics = service.getMetrics();
      expect(metrics.translations.total).toBe(0);
      expect(metrics.audio.totalGenerated).toBe(0);
      expect(metrics.connections.total).toBe(0);
    });
  });

  describe('Data Export', () => {
    it('should provide complete diagnostic data for export', () => {
      // Given: Service with some metrics
      service.recordTranslation(150);
      service.recordAudioGeneration(300, 'openai');
      service.recordConnection();

      // When: We get export data
      const exportData = service.getExportData();

      // Then: Should include all metrics plus metadata
      expect(exportData).toMatchObject({
        connections: expect.any(Object),
        translations: expect.any(Object),
        audio: expect.any(Object),
        system: expect.any(Object),
        exportedAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        version: expect.any(String)
      });
    });
  });
});
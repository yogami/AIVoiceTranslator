/**
 * Diagnostics Service
 * 
 * Provides comprehensive application diagnostics for non-technical users.
 * Tracks performance metrics, system health, and provides user-friendly formatting.
 */

interface ConnectionMetrics {
  total: number;
  active: number;
}

interface TranslationMetrics {
  total: number;
  averageTime: number;
  averageTimeFormatted: string;
}

interface AudioMetrics {
  totalGenerated: number;
  averageGenerationTime: number;
  averageGenerationTimeFormatted: string;
  cacheSize: number;
  cacheSizeFormatted: string;
}

interface SystemMetrics {
  memoryUsage: number;
  memoryUsageFormatted: string;
  uptime: number;
  uptimeFormatted: string;
}

export interface DiagnosticsData {
  connections: ConnectionMetrics;
  translations: TranslationMetrics;
  audio: AudioMetrics;
  system: SystemMetrics;
  lastUpdated: string;
}

export interface DiagnosticsExportData extends DiagnosticsData {
  exportedAt: string;
  version: string;
}

export class DiagnosticsService {
  private startTime: number;
  private connectionCount: number = 0;
  private activeConnections: number = 0;
  private translationTimes: number[] = [];
  private audioGenerationTimes: number[] = [];
  private audioCacheSize: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  recordConnection(): void {
    this.connectionCount++;
  }

  recordConnectionActive(): void {
    this.activeConnections++;
  }

  recordConnectionClosed(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
    }
  }

  recordTranslation(timeMs: number): void {
    this.translationTimes.push(timeMs);
    // Keep only last 100 translations for memory efficiency
    if (this.translationTimes.length > 100) {
      this.translationTimes.shift();
    }
  }

  recordAudioGeneration(timeMs: number, service: string): void {
    this.audioGenerationTimes.push(timeMs);
    // Keep only last 100 audio generations
    if (this.audioGenerationTimes.length > 100) {
      this.audioGenerationTimes.shift();
    }
  }

  getAudioCacheSize(): number {
    // This would normally check actual cache size, for now return mock value
    return this.audioCacheSize;
  }

  setAudioCacheSize(size: number): void {
    this.audioCacheSize = size;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0.0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms} ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)} seconds`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)} minutes`;
    } else {
      return `${(ms / 3600000).toFixed(1)} hours`;
    }
  }

  formatUptime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)} minutes`;
    } else if (seconds < 86400) {
      return `${(seconds / 3600).toFixed(1)} hours`;
    } else {
      return `${(seconds / 86400).toFixed(1)} days`;
    }
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return Math.round(numbers.reduce((sum, num) => sum + num, 0) / numbers.length);
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private getUptime(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  getMetrics(): DiagnosticsData {
    const translationAvg = this.calculateAverage(this.translationTimes);
    const audioAvg = this.calculateAverage(this.audioGenerationTimes);
    const memoryUsage = this.getMemoryUsage();
    const uptime = this.getUptime();

    return {
      connections: {
        total: this.connectionCount,
        active: this.activeConnections
      },
      translations: {
        total: this.translationTimes.length,
        averageTime: translationAvg,
        averageTimeFormatted: this.formatDuration(translationAvg)
      },
      audio: {
        totalGenerated: this.audioGenerationTimes.length,
        averageGenerationTime: audioAvg,
        averageGenerationTimeFormatted: this.formatDuration(audioAvg),
        cacheSize: this.getAudioCacheSize(),
        cacheSizeFormatted: this.formatBytes(this.getAudioCacheSize())
      },
      system: {
        memoryUsage,
        memoryUsageFormatted: this.formatBytes(memoryUsage),
        uptime,
        uptimeFormatted: this.formatUptime(uptime)
      },
      lastUpdated: new Date().toISOString()
    };
  }

  getExportData(): DiagnosticsExportData {
    const metrics = this.getMetrics();
    return {
      ...metrics,
      exportedAt: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  reset(): void {
    this.connectionCount = 0;
    this.activeConnections = 0;
    this.translationTimes = [];
    this.audioGenerationTimes = [];
    this.audioCacheSize = 0;
    this.startTime = Date.now();
  }
}
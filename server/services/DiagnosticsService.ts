/**
 * Diagnostics Service
 * 
 * Provides comprehensive application diagnostics for non-technical users.
 * Tracks performance metrics, system health, and provides user-friendly formatting.
 */

import { storage } from '../storage';
import { WebSocketServer } from './WebSocketServer';

interface ConnectionMetrics {
  total: number;
  active: number;
}

interface TranslationMetrics {
  total: number;
  averageTime: number;
  averageTimeFormatted: string;
  totalFromDatabase: number;
  averageLatencyFromDatabase: number;
  averageLatencyFromDatabaseFormatted: string;
  languagePairs: LanguagePairMetric[];
  recentTranslations: number;
}

interface LanguagePairMetric {
  sourceLanguage: string;
  targetLanguage: string;
  count: number;
  averageLatency: number;
  averageLatencyFormatted: string;
}

interface SessionMetrics {
  activeSessions: number;
  totalSessions: number;
  averageSessionDuration: number;
  averageSessionDurationFormatted: string;
  studentsConnected: number;
  teachersConnected: number;
  currentLanguages: string[];
  recentSessionActivity: SessionActivity[];
}

interface SessionActivity {
  sessionId: string;
  language: string;
  transcriptCount: number;
  lastActivity: string;
  duration: number;
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

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeRangeInfo {
  preset?: string;
  startDate: string;
  endDate: string;
}

export interface DiagnosticsData {
  connections: ConnectionMetrics;
  translations: TranslationMetrics;
  sessions: SessionMetrics;
  audio: AudioMetrics;
  system: SystemMetrics;
  lastUpdated: string;
  timeRange?: TimeRangeInfo;
}

export interface DiagnosticsExportData extends DiagnosticsData {
  exportedAt: string;
  version: string;
}

export type TimeRangePreset = 'lastHour' | 'last24Hours' | 'last7Days' | 'last30Days';

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

  recordAudioGeneration(timeMs: number): void {
    this.audioGenerationTimes.push(timeMs);
    // Keep only last 100 audio generations
    if (this.audioGenerationTimes.length > 100) {
      this.audioGenerationTimes.shift();
    }
  }

  getAudioCacheSize(): number {
    return this.audioCacheSize;
  }

  setAudioCacheSize(size: number): void {
    this.audioCacheSize = size;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0.0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    
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

  private parseTimeRange(timeRangeOrPreset?: TimeRange | TimeRangePreset): TimeRange | undefined {
    if (!timeRangeOrPreset) {
      return undefined;
    }

    // If it's already a TimeRange object, return it
    if (typeof timeRangeOrPreset === 'object' && 'startDate' in timeRangeOrPreset && 'endDate' in timeRangeOrPreset) {
      return timeRangeOrPreset;
    }

    // If it's a preset string, convert to TimeRange
    if (typeof timeRangeOrPreset === 'string') {
      const now = new Date();
      let startDate: Date;

      switch (timeRangeOrPreset) {
        case 'lastHour':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'last24Hours':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last7Days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30Days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          return undefined;
      }

      return {
        startDate,
        endDate: now
      };
    }

    return undefined;
  }

  async getMetrics(timeRangeOrPreset?: TimeRange | TimeRangePreset): Promise<DiagnosticsData> {
    const translationAvg = this.calculateAverage(this.translationTimes);
    const audioAvg = this.calculateAverage(this.audioGenerationTimes);
    const memoryUsage = this.getMemoryUsage();
    const uptime = this.getUptime();

    // Parse time range
    const timeRange = this.parseTimeRange(timeRangeOrPreset);

    // Get real data from storage with optional time range
    const [sessions, translations, languagePairs] = await Promise.all([
      storage.getSessionMetrics(timeRange),
      storage.getTranslationMetrics(timeRange),
      storage.getLanguagePairMetrics(timeRange)
    ]);

    // Get active connection data from WebSocketServer if available
    let activeSessionData = {
      activeSessions: 0,
      studentsConnected: 0,
      teachersConnected: 0,
      currentLanguages: [] as string[]
    };

    try {
      // Get WebSocketServer instance if it exists
      const wsServer = (global as any).wsServer as WebSocketServer;
      if (wsServer) {
        activeSessionData = wsServer.getActiveSessionMetrics();
      }
    } catch (error) {
      console.error('Failed to get active session metrics:', error);
    }

    // Format language pair metrics
    const formattedLanguagePairs = languagePairs.map(pair => ({
      sourceLanguage: pair.sourceLanguage,
      targetLanguage: pair.targetLanguage,
      count: pair.count,
      averageLatency: pair.averageLatency,
      averageLatencyFormatted: this.formatDuration(pair.averageLatency)
    }));

    // Get recent session activity
    const recentSessions = await storage.getRecentSessionActivity(5);
    const recentSessionActivity = recentSessions.map(session => ({
      sessionId: session.sessionId,
      language: session.teacherLanguage || 'unknown',
      transcriptCount: session.transcriptCount || 0,
      lastActivity: (session.endTime || session.startTime)?.toISOString() || new Date().toISOString(),
      duration: session.duration || 0
    }));

    const result: DiagnosticsData = {
      connections: {
        total: this.connectionCount,
        active: this.activeConnections
      },
      translations: {
        total: this.translationTimes.length,
        averageTime: translationAvg,
        averageTimeFormatted: this.formatDuration(translationAvg),
        totalFromDatabase: translations.totalTranslations,
        averageLatencyFromDatabase: translations.averageLatency,
        averageLatencyFromDatabaseFormatted: this.formatDuration(translations.averageLatency),
        languagePairs: formattedLanguagePairs,
        recentTranslations: translations.recentTranslations
      },
      sessions: {
        activeSessions: activeSessionData.activeSessions,
        totalSessions: sessions.totalSessions,
        averageSessionDuration: sessions.averageSessionDuration,
        averageSessionDurationFormatted: this.formatDuration(sessions.averageSessionDuration),
        studentsConnected: activeSessionData.studentsConnected,
        teachersConnected: activeSessionData.teachersConnected,
        currentLanguages: activeSessionData.currentLanguages,
        recentSessionActivity
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

    // Add time range info if applicable
    if (timeRange) {
      result.timeRange = {
        preset: typeof timeRangeOrPreset === 'string' ? timeRangeOrPreset : undefined,
        startDate: timeRange.startDate.toISOString(),
        endDate: timeRange.endDate.toISOString()
      };
    }

    return result;
  }

  async getExportData(): Promise<DiagnosticsExportData> {
    const metrics = await this.getMetrics();
    return {
      ...metrics,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
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

// Export a singleton instance
export const diagnosticsService = new DiagnosticsService();
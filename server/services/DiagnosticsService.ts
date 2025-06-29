/**
 * Diagnostics Service
 * 
 * Provides comprehensive application diagnostics for non-technical users.
 * Tracks performance metrics, system health, and provides user-friendly formatting.
 */

import { IStorage } from '../storage.interface';
import { IActiveSessionProvider } from './IActiveSessionProvider';

interface ConnectionMetrics {
  cumulativeTotalSinceStartup: number;
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
  sessionsLast24Hours: number;
}

export interface SessionActivity {
  sessionId: string;
  language: string;
  classCode: string;
  transcriptCount: number;
  lastActivity: string;
  studentCount: number;
  duration: string;
}

interface CurrentPerformanceMetrics {
  activeConnections: number;
  activeSessions: number;
  studentsConnected: number;
  teachersConnected: number;
  currentTranslationCount: number;
  currentAverageTranslationTimeMs: number;
  currentAverageTranslationTimeFormatted: string;
}

export interface GlobalMetrics {
  uptime: string;
  currentPerformance: CurrentPerformanceMetrics;
  connections: ConnectionMetrics;
  translations: TranslationMetrics;
  sessions: SessionMetrics;
  lastUpdated?: string;
  timeRange?: { startDate: string; endDate: string };
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeRangeInfo {
  preset?: string;
  startDate: Date; // Changed to Date
  endDate: Date;   // Changed to Date
}

export interface DiagnosticsExportData extends GlobalMetrics {
  exportedAt: string;
  version: string;
}

export type TimeRangePreset = 'lastHour' | 'last24Hours' | 'last7Days' | 'last30Days';

export class DiagnosticsService {
  private storage: IStorage;
  private activeSessionProvider: IActiveSessionProvider | null;
  private startTime: number | undefined;

  constructor(storage: IStorage, activeSessionProvider: IActiveSessionProvider | null) {
    this.storage = storage;
    this.activeSessionProvider = activeSessionProvider;
    this.startTime = Date.now();
  }

  public setActiveSessionProvider(activeSessionProvider: IActiveSessionProvider | null): void {
    this.activeSessionProvider = activeSessionProvider;
  }

  public getApplicationUptime(): string {
    if (this.startTime === undefined) {
      return 'Not started';
    }
    const uptimeMs = Date.now() - this.startTime;
    return this.formatDuration(uptimeMs);
  }
  
  private getUptimeSeconds(): number {
    if (this.startTime === undefined) {
      return 0;
    }
    return Math.round((Date.now() - this.startTime) / 1000);
  }
  
  private connectionCount: number = 0; // For cumulative connections
  // In-memory audio tracking, assuming this is still desired for now
  private audioGenerationTimes: number[] = []; 
  private audioCacheSize: number = 0;

  // Called when a new WebSocket connection is made (cumulative)
  recordConnection(): void { 
    this.connectionCount++;
  }

  // Methods for in-memory audio metrics - keep if still needed
  recordAudioGeneration(timeMs: number): void {
    this.audioGenerationTimes.push(timeMs);
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

  public formatDuration(ms: number, shortForm = false): string {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (shortForm) {
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      if (ms > 0 && ms < 1000) return `${ms} ms`;
      return `${seconds}s`;
    }

    let formatted = '';
    if (hours > 0) formatted += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0) formatted += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    if (totalSeconds < 60 || seconds > 0) {
      formatted += `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    if (ms > 0 && ms < 1000 && totalSeconds === 0 && minutes === 0 && hours === 0) {
        return `${ms} ms`;
    }
    return formatted.trim() || '0 seconds';
  }

  formatUptime(seconds: number): string {
    if (seconds <= 0) return '0 seconds';
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    let parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0 && parts.length < 2) {
        parts.push(`${seconds} sec${seconds !== 1 ? 's' : ''}`);
    }
    if (parts.length === 0) return '0 seconds';
    if (parts.length > 2) parts = parts.slice(0, 2);
    return parts.join(', ');
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
    if (this.startTime === undefined) {
      return 0;
    }
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  private parseTimeRange(timeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): TimeRangeInfo | undefined {
    if (!timeParam) {
      return undefined;
    }
    let startDate: Date;
    let endDate: Date = new Date(); // Default to now if only startDate is provided or for presets

    if (typeof timeParam === 'string') {
      const now = new Date();
      endDate = now; // Presets are relative to now
      switch (timeParam) {
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
          // Should not happen with TypeScript, but handle defensively
          throw new Error(`Invalid TimeRangePreset: ${timeParam}`);
      }
      return { preset: timeParam, startDate, endDate };
    } else {
      // It's an object { startDate: Date; endDate?: Date }
      startDate = timeParam.startDate;
      if (timeParam.endDate) {
        endDate = timeParam.endDate;
      }
      // Ensure startDate is not after endDate
      if (startDate.getTime() > endDate.getTime()) {
        // Or throw an error, or adjust. For now, let's swap them or set endDate to startDate.
        // This case should ideally be validated by the caller or UI.
        endDate = startDate; 
      }
      return { startDate, endDate };
    }
  }

  private async getCurrentPerformanceMetrics(): Promise<CurrentPerformanceMetrics> {
    const activeSessions = this.activeSessionProvider?.getActiveSessionsCount() || 0;
    const studentsConnected = this.activeSessionProvider?.getActiveStudentCount() || 0;
    const teachersConnected = this.activeSessionProvider?.getActiveTeacherCount() || 0;

    let currentTranslationCount = 0;
    let currentAverageTranslationTimeMs = 0;

    try {
      // Use last minute time range for current performance metrics
      const lastMinuteRange = this.parseTimeRange('lastHour')!; // Use lastHour since lastMinute isn't a defined preset
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000); // 1 minute ago
      const recentMetrics = await this.storage.getTranslationMetrics({ startDate: oneMinuteAgo, endDate: now });
      currentTranslationCount = recentMetrics.recentTranslations;
      currentAverageTranslationTimeMs = recentMetrics.averageLatency;
    } catch (error) {
      console.error("Error fetching recent translation metrics for CurrentPerformance:", error);
    }
    
    return {
      activeConnections: activeSessions,
      activeSessions,
      studentsConnected,
      teachersConnected,
      currentTranslationCount,
      currentAverageTranslationTimeMs,
      currentAverageTranslationTimeFormatted: this.formatDuration(currentAverageTranslationTimeMs, true),
    };
  }

  private async getTranslationMetrics(timeRangeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): Promise<TranslationMetrics> {
    const rangeInfo = this.parseTimeRange(timeRangeParam);
    
    // If no time range is provided, don't apply any time filtering (include all data)
    // This ensures tests and default dashboard views see all available data
    const storageTimeRange = rangeInfo ? { startDate: rangeInfo.startDate, endDate: rangeInfo.endDate } : undefined;
    const storageMetrics = await this.storage.getTranslationMetrics(storageTimeRange);
    const languagePairsData = await this.storage.getLanguagePairUsage(storageTimeRange);
    const languagePairsFormatted: LanguagePairMetric[] = languagePairsData.map(lp => ({
        ...lp,
        averageLatencyFormatted: this.formatDuration(lp.averageLatency, true)
    }));

    return {
      total: storageMetrics.totalTranslations,
      averageTime: storageMetrics.averageLatency,
      averageTimeFormatted: this.formatDuration(storageMetrics.averageLatency, true),
      totalFromDatabase: storageMetrics.totalTranslations, 
      averageLatencyFromDatabase: storageMetrics.averageLatency,
      averageLatencyFromDatabaseFormatted: this.formatDuration(storageMetrics.averageLatency, true),
      languagePairs: languagePairsFormatted,
      recentTranslations: storageMetrics.recentTranslations, 
    };
  }

  private async getSessionMetrics(timeRangeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): Promise<SessionMetrics> {
    const rangeInfo = this.parseTimeRange(timeRangeParam);
    
    // If no time range is provided, don't apply any time filtering (include all data)
    // This ensures tests and default dashboard views see all available data
    const storageTimeRange = rangeInfo ? { startDate: rangeInfo.startDate, endDate: rangeInfo.endDate } : undefined;
    const storageSessionMetrics = await this.storage.getSessionMetrics(storageTimeRange);
    
    // Use database session count instead of WebSocket connection count for active sessions
    const activeSessions = storageSessionMetrics.activeSessions;
    const studentsConnected = this.activeSessionProvider?.getActiveStudentCount() || 0;
    const teachersConnected = this.activeSessionProvider?.getActiveTeacherCount() || 0;
    
    const recentActivityLimit = 5; // Match test expectation
    const rawRecentActivity = await this.storage.getRecentSessionActivity(recentActivityLimit);
    const recentSessionActivity: SessionActivity[] = rawRecentActivity.map(activity => ({
      sessionId: activity.sessionId,
      language: activity.studentLanguage || activity.teacherLanguage || 'N/A',
      classCode: activity.classCode || 'N/A',
      transcriptCount: activity.transcriptCount,
      lastActivity: activity.endTime ? activity.endTime.toISOString() : (activity.startTime ? activity.startTime.toISOString() : 'N/A'),
      studentCount: activity.studentCount,
      duration: this.formatDuration(activity.duration, false),
    }));

    const currentLanguages: string[] = []; 

    return {
      activeSessions,
      totalSessions: storageSessionMetrics.totalSessions,
      averageSessionDuration: storageSessionMetrics.averageSessionDuration,
      averageSessionDurationFormatted: this.formatDuration(storageSessionMetrics.averageSessionDuration, false),
      studentsConnected,
      teachersConnected,
      currentLanguages,
      recentSessionActivity,
      sessionsLast24Hours: storageSessionMetrics.sessionsLast24Hours,
    };
  }
  
  public async getMetrics(timeRangeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): Promise<GlobalMetrics> {
    const currentPerformance = await this.getCurrentPerformanceMetrics();
    const translationData = await this.getTranslationMetrics(timeRangeParam);
    const sessionData = await this.getSessionMetrics(timeRangeParam);
    
    const connections: ConnectionMetrics = {
      cumulativeTotalSinceStartup: this.connectionCount,
    };

    const timeRangeInfo = this.parseTimeRange(timeRangeParam);

    return {
      uptime: this.getApplicationUptime(),
      currentPerformance,
      connections,
      translations: translationData,
      sessions: sessionData,
      lastUpdated: new Date().toISOString(),
      timeRange: timeRangeInfo ? { startDate: timeRangeInfo.startDate.toISOString(), endDate: timeRangeInfo.endDate.toISOString() } : undefined,
    };
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
    // this.activeConnections = 0; // No longer tracked directly
    // this.translationTimes = []; // No longer tracked directly
    this.audioGenerationTimes = [];
    this.audioCacheSize = 0;
    this.startTime = Date.now();
  }
}
/**
 * Diagnostics Service
 * 
 * Provides comprehensive application diagnostics for non-technical users.
 * Tracks performance metrics, system health, and provides user-friendly formatting.
 */

import { IStorage } from '../storage.interface';
import { IActiveSessionProvider } from './IActiveSessionProvider';

interface ConnectionMetrics {
  // active: number; // Moved to CurrentPerformanceMetrics
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
  currentLanguages: string[]; // This might need review based on actual usage/availability
  recentSessionActivity: SessionActivity[];
  sessionsLast24Hours: number; // Added this field
}

export interface SessionActivity {
  sessionId: string;
  language: string; // Typically teacher's language for the session
  transcriptCount: number;
  lastActivity: string; // ISO string format of the last known activity (e.g., session end time)
  studentCount: number;
  duration: string; // Formatted duration string (e.g., "1h 30m")
  // Optional:
  // teacherName?: string;
  // classroomCode?: string;
}

// NEW: Interface for purely in-memory, real-time performance data
interface CurrentPerformanceMetrics {
  activeConnections: number; // Equivalent to active sessions
  activeSessions: number;
  studentsConnected: number;
  teachersConnected: number;
  currentTranslationCount: number; // Added this field
  currentAverageTranslationTimeMs: number;
  currentAverageTranslationTimeFormatted: string;
  // Potentially: currentAverageAudioGenerationTimeMs, audioCacheSize (if needed here)
}

// Renamed from DiagnosticsData to GlobalMetrics for clarity and to avoid conflict with other types
export interface GlobalMetrics {
  uptime: string;
  currentPerformance: CurrentPerformanceMetrics; // NEW: Holds live, in-memory metrics
  connections: ConnectionMetrics; // Represents cumulative connection data
  translations: TranslationMetrics; // Populated based on timeRange (persistent) or in-memory defaults
  sessions: SessionMetrics;         // Populated based on timeRange (persistent) or in-memory defaults
  // audio: AudioMetrics; // Assuming AudioMetrics might be added later or is optional
  // system: SystemMetrics; // Assuming SystemMetrics might be added later or is optional
  lastUpdated?: string; // Optional, can be added by the consumer if needed
  timeRange?: { startDate: string; endDate: string }; // Consistent with getMetrics return
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

// Corrected: DiagnosticsExportData should extend GlobalMetrics
export interface DiagnosticsExportData extends GlobalMetrics {
  exportedAt: string;
  version: string;
}

export type TimeRangePreset = 'lastHour' | 'last24Hours' | 'last7Days' | 'last30Days';

export class DiagnosticsService {
  private storage: IStorage;
  private activeSessionProvider: IActiveSessionProvider | null; // Allow null
  private startTime: number | undefined; // For application uptime

  // TODO: Decouple DiagnosticsService from WebSocketServer.
  // Reason: To break circular dependency and improve modularity.
  // How: Introduce an interface (e.g., IActiveSessionProvider) that WebSocketServer implements.
  //      DiagnosticsService will then depend on this interface, not the concrete WebSocketServer class.
  //      This allows WebSocketServer to use DiagnosticsService, and DiagnosticsService to get active session data
  //      without them directly knowing about each other.
  // Status: IActiveSessionProvider introduced. WebSocketServer needs to implement it and use setter for DiagnosticsService.

  constructor(storage: IStorage, activeSessionProvider: IActiveSessionProvider | null) { // Allow null in constructor
    this.storage = storage;
    this.activeSessionProvider = activeSessionProvider;
    this.startTime = Date.now();
  }

  /**
   * Sets the active session provider.
   * This method allows for deferred initialization or updates of the session provider,
   * particularly useful in scenarios involving dependency injection or when the provider
   * might not be available at the time of DiagnosticsService construction.
   *
   * @param activeSessionProvider The IActiveSessionProvider instance, or null if not available.
   */
  public setActiveSessionProvider(activeSessionProvider: IActiveSessionProvider | null): void {
    this.activeSessionProvider = activeSessionProvider;
  }

  /**
   * Get current application uptime.
   * 
   * @returns A string representing the uptime duration, e.g., "2 hours 15 minutes".
   */
  public getApplicationUptime(): string {
    if (this.startTime === undefined) {
      return 'Not started';
    }
    const uptimeMs = Date.now() - this.startTime;
    return this.formatDuration(uptimeMs);
  }
  
  private getUptimeSeconds(): number {
    if (this.startTime === undefined) { // Added undefined check
      return 0;
    }
    return Math.round((Date.now() - this.startTime) / 1000);
  }
  
  private connectionCount: number = 0;
  private activeConnections: number = 0;
  private translationTimes: number[] = [];
  private audioGenerationTimes: number[] = [];
  private audioCacheSize: number = 0;

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

  public formatDuration(ms: number, shortForm = false): string { // Made public
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (shortForm) {
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      if (ms > 0 && ms < 1000) return `${ms} ms`; // Handle sub-second for short form
      return `${seconds}s`;
    }

    let formatted = '';
    if (hours > 0) formatted += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0) formatted += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    // Always show seconds if duration is less than a minute or if it's exactly 0
    if (totalSeconds < 60 || seconds > 0) {
      formatted += `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    
    // Handle case where ms is > 0 but < 1000 (e.g. 150ms)
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
    if (seconds > 0 && parts.length < 2) { // Show seconds only if less than 2 other units are shown or it's the only unit
        parts.push(`${seconds} sec${seconds !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) return '0 seconds'; // Should not happen if input seconds > 0
    if (parts.length > 2) parts = parts.slice(0, 2); // Limit to two most significant units

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

  private getUptime(): number { // This seems to be a duplicate of getUptimeSeconds or intended for internal raw seconds
    if (this.startTime === undefined) {
      return 0;
    }
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  // Updated parseTimeRange to handle { startDate: Date; endDate?: Date }
  private parseTimeRange(timeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): TimeRange | undefined {
    if (!timeParam) {
      return undefined;
    }

    if (typeof timeParam === 'string') {
      const now = new Date();
      let startDate: Date;
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
          return undefined; // Invalid preset
      }
      return { startDate, endDate: now };
    }

    // If it's an object, it must be { startDate: Date; endDate?: Date }
    if (typeof timeParam === 'object' && timeParam.startDate instanceof Date) {
      return {
        startDate: timeParam.startDate,
        endDate: timeParam.endDate instanceof Date ? timeParam.endDate : new Date() // Default endDate to now if not provided or invalid
      };
    }
    
    return undefined; // Fallback for invalid input
  }

  private async getTranslationMetrics(timeRange?: TimeRange): Promise<TranslationMetrics> { // timeRange is now TimeRange | undefined
    const inMemoryTotalTranslations = this.translationTimes.length;
    const inMemoryAverageTime = this.calculateAverage(this.translationTimes);
    const inMemoryAverageTimeFormatted = this.formatDuration(inMemoryAverageTime, true);

    if (timeRange) {
      // Fetch from database for the given time range
      const dbTranslationMetrics = await this.storage.getTranslationMetrics(timeRange);
      const dbLanguagePairMetrics = await this.storage.getLanguagePairUsage(timeRange);

      const languagePairsFormatted: LanguagePairMetric[] = dbLanguagePairMetrics.map((pair: { sourceLanguage: string; targetLanguage: string; count: number; averageLatency: number; }) => ({
        ...pair,
        averageLatencyFormatted: this.formatDuration(pair.averageLatency, true),
      }));

      return {
        total: dbTranslationMetrics.totalTranslations, // Historical total from DB for the range
        averageTime: dbTranslationMetrics.averageLatency, // Historical average latency from DB for the range
        averageTimeFormatted: this.formatDuration(dbTranslationMetrics.averageLatency, true),
        totalFromDatabase: dbTranslationMetrics.totalTranslations,
        averageLatencyFromDatabase: dbTranslationMetrics.averageLatency,
        averageLatencyFromDatabaseFormatted: this.formatDuration(dbTranslationMetrics.averageLatency, true),
        languagePairs: languagePairsFormatted,
        recentTranslations: dbTranslationMetrics.recentTranslations, // This comes from storage query for the range
      };
    } else {
      // Return in-memory metrics when no time range is specified
      return {
        total: inMemoryTotalTranslations,
        averageTime: inMemoryAverageTime,
        averageTimeFormatted: inMemoryAverageTimeFormatted,
        totalFromDatabase: 0, // No specific DB query for "all time" here, focusing on current
        averageLatencyFromDatabase: 0,
        averageLatencyFromDatabaseFormatted: this.formatDuration(0, true),
        languagePairs: [], // Or fetch all-time from DB if desired, but keeping separate for now
        recentTranslations: 0, // In-memory recent translations are implicitly part of this.translationTimes
      };
    }
  }

  private async getSessionMetrics(timeRange?: TimeRange): Promise<SessionMetrics> { // timeRange is now TimeRange | undefined
    const activeTeachers = this.activeSessionProvider?.getActiveTeacherCount() || 0;
    const activeStudents = this.activeSessionProvider?.getActiveStudentCount() || 0;
    const currentActiveSessions = activeTeachers + activeStudents;

    if (timeRange) {
      // Fetch from database for the given time range
      const dbSessionMetrics = await this.storage.getSessionMetrics(timeRange);
      const recentActivityLimit = 5;
      // Corrected: getRecentSessionActivity in IStorage does not take a timeRange.
      // It fetches general recent activity.
      const recentActivityFromStorage = await this.storage.getRecentSessionActivity(recentActivityLimit);

      const recentSessionActivity: SessionActivity[] = recentActivityFromStorage.map(activity => {
        const lastActivityTimeValue = activity.endTime || activity.startTime;
        return {
          sessionId: activity.sessionId,
          language: activity.teacherLanguage || 'N/A',
          transcriptCount: activity.transcriptCount || 0,
          // Corrected: Ensure lastActivityTimeValue is not null before creating Date
          lastActivity: lastActivityTimeValue ? new Date(lastActivityTimeValue).toISOString() : 'N/A',
          studentCount: activity.studentCount || 0,
          duration: this.formatDuration(activity.duration || 0)
        };
      });

      return {
        activeSessions: currentActiveSessions, // Always live
        totalSessions: dbSessionMetrics.totalSessions, // Historical from DB for the range
        averageSessionDuration: dbSessionMetrics.averageSessionDuration, // Historical from DB for the range
        averageSessionDurationFormatted: this.formatDuration(dbSessionMetrics.averageSessionDuration),
        studentsConnected: activeStudents, // Always live
        teachersConnected: activeTeachers, // Always live
        currentLanguages: [], // Placeholder, or could be derived if needed
        recentSessionActivity: recentSessionActivity, // Historical from DB for the range
        sessionsLast24Hours: dbSessionMetrics.sessionsLast24Hours, // Historical from DB for the range
      };
    } else {
      // Return in-memory/live metrics when no time range is specified
      return {
        activeSessions: currentActiveSessions,
        totalSessions: 0, // No persistent total without a time range
        averageSessionDuration: 0,
        averageSessionDurationFormatted: this.formatDuration(0),
        studentsConnected: activeStudents,
        teachersConnected: activeTeachers,
        currentLanguages: [],
        recentSessionActivity: [], // No persistent recent activity without a time range
        sessionsLast24Hours: 0, // This is a specific DB query, so 0 if no range
      };
    }
  }
  
  // Ensure getMetrics correctly calls getSessionMetrics and getTranslationMetrics with the parsed timeRange.
  
  public async getMetrics(timeParam?: TimeRangePreset | { startDate: Date; endDate?: Date }): Promise<GlobalMetrics> {
    const finalTimeRange = this.parseTimeRange(timeParam); // finalTimeRange is TimeRange | undefined
    const preset = typeof timeParam === 'string' ? timeParam : undefined; // Capture preset

    // Always get current, in-memory performance data
    const activeTeachers = this.activeSessionProvider?.getActiveTeacherCount() || 0;
    const activeStudents = this.activeSessionProvider?.getActiveStudentCount() || 0;
    const currentActiveSessions = activeTeachers + activeStudents;
    const inMemoryAverageTranslationTime = this.calculateAverage(this.translationTimes);
    const inMemoryTranslationCount = this.translationTimes.length; // Get current translation count

    const currentPerformanceMetrics: CurrentPerformanceMetrics = {
      activeConnections: currentActiveSessions, // Active connections are active sessions
      activeSessions: currentActiveSessions,
      studentsConnected: activeStudents,
      teachersConnected: activeTeachers,
      currentTranslationCount: inMemoryTranslationCount, // Populate the new field
      currentAverageTranslationTimeMs: inMemoryAverageTranslationTime,
      currentAverageTranslationTimeFormatted: this.formatDuration(inMemoryAverageTranslationTime, true),
    };
    
    // Get translation and session metrics, which will be conditional on finalTimeRange
    const translationMetricsData = await this.getTranslationMetrics(finalTimeRange);
    const sessionMetricsData = await this.getSessionMetrics(finalTimeRange); 

    // ConnectionMetrics now only holds cumulative total
    const connectionMetrics: ConnectionMetrics = {
      cumulativeTotalSinceStartup: this.connectionCount,
    };
    
    const uptime = this.getApplicationUptime();

    return {
      uptime,
      currentPerformance: currentPerformanceMetrics, // New field with live data
      connections: connectionMetrics,
      translations: translationMetricsData, // Populated based on timeRange
      sessions: sessionMetricsData,         // Populated based on timeRange
      ...(finalTimeRange && { 
        timeRange: { 
          startDate: finalTimeRange.startDate.toISOString(), 
          endDate: finalTimeRange.endDate.toISOString(),
          ...(preset && { preset }) // Add preset if it exists
        } 
      }),
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
    this.activeConnections = 0;
    this.translationTimes = [];
    this.audioGenerationTimes = [];
    this.audioCacheSize = 0;
    this.startTime = Date.now();
  }
}
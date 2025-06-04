/**
 * Diagnostics Service
 * 
 * Provides comprehensive application diagnostics for non-technical users.
 * Tracks performance metrics, system health, and provides user-friendly formatting.
 */

import { storage } from '../storage';
import type { Translation, Session, Transcript } from '../../shared/schema';

interface ConnectionMetrics {
  total: number;
  active: number;
  teachers: number;
  students: number;
  byRole: { [role: string]: number };
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
  translationsLast24Hours: number;
  translationsLastHour: number;
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
  averageStudentsPerSession: number;
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

interface UsageMetrics {
  peakConcurrentUsers: number;
  uniqueTeachersToday: Set<string>;
  uniqueStudentsToday: Set<string>;
  mostActiveLanguagePairs: LanguagePairMetric[];
  averageSessionLength: number;
  totalTranscriptions: number;
  completedSessionsCount: number;
}

export interface DiagnosticsData {
  connections: ConnectionMetrics;
  translations: TranslationMetrics;
  sessions: SessionMetrics;
  audio: AudioMetrics;
  system: SystemMetrics;
  usage: {
    peakConcurrentUsers: number;
    uniqueTeachersToday: number;
    uniqueStudentsToday: number;
    mostActiveLanguagePairs: LanguagePairMetric[];
    averageSessionLengthFormatted: string;
    totalTranscriptions: number;
  };
  lastUpdated: string;
}

export interface DiagnosticsExportData extends DiagnosticsData {
  exportedAt: string;
  version: string;
}

export class DiagnosticsService {
  private startTime: number;
  private connectionCount: number = 0;
  private activeConnections: Map<string, { role: string; connectedAt: Date }> = new Map();
  private translationTimes: number[] = [];
  private audioGenerationTimes: number[] = [];
  private audioCacheSize: number = 0;
  private usageMetrics: UsageMetrics;
  private sessionStartTimes: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
    this.usageMetrics = {
      peakConcurrentUsers: 0,
      uniqueTeachersToday: new Set(),
      uniqueStudentsToday: new Set(),
      mostActiveLanguagePairs: [],
      averageSessionLength: 0,
      totalTranscriptions: 0,
      completedSessionsCount: 0
    };
  }

  recordConnection(connectionId: string, role: string): void {
    this.connectionCount++;
    this.activeConnections.set(connectionId, { role, connectedAt: new Date() });
    
    // Track unique users
    if (role === 'teacher') {
      this.usageMetrics.uniqueTeachersToday.add(connectionId);
    } else if (role === 'student') {
      this.usageMetrics.uniqueStudentsToday.add(connectionId);
    }
    
    // Update peak concurrent users
    const currentActive = this.activeConnections.size;
    if (currentActive > this.usageMetrics.peakConcurrentUsers) {
      this.usageMetrics.peakConcurrentUsers = currentActive;
    }
  }

  recordConnectionClosed(connectionId: string): void {
    this.activeConnections.delete(connectionId);
  }

  recordSessionStart(sessionId: string): void {
    this.sessionStartTimes.set(sessionId, Date.now());
  }

  recordSessionEnd(sessionId: string): void {
    const startTime = this.sessionStartTimes.get(sessionId);
    if (startTime) {
      const duration = Date.now() - startTime;
      // Update average session length
      const currentAvg = this.usageMetrics.averageSessionLength;
      const completedCount = this.usageMetrics.completedSessionsCount;
      this.usageMetrics.averageSessionLength = 
        (currentAvg * completedCount + duration) / (completedCount + 1);
      
      this.usageMetrics.completedSessionsCount++;
      this.sessionStartTimes.delete(sessionId);
    }
  }

  recordTranslation(timeMs: number): void {
    this.translationTimes.push(timeMs);
    // Keep only last 100 translations for memory efficiency
    if (this.translationTimes.length > 100) {
      this.translationTimes.shift();
    }
  }

  recordTranscription(): void {
    this.usageMetrics.totalTranscriptions++;
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

  private async getLanguagePairMetrics(): Promise<LanguagePairMetric[]> {
    try {
      // Get translations from last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      const translations = await storage.getTranslationsByDateRange(startDate, endDate);
      
      // Aggregate by language pair
      const pairMap = new Map<string, { count: number; totalLatency: number }>();
      
      translations.forEach(t => {
        const key = `${t.sourceLanguage}->${t.targetLanguage}`;
        const existing = pairMap.get(key) || { count: 0, totalLatency: 0 };
        existing.count++;
        existing.totalLatency += t.latency || 0;
        pairMap.set(key, existing);
      });
      
      // Convert to array and calculate averages
      return Array.from(pairMap.entries()).map(([pair, data]) => {
        const [source, target] = pair.split('->');
        const avgLatency = data.count > 0 ? Math.round(data.totalLatency / data.count) : 0;
        return {
          sourceLanguage: source,
          targetLanguage: target,
          count: data.count,
          averageLatency: avgLatency,
          averageLatencyFormatted: this.formatDuration(avgLatency)
        };
      }).sort((a, b) => b.count - a.count); // Sort by most used
    } catch (error) {
      console.error('Error getting language pair metrics:', error);
      return [];
    }
  }

  async getMetrics(): Promise<DiagnosticsData> {
    const translationAvg = this.calculateAverage(this.translationTimes);
    const audioAvg = this.calculateAverage(this.audioGenerationTimes);
    const memoryUsage = this.getMemoryUsage();
    const uptime = this.getUptime();

    // Get active connections by role
    const connectionsByRole: { [role: string]: number } = {};
    let teacherCount = 0;
    let studentCount = 0;
    
    this.activeConnections.forEach(conn => {
      connectionsByRole[conn.role] = (connectionsByRole[conn.role] || 0) + 1;
      if (conn.role === 'teacher') teacherCount++;
      else if (conn.role === 'student') studentCount++;
    });

    // Get data from storage
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let dbTranslations: Translation[] = [];
    let dbSessions: Session[] = [];
    let totalDbTranslations = 0;
    let avgDbLatency = 0;
    
    try {
      // Get translations from database
      dbTranslations = await storage.getTranslationsByDateRange(oneDayAgo, now);
      totalDbTranslations = dbTranslations.length;
      
      if (totalDbTranslations > 0) {
        const totalLatency = dbTranslations.reduce((sum, t) => sum + (t.latency || 0), 0);
        avgDbLatency = Math.round(totalLatency / totalDbTranslations);
      }
      
      // Get sessions
      dbSessions = await storage.getAllActiveSessions();
    } catch (error) {
      console.error('Error fetching data from storage:', error);
    }

    // Calculate translations in different time windows
    const translationsLastHour = dbTranslations.filter(t => 
      t.timestamp && t.timestamp >= oneHourAgo
    ).length;

    // Get language pair metrics
    const languagePairs = await this.getLanguagePairMetrics();

    return {
      connections: {
        total: this.connectionCount,
        active: this.activeConnections.size,
        teachers: teacherCount,
        students: studentCount,
        byRole: connectionsByRole
      },
      translations: {
        total: this.translationTimes.length,
        averageTime: translationAvg,
        averageTimeFormatted: this.formatDuration(translationAvg),
        totalFromDatabase: totalDbTranslations,
        averageLatencyFromDatabase: avgDbLatency,
        averageLatencyFromDatabaseFormatted: this.formatDuration(avgDbLatency),
        languagePairs: languagePairs.slice(0, 5), // Top 5 language pairs
        recentTranslations: this.translationTimes.length,
        translationsLast24Hours: totalDbTranslations,
        translationsLastHour: translationsLastHour
      },
      sessions: {
        activeSessions: dbSessions.length,
        totalSessions: this.sessionStartTimes.size + dbSessions.length,
        averageSessionDuration: this.usageMetrics.averageSessionLength,
        averageSessionDurationFormatted: this.formatDuration(this.usageMetrics.averageSessionLength),
        studentsConnected: studentCount,
        teachersConnected: teacherCount,
        currentLanguages: Array.from(new Set(
          Array.from(this.activeConnections.values())
            .map(conn => conn.role)
            .filter(role => role !== 'teacher' && role !== 'student')
        )),
        recentSessionActivity: [], // TODO: Implement if needed
        sessionsLast24Hours: dbSessions.length,
        averageStudentsPerSession: studentCount > 0 && teacherCount > 0 
          ? Math.round(studentCount / teacherCount) 
          : 0
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
      usage: {
        peakConcurrentUsers: this.usageMetrics.peakConcurrentUsers,
        uniqueTeachersToday: this.usageMetrics.uniqueTeachersToday.size,
        uniqueStudentsToday: this.usageMetrics.uniqueStudentsToday.size,
        mostActiveLanguagePairs: languagePairs.slice(0, 3), // Top 3
        averageSessionLengthFormatted: this.formatDuration(this.usageMetrics.averageSessionLength),
        totalTranscriptions: this.usageMetrics.totalTranscriptions
      },
      lastUpdated: new Date().toISOString()
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
    this.activeConnections.clear();
    this.translationTimes = [];
    this.audioGenerationTimes = [];
    this.audioCacheSize = 0;
    this.startTime = Date.now();
    this.usageMetrics = {
      peakConcurrentUsers: 0,
      uniqueTeachersToday: new Set(),
      uniqueStudentsToday: new Set(),
      mostActiveLanguagePairs: [],
      averageSessionLength: 0,
      totalTranscriptions: 0,
      completedSessionsCount: 0
    };
    this.sessionStartTimes.clear();
  }
}

// Export a singleton instance
export const diagnosticsService = new DiagnosticsService();
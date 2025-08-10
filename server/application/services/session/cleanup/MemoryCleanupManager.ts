import logger from '../../../../logger';
import { IMemoryCleanupManager, MemoryCleanupResult } from './IMemoryCleanupManager';

/**
 * Memory Cleanup Manager
 * 
 * Responsible for cleaning up in-memory data structures like classroom codes.
 * Follows Single Responsibility Principle - only handles memory operations.
 * Uses Dependency Injection for external data structure access.
 */
export class MemoryCleanupManager implements IMemoryCleanupManager {
  private classroomSessions: Map<string, any>;

  constructor(classroomSessionsMap: Map<string, any>) {
    this.classroomSessions = classroomSessionsMap;
  }

  cleanupExpiredClassroomCodes(now: number): number {
    const expiredCodes: string[] = [];

    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        expiredCodes.push(code);
      }
    }

    for (const code of expiredCodes) {
      this.classroomSessions.delete(code);
    }

    if (expiredCodes.length > 0) {
      logger.info(`Cleaned up ${expiredCodes.length} expired classroom codes from memory`);
    }

    return expiredCodes.length;
  }

  cleanupExpiredMemoryData(now: number): MemoryCleanupResult {
    const result: MemoryCleanupResult = {
      expiredClassroomCodes: 0,
      expiredConnections: 0,
      totalMemoryFreed: 0
    };

    // Clean up classroom codes
    result.expiredClassroomCodes = this.cleanupExpiredClassroomCodes(now);

    // TODO: Add other memory cleanup operations here as needed
    // For example: expired connection pools, cached data, etc.

    // Estimate memory freed (rough calculation)
    result.totalMemoryFreed = result.expiredClassroomCodes * 256; // Rough estimate: 256 bytes per classroom code

    if (result.expiredClassroomCodes > 0) {
      logger.debug('Memory cleanup completed', result);
    }

    return result;
  }

  getMemoryStats(): { activeClassroomCodes: number; activeConnections: number } {
    return {
      activeClassroomCodes: this.classroomSessions.size,
      activeConnections: 0 // TODO: Add connection count if needed
    };
  }
} 
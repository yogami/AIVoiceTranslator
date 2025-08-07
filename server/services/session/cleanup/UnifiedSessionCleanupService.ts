import logger from '../../../logger';
import { config } from '../../../config';
import { eq, and, lt, gt, isNotNull, isNull, ne } from 'drizzle-orm';
import { sessions } from '../../../../shared/schema';
import { db } from '../../../db';
import { IStorage } from '../../../storage.interface';

// Import SOLID strategy interfaces and implementations
import { ISessionCleanupStrategy, CleanupResult } from './ISessionCleanupStrategy';
import { EmptyTeacherSessionCleanupStrategy } from './strategies/EmptyTeacherSessionCleanupStrategy';
import { AbandonedSessionCleanupStrategy } from './strategies/AbandonedSessionCleanupStrategy';
import { InactiveSessionCleanupStrategy } from './strategies/InactiveSessionCleanupStrategy';

/**
 * Unified Session Cleanup Service - COMPLETE SOLID IMPLEMENTATION
 * 
 * Centralizes ALL session cleanup logic using SOLID principles:
 * - Single Responsibility: Each strategy handles one type of cleanup
 * - Open/Closed: New cleanup strategies can be added without modifying this class
 * - Liskov Substitution: All strategies implement the same interface
 * - Interface Segregation: Separate interfaces for different cleanup types
 * - Dependency Inversion: Depends on interfaces, not concrete implementations
 * 
 * This service replaces the fragmented cleanup logic that was spread across multiple services.
 */

export interface UnifiedCleanupResult {
  totalCleaned: number;
  strategies: CleanupResult[];
  duration: number; // milliseconds
}

export class UnifiedSessionCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isExplicitlyStopped = false;
  
  // Injected dependencies (Dependency Inversion Principle)
  private storage: IStorage;
  private classroomSessionsMap: Map<string, any>;
  private cleanupStrategies: ISessionCleanupStrategy[];

  constructor(
    storage: IStorage,
    classroomSessionsMap: Map<string, any>
  ) {
    this.storage = storage;
    this.classroomSessionsMap = classroomSessionsMap;
    
    // Initialize cleanup strategies in priority order
    this.cleanupStrategies = [
      new AbandonedSessionCleanupStrategy(),       // HIGHEST PRIORITY - time-critical grace periods
      new EmptyTeacherSessionCleanupStrategy(),    // Medium priority - teachers waiting
      new InactiveSessionCleanupStrategy()         // Lowest priority (fallback)
    ];
    
    logger.info('UnifiedSessionCleanupService initialized with SOLID architecture');
  }

  /**
   * Start the unified cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      return; // Already started
    }

    logger.info('Starting unified session cleanup service with SOLID architecture');
    
    // Skip automatic cleanup intervals in test environment to prevent hanging tests
    if (process.env.NODE_ENV === 'test') {
      logger.info('Test environment detected - skipping automatic cleanup intervals');
      return;
    }
    
    // Set up periodic cleanup with safety checks (production only)
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runUnifiedCleanup();
      } catch (error) {
        logger.error('Cleanup interval error:', error);
      }
    }, config.session.cleanupInterval);
    
    logger.info('Unified cleanup service started with SOLID patterns');
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isExplicitlyStopped = true;
    logger.info('Stopped unified session cleanup service');
  }

  /**
   * Main unified cleanup orchestration using Strategy Pattern
   */
  private async runUnifiedCleanup(): Promise<UnifiedCleanupResult> {
    logger.info('[UnifiedCleanup] runUnifiedCleanup called');
    
    if (this.isExplicitlyStopped) {
      logger.info('[UnifiedCleanup] Service is stopped, skipping cleanup');
      return {
        totalCleaned: 0,
        strategies: [],
        duration: 0
      };
    }

    const startTime = Date.now();
    const result: UnifiedCleanupResult = {
      totalCleaned: 0,
      strategies: [],
      duration: 0
    };

    try {
      // SAFETY: Add timeout to prevent hanging
      const cleanupPromise = this.executeCleanupStrategies();
      const timeoutPromise = new Promise<CleanupResult[]>((resolve) => {
        setTimeout(() => {
          logger.warn('Cleanup operation timed out, returning partial results');
          resolve([]);
        }, 10000); // 10 second timeout (increased from 5 seconds)
      });

      const strategies = await Promise.race([cleanupPromise, timeoutPromise]);
      result.strategies = strategies;
      result.totalCleaned = strategies.reduce((sum, s) => sum + s.cleanedCount, 0);
      result.duration = Date.now() - startTime;

      if (result.totalCleaned > 0) {
        logger.info('SOLID cleanup completed', {
          totalCleaned: result.totalCleaned,
          strategiesRun: result.strategies.length,
          duration: result.duration
        });
      }

      return result;
    } catch (error) {
      logger.error('Error during SOLID cleanup:', error);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Execute all cleanup strategies in priority order
   * Follows Strategy Pattern and Open/Closed Principle
   */
  private async executeCleanupStrategies(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    const now = Date.now();

    logger.info(`[StrategyExecution] Starting execution of ${this.cleanupStrategies.length} strategies`);

    // Execute strategies in priority order (Single Responsibility Principle)
    for (const strategy of this.cleanupStrategies) {
      if (this.isExplicitlyStopped) {
        logger.info(`[StrategyExecution] Service stopped, breaking strategy loop`);
        break;
      }

      logger.info(`[StrategyExecution] Executing strategy: ${strategy.getName()}`);

      if (strategy.shouldRun(now)) {
        try {
          const result = await strategy.execute(now);
          results.push(result);
          
          logger.info(`[StrategyExecution] Strategy ${strategy.getName()} completed: cleaned ${result.cleanedCount} sessions`);
          
          // Stop if a strategy cleaned something to prevent conflicts
          if (result.cleanedCount > 0) {
            logger.debug(`Strategy ${strategy.getName()} cleaned ${result.cleanedCount} sessions, stopping other strategies`);
            break;
          }
        } catch (error) {
          logger.error(`Error in strategy ${strategy.getName()}:`, error);
          results.push({
            cleanedCount: 0,
            type: strategy.getName(),
            details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      } else {
        logger.info(`[StrategyExecution] Strategy ${strategy.getName()} shouldRun returned false, skipping`);
      }
    }

    logger.info(`[StrategyExecution] Completed. Executed ${results.length} strategies, total results: ${results.map(r => `${r.type}:${r.cleanedCount}`).join(', ')}`);
    return results;
  }

  /**
   * Add a new cleanup strategy (Open/Closed Principle)
   */
  addCleanupStrategy(strategy: ISessionCleanupStrategy): void {
    this.cleanupStrategies.push(strategy);
    logger.info(`Added cleanup strategy: ${strategy.getName()}`);
  }

  /**
   * Remove a cleanup strategy by name
   */
  removeCleanupStrategy(strategyName: string): boolean {
    const initialLength = this.cleanupStrategies.length;
    this.cleanupStrategies = this.cleanupStrategies.filter(s => s.getName() !== strategyName);
    const removed = this.cleanupStrategies.length < initialLength;
    
    if (removed) {
      logger.info(`Removed cleanup strategy: ${strategyName}`);
    }
    
    return removed;
  }

  /**
   * Mark that all students have left a session (start grace period)
   */
  async markAllStudentsLeft(sessionId: string): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({
          studentsCount: 0,
          qualityReason: `All students disconnected - grace period active`
        })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.isActive, true)
          )
        );

      logger.info(`Marked session ${sessionId} as all students left - grace period started`);
    } catch (error) {
      logger.error('Error marking session as students left:', { sessionId, error });
    }
  }

  /**
   * Mark that students have rejoined a session (cancel grace period)
   */
  async markStudentsRejoined(sessionId: string): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({
          qualityReason: null, // Clear grace period marker
          lastActivityAt: new Date() // Update activity timestamp
        })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.isActive, true)
          )
        );

      logger.info(`Students rejoined session ${sessionId} - grace period cancelled`);
    } catch (error) {
      logger.error('Error marking students rejoined:', { sessionId, error });
    }
  }

  /**
   * Update last activity time for a session
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    if (this.isExplicitlyStopped) return;
    
    try {
      await this.storage.updateSession(sessionId, {
        lastActivityAt: new Date()
      });
      logger.debug(`Updated session activity: ${sessionId}`);
    } catch (error) {
      logger.error('Error updating session activity:', { sessionId, error });
    }
  }

  /**
   * Manually end a session
   */
  async endSession(sessionId: string, reason: string): Promise<void> {
    if (this.isExplicitlyStopped) return;

    try {
      await this.storage.updateSession(sessionId, {
        isActive: false,
        endTime: new Date(),
        qualityReason: reason
      });
      logger.info(`Ended session ${sessionId}: ${reason}`);
    } catch (error) {
      logger.error('Error ending session:', { sessionId, reason, error });
    }
  }

  /**
   * Force run cleanup now (for testing)
   */
  async forceCleanup(): Promise<UnifiedCleanupResult> {
    logger.info('Force cleanup triggered');
    return this.runUnifiedCleanup();
  }

  /**
   * Legacy method for backwards compatibility with tests
   * Delegates to the unified cleanup system
   */
  async cleanupStaleSessions(): Promise<void> {
    logger.info('[UnifiedCleanup] cleanupStaleSessions called');
    await this.runUnifiedCleanup();
  }

  /**
   * Find active session for teacher reconnection
   * Legacy method for backwards compatibility
   */
  async findActiveTeacherSession(teacherLanguage: string): Promise<any | null> {
    try {
      const gracePeriodThreshold = new Date(Date.now() - config.session.teacherReconnectionGracePeriod);
      
      const result = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.teacherLanguage, teacherLanguage),
            // Within grace period
            gt(sessions.lastActivityAt, gracePeriodThreshold)
          )
        )
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding active teacher session:', error);
      return null;
    }
  }

  /**
   * End duplicate teacher sessions
   * Legacy method for backwards compatibility
   */
  async endDuplicateTeacherSessions(currentSessionId: string, teacherLanguage: string): Promise<void> {
    try {
      // Find other active sessions for the same teacher language, excluding the current one
      const duplicateSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.teacherLanguage, teacherLanguage),
            // Not the current session
            ne(sessions.sessionId, currentSessionId)
          )
        );

      if (duplicateSessions.length > 0) {
        logger.info(`Found ${duplicateSessions.length} duplicate teacher sessions to end`);

        // End all duplicate sessions
        await db
          .update(sessions)
          .set({
            isActive: false,
            endTime: new Date(),
            quality: 'no_activity',
            qualityReason: 'Ended due to teacher starting new session'
          })
          .where(
            and(
              eq(sessions.isActive, true),
              eq(sessions.teacherLanguage, teacherLanguage),
              ne(sessions.sessionId, currentSessionId)
            )
          );

        logger.info(`Ended ${duplicateSessions.length} duplicate teacher sessions`);
      }
    } catch (error) {
      logger.error('Error ending duplicate teacher sessions:', error);
    }
  }

  // LEGACY METHODS - kept for backwards compatibility but delegate to unified system
  
  /**
   * @deprecated Use unified cleanup system instead
   */
  private async cleanupEmptyTeacherSessions(now: number): Promise<number> {
    const strategy = this.cleanupStrategies.find(s => s.getName() === 'EmptyTeacherSessionCleanup');
    if (strategy) {
      const result = await strategy.execute(now);
      return result.cleanedCount;
    }
    return 0;
  }

  /**
   * @deprecated Use unified cleanup system instead  
   */
  private async cleanupAbandonedSessions(now: number): Promise<number> {
    const strategy = this.cleanupStrategies.find(s => s.getName() === 'AbandonedSessionCleanup');
    if (strategy) {
      const result = await strategy.execute(now);
      return result.cleanedCount;
    }
    return 0;
  }

  /**
   * @deprecated Use unified cleanup system instead
   */
  private async cleanupInactiveSessions(now: number): Promise<number> {
    const strategy = this.cleanupStrategies.find(s => s.getName() === 'InactiveSessionCleanup');
    if (strategy) {
      const result = await strategy.execute(now);
      return result.cleanedCount;
    }
    return 0;
  }

  // Remove old methods that are no longer needed
  private async runCleanup(): Promise<any> {
    return this.runUnifiedCleanup();
  }

  private async doSafeCleanup(): Promise<any> {
    return this.runUnifiedCleanup();
  }
} 
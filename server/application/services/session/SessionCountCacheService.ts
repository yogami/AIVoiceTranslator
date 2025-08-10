/**
 * Session Count Cache Service
 * 
 * Manages caching of active session count from database for accurate diagnostics.
 * Provides real-time cache invalidation when session state changes.
 */
import logger from '../../../logger';
import { IStorage } from '../../../storage.interface';

export class SessionCountCacheService {
  private storage: IStorage;
  private cachedActiveSessionCount: number = 0;
  private cacheInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_UPDATE_INTERVAL_MS = 30 * 1000; // 30 seconds
  private isRunning: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start the cache service
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('SessionCountCacheService is already running');
      return;
    }
    
    this.isRunning = true;
    
    // Update cache immediately
    this.updateCache();
    
    // Set up periodic cache updates
    this.cacheInterval = setInterval(() => {
      if (this.isRunning) {
        this.updateCache();
      }
    }, this.CACHE_UPDATE_INTERVAL_MS);

    logger.info('SessionCountCacheService started');
  }

  /**
   * Stop the cache service
   */
  public stop(): void {
    this.isRunning = false;
    
    if (this.cacheInterval) {
      clearInterval(this.cacheInterval);
      this.cacheInterval = null;
    }
    logger.info('SessionCountCacheService stopped');
  }

  /**
   * Get the cached active session count
   */
  public getActiveSessionCount(): number {
    return this.cachedActiveSessionCount;
  }

  /**
   * Invalidate and immediately update the cache
   */
  public async invalidateCache(): Promise<void> {
    // Only invalidate cache if service is running
    if (!this.isRunning) {
      return;
    }
    
    try {
      await this.updateCache();
    } catch (error) {
      logger.error('Failed to invalidate session count cache:', { error });
    }
  }

  /**
   * Update storage instance (for test isolation)
   */
  public updateStorage(newStorage: IStorage): void {
    this.storage = newStorage;
    // Only update cache if service is running
    if (this.isRunning) {
      this.updateCache();
    }
  }

  /**
   * Check if the service is currently running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Update the cached active session count from database
   */
  private async updateCache(): Promise<void> {
    // Don't attempt to update cache if service is stopped
    if (!this.isRunning) {
      return;
    }
    
    try {
      const activeSessions = await this.storage.getAllActiveSessions();
      this.cachedActiveSessionCount = activeSessions.length;
    } catch (error: any) {
      // Check if this is a database connection error
      if (error?.message?.includes('pool after calling end') || 
          error?.details?.message?.includes('pool after calling end')) {
        logger.warn('SessionCountCacheService: Database connection closed, stopping service');
        this.stop();
        return;
      }
      
      logger.error('Failed to update session count cache:', { error });
      // Don't update cache if there's an error, keep previous value
    }
  }
}

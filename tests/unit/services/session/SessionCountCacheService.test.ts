import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionCountCacheService } from '../../../../server/services/session/SessionCountCacheService.js';
import { IStorage } from '../../../../server/storage.interface.js';

// Mock global timer functions
const mockClearInterval = vi.fn();
vi.stubGlobal('clearInterval', mockClearInterval);

describe('SessionCountCacheService', () => {
  let sessionCountCacheService: SessionCountCacheService;
  let mockStorage: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClearInterval.mockClear();
    
    // Create mock storage
    mockStorage = {
      getAllActiveSessions: vi.fn().mockResolvedValue([
        { sessionId: 'session1', isActive: true },
        { sessionId: 'session2', isActive: true },
        { sessionId: 'session3', isActive: true }
      ])
    } as unknown as IStorage;

    sessionCountCacheService = new SessionCountCacheService(mockStorage);
  });

  afterEach(() => {
    sessionCountCacheService.stop();
  });

  describe('constructor', () => {
    it('should initialize with zero cached count', () => {
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(0);
    });

    it('should store storage reference', () => {
      expect(sessionCountCacheService['storage']).toBe(mockStorage);
    });
  });

  describe('start', () => {
    it('should start the cache service and update cache immediately', async () => {
      const updateCacheSpy = vi.spyOn(sessionCountCacheService as any, 'updateCache');
      
      sessionCountCacheService.start();
      
      expect(updateCacheSpy).toHaveBeenCalledOnce();
      expect(sessionCountCacheService['cacheInterval']).toBeDefined();
    });

    it('should set up periodic cache updates', async () => {
      vi.useFakeTimers();
      
      sessionCountCacheService.start();
      
      // Initial call
      expect(mockStorage.getAllActiveSessions).toHaveBeenCalledTimes(1);
      
      // Advance timer by 30 seconds
      vi.advanceTimersByTime(30000);
      
      // Should have been called again
      expect(mockStorage.getAllActiveSessions).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should update cached count from storage on start', async () => {
      await sessionCountCacheService.start();
      
      // Wait for async update to complete
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
      });
    });
  });

  describe('stop', () => {
    it('should clear the cache interval', () => {
      sessionCountCacheService.start();
      const intervalId = sessionCountCacheService['cacheInterval'];
      
      sessionCountCacheService.stop();
      
      expect(sessionCountCacheService['cacheInterval']).toBeNull();
      expect(mockClearInterval).toHaveBeenCalledWith(intervalId);
    });

    it('should handle stopping when not started', () => {
      expect(() => sessionCountCacheService.stop()).not.toThrow();
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return cached active session count', async () => {
      await sessionCountCacheService.start();
      
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
      });
    });

    it('should return 0 before cache is updated', () => {
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(0);
    });
  });

  describe('invalidateCache', () => {
    it('should immediately update the cache', async () => {
      // Start with 3 sessions
      await sessionCountCacheService.start();
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
      });

      // Mock storage to return 5 sessions
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([
        { sessionId: 'session1' }, { sessionId: 'session2' }, 
        { sessionId: 'session3' }, { sessionId: 'session4' }, 
        { sessionId: 'session5' }
      ]);

      await sessionCountCacheService.invalidateCache();

      expect(sessionCountCacheService.getActiveSessionCount()).toBe(5);
    });

    it('should handle storage errors gracefully', async () => {
      await sessionCountCacheService.start();
      
      // Mock storage to throw error
      mockStorage.getAllActiveSessions = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(sessionCountCacheService.invalidateCache()).resolves.not.toThrow();
      
      // Should keep previous cached value (3) when error occurs
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
    });
  });

  describe('updateStorage', () => {
    it('should update storage reference and immediately update cache', async () => {
      const newMockStorage = {
        getAllActiveSessions: vi.fn().mockResolvedValue([
          { sessionId: 'new1' }, { sessionId: 'new2' }
        ])
      } as unknown as IStorage;

      await sessionCountCacheService.start();
      
      sessionCountCacheService.updateStorage(newMockStorage);

      expect(sessionCountCacheService['storage']).toBe(newMockStorage);
      
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(2);
      });
    });
  });

  describe('updateCache (private method)', () => {
    it('should update cached count from storage', async () => {
      // Start the service so updateCache can run
      sessionCountCacheService.start();
      
      const updateCache = sessionCountCacheService['updateCache'].bind(sessionCountCacheService);
      
      await updateCache();
      
      expect(mockStorage.getAllActiveSessions).toHaveBeenCalled();
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
    });

    it('should handle storage errors and keep previous value', async () => {
      // Start the service so updateCache can run
      sessionCountCacheService.start();
      
      // First successful update
      await sessionCountCacheService['updateCache']();
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);

      // Mock storage error
      mockStorage.getAllActiveSessions = vi.fn().mockRejectedValue(new Error('Database error'));
      
      await sessionCountCacheService['updateCache']();
      
      // Should keep previous value
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
    });

    it('should handle empty session list', async () => {
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([]);
      
      await sessionCountCacheService['updateCache']();
      
      expect(sessionCountCacheService.getActiveSessionCount()).toBe(0);
    });
  });

  describe('integration with periodic updates', () => {
    it('should continuously update cache at specified intervals', async () => {
      vi.useFakeTimers();
      
      sessionCountCacheService.start();
      
      // Initial update
      expect(mockStorage.getAllActiveSessions).toHaveBeenCalledTimes(1);
      
      // Mock different session counts over time
      let callCount = 0;
      mockStorage.getAllActiveSessions = vi.fn().mockImplementation(() => {
        callCount++;
        const sessions = Array.from({ length: callCount }, (_, i) => ({ sessionId: `session${i + 1}` }));
        return Promise.resolve(sessions);
      });
      
      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(1);
      });
      
      // Advance another 30 seconds
      vi.advanceTimersByTime(30000);
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(2);
      });
      
      // Advance another 30 seconds
      vi.advanceTimersByTime(30000);
      await vi.waitFor(() => {
        expect(sessionCountCacheService.getActiveSessionCount()).toBe(3);
      });
      
      vi.useRealTimers();
    });
  });

  describe('constants', () => {
    it('should have correct cache update interval', () => {
      expect(sessionCountCacheService['CACHE_UPDATE_INTERVAL_MS']).toBe(30000); // 30 seconds
    });
  });
});

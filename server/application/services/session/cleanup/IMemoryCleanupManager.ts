/**
 * Memory Cleanup Manager Interface
 * 
 * Defines the contract for cleaning up in-memory data structures.
 * Follows Interface Segregation Principle - focused only on memory operations.
 */

export interface MemoryCleanupResult {
  expiredClassroomCodes: number;
  expiredConnections: number;
  totalMemoryFreed: number; // in bytes, if measurable
}

export interface IMemoryCleanupManager {
  /**
   * Clean up expired classroom codes from memory
   * @param now Current timestamp
   * @returns number of expired codes cleaned
   */
  cleanupExpiredClassroomCodes(now: number): number;

  /**
   * Clean up any other expired in-memory data structures
   * @param now Current timestamp
   * @returns MemoryCleanupResult
   */
  cleanupExpiredMemoryData(now: number): MemoryCleanupResult;

  /**
   * Get current memory usage statistics
   * @returns Object with memory usage metrics
   */
  getMemoryStats(): {
    activeClassroomCodes: number;
    activeConnections: number;
  };
} 
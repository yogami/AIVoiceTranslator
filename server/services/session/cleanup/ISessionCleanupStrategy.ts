/**
 * Session Cleanup Strategy Interface
 * 
 * Defines the contract for different session cleanup strategies.
 * Follows the Strategy Pattern and Single Responsibility Principle.
 */

export interface CleanupResult {
  cleanedCount: number;
  type: string;
  details?: string;
}

export interface ISessionCleanupStrategy {
  /**
   * Execute the cleanup strategy
   * @param now Current timestamp
   * @returns Promise<CleanupResult> Result of the cleanup operation
   */
  execute(now: number): Promise<CleanupResult>;

  /**
   * Get the name of this cleanup strategy
   */
  getName(): string;

  /**
   * Check if this strategy should run (allows for conditional execution)
   */
  shouldRun(now: number): boolean;
} 
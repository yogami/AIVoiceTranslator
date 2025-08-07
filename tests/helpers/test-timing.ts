/**
 * Centralized Test Timing Utilities
 * 
 * All test timing values should be driven by environment variables
 * and scaled using the TEST_TIMING_SCALE factor from .env.test.
 * This ensures consistent, fast, and reliable test execution.
 */

/**
 * Get environment variable as number with fallback
 */
function getEnvNumber(envVar: string, fallback: number): number {
  const value = process.env[envVar];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * Get test scaling factor from environment
 */
function getTestScalingFactor(): number {
  if (process.env.NODE_ENV === 'test') {
    const customScale = process.env.TEST_TIMING_SCALE;
    if (customScale) {
      const parsed = parseFloat(customScale);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
        return parsed;
      }
    }
    return 0.01; // 100x faster for integration tests by default
  }
  return 1; // No scaling for non-test environments
}

/**
 * Scale timing value for test environment with appropriate minimums
 */
function scaleForTest(productionValue: number): number {
  const scalingFactor = getTestScalingFactor();
  const scaled = Math.round(productionValue * scalingFactor);
  
  // Special handling for API/translation timeouts that need real external service calls
  if (productionValue >= 8000) {
    // API/Translation timeouts: need generous minimums for real external service calls
    // OpenAI + ElevenLabs can take 3-9 seconds, so minimum should be at least 10 seconds
    return Math.max(scaled, Math.round(productionValue * 1.0)); // Use full production value as minimum for APIs
  } else if (productionValue >= 5000) {
    // Large timeouts (connections): scale with higher minimum
    return Math.max(scaled, Math.round(productionValue * 0.3));
  } else if (productionValue >= 2000) {
    // Medium timeouts (messages, database ops): scale with medium minimum  
    return Math.max(scaled, Math.round(productionValue * 0.2));
  } else if (productionValue >= 1000) {
    // Small timeouts (waits, database ops): scale with higher minimum for remote database operations
    return Math.max(scaled, Math.round(productionValue * 1.0)); // Use full production value as minimum
  } else {
    // Very small waits: use original scaling with small minimum
    return Math.max(scaled, 50);
  }
}

/**
 * Integration Test Timing Configuration
 * All values are driven by .env.test and automatically scaled
 */
export const INTEGRATION_TEST_CONFIG = {
  // Connection timeouts
  CONNECTION_TIMEOUT: scaleForTest(getEnvNumber('TEST_CONNECTION_TIMEOUT_MS', 10000)),
  MESSAGE_TIMEOUT: scaleForTest(getEnvNumber('TEST_MESSAGE_TIMEOUT_MS', 5000)),
  WEBSOCKET_READY_TIMEOUT: scaleForTest(getEnvNumber('TEST_WEBSOCKET_READY_TIMEOUT_MS', 3000)),
  
  // Server lifecycle
  SERVER_STARTUP_DELAY: scaleForTest(getEnvNumber('TEST_SERVER_STARTUP_DELAY_MS', 1000)),
  SERVER_SHUTDOWN_DELAY: scaleForTest(getEnvNumber('TEST_SERVER_SHUTDOWN_DELAY_MS', 500)),
  CLEANUP_DELAY: scaleForTest(getEnvNumber('TEST_CLEANUP_DELAY_MS', 500)),
  
  // Wait timings
  SHORT_WAIT: scaleForTest(getEnvNumber('TEST_SHORT_WAIT_MS', 50)),
  STANDARD_WAIT: scaleForTest(getEnvNumber('TEST_STANDARD_WAIT_MS', 100)),
  LONG_WAIT: scaleForTest(getEnvNumber('TEST_LONG_WAIT_MS', 1000)),
  RECONNECTION_WAIT: scaleForTest(getEnvNumber('TEST_RECONNECTION_WAIT_MS', 1000)),
  
  // Database and storage
  DATABASE_SYNC_WAIT: scaleForTest(getEnvNumber('TEST_DATABASE_SYNC_WAIT_MS', 100)),
  STORAGE_OPERATION_TIMEOUT: scaleForTest(getEnvNumber('TEST_STORAGE_OPERATION_TIMEOUT_MS', 2000)),
  
  // Translation and TTS
  TRANSLATION_TIMEOUT: scaleForTest(getEnvNumber('TEST_TRANSLATION_TIMEOUT_MS', 10000)),
  TTS_TIMEOUT: scaleForTest(getEnvNumber('TEST_TTS_TIMEOUT_MS', 8000)),
  AUDIO_PROCESSING_TIMEOUT: scaleForTest(getEnvNumber('TEST_AUDIO_PROCESSING_TIMEOUT_MS', 5000)),
  
  // Session management
  SESSION_GRACE_PERIOD: scaleForTest(getEnvNumber('TEST_SESSION_GRACE_PERIOD_MS', 3000)),
  TEACHER_RECONNECTION_GRACE: scaleForTest(getEnvNumber('TEACHER_RECONNECTION_GRACE_PERIOD_MS', 90000)),
  
  // Test timeouts (for vitest)
  UNIT_TEST_TIMEOUT: scaleForTest(getEnvNumber('TEST_UNIT_TIMEOUT_MS', 5000)),
  INTEGRATION_TEST_TIMEOUT: scaleForTest(getEnvNumber('TEST_INTEGRATION_TIMEOUT_MS', 30000)),
  E2E_TEST_TIMEOUT: scaleForTest(getEnvNumber('TEST_E2E_TIMEOUT_MS', 60000)),
  
  // Fallback and error handling
  FALLBACK_TIMEOUT: scaleForTest(getEnvNumber('TEST_FALLBACK_TIMEOUT_MS', 1000)),
  ERROR_RECOVERY_DELAY: scaleForTest(getEnvNumber('TEST_ERROR_RECOVERY_DELAY_MS', 500)),
  RETRY_DELAY: scaleForTest(getEnvNumber('TEST_RETRY_DELAY_MS', 200))
};

/**
 * Utility function to create a scaled timeout promise
 */
export function createTestTimeout(ms: number): Promise<void> {
  const scaledMs = scaleForTest(ms);
  return new Promise(resolve => setTimeout(resolve, scaledMs));
}

/**
 * Utility function to create a scaled timeout with reject
 */
export function createTestTimeoutReject(ms: number, errorMessage: string = 'Test timeout'): Promise<never> {
  const scaledMs = scaleForTest(ms);
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(errorMessage)), scaledMs)
  );
}

/**
 * Debug function to show current timing scaling
 */
export function debugTestTimingScaling(): void {
  if (process.env.NODE_ENV === 'test') {
    const scalingFactor = getTestScalingFactor();
    console.log(`🔧 Integration Test Timing Scaling Factor: ${scalingFactor} (${Math.round(1/scalingFactor)}x faster)`);
    console.log('🔧 Scaled Integration Test Timing Values:');
    console.log(`  - Connection Timeout: ${INTEGRATION_TEST_CONFIG.CONNECTION_TIMEOUT}ms`);
    console.log(`  - Message Timeout: ${INTEGRATION_TEST_CONFIG.MESSAGE_TIMEOUT}ms`);
    console.log(`  - Translation Timeout: ${INTEGRATION_TEST_CONFIG.TRANSLATION_TIMEOUT}ms`);
    console.log(`  - TTS Timeout: ${INTEGRATION_TEST_CONFIG.TTS_TIMEOUT}ms`);
    console.log(`  - Server Startup Delay: ${INTEGRATION_TEST_CONFIG.SERVER_STARTUP_DELAY}ms`);
    console.log(`  - Standard Wait: ${INTEGRATION_TEST_CONFIG.STANDARD_WAIT}ms`);
  }
}

/**
 * Exported utility functions
 */
export { scaleForTest, getTestScalingFactor };

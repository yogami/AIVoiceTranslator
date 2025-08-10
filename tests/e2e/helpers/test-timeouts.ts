/**
 * Test Configuration Helper
 * 
 * Centralized configuration for test timeout and timing values.
 * This ensures all test timeouts are configurable through environment variables.
 */

interface TestConfig {
  playwright: {
    // Playwright server startup timeout
    serverStartupTimeout: number;
  };
  ui: {
    // UI element timeout values
    elementVisibilityTimeout: number;
    connectionStatusTimeout: number;
    teacherRegistrationTimeout: number;
    classroomCodeTimeout: number;
    recordButtonTimeout: number;
    speechRecognitionUnavailableTimeout: number;
  };
  wait: {
    // Wait timeout values for test stability
    shortWait: number;
    standardWait: number;
    adjustableWait: number;
  };
  mock: {
    // Mock timing values
    audioDataDelay: number;
  };
}

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
 * Check if we're running in test environment
 */
function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.E2E_TEST_MODE === 'true';
}

/**
 * Get test scaling factor for timing values
 */
function getTestScalingFactor(): number {
  if (isTestEnvironment()) {
    const customScale = process.env.TEST_TIMING_SCALE;
    if (customScale) {
      const parsed = parseFloat(customScale);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
        return parsed;
      }
    }
    // Default: 10x faster for E2E tests
    return 0.1;
  }
  return 1; // No scaling for non-test environments
}

/**
 * Scale timing value for test environment
 */
function scaleForTest(productionValue: number): number {
  const scalingFactor = getTestScalingFactor();
  const scaled = Math.round(productionValue * scalingFactor);
  // Ensure minimum timing values for test stability
  // Increase the minimum to reduce UI flakiness in CI/E2E
  return Math.max(scaled, 500); // At least 500ms for E2E test stability
}

/**
 * Scale with a custom floor to avoid unrealistically low timeouts
 */
function scaleForTestMin(productionValue: number, minMs: number): number {
  const scaled = scaleForTest(productionValue);
  return Math.max(scaled, minMs);
}

/**
 * Test configuration object
 */
export const testConfig: TestConfig = {
  playwright: {
    serverStartupTimeout: scaleForTest(
      getEnvNumber('PLAYWRIGHT_SERVER_STARTUP_TIMEOUT_MS', 120000)
    ),
  },
  ui: {
    elementVisibilityTimeout: scaleForTestMin(
      getEnvNumber('TEST_ELEMENT_VISIBILITY_TIMEOUT_MS', 15000),
      1500
    ),
    connectionStatusTimeout: scaleForTestMin(
      getEnvNumber('TEST_CONNECTION_STATUS_TIMEOUT_MS', 30000),
      8000
    ),
    teacherRegistrationTimeout: scaleForTestMin(
      getEnvNumber('TEST_TEACHER_REGISTRATION_TIMEOUT_MS', 30000),
      10000
    ),
    classroomCodeTimeout: scaleForTestMin(
      getEnvNumber('TEST_CLASSROOM_CODE_TIMEOUT_MS', 30000),
      10000
    ),
    recordButtonTimeout: scaleForTestMin(
      getEnvNumber('TEST_RECORD_BUTTON_TIMEOUT_MS', 5000),
      2000
    ),
    speechRecognitionUnavailableTimeout: scaleForTestMin(
      getEnvNumber('TEST_SPEECH_RECOGNITION_UNAVAILABLE_TIMEOUT_MS', 3000),
      1000
    ),
  },
  wait: {
    shortWait: scaleForTestMin(
      getEnvNumber('TEST_SHORT_WAIT_MS', 500),
      250
    ),
    standardWait: scaleForTestMin(
      getEnvNumber('TEST_STANDARD_WAIT_MS', 1000),
      600
    ),
    adjustableWait: scaleForTestMin(
      getEnvNumber('TEST_ADJUSTABLE_WAIT_MS', 1500),
      1000
    ),
  },
  mock: {
    audioDataDelay: scaleForTest(
      getEnvNumber('TEST_MOCK_AUDIO_DATA_DELAY_MS', 150)
    ),
  },
};

/**
 * Debug function to show scaled timing values in test environment
 */
export function debugTestTimingScaling(): void {
  if (isTestEnvironment()) {
    const scalingFactor = getTestScalingFactor();
    console.log(`🔧 E2E Test Timing Scaling Factor: ${scalingFactor} (${Math.round(1/scalingFactor)}x faster)`);
    console.log('🔧 E2E Test Scaled Timing Values:');
    console.log(`  - Element Visibility Timeout: ${testConfig.ui.elementVisibilityTimeout}ms`);
    console.log(`  - Teacher Registration Timeout: ${testConfig.ui.teacherRegistrationTimeout}ms`);
    console.log(`  - Standard Wait: ${testConfig.wait.standardWait}ms`);
    console.log(`  - Short Wait: ${testConfig.wait.shortWait}ms`);
  }
}

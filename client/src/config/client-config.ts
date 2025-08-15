/**
 * Client-side Configuration
 * 
 * Centralized configuration management for client-side timeout and timing values.
 * All timing-related environment variables should be defined here.
 */

interface ClientConfig {
  websocket: {
    // WebSocket reconnection settings
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  features: {
    twoWayCommunication: boolean;
  };
  audio: {
    // Audio recording settings
    speechRecognitionRestartDelay: number;
    mockAudioDataDelay: number;
  };
  ui: {
    // UI interaction timeouts
    elementVisibilityTimeout: number;
    connectionStatusTimeout: number;
    teacherRegistrationTimeout: number;
    recordButtonTimeout: number;
    speechRecognitionUnavailableTimeout: number;
    waitTimeout: number;
    shortWaitTimeout: number;
    adjustableWaitTimeout: number;
  };
}

/**
 * Get environment variable as number with fallback
 */
function getEnvNumber(envVar: string, fallback: number): number {
  const value = (import.meta as any).env[envVar];
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
  return (import.meta as any).env.MODE === 'test' || 
         (import.meta as any).env.NODE_ENV === 'test';
}

/**
 * Get test scaling factor for timing values
 * This allows test timeouts to be proportionally faster while maintaining relationships
 */
function getTestScalingFactor(): number {
  if (isTestEnvironment()) {
    const customScale = (import.meta as any).env.VITE_TEST_TIMING_SCALE;
    if (customScale) {
      const parsed = parseFloat(customScale);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
        return parsed;
      }
    }
    // Default: 10x faster for client-side tests (more conservative than server-side)
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
  return Math.max(scaled, 100); // At least 100ms
}

/**
 * Client configuration object
 */
export const clientConfig: ClientConfig = {
  websocket: {
    maxReconnectAttempts: getEnvNumber('VITE_WS_MAX_RECONNECT_ATTEMPTS', 5),
    reconnectDelay: scaleForTest(
      getEnvNumber('VITE_WS_RECONNECT_DELAY_MS', 3000)
    ),
  },
  features: {
    twoWayCommunication: ((import.meta as any).env.VITE_FEATURE_TWO_WAY_COMMUNICATION || 'false')
      .toString().toLowerCase() 
      .match(/^(1|true|yes|on)$/) !== null
  },
  audio: {
    speechRecognitionRestartDelay: scaleForTest(
      getEnvNumber('VITE_SPEECH_RECOGNITION_RESTART_DELAY_MS', 100)
    ),
    mockAudioDataDelay: scaleForTest(
      getEnvNumber('VITE_MOCK_AUDIO_DATA_DELAY_MS', 150)
    ),
  },
  ui: {
    elementVisibilityTimeout: scaleForTest(
      getEnvNumber('VITE_ELEMENT_VISIBILITY_TIMEOUT_MS', 10000)
    ),
    connectionStatusTimeout: scaleForTest(
      getEnvNumber('VITE_CONNECTION_STATUS_TIMEOUT_MS', 10000)
    ),
    teacherRegistrationTimeout: scaleForTest(
      getEnvNumber('VITE_TEACHER_REGISTRATION_TIMEOUT_MS', 10000)
    ),
    recordButtonTimeout: scaleForTest(
      getEnvNumber('VITE_RECORD_BUTTON_TIMEOUT_MS', 5000)
    ),
    speechRecognitionUnavailableTimeout: scaleForTest(
      getEnvNumber('VITE_SPEECH_RECOGNITION_UNAVAILABLE_TIMEOUT_MS', 3000)
    ),
    waitTimeout: scaleForTest(
      getEnvNumber('VITE_WAIT_TIMEOUT_MS', 1000)
    ),
    shortWaitTimeout: scaleForTest(
      getEnvNumber('VITE_SHORT_WAIT_TIMEOUT_MS', 1000)
    ),
    adjustableWaitTimeout: scaleForTest(
      getEnvNumber('VITE_ADJUSTABLE_WAIT_TIMEOUT_MS', 1500)
    ),
  },
};

/**
 * Debug function to show scaled timing values in test environment
 */
export function debugClientTimingScaling(): void {
  if (isTestEnvironment()) {
    const scalingFactor = getTestScalingFactor();
    console.log(`🔧 Client Test Timing Scaling Factor: ${scalingFactor} (${Math.round(1/scalingFactor)}x faster)`);
    console.log('🔧 Client Scaled Timing Values:');
    console.log(`  - WebSocket Reconnect Delay: ${clientConfig.websocket.reconnectDelay}ms`);
    console.log(`  - Teacher Registration Timeout: ${clientConfig.ui.teacherRegistrationTimeout}ms`);
    console.log(`  - Element Visibility Timeout: ${clientConfig.ui.elementVisibilityTimeout}ms`);
    console.log(`  - Wait Timeout: ${clientConfig.ui.waitTimeout}ms`);
  }
}

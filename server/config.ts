/**
 * Application Configuration
 * 
 * Centralized configuration management for the AI Voice Translator application.
 * All environment variables and configuration constants should be defined here.
 */

/**
 * Configuration interface for type safety
 */
interface AppConfig {
  openai: {
    apiKey: string | undefined;
  };
  server: {
    port: number;
    host: string;
  };
  features?: {
    twoWayCommunication: boolean;
    originalSourceAudio?: boolean;
  };
  app: {
    environment: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  session: {
    // Connection lifecycle timeouts (in milliseconds)
    veryShortSessionThreshold: number;
    // SessionCleanupService timeouts (in milliseconds)  
    staleSessionTimeout: number;
    staleSessionTimeoutUnscaled: number; // For display purposes in quality reasons
    allStudentsLeftTimeout: number;
    allStudentsLeftTimeoutUnscaled: number; // For display purposes in quality reasons
    emptyTeacherTimeout: number; // Time to wait before cleaning up teacher sessions with no students
    emptyTeacherTimeoutUnscaled: number; // For display purposes in quality reasons
    cleanupInterval: number;
    // Classroom code lifecycle (in milliseconds)
    classroomCodeExpiration: number;
    classroomCodeCleanupInterval: number;
    // Connection health timeouts (in milliseconds)
    healthCheckInterval: number;
    // Teacher reconnection timeouts (in milliseconds)
    teacherReconnectionGracePeriod: number;
    // Audio processing parameters
    minAudioDataLength: number;
    minAudioBufferLength: number;
    // Message delays (in milliseconds)
    sessionExpiredMessageDelay: number;
    invalidClassroomMessageDelay: number;
    // Text processing parameters
    logTextPreviewLength: number;
  };
}

/**
 * Test timing scaling factor
 * This mathematically scales down all timing values during test runs to save time
 * while maintaining proportional relationships between different timeouts.
 * Both E2E and integration tests use scaled timings via TEST_TIMING_SCALE env var.
 */
const getTestScalingFactor = (): number => {
  if (process.env.NODE_ENV === 'test') {
    // Apply scaling for both E2E and integration tests using TEST_TIMING_SCALE
    const customScale = process.env.TEST_TIMING_SCALE;
    console.log(`🔧 DEBUG: Test mode - TEST_TIMING_SCALE env var: ${customScale}`);
    if (customScale) {
      const parsed = parseFloat(customScale);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
        console.log(`🔧 DEBUG: Using TEST_TIMING_SCALE: ${parsed} (${Math.round(1/parsed)}x faster)`);
        return parsed;
      }
    }
    // Default test scaling: 1/100th of production timing (100x faster)
    console.log('🔧 DEBUG: Using default test scaling: 0.01 (100x faster)');
    return 1/100;
  }
  return 1; // No scaling for non-test environments
};

/**
 * Scales timing values for test environment
 */
const scaleForTest = (productionValue: number): number => {
  const scalingFactor = getTestScalingFactor();
  const scaled = Math.round(productionValue * scalingFactor);
  // Ensure minimum timing values for test stability - much faster for scaled tests
  return Math.max(scaled, 20); // At least 20ms for very fast scaled tests
};

/**
 * Application configuration object
 */
export const config: AppConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  server: {
    port: (() => {
      /**
       * Railway Deployment PORT Configuration
       * 
       * Railway automatically assigns and provides a PORT environment variable for deployed services.
       * However, during deployment troubleshooting, we discovered that Railway wasn't providing PORT
       * in some cases, causing EADDRINUSE errors when the app tried to bind to undefined/default ports.
       * 
       * This configuration implements Railway-specific logic:
       * - In production: PORT is optional with fallback to 3000 (Railway should auto-provide)
       * - In development: PORT is required and must be explicitly set in .env
       * 
       * The fallback ensures Railway deployments don't fail if PORT isn't auto-provided,
       * while maintaining strict validation for local development environments.
       */
      const portEnv = process.env.PORT;
      if (!portEnv) {
        if (process.env.NODE_ENV === 'production') {
          // Railway should provide PORT automatically, but fallback prevents deployment failures
          console.warn('PORT environment variable not provided by Railway, using fallback port 3000');
          return 3000;
        } else {
          // Development requires explicit PORT configuration
          throw new Error('PORT environment variable must be set in development.');
        }
      }
      const parsedPort = parseInt(portEnv, 10);
      if (isNaN(parsedPort)) {
        throw new Error('PORT environment variable must be a valid number.');
      }
      return parsedPort;
    })(),
    host: (() => {
      /**
       * Railway Deployment HOST Configuration
       * 
       * Railway requires applications to bind to '0.0.0.0' (all network interfaces) to receive
       * external traffic through their proxy system. Unlike local development where we bind to
       * specific interfaces like '127.0.0.1', Railway needs the app to listen on all interfaces.
       * 
       * This configuration implements environment-specific binding:
       * - In production: HOST defaults to '0.0.0.0' for Railway's proxy system compatibility
       * - In development: HOST is required and should be explicitly set (usually '127.0.0.1')
       * 
       * The automatic '0.0.0.0' binding in production ensures Railway can route traffic to the
       * containerized application without requiring manual HOST configuration in Railway dashboard.
       */
      const host = process.env.HOST;
      if (!host) {
        if (process.env.NODE_ENV === 'production') {
          // Railway requires binding to all interfaces for external traffic routing
          return '0.0.0.0';
        } else {
          // Development requires explicit HOST specification for security and clarity
          throw new Error('HOST environment variable must be set in development.');
        }
      }
      return host;
    })(),
  },
  features: {
    twoWayCommunication: (() => {
      const val = (process.env.FEATURE_TWO_WAY_COMMUNICATION || '').toLowerCase();
      return val === '1' || val === 'true' || val === 'yes' || val === 'on';
    })(),
    originalSourceAudio: (() => {
      const val = (process.env.FEATURE_ORIGINAL_SOURCE_AUDIO || '').toLowerCase();
      return val === '1' || val === 'true' || val === 'yes' || val === 'on';
    })(),
  },
  app: {
    environment: (() => {
      if (!process.env.NODE_ENV) throw new Error('NODE_ENV environment variable must be set.');
      const validEnvironments: AppConfig['app']['environment'][] = ['development', 'production', 'test'];
      const environment = process.env.NODE_ENV.toLowerCase() as AppConfig['app']['environment'];
      if (!validEnvironments.includes(environment)) throw new Error('NODE_ENV must be one of development, production, or test.');
      return environment;
    })(),
    logLevel: (() => {
      if (!process.env.LOG_LEVEL) throw new Error('LOG_LEVEL environment variable must be set.');
      const validLogLevels: AppConfig['app']['logLevel'][] = ['debug', 'info', 'warn', 'error'];
      const logLevel = process.env.LOG_LEVEL.toLowerCase() as AppConfig['app']['logLevel'];
      if (!validLogLevels.includes(logLevel)) throw new Error('LOG_LEVEL must be one of debug, info, warn, or error.');
      return logLevel;
    })(),
  },
  session: {
    // Connection lifecycle timeouts (in milliseconds)
    veryShortSessionThreshold: (() => {
      const envValue = process.env.SESSION_VERY_SHORT_THRESHOLD_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_VERY_SHORT_THRESHOLD_MS must be a valid number');
        return parsed;
      }
      // Default: 5 seconds, scaled for tests
      return scaleForTest(5000);
    })(),
    
    // SessionCleanupService timeouts (in milliseconds)
    staleSessionTimeout: (() => {
      const envValue = process.env.SESSION_STALE_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_STALE_TIMEOUT_MS must be a valid number');
        return scaleForTest(parsed); // Apply scaling to environment variable too
      }
      // Default: 90 minutes, scaled for tests
      return scaleForTest(90 * 60 * 1000);
    })(),
    
    staleSessionTimeoutUnscaled: (() => {
      const envValue = process.env.SESSION_STALE_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_STALE_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 90 minutes, unscaled for display in quality reasons
      return 90 * 60 * 1000;
    })(),
    
    allStudentsLeftTimeout: (() => {
      const envValue = process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS must be a valid number');
        return scaleForTest(parsed); // Apply scaling to environment variable too
      }
      // Default: 10 minutes, scaled for tests
      return scaleForTest(10 * 60 * 1000);
    })(),
    
    allStudentsLeftTimeoutUnscaled: (() => {
      const envValue = process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 10 minutes, unscaled for display in quality reasons
      return 10 * 60 * 1000;
    })(),
    
    emptyTeacherTimeoutUnscaled: (() => {
      const envValue = process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_EMPTY_TEACHER_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 15 minutes, unscaled for display in quality reasons
      return 15 * 60 * 1000;
    })(),
    
    emptyTeacherTimeout: (() => {
      const envValue = process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_EMPTY_TEACHER_TIMEOUT_MS must be a valid number');
        return scaleForTest(parsed); // Apply scaling for tests
      }
      // Default: 15 minutes, scaled for tests
      return scaleForTest(15 * 60 * 1000);
    })(),
    
    cleanupInterval: (() => {
      const envValue = process.env.SESSION_CLEANUP_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_CLEANUP_INTERVAL_MS must be a valid number');
        return scaleForTest(parsed); // Apply scaling to environment variable too
      }
      // Default: 2 minutes, scaled for tests
      return scaleForTest(2 * 60 * 1000);
    })(),
    
    classroomCodeExpiration: (() => {
      const envValue = process.env.CLASSROOM_CODE_EXPIRATION_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('CLASSROOM_CODE_EXPIRATION_MS must be a valid number');
        return parsed;
      }
      // Default: 2 hours, scaled for tests
      return scaleForTest(2 * 60 * 60 * 1000);
    })(),
    
    classroomCodeCleanupInterval: (() => {
      const envValue = process.env.CLASSROOM_CODE_CLEANUP_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('CLASSROOM_CODE_CLEANUP_INTERVAL_MS must be a valid number');
        return parsed;
      }
      // Default: 15 minutes, scaled for tests
      return scaleForTest(15 * 60 * 1000);
    })(),
    
    healthCheckInterval: (() => {
      const envValue = process.env.HEALTH_CHECK_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('HEALTH_CHECK_INTERVAL_MS must be a valid number');
        return parsed;
      }
      // Default: 30 seconds, scaled for tests
      return scaleForTest(30000);
    })(),
    
    teacherReconnectionGracePeriod: (() => {
      const envValue = process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('TEACHER_RECONNECTION_GRACE_PERIOD_MS must be a valid number');
        return parsed;
      }
      // Default: 5 minutes, scaled for tests
      return scaleForTest(5 * 60 * 1000);
    })(),
    
    minAudioDataLength: (() => {
      const envValue = process.env.MIN_AUDIO_DATA_LENGTH;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('MIN_AUDIO_DATA_LENGTH must be a valid number');
        return parsed;
      }
      // Default: 100 bytes minimum for both production and test
      return 100;
    })(),
    
    minAudioBufferLength: (() => {
      const envValue = process.env.MIN_AUDIO_BUFFER_LENGTH;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('MIN_AUDIO_BUFFER_LENGTH must be a valid number');
        return parsed;
      }
      // Default: 100 bytes minimum for both production and test
      return 100;
    })(),
    
    sessionExpiredMessageDelay: (() => {
      const envValue = process.env.SESSION_EXPIRED_MESSAGE_DELAY_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_EXPIRED_MESSAGE_DELAY_MS must be a valid number');
        return parsed;
      }
      // Default: 1 second, scaled for tests
      return scaleForTest(1000);
    })(),
    
    invalidClassroomMessageDelay: (() => {
      const envValue = process.env.INVALID_CLASSROOM_MESSAGE_DELAY_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('INVALID_CLASSROOM_MESSAGE_DELAY_MS must be a valid number');
        return parsed;
      }
      // Default: 100ms, with minimum 100ms for test stability
      return Math.max(scaleForTest(100), 100);
    })(),
    
    logTextPreviewLength: (() => {
      const envValue = process.env.LOG_TEXT_PREVIEW_LENGTH;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('LOG_TEXT_PREVIEW_LENGTH must be a valid number');
        return parsed;
      }
      // Default: 100 characters for log previews
      return 100;
    })(),
  },
};

// Export individual values for backward compatibility
export const OPENAI_API_KEY = config.openai.apiKey;

/**
 * Validates that required configuration values are present
 * @throws Error if required configuration is missing
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.openai.apiKey && config.app.environment === 'production') {
    errors.push('OPENAI_API_KEY is required in production environment');
  }

  if (!config.server.port) {
    errors.push('PORT is required');
  }

  if (!config.server.host) {
    errors.push('HOST is required');
  }

  // Database URL is always required since we only use database storage
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Gets a configuration value with a fallback
 */
export function getConfigValue<T>(path: string, fallback: T): T {
  const keys = path.split('.');
  let value: any = config;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) {
      return fallback;
    }
  }
  
  return value as T;
}

// Remove the entire PATHS object as it seems unused
// export const PATHS = { ... };

/**
 * Debug function to show scaled timing values in test environment
 */
export function debugTimingScaling(): void {
  if (process.env.NODE_ENV === 'test') {
    const scalingFactor = getTestScalingFactor();
    console.log(`🔧 Test Timing Scaling Factor: ${scalingFactor} (${Math.round(1/scalingFactor)}x faster)`);
    console.log('🔧 Scaled Timing Values:');
    console.log(`  - Classroom Code Expiration: ${config.session.classroomCodeExpiration}ms (${config.session.classroomCodeExpiration/1000}s)`);
    console.log(`  - Teacher Reconnection Grace: ${config.session.teacherReconnectionGracePeriod}ms (${config.session.teacherReconnectionGracePeriod/1000}s)`);
    console.log(`  - All Students Left Timeout: ${config.session.allStudentsLeftTimeout}ms (${config.session.allStudentsLeftTimeout/1000}s)`);
    console.log(`  - Session Cleanup Interval: ${config.session.cleanupInterval}ms (${config.session.cleanupInterval/1000}s)`);
    console.log(`  - Stale Session Timeout: ${config.session.staleSessionTimeout}ms (${config.session.staleSessionTimeout/1000}s)`);
  }
}
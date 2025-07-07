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
  app: {
    environment: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  session: {
    // Connection lifecycle timeouts (in milliseconds)
    veryShortSessionThreshold: number;
    // SessionCleanupService timeouts (in milliseconds)  
    staleSessionTimeout: number;
    allStudentsLeftTimeout: number;
    emptyTeacherTimeout: number;
    cleanupInterval: number;
    // Classroom session timeouts (in milliseconds)
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
 * Application configuration object
 */
export const config: AppConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  server: {
    port: (() => {
      if (!process.env.PORT) throw new Error('PORT environment variable must be set.');
      const parsedPort = parseInt(process.env.PORT, 10);
      if (isNaN(parsedPort)) throw new Error('PORT environment variable must be a valid number.');
      return parsedPort;
    })(),
    host: (() => {
      if (!process.env.HOST) throw new Error('HOST environment variable must be set.');
      return process.env.HOST;
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
      // Default: 5 seconds for production, 1 second for test
      return process.env.NODE_ENV === 'test' ? 1000 : 5000;
    })(),
    
    // SessionCleanupService timeouts (in milliseconds)
    staleSessionTimeout: (() => {
      const envValue = process.env.SESSION_STALE_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_STALE_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 90 minutes for production, 30 seconds for test
      return process.env.NODE_ENV === 'test' ? 30000 : 90 * 60 * 1000;
    })(),
    
    allStudentsLeftTimeout: (() => {
      const envValue = process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 10 minutes for production, 5 seconds for test
      return process.env.NODE_ENV === 'test' ? 5000 : 10 * 60 * 1000;
    })(),
    
    emptyTeacherTimeout: (() => {
      const envValue = process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_EMPTY_TEACHER_TIMEOUT_MS must be a valid number');
        return parsed;
      }
      // Default: 15 minutes for production, 3 seconds for test
      return process.env.NODE_ENV === 'test' ? 3000 : 15 * 60 * 1000;
    })(),
    
    cleanupInterval: (() => {
      const envValue = process.env.SESSION_CLEANUP_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('SESSION_CLEANUP_INTERVAL_MS must be a valid number');
        return parsed;
      }
      // Default: 2 minutes for production, 5 seconds for test
      return process.env.NODE_ENV === 'test' ? 5000 : 2 * 60 * 1000;
    })(),
    
    classroomCodeExpiration: (() => {
      const envValue = process.env.CLASSROOM_CODE_EXPIRATION_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('CLASSROOM_CODE_EXPIRATION_MS must be a valid number');
        return parsed;
      }
      // Default: 2 hours for production, 30 seconds for test
      return process.env.NODE_ENV === 'test' ? 30000 : 2 * 60 * 60 * 1000;
    })(),
    
    classroomCodeCleanupInterval: (() => {
      const envValue = process.env.CLASSROOM_CODE_CLEANUP_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('CLASSROOM_CODE_CLEANUP_INTERVAL_MS must be a valid number');
        return parsed;
      }
      // Default: 15 minutes for production, 10 seconds for test
      return process.env.NODE_ENV === 'test' ? 10000 : 15 * 60 * 1000;
    })(),
    
    healthCheckInterval: (() => {
      const envValue = process.env.HEALTH_CHECK_INTERVAL_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('HEALTH_CHECK_INTERVAL_MS must be a valid number');
        return parsed;
      }
      // Default: 30 seconds for production, 5 seconds for test
      return process.env.NODE_ENV === 'test' ? 5000 : 30000;
    })(),
    
    teacherReconnectionGracePeriod: (() => {
      const envValue = process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('TEACHER_RECONNECTION_GRACE_PERIOD_MS must be a valid number');
        return parsed;
      }
      // Default: 5 minutes for production, 10 seconds for test
      return process.env.NODE_ENV === 'test' ? 10000 : 5 * 60 * 1000;
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
      // Default: 1 second for production, 100ms for test
      return process.env.NODE_ENV === 'test' ? 100 : 1000;
    })(),
    
    invalidClassroomMessageDelay: (() => {
      const envValue = process.env.INVALID_CLASSROOM_MESSAGE_DELAY_MS;
      if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) throw new Error('INVALID_CLASSROOM_MESSAGE_DELAY_MS must be a valid number');
        return parsed;
      }
      // Default: 100ms for both production and test (just enough to send message)
      return 100;
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
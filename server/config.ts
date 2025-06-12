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
  storage: { // Added storage configuration
    type: 'database' | 'memory';
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
  storage: { // Added storage type reading
    type: (() => {
      if (!process.env.STORAGE_TYPE) throw new Error('STORAGE_TYPE environment variable must be set.');
      const storageType = process.env.STORAGE_TYPE.toLowerCase() as AppConfig['storage']['type'];
      if (storageType !== 'database' && storageType !== 'memory') {
        throw new Error('STORAGE_TYPE must be either "database" or "memory".');
      }
      return storageType;
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

  // Added STORAGE_TYPE validation
  if (!config.storage.type) {
    errors.push('STORAGE_TYPE is required');
  } else if (config.storage.type === 'database' && !process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required when STORAGE_TYPE is "database"');
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
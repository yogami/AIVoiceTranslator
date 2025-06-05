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
}

/**
 * Validates and returns a port number
 */
function validatePort(port: string | undefined, defaultPort: number): number {
  const parsedPort = parseInt(port || '', 10);
  return isNaN(parsedPort) ? defaultPort : parsedPort;
}

/**
 * Validates environment type
 */
function validateEnvironment(env: string | undefined): AppConfig['app']['environment'] {
  const validEnvironments: AppConfig['app']['environment'][] = ['development', 'production', 'test'];
  const environment = (env || 'development').toLowerCase() as AppConfig['app']['environment'];
  return validEnvironments.includes(environment) ? environment : 'development';
}

/**
 * Application configuration object
 */
export const config: AppConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  server: {
    port: validatePort(process.env.PORT, 3001),
    host: process.env.HOST || 'localhost',
  },
  app: {
    environment: validateEnvironment(process.env.NODE_ENV),
    logLevel: (process.env.LOG_LEVEL || 'info') as AppConfig['app']['logLevel'],
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

// Test mode detection
export const isE2ETestMode = process.env.E2E_TEST_MODE === 'true' || 
  (process.env.NODE_ENV === 'test' && process.argv.includes('--e2e'));

// Storage configuration
export const getStorageType = (): 'memory' | 'database' => {
  // Force memory storage for E2E tests
  if (isE2ETestMode) {
    return 'memory';
  }
  
  // Check explicit STORAGE_TYPE setting
  if (process.env.STORAGE_TYPE === 'database' || process.env.STORAGE_TYPE === 'memory') {
    return process.env.STORAGE_TYPE;
  }
  
  // Fallback to DATABASE_URL check for backward compatibility
  return process.env.DATABASE_URL ? 'database' : 'memory';
};
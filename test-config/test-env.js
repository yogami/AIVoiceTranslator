/**
 * Test Environment Configuration
 * 
 * This script sets up environment variables for running tests,
 * especially in CI/CD pipelines where we want predictable behavior.
 */

require('dotenv').config({ path: '.env.test' });

// All test environment variables must be set explicitly in .env.test. No defaults or fallbacks allowed.
const requiredTestEnvVars = [
  'NODE_ENV',
  'HOST',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'SESSION_SECRET',
  'OPENAI_API_KEY',
  'TTS_SERVICE_TYPE',
  'LOG_LEVEL',
  'STORAGE_TYPE',
  'VITE_API_URL',
  'VITE_WS_URL'
];

requiredTestEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required test environment variable: ${envVar}. Please ensure it is defined in .env.test.`);
  }
});

// Ensure critical variables are set to test-specific values
if (process.env.NODE_ENV !== 'test') {
  throw new Error(`NODE_ENV must be 'test' for tests, but it is '${process.env.NODE_ENV}'. Check .env.test.`);
}

// Optional: Add more specific checks, e.g., for database naming, if needed.
// Ensure we're not using a production database in tests (example check)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('production_db')) {
  console.warn('WARNING: DATABASE_URL in .env.test might be pointing to a production database.');
  // Depending on policy, you might want to throw an error here:
  // throw new Error('Test environment is configured with a production database URL. Aborting.');
}

console.log('Test environment configured successfully from .env.test:');
console.log('- Node Environment:', process.env.NODE_ENV);
console.log('- Host:', process.env.HOST);
console.log('- Port:', process.env.PORT);
console.log('- Storage Type:', process.env.STORAGE_TYPE);
console.log('- TTS Service:', process.env.TTS_SERVICE_TYPE);
console.log('- OpenAI Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('- Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('- Redis URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
console.log('- Log Level:', process.env.LOG_LEVEL);
console.log('- Vite API URL:', process.env.VITE_API_URL);
console.log('- Vite WS URL:', process.env.VITE_WS_URL);
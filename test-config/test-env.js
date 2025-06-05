/**
 * Test Environment Configuration
 * 
 * This script sets up environment variables for running tests,
 * especially in CI/CD pipelines where we want predictable behavior.
 */

// Set test environment variables
process.env.STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory';
process.env.NODE_ENV = 'test';
process.env.TTS_SERVICE_TYPE = 'silent';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

// If no OpenAI key is provided, use a test key
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-test-key-for-tests';
}

// Ensure we're not using a production database in tests
if (process.env.STORAGE_TYPE === 'database' && !process.env.DATABASE_URL?.includes('test')) {
  console.warn('WARNING: Database URL does not appear to be a test database');
}

console.log('Test environment configured:');
console.log('- Storage Type:', process.env.STORAGE_TYPE);
console.log('- Node Environment:', process.env.NODE_ENV);
console.log('- TTS Service:', process.env.TTS_SERVICE_TYPE);
console.log('- OpenAI Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('- Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set'); 
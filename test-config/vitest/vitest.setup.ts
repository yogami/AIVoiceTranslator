// This file will be referenced in Vitest config to set up global mocks
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Set test-specific OpenAI key if not already set
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-key-for-unit-tests';
}

// Don't set global config in setup file, it will be handled by config files
// E2E Test Environment Setup
// This file MUST run before any other imports to ensure correct environment variables

import dotenv from 'dotenv';
import path from 'path';

// Load .env.test and override any existing environment variables
const envTestPath = path.resolve(process.cwd(), '.env.test');
console.log('🔧 E2E Setup: Loading environment from:', envTestPath);

const result = dotenv.config({ path: envTestPath, override: true });

if (result.error) {
  console.error('❌ Failed to load .env.test:', result.error);
  process.exit(1);
}

// Verify the correct DATABASE_URL is loaded
console.log('🔧 E2E Setup: DATABASE_URL loaded:', process.env.DATABASE_URL?.includes('aivencloud.com') ? 'Aiven (correct)' : 'NOT AIVEN - WRONG DATABASE!');
console.log('🔧 E2E Setup: Full DATABASE_URL:', process.env.DATABASE_URL);

// This ensures environment is set before any other modules are imported
export const testEnvironmentReady = true;

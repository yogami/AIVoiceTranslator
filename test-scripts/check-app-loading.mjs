#!/usr/bin/env node

/**
 * This script tries to load all critical application modules to check for loading issues
 * It doesn't modify any application code, just tests that it can be loaded
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get directory name for current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('✅ Starting application load test');
console.log(`✅ Current directory: ${process.cwd()}`);
console.log(`✅ Root directory: ${rootDir}`);

// Check if critical server files exist
const files = [
  'server/index.ts',
  'server/config.ts',
  'server/openai.ts',
  'server/routes.ts',
  'server/services/TranslationService.ts'
];

for (const file of files) {
  const filePath = path.join(rootDir, file);
  console.log(`Checking if ${file} exists...`);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.error(`❌ ${file} does not exist!`);
  }
}

// Try importing the critical modules
console.log('🔍 Attempting to import critical modules...');

try {
  console.log('Importing server/index.ts...');
  await import('../server/index.js').catch(error => {
    console.error('❌ Error importing server/index.ts:', error.message);
  });
  
  console.log('Importing server/config.ts...');
  await import('../server/config.js').catch(error => {
    console.error('❌ Error importing server/config.ts:', error.message);
  });
  
  console.log('Importing server/openai.ts...');
  await import('../server/openai.js').catch(error => {
    console.error('❌ Error importing server/openai.ts:', error.message);
  });
  
  console.log('Importing server/routes.ts...');
  await import('../server/routes.js').catch(error => {
    console.error('❌ Error importing server/routes.ts:', error.message);
  });
  
  console.log('Importing server/services/TranslationService.ts...');
  await import('../server/services/TranslationService.js').catch(error => {
    console.error('❌ Error importing server/services/TranslationService.ts:', error.message);
  });
  
  console.log('✅ All imports attempted');
} catch (error) {
  console.error('❌ Error during import checks:', error.message);
}
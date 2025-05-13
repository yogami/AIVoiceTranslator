#!/usr/bin/env node

/**
 * This script helps clean up any module cache issues that might have been 
 * introduced by the testing setup. It doesn't modify any application code.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🧹 Cleaning up test mock artifacts...');

// These are directories that might contain test artifacts
const dirsToClear = [
  'node_modules/.cache',
  'node_modules/.vitest',
  'node_modules/.vite'
];

let cleanupCount = 0;

// Try to clear cache directories
for (const dir of dirsToClear) {
  const dirPath = path.join(rootDir, dir);
  
  try {
    if (fs.existsSync(dirPath)) {
      console.log(`Clearing ${dir}...`);
      // Remove the directory recursively
      fs.rmSync(dirPath, { recursive: true, force: true });
      cleanupCount++;
    }
  } catch (error) {
    console.error(`Error clearing ${dir}:`, error.message);
  }
}

console.log(`✅ Cleanup completed! Cleared ${cleanupCount} directories.`);
console.log('✅ Any module cache issues should now be resolved.');
console.log('✅ The application should now load properly again.');

// Create a marker file to indicate we ran the cleanup
try {
  const cleanupMarker = path.join(rootDir, 'test-scripts/.cleanup-marker');
  fs.writeFileSync(cleanupMarker, String(Date.now()));
  console.log('✅ Created cleanup marker file.');
} catch (error) {
  console.error('Error creating cleanup marker file:', error.message);
}
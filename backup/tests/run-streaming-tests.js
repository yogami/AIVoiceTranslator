/**
 * Run tests for the streaming Whisper API and audio-to-audio translation features
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_TO_RUN = [
  path.join(__dirname, 'streaming-whisper-test.js'),
];

console.log('Running Streaming Whisper and Audio-to-Audio Translation Tests...');

// Make sure the OPENAI_API_KEY environment variable is set
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set.');
  console.error('Please set it before running this test:');
  console.error('export OPENAI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Run each test sequentially
(async function runTests() {
  for (const testFile of TESTS_TO_RUN) {
    console.log(`\n==== Running ${path.basename(testFile)} ====`);
    
    try {
      const testProcess = spawn('node', [testFile], {
        env: process.env,
        stdio: 'inherit'
      });
      
      await new Promise((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ ${path.basename(testFile)} PASSED`);
            resolve();
          } else {
            console.error(`❌ ${path.basename(testFile)} FAILED with exit code ${code}`);
            reject(new Error(`Test failed with exit code ${code}`));
          }
        });
        
        testProcess.on('error', (err) => {
          console.error(`Error executing test: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      console.error(`Error running ${path.basename(testFile)}: ${error.message}`);
      // Continue with next test even if one fails
    }
  }
  
  console.log('\n==== All Tests Completed ====');
})().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
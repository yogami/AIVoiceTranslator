/**
 * Run the end-to-end Selenium test for speech transcription
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Setting up WebDriver...');
try {
  // Update and start webdriver
  execSync('npx webdriver-manager update --versions.chrome=latest', {
    stdio: 'inherit'
  });
  
  console.log('Starting WebDriver server...');
  const webdriverProcess = execSync('npx webdriver-manager start &', {
    stdio: 'inherit'
  });
  
  // Give WebDriver time to start
  console.log('Waiting for WebDriver to initialize...');
  setTimeout(() => {
    try {
      console.log('Running end-to-end test...');
      execSync('node e2e-speech-test.js', {
        stdio: 'inherit'
      });
      console.log('Test completed!');
    } catch (err) {
      console.error('Test failed:', err);
      process.exit(1);
    } finally {
      // Clean up - kill the WebDriver server
      try {
        execSync('pkill -f webdriver-manager', {
          stdio: 'inherit'
        });
      } catch (err) {
        console.log('WebDriver may have already been stopped');
      }
    }
  }, 5000);
} catch (err) {
  console.error('Failed to set up or run tests:', err);
  process.exit(1);
}
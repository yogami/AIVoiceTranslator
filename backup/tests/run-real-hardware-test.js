/**
 * Run the real hardware end-to-end test for speech transcription
 * 
 * This test will:
 * 1. Play a real audio file through system speakers
 * 2. Record the audio through the microphone
 * 3. Verify the transcription appears correctly
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('💡 Starting real hardware test that uses actual audio playback and microphone capture');
console.log('✓ This test requires your laptop speakers and microphone to be working properly');
console.log('✓ Make sure your speakers are at a reasonable volume');
console.log('✓ Make sure your microphone is not muted');
console.log('✓ Position your microphone near your speakers if possible\n');

try {
  console.log('Setting up WebDriver...');
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
      console.log('Running real hardware end-to-end test...');
      execSync('node real-hardware-test.js', {
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
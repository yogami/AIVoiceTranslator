/**
 * Download test audio file for Selenium tests
 * 
 * This script downloads a sample audio file to use in automated tests.
 * Using an MIT licensed sample from SoundBible.com
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample audio URL (short, MIT licensed audio sample)
const TEST_AUDIO_URL = 'https://soundbible.com/grab.php?id=1949&type=mp3';
const OUTPUT_FILE = path.join(__dirname, 'test-sample.mp3');

console.log('Downloading test audio file...');

// Download the file
const file = fs.createWriteStream(OUTPUT_FILE);
https.get(TEST_AUDIO_URL, function(response) {
  if (response.statusCode !== 200) {
    console.error(`Failed to download test audio: ${response.statusCode} ${response.statusMessage}`);
    fs.unlinkSync(OUTPUT_FILE);
    process.exit(1);
  }
  
  response.pipe(file);
  
  file.on('finish', function() {
    file.close(() => {
      // Check file size
      const stats = fs.statSync(OUTPUT_FILE);
      console.log(`Downloaded test audio: ${OUTPUT_FILE} (${stats.size} bytes)`);
      
      if (stats.size < 1000) {
        console.error('WARNING: Downloaded file is very small, may not be valid audio');
      } else {
        console.log('Test audio file downloaded successfully and ready for testing');
      }
    });
  });
}).on('error', function(err) {
  fs.unlinkSync(OUTPUT_FILE);
  console.error(`Error downloading test audio: ${err.message}`);
  process.exit(1);
});
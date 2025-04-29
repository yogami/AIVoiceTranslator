/**
 * Direct Test Script for TranslationService
 * 
 * This script directly tests the TranslationService to verify it works
 * after refactoring.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translateSpeech } from './server/services/TranslationService.js';

// Convert ESM-specific URLs to paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple function to log results
function logResult(result) {
  console.log('-'.repeat(50));
  console.log('Translation Test Result:');
  console.log('-'.repeat(50));
  console.log(`Original Text: ${result.originalText}`);
  console.log(`Translated Text: ${result.translatedText}`);
  console.log(`Language Code: ${result.languageCode}`);
  console.log(`Audio Buffer Size: ${result.audioBuffer.length} bytes`);
  console.log(`Confidence: ${result.confidence || 'N/A'}`);
  console.log('-'.repeat(50));
}

// Function to create a sample audio buffer
// This is just a simple example; in a real test we would use a real audio file
function createSampleAudioBuffer() {
  // Try to load a test audio file if it exists
  try {
    const testAudioPath = path.join(__dirname, 'test-audio.webm');
    if (fs.existsSync(testAudioPath)) {
      console.log(`Loading test audio from ${testAudioPath}...`);
      return fs.readFileSync(testAudioPath);
    }
  } catch (error) {
    console.warn('Could not load test audio file, using dummy buffer.');
  }
  
  // Create a simple audio buffer (this won't be real audio)
  return Buffer.from('test audio data for translation service');
}

// Main test function
async function testTranslationService() {
  try {
    console.log('Testing Translation Service...');
    
    // Get test audio
    const audioBuffer = createSampleAudioBuffer();
    console.log(`Created test audio buffer (${audioBuffer.length} bytes)`);
    
    // Test with English to Spanish translation
    console.log('Translating from English to Spanish...');
    const result = await translateSpeech(audioBuffer, 'en', 'es');
    
    // Log results
    logResult(result);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error testing translation service:', error);
  }
}

// Run the test
testTranslationService();

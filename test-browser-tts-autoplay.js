/**
 * Browser TTS Auto-Play Verification Test
 * 
 * This test verifies that our BrowserSpeechSynthesisService correctly
 * includes the autoPlay flag in the JSON buffer data.
 */

import fs from 'fs';
import assert from 'assert';

// Import the TTS service class
import { BrowserSpeechSynthesisService } from './server/services/TextToSpeechService.js';

// Create an instance of the service
const browserTTS = new BrowserSpeechSynthesisService();

async function runTest() {
  console.log('Running Browser TTS Auto-Play Verification Test');
  
  // Test with various inputs
  const testCases = [
    {
      text: 'This is a test message',
      languageCode: 'en-US',
      preserveEmotions: true
    },
    {
      text: 'Esto es una prueba',
      languageCode: 'es',
      preserveEmotions: false
    },
    {
      text: 'Dies ist ein Test',
      languageCode: 'de',
      speed: 1.5
    }
  ];
  
  for (const [i, testCase] of testCases.entries()) {
    console.log(`\nTest case ${i+1}: ${JSON.stringify(testCase)}`);
    
    // Generate speech marker buffer
    const buffer = await browserTTS.synthesizeSpeech(testCase);
    
    // Convert buffer to string
    const bufferString = buffer.toString('utf8');
    console.log(`Buffer output: ${bufferString}`);
    
    try {
      // Parse JSON from buffer
      const parsed = JSON.parse(bufferString);
      
      // Verify the autoPlay flag is set to true
      assert.strictEqual(parsed.autoPlay, true, 'autoPlay flag should be set to true');
      
      // Verify other properties
      assert.strictEqual(parsed.type, 'browser-speech', 'type should be browser-speech');
      assert.strictEqual(parsed.text, testCase.text, 'text should match input');
      assert.strictEqual(parsed.languageCode, testCase.languageCode, 'languageCode should match input');
      
      console.log('✅ Test passed: autoPlay flag is set to true');
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }
  
  console.log('\n==============================');
  console.log('✅ ALL TESTS PASSED: Browser TTS Auto-Play Verification');
  console.log('✅ The BrowserSpeechSynthesisService correctly sets the autoPlay flag');
  console.log('==============================');
}

// Run the test
runTest();
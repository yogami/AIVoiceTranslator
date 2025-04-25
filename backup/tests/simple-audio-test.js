/**
 * Simple Audio Test for Benedictaitor
 * 
 * This test directly sends a pre-built test audio file to OpenAI to verify transcription
 * without involving WebSockets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message-larger.wav');

async function runTest() {
  console.log('Starting simple audio test for OpenAI transcription...');
  
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.error(`Test audio file not found at ${TEST_AUDIO_PATH}`);
    return false;
  }
  
  // Initialize OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is not set');
    return false;
  }
  
  const openai = new OpenAI({ apiKey });
  console.log('OpenAI client initialized');
  
  try {
    console.log(`Reading audio file from ${TEST_AUDIO_PATH}`);
    const audioReadStream = fs.createReadStream(TEST_AUDIO_PATH);
    
    console.log('Sending audio to OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
      language: "en",
      response_format: "json",
      temperature: 0.0,
      prompt: "The speaker is giving a lecture about a test message. Transcribe their actual words, not background noise."
    });
    
    console.log('Transcription result:', transcription);
    
    if (transcription.text) {
      console.log(`✅ SUCCESS: Received transcription: "${transcription.text}"`);
      return true;
    } else {
      console.log('❌ FAILURE: Received empty transcription');
      return false;
    }
  } catch (error) {
    console.error('Error during transcription:', error);
    return false;
  }
}

// Run the test
runTest()
  .then(success => {
    if (success) {
      console.log('Test completed successfully!');
      process.exit(0);
    } else {
      console.log('Test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Fatal error in test:', err);
    process.exit(1);
  });
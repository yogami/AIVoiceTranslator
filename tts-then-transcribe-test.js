/**
 * This test creates a speech audio file from known text using OpenAI's TTS API,
 * then attempts to transcribe it using their Whisper API.
 * This provides a complete end-to-end test of audio processing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_TEXT = "This is a test message for the Benedictaitor speech transcription system.";
const TTS_AUDIO_PATH = path.join(__dirname, 'tts-test-message.mp3');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function runTest() {
  console.log('Starting TTS + transcription test...');
  
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is not set');
    return false;
  }
  
  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log('OpenAI client initialized');
  
  try {
    // Step 1: Generate speech audio from text
    console.log(`Generating speech audio from text: "${TEST_TEXT}"`);
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: TEST_TEXT,
    });
    
    // Save the audio to disk
    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(TTS_AUDIO_PATH, buffer);
    console.log(`Speech audio saved to ${TTS_AUDIO_PATH} (${buffer.length} bytes)`);
    
    // Step 2: Transcribe the generated audio
    console.log('Transcribing the generated audio...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(TTS_AUDIO_PATH),
      model: "whisper-1",
      language: "en",
      response_format: "json",
      temperature: 0.0,
    });
    
    console.log('Transcription result:', transcription);
    
    // Step 3: Compare the transcription to the original text
    if (transcription.text) {
      console.log(`Original text: "${TEST_TEXT}"`);
      console.log(`Transcribed text: "${transcription.text}"`);
      
      // Check if the transcription contains the essential words from the original
      const normalizedOriginal = TEST_TEXT.toLowerCase().replace(/[.,?!;:]/g, '');
      const normalizedTranscript = transcription.text.toLowerCase().replace(/[.,?!;:]/g, '');
      
      const originalWords = normalizedOriginal.split(' ');
      const keyWords = originalWords.filter(word => word.length > 3); // Only check significant words
      
      let matchCount = 0;
      for (const word of keyWords) {
        if (normalizedTranscript.includes(word)) {
          matchCount++;
        }
      }
      
      const matchPercentage = (matchCount / keyWords.length) * 100;
      console.log(`Matching key words: ${matchCount}/${keyWords.length} (${matchPercentage.toFixed(2)}%)`);
      
      // Consider it a success if at least 70% of key words match
      if (matchPercentage >= 70) {
        console.log(`✅ SUCCESS: Transcription matches original with ${matchPercentage.toFixed(2)}% accuracy`);
        return true;
      } else {
        console.log(`❌ FAILURE: Transcription doesn't match original (${matchPercentage.toFixed(2)}% accuracy)`);
        return false;
      }
    } else {
      console.log('❌ FAILURE: Received empty transcription');
      return false;
    }
  } catch (error) {
    console.error('Error during test:', error);
    return false;
  } finally {
    // Clean up the temporary audio file
    try {
      if (fs.existsSync(TTS_AUDIO_PATH)) {
        fs.unlinkSync(TTS_AUDIO_PATH);
        console.log(`Cleaned up temporary audio file: ${TTS_AUDIO_PATH}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary audio file:', cleanupError);
    }
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
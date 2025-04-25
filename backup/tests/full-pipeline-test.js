/**
 * This test runs a full pipeline test:
 * 1. Generates speech audio using OpenAI TTS API
 * 2. Sends the audio over WebSocket to our server
 * 3. Verifies that the transcription comes back correctly
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_TEXT = "This is a test message for the Benedictaitor speech transcription system.";
const TTS_AUDIO_PATH = path.join(__dirname, 'tts-test-message.mp3');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateTestAudio() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log('OpenAI client initialized for TTS');
  
  // Generate speech audio from text
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
  
  return buffer;
}

async function runTest() {
  console.log('Starting full pipeline test...');
  
  try {
    // Step 1: Generate the test audio
    const audioBuffer = await generateTestAudio();
    const audioBase64 = audioBuffer.toString('base64');
    
    // Step 2: Send audio to our WebSocket server
    console.log('Connecting to WebSocket server...');
    const serverUrl = 'ws://localhost:5000/ws?role=teacher&language=en-US';
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl);
      
      ws.on('open', () => {
        console.log('Connected to WebSocket server');
        
        // Step 2a: Register as teacher
        ws.send(JSON.stringify({
          type: 'register',
          payload: {
            role: 'teacher',
            languageCode: 'en-US'
          }
        }));
        
        console.log('Registered as teacher');
        
        // Step 2b: Send the audio
        setTimeout(() => {
          console.log(`Sending audio data (${audioBase64.length} bytes)...`);
          
          ws.send(JSON.stringify({
            type: 'audio',
            payload: {
              role: 'teacher',
              audio: audioBase64
            }
          }));
          
          console.log('Audio data sent, waiting for transcription...');
        }, 1000);
      });
      
      // Step 3: Wait for transcription response
      let receivedTranscription = false;
      const transcriptions = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('Received message type:', message.type);
          
          if (message.type === 'translation') {
            const transcription = message.data.translatedText;
            console.log('Received transcription:', transcription);
            transcriptions.push(transcription);
            receivedTranscription = true;
            
            // Check if the transcription matches our original text
            const normalizedOriginal = TEST_TEXT.toLowerCase().replace(/[.,?!;:]/g, '');
            const normalizedTranscript = transcription.toLowerCase().replace(/[.,?!;:]/g, '');
            
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
              setTimeout(() => {
                ws.close();
                resolve(true);
              }, 1000);
            } else {
              console.log(`❌ FAILURE: Transcription doesn't match original (${matchPercentage.toFixed(2)}% accuracy)`);
              setTimeout(() => {
                ws.close();
                resolve(false);
              }, 1000);
            }
          } else if (message.type === 'processing_complete') {
            console.log('Processing complete for languages:', message.data.targetLanguages);
            
            // If we've received a processing_complete but still no transcription
            if (!receivedTranscription) {
              // Wait a bit longer for transcription
              setTimeout(() => {
                if (!receivedTranscription) {
                  console.log('❌ FAILURE: Received processing_complete but no transcription');
                  ws.close();
                  resolve(false);
                }
              }, 2000);
            }
          } else if (message.type === 'error') {
            console.error('Error from server:', message.error);
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
      
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        
        if (!receivedTranscription) {
          console.log('❌ FAILURE: No transcription received before connection closed');
          resolve(false);
        }
      });
      
      // Set a timeout for the test
      setTimeout(() => {
        if (!receivedTranscription) {
          console.log('Test timed out after 20 seconds');
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          resolve(false);
        }
      }, 20000);
    });
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
      console.log('Full pipeline test completed successfully!');
      process.exit(0);
    } else {
      console.log('Full pipeline test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Fatal error in test:', err);
    process.exit(1);
  });
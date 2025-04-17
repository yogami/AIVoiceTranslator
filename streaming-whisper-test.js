/**
 * Streaming Whisper API Test for Benedictaitor
 * 
 * This test verifies:
 * 1. The streaming audio transcription using OpenAI Whisper API
 * 2. The real-time audio-to-audio translation between different languages
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message-streaming.wav'); // Temporary audio for testing
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_TEXT = "This is a test of the streaming Whisper API transcription service.";

// This is the base64 representation of a simple WAV format RIFF header
// It's used to create valid WAV files for sending to the API
const WAV_HEADER = 'UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAA=';

/**
 * Generates test audio using OpenAI TTS API
 */
async function generateTestAudio() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  console.log('Initializing OpenAI client for TTS...');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  try {
    console.log(`Generating speech audio from text: "${TEST_TEXT}"`);
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: TEST_TEXT,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(TEST_AUDIO_PATH, buffer);
    console.log(`Speech audio saved to ${TEST_AUDIO_PATH} (${buffer.length} bytes)`);
    
    return buffer;
  } catch (error) {
    console.error('Error generating test audio:', error);
    throw error;
  }
}

/**
 * Tests the streaming Whisper API functionality
 */
async function testStreamingWhisper() {
  console.log('==== Starting Streaming Whisper API Test ====');
  try {
    // Step 1: Generate test audio for the test
    const audioBuffer = await generateTestAudio();
    const audioBase64 = audioBuffer.toString('base64');
    
    // Step 2: Connect to WebSocket server
    const serverUrl = 'ws://localhost:5000/ws?role=teacher&language=en-US';
    console.log(`Connecting to WebSocket server at ${serverUrl}...`);
    
    const ws = new WebSocket(serverUrl);
    
    return new Promise((resolve, reject) => {
      ws.on('open', async () => {
        console.log('Connected to WebSocket server');
        
        // Register as teacher
        ws.send(JSON.stringify({
          type: 'register',
          payload: {
            role: 'teacher',
            languageCode: 'en-US'
          }
        }));
        
        console.log('Registered as teacher');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send audio in chunks to simulate streaming behavior
        console.log('Sending audio in chunks to simulate streaming...');
        const chunkSize = 32768; // 32KB chunks
        
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
          const chunkBase64 = chunk.toString('base64');
          
          // Send streaming audio chunk
          ws.send(JSON.stringify({
            type: 'streaming_audio',
            payload: {
              audio: chunkBase64,
              isFirstChunk: i === 0,
              isFinalChunk: i + chunkSize >= audioBuffer.length,
              language: 'en-US'
            }
          }));
          
          console.log(`Sent chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(audioBuffer.length/chunkSize)}`);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between chunks
        }
        
        console.log('All audio chunks sent, waiting for transcription...');
      });
      
      // Handle WebSocket messages
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log(`Received message type: ${message.type}`);
          
          if (message.type === 'transcription' || message.type === 'translation') {
            const text = message.text || (message.data && message.data.translatedText);
            if (text) {
              console.log(`Received text: "${text}"`);
              receivedMessages.push(text);
              
              // Check for basic match with our test text
              if (text.toLowerCase().includes('test') && 
                  text.toLowerCase().includes('streaming') &&
                  text.toLowerCase().includes('transcription')) {
                console.log('✅ PASS: Transcription contains key parts of test text');
                ws.close();
                resolve(true);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
      
      // Handle connection close
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        
        if (receivedMessages.length === 0) {
          console.log('❌ FAIL: No transcription received');
          resolve(false);
        } else if (!receivedMessages.some(msg => 
            msg.toLowerCase().includes('test') && 
            msg.toLowerCase().includes('streaming') &&
            msg.toLowerCase().includes('transcription'))) {
          console.log('❌ FAIL: Transcription did not contain expected content');
          console.log('Received messages:', receivedMessages);
          resolve(false);
        }
      });
      
      // Set a timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log('Test timed out after 15 seconds');
          ws.close();
          resolve(false);
        }
      }, 15000);
    });
  } catch (error) {
    console.error('Error in streaming test:', error);
    return false;
  }
}

/**
 * Tests the audio-to-audio real-time translation between languages
 */
async function testAudioToAudioTranslation() {
  console.log('==== Starting Audio-to-Audio Translation Test ====');
  try {
    // Reuse the same audio file we generated for the streaming test
    if (!fs.existsSync(TEST_AUDIO_PATH)) {
      await generateTestAudio();
    }
    
    const audioBuffer = fs.readFileSync(TEST_AUDIO_PATH);
    const audioBase64 = audioBuffer.toString('base64');
    
    // First setup a teacher connection to send the audio
    const teacherUrl = 'ws://localhost:5000/ws?role=teacher&language=en-US';
    console.log(`Connecting teacher WebSocket at ${teacherUrl}...`);
    const teacherWs = new WebSocket(teacherUrl);
    
    // Then setup a student connection to receive the translation
    const studentUrl = 'ws://localhost:5000/ws?role=student&language=es-ES'; // Spanish student
    console.log(`Connecting student WebSocket at ${studentUrl}...`);
    const studentWs = new WebSocket(studentUrl);
    
    return new Promise((resolve, reject) => {
      let teacherConnected = false;
      let studentConnected = false;
      let translationReceived = false;
      
      // Teacher WebSocket handlers
      teacherWs.on('open', async () => {
        console.log('Teacher connected to WebSocket server');
        teacherConnected = true;
        
        // Register as teacher
        teacherWs.send(JSON.stringify({
          type: 'register',
          payload: {
            role: 'teacher',
            languageCode: 'en-US'
          }
        }));
        
        // Wait for both connections to be established
        await waitForConnectionsReady();
        
        // Send the audio
        console.log('Sending audio as teacher...');
        teacherWs.send(JSON.stringify({
          type: 'audio',
          payload: {
            role: 'teacher',
            audio: audioBase64
          }
        }));
        
        console.log('Audio sent, waiting for student to receive translation...');
      });
      
      // Student WebSocket handlers
      studentWs.on('open', () => {
        console.log('Student connected to WebSocket server');
        studentConnected = true;
        
        // Register as student
        studentWs.send(JSON.stringify({
          type: 'register',
          payload: {
            role: 'student',
            languageCode: 'es-ES' // Spanish
          }
        }));
        
        console.log('Registered as Spanish student');
      });
      
      studentWs.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log(`Student received message type: ${message.type}`);
          
          if (message.type === 'translation') {
            translationReceived = true;
            
            // Spanish translation should have been received
            const originalText = message.data.originalText || '';
            const translatedText = message.data.translatedText || '';
            const audioData = message.data.audio; // This should be the translated audio
            
            console.log(`Translation received by student:`);
            console.log(`Original (English): "${originalText}"`);
            console.log(`Translated (Spanish): "${translatedText}"`);
            console.log(`Audio data received: ${!!audioData}`);
            
            // Basic check if the translation is in Spanish
            // Look for Spanish-specific words like "esto", "prueba", "servicio"
            const potentialSpanishWords = ['esto', 'prueba', 'servicio', 'es', 'la', 'el', 'una'];
            const containsSpanishWords = potentialSpanishWords.some(word => 
              translatedText.toLowerCase().includes(word)
            );
            
            if (containsSpanishWords) {
              console.log('✅ PASS: Received translation appears to be in Spanish');
              cleanup(true);
            } else {
              console.log('❌ FAIL: Translation does not appear to be in Spanish');
              cleanup(false);
            }
          }
        } catch (error) {
          console.error('Error parsing student message:', error);
        }
      });
      
      // Helper: Wait for both connections to be ready
      async function waitForConnectionsReady() {
        for (let i = 0; i < 10; i++) {
          if (teacherConnected && studentConnected) {
            console.log('Both teacher and student connections established');
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Timed out waiting for connections to be ready');
      }
      
      // Helper: Cleanup and resolve test
      function cleanup(success) {
        if (teacherWs.readyState === WebSocket.OPEN) {
          teacherWs.close();
        }
        if (studentWs.readyState === WebSocket.OPEN) {
          studentWs.close();
        }
        resolve(success);
      }
      
      // Handle errors
      teacherWs.on('error', (error) => {
        console.error('Teacher WebSocket error:', error);
        reject(error);
      });
      
      studentWs.on('error', (error) => {
        console.error('Student WebSocket error:', error);
        reject(error);
      });
      
      // Set a timeout
      setTimeout(() => {
        if (!translationReceived) {
          console.log('❌ FAIL: Test timed out - no translation received by student');
          cleanup(false);
        }
      }, 20000);
    });
  } catch (error) {
    console.error('Error in audio-to-audio translation test:', error);
    return false;
  } finally {
    // Clean up the test audio file
    try {
      if (fs.existsSync(TEST_AUDIO_PATH)) {
        fs.unlinkSync(TEST_AUDIO_PATH);
        console.log(`Cleaned up temporary audio file: ${TEST_AUDIO_PATH}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary audio file:', cleanupError);
    }
  }
}

// Run both tests sequentially
async function runTests() {
  console.log('=== STARTING BENEDICTAITOR STREAMING AND TRANSLATION TESTS ===');
  
  // Test 1: Streaming Whisper API
  const streamingTestResult = await testStreamingWhisper();
  console.log(`Streaming Whisper API Test: ${streamingTestResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  // Test 2: Audio-to-Audio Translation
  const translationTestResult = await testAudioToAudioTranslation();
  console.log(`Audio-to-Audio Translation Test: ${translationTestResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  // Overall results
  const overallResult = streamingTestResult && translationTestResult;
  console.log('=== TEST SUMMARY ===');
  console.log(`Streaming Whisper API Test: ${streamingTestResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Audio-to-Audio Translation Test: ${translationTestResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Overall Result: ${overallResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  return overallResult;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
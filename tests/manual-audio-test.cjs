/**
 * Manual Audio Test Script
 * 
 * This script provides a simple way to test the audio translation functionality
 * without requiring a browser. It connects to the WebSocket server, simulates
 * teacher speech, and logs the responses.
 * 
 * Usage: 
 *   node tests/manual-audio-test.cjs [language] [text]
 *   Example: node tests/manual-audio-test.cjs es "Hello world"
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:5000/ws';
const TARGET_LANGUAGE = process.argv[2] || 'es'; // Default to Spanish if not provided
const TEST_TEXT = process.argv[3] || 'This is a test of the translation system';

// Create unique session IDs
const TEACHER_SESSION_ID = `teacher_${Date.now()}`;
const STUDENT_SESSION_ID = `student_${Date.now()}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// ===== Helper Functions =====

/**
 * Log a message with color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Create a WebSocket connection with event handlers
 */
function createWebSocketConnection(sessionId, role, languageCode, messageHandler) {
  log(`Creating WebSocket connection: ${sessionId} (${role}, ${languageCode})`, colors.cyan);
  
  const ws = new WebSocket(SERVER_URL);
  
  // Event: Connection Open
  ws.on('open', () => {
    log(`WebSocket connection established for ${sessionId}`, colors.green);
    
    // Register the connection with server
    ws.send(JSON.stringify({
      type: 'register',
      sessionId,
      role,
      languageCode
    }));
    
    log(`Registered as ${role} with language ${languageCode}`, colors.green);
  });
  
  // Event: Message Received
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      messageHandler(message);
    } catch (error) {
      log(`Error parsing message: ${error.message}`, colors.red);
    }
  });
  
  // Event: Error
  ws.on('error', (error) => {
    log(`WebSocket error for ${sessionId}: ${error.message}`, colors.red);
  });
  
  // Event: Connection Closed
  ws.on('close', (code, reason) => {
    log(`WebSocket connection closed for ${sessionId}: ${code} ${reason}`, colors.yellow);
  });
  
  return ws;
}

/**
 * Send a speech transcription from the teacher
 */
function sendTeacherSpeech(ws, text) {
  log(`Teacher says: "${text}"`, colors.cyan);
  
  ws.send(JSON.stringify({
    type: 'transcription',
    text,
    final: true
  }));
}

/**
 * Save audio to file
 */
function saveAudioToFile(audioBase64, filename) {
  try {
    const audioDir = path.join(__dirname, 'test-assets/audio');
    
    // Ensure directory exists
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filePath = path.join(audioDir, filename);
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    fs.writeFileSync(filePath, audioBuffer);
    log(`Audio saved to ${filePath}`, colors.green);
    return filePath;
  } catch (error) {
    log(`Error saving audio: ${error.message}`, colors.red);
    return null;
  }
}

// ===== Test Implementation =====

/**
 * Run the manual audio test
 */
async function runTest() {
  log('===== Manual Audio Test =====', colors.magenta);
  log(`Server URL: ${SERVER_URL}`, colors.yellow);
  log(`Target Language: ${TARGET_LANGUAGE}`, colors.yellow);
  log(`Test Text: "${TEST_TEXT}"`, colors.yellow);
  log('============================', colors.magenta);
  
  // Setup promise to track test completion
  let testCompleted = false;
  const testCompletionPromise = new Promise((resolve) => {
    // Auto-timeout after 30 seconds
    setTimeout(() => {
      if (!testCompleted) {
        log('Test timed out after 30 seconds', colors.red);
        resolve(false);
      }
    }, 30000);
  });
  
  // Create student WebSocket connection
  const studentWs = createWebSocketConnection(
    STUDENT_SESSION_ID,
    'student',
    TARGET_LANGUAGE,
    (message) => {
      switch (message.type) {
        case 'confirmation':
          log('Student connection confirmed by server', colors.green);
          break;
          
        case 'translation':
          log(`Received translation: "${message.translatedText}"`, colors.green);
          log(`Original text: "${message.originalText}"`, colors.green);
          
          if (message.audioUrl) {
            log('Received audio URL (browser playback)', colors.green);
          }
          
          if (message.audioBase64) {
            log('Received audio data (Base64)', colors.green);
            // Save the audio to a file
            const filename = `${TARGET_LANGUAGE}_translation_${Date.now()}.mp3`;
            const filePath = saveAudioToFile(message.audioBase64, filename);
            
            if (filePath) {
              log(`✅ TEST PASSED: Full translation cycle completed`, colors.green);
              testCompleted = true;
              
              // Allow time to save file before exiting
              setTimeout(() => {
                process.exit(0);
              }, 1000);
            }
          }
          break;
          
        case 'error':
          log(`Error from server: ${message.error}`, colors.red);
          break;
          
        default:
          log(`Unhandled message type for student: ${message.type}`, colors.yellow);
      }
    }
  );
  
  // Create teacher WebSocket connection
  const teacherWs = createWebSocketConnection(
    TEACHER_SESSION_ID,
    'teacher',
    'en-US',
    (message) => {
      switch (message.type) {
        case 'confirmation':
          log('Teacher connection confirmed by server', colors.green);
          
          // Send test speech after short delay to ensure student is connected
          setTimeout(() => {
            sendTeacherSpeech(teacherWs, TEST_TEXT);
          }, 2000);
          break;
          
        case 'error':
          log(`Error from server: ${message.error}`, colors.red);
          break;
          
        default:
          log(`Unhandled message type for teacher: ${message.type}`, colors.yellow);
      }
    }
  );
  
  // Wait for test completion or timeout
  const result = await testCompletionPromise;
  
  // Clean up connections
  teacherWs.close();
  studentWs.close();
  
  return result;
}

// Run the test
runTest()
  .then((success) => {
    if (!success) {
      log('❌ TEST FAILED: Did not complete full translation cycle', colors.red);
      process.exit(1);
    }
  })
  .catch((error) => {
    log(`❌ TEST ERROR: ${error.message}`, colors.red);
    process.exit(1);
  });
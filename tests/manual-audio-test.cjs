/**
 * Manual Audio Playback Test Script
 * 
 * This script provides a way to manually test the audio playback functionality
 * without requiring a full browser environment.
 * 
 * Usage: node tests/manual-audio-test.js
 */

const WebSocket = require('ws');
const readline = require('readline');

// Create readline interface for console interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Set up application URL - use environment variable or default
const APP_URL = process.env.APP_URL || 'https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
const WS_URL = APP_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

console.log(`Connecting to WebSocket at: ${WS_URL}`);

let teacherWs = null;
let studentWs = null;
let teacherSessionId = null;
let studentSessionId = null;

// Connect teacher WebSocket
function connectTeacher() {
  return new Promise((resolve, reject) => {
    console.log('\nConnecting teacher WebSocket...');
    teacherWs = new WebSocket(WS_URL);
    
    teacherWs.on('open', () => {
      console.log('✓ Teacher WebSocket connected');
      
      // Register as teacher
      const registerMessage = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      };
      
      teacherWs.send(JSON.stringify(registerMessage));
      console.log('✓ Teacher registration message sent');
    });
    
    teacherWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`Teacher received: ${JSON.stringify(message)}`);
      
      if (message.type === 'connection' && message.sessionId) {
        teacherSessionId = message.sessionId;
        console.log(`✓ Teacher session established: ${teacherSessionId}`);
        resolve(teacherWs);
      }
    });
    
    teacherWs.on('error', (error) => {
      console.error('Teacher WebSocket error:', error);
      reject(error);
    });
    
    teacherWs.on('close', () => {
      console.log('Teacher WebSocket closed');
    });
  });
}

// Connect student WebSocket
function connectStudent() {
  return new Promise((resolve, reject) => {
    console.log('\nConnecting student WebSocket...');
    studentWs = new WebSocket(WS_URL);
    
    studentWs.on('open', () => {
      console.log('✓ Student WebSocket connected');
      
      // Register as student
      const registerMessage = {
        type: 'register',
        role: 'student',
        languageCode: 'es' // Spanish
      };
      
      studentWs.send(JSON.stringify(registerMessage));
      console.log('✓ Student registration message sent (Spanish language)');
    });
    
    studentWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`Student received: ${JSON.stringify(message)}`);
      
      if (message.type === 'connection' && message.sessionId) {
        studentSessionId = message.sessionId;
        console.log(`✓ Student session established: ${studentSessionId}`);
        resolve(studentWs);
      }
      
      if (message.type === 'translation') {
        console.log('\n✓ TRANSLATION RECEIVED!');
        console.log(`Original: "${message.originalText}"`);
        console.log(`Translated (${message.targetLanguage}): "${message.text}"`);
        
        // This is where we'd examine the data to verify audio functionality
        console.log(`Audio data included in message: ${message.audioUrl ? 'YES' : 'NO'}`);
        
        if (message.audioUrl) {
          console.log(`Audio URL: ${message.audioUrl}`);
        }
      }
    });
    
    studentWs.on('error', (error) => {
      console.error('Student WebSocket error:', error);
      reject(error);
    });
    
    studentWs.on('close', () => {
      console.log('Student WebSocket closed');
    });
  });
}

// Send a test transcription from the teacher
function sendTestTranscription() {
  if (!teacherWs || teacherWs.readyState !== WebSocket.OPEN) {
    console.error('Teacher WebSocket not connected');
    return;
  }
  
  const transcriptionMessage = {
    type: 'transcription',
    text: 'This is a test of the translation system',
    languageCode: 'en-US'
  };
  
  teacherWs.send(JSON.stringify(transcriptionMessage));
  console.log('\n✓ Test transcription sent: "This is a test of the translation system"');
}

// Main test function
async function runTest() {
  try {
    // Connect both WebSocket clients
    await connectTeacher();
    await connectStudent();
    
    console.log('\nBoth connections established. Ready for testing.');
    
    // Wait a moment for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send test transcription
    sendTestTranscription();
    
    // Keep the script running for a while to see results
    console.log('\nWaiting for translation (press Ctrl+C to exit)...');
    
    // Wait for user input to exit
    rl.question('\nPress Enter to close connections and exit...', () => {
      if (teacherWs) teacherWs.close();
      if (studentWs) studentWs.close();
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
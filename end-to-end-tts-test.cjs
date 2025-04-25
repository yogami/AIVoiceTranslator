/**
 * End-to-End TTS Service Selection Test Script
 * 
 * This script tests the full end-to-end flow to verify that:
 * 1. Teacher can select Browser TTS service
 * 2. Teacher can send a message
 * 3. Student receives the message with the correct TTS service type
 * 4. Student plays the audio using the correct TTS service
 */

const WebSocket = require('ws');

// Configuration
const serverUrl = 'ws://localhost:5000/ws';

// Test data
const testMessage = "This is a test message to verify TTS service selection works end-to-end.";
const targetLanguage = 'es'; // Spanish

// Keep track of active connections
let teacherWs = null;
let studentWs = null;

// Keep track of session IDs
let teacherSessionId = null;
let studentSessionId = null;

// Flag to track test progress
let teacherRegistered = false;
let studentRegistered = false;
let ttsServiceSet = false;
let testMessageSent = false;
let translationReceived = false;
let receivedTtsServiceType = null;

// Create teacher connection
function connectTeacher() {
  console.log('\n[Teacher] Connecting to WebSocket server...');
  teacherWs = new WebSocket(serverUrl);
  
  teacherWs.on('open', () => {
    console.log('[Teacher] Connected to WebSocket server');
    registerAsTeacher();
  });
  
  teacherWs.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(`[Teacher] Received: ${message.type}`);
    
    if (message.type === 'connection' && message.sessionId) {
      teacherSessionId = message.sessionId;
      console.log(`[Teacher] Session ID: ${teacherSessionId}`);
    }
    
    if (message.type === 'register_confirm') {
      teacherRegistered = true;
      console.log('[Teacher] Successfully registered');
      setTtsService('browser');
    }
    
    if (message.type === 'settings_confirm') {
      ttsServiceSet = true;
      console.log(`[Teacher] TTS service set to: ${message.ttsServiceType}`);
      
      // After settings are confirmed, connect student
      connectStudent();
    }
  });
  
  teacherWs.on('error', (error) => {
    console.error('[Teacher] WebSocket error:', error);
  });
  
  teacherWs.on('close', () => {
    console.log('[Teacher] WebSocket connection closed');
  });
}

// Create student connection
function connectStudent() {
  console.log('\n[Student] Connecting to WebSocket server...');
  studentWs = new WebSocket(serverUrl);
  
  studentWs.on('open', () => {
    console.log('[Student] Connected to WebSocket server');
    registerAsStudent();
  });
  
  studentWs.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(`[Student] Received: ${message.type}`);
    
    if (message.type === 'connection' && message.sessionId) {
      studentSessionId = message.sessionId;
      console.log(`[Student] Session ID: ${studentSessionId}`);
    }
    
    if (message.type === 'register_confirm') {
      studentRegistered = true;
      console.log('[Student] Successfully registered');
      
      // Now send a test message from the teacher
      if (teacherRegistered && ttsServiceSet) {
        setTimeout(() => {
          sendTestMessage();
        }, 1000);
      }
    }
    
    if (message.type === 'translation') {
      translationReceived = true;
      receivedTtsServiceType = message.ttsServiceType;
      
      console.log('\n╔═════════════════════════════════════════════════╗');
      console.log('║           TRANSLATION RECEIVED BY STUDENT       ║');
      console.log('╚═════════════════════════════════════════════════╝');
      console.log(`Original text: ${message.originalText}`);
      console.log(`Translated text: ${message.text}`);
      console.log(`TTS Service Type: ${message.ttsServiceType}`);
      console.log(`Use Client Speech: ${message.useClientSpeech}`);
      console.log(`Has Audio Data: ${message.audioData ? 'Yes' : 'No'}`);
      
      // Check if the TTS service type matches what we set
      verifyResult();
    }
  });
  
  studentWs.on('error', (error) => {
    console.error('[Student] WebSocket error:', error);
  });
  
  studentWs.on('close', () => {
    console.log('[Student] WebSocket connection closed');
  });
}

// Register as teacher
function registerAsTeacher() {
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US',
    name: 'Test Teacher'
  };
  
  teacherWs.send(JSON.stringify(registerMessage));
  console.log('[Teacher] Sent registration message');
}

// Register as student with language preference
function registerAsStudent() {
  const registerMessage = {
    type: 'register',
    role: 'student',
    languageCode: targetLanguage,
    name: 'Test Student'
  };
  
  studentWs.send(JSON.stringify(registerMessage));
  console.log(`[Student] Sent registration message with language: ${targetLanguage}`);
}

// Set TTS service to browser (used by the teacher)
function setTtsService(serviceType) {
  const settingsMessage = {
    type: 'settings',
    ttsServiceType: serviceType
  };
  
  teacherWs.send(JSON.stringify(settingsMessage));
  console.log(`[Teacher] Set TTS service to: ${serviceType}`);
}

// Send a test message from the teacher
function sendTestMessage() {
  const transcriptionMessage = {
    type: 'transcription',
    text: testMessage,
    languageCode: 'en-US'
  };
  
  teacherWs.send(JSON.stringify(transcriptionMessage));
  testMessageSent = true;
  console.log('\n[Teacher] Sent test message for translation');
}

// Verify the results
function verifyResult() {
  console.log('\n╔═════════════════════════════════════════════════╗');
  console.log('║                 TEST RESULTS                    ║');
  console.log('╚═════════════════════════════════════════════════╝');
  
  let allTestsPassed = true;
  
  // Test 1: Teacher registration successful
  console.log(`Teacher Registration: ${teacherRegistered ? '✅ PASSED' : '❌ FAILED'}`);
  allTestsPassed = allTestsPassed && teacherRegistered;
  
  // Test 2: TTS service set to browser
  console.log(`TTS Service Setting: ${ttsServiceSet ? '✅ PASSED' : '❌ FAILED'}`);
  allTestsPassed = allTestsPassed && ttsServiceSet;
  
  // Test 3: Student registration successful
  console.log(`Student Registration: ${studentRegistered ? '✅ PASSED' : '❌ FAILED'}`);
  allTestsPassed = allTestsPassed && studentRegistered;
  
  // Test 4: Test message sent
  console.log(`Test Message Sending: ${testMessageSent ? '✅ PASSED' : '❌ FAILED'}`);
  allTestsPassed = allTestsPassed && testMessageSent;
  
  // Test 5: Translation received by student
  console.log(`Translation Received: ${translationReceived ? '✅ PASSED' : '❌ FAILED'}`);
  allTestsPassed = allTestsPassed && translationReceived;
  
  // Test 6: TTS service type correctly set to browser
  const ttsServiceCorrect = receivedTtsServiceType === 'browser';
  console.log(`TTS Service Type: ${ttsServiceCorrect ? '✅ PASSED' : '❌ FAILED'} (received: ${receivedTtsServiceType}, expected: browser)`);
  allTestsPassed = allTestsPassed && ttsServiceCorrect;
  
  console.log('\n╔═════════════════════════════════════════════════╗');
  console.log(`║  OVERALL RESULT: ${allTestsPassed ? '✅ PASSED' : '❌ FAILED'}                        ║`);
  console.log('╚═════════════════════════════════════════════════╝');
  
  // Clean up
  setTimeout(() => {
    if (teacherWs) teacherWs.close();
    if (studentWs) studentWs.close();
    console.log('\nTest completed, connections closed.');
  }, 2000);
}

// Start the test
console.log('╔═════════════════════════════════════════════════╗');
console.log('║      END-TO-END TTS SERVICE SELECTION TEST      ║');
console.log('╚═════════════════════════════════════════════════╝');
connectTeacher();
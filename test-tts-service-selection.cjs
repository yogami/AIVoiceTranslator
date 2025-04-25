// Test for TTS service selection
// This script simulates what happens when a teacher selects a different TTS service

// WebSocket URL
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:5000/ws');

// Connect to the server
ws.on('open', function open() {
  console.log('Connected to the server');
  
  // Register as a teacher
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US'
  };
  
  ws.send(JSON.stringify(registerMessage));
  console.log('Sent registration as teacher');
  
  // Wait a moment and then change the TTS service type
  setTimeout(() => {
    const settingsMessage = {
      type: 'settings',
      ttsServiceType: 'browser'
    };
    
    ws.send(JSON.stringify(settingsMessage));
    console.log('Changed TTS service preference to browser');
    
    // Wait a moment and then send a test transcription
    setTimeout(() => {
      const transcriptionMessage = {
        type: 'transcription',
        text: 'This is a test message to verify TTS service selection',
        source: 'recognizer',
        targetLanguages: ['es', 'fr', 'de']
      };
      
      ws.send(JSON.stringify(transcriptionMessage));
      console.log('Sent test transcription');
      
      // Close after a moment
      setTimeout(() => {
        ws.close();
        console.log('Test complete');
      }, 5000);
    }, 1000);
  }, 1000);
});

// Handle messages from the server
ws.on('message', function incoming(data) {
  const message = JSON.parse(data);
  
  if (message.type === 'connection') {
    console.log('Connection confirmed, session ID:', message.sessionId);
  } else if (message.type === 'settings') {
    console.log('Settings update confirmed:', message.data);
  } else {
    console.log('Received message type:', message.type);
  }
});

// Handle errors
ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

// Handle close
ws.on('close', function close() {
  console.log('Disconnected from the server');
});
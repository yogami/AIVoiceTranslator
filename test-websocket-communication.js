import WebSocket from 'ws';

const wsUrl = 'ws://localhost:5000/ws';
const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // Register as teacher with explicit browser TTS preference
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US',
    settings: {
      ttsServiceType: 'browser' // Explicitly request browser TTS
    }
  };
  
  ws.send(JSON.stringify(registerMessage));
  console.log('Sent register message with browser TTS preference');
  
  // Wait a bit before sending a transcription with the browser TTS setting
  setTimeout(() => {
    // Force log to check what TTS service is set in the server
    const debugMessage = {
      type: 'ping',
      message: 'Checking current TTS service type before transcription'
    };
    ws.send(JSON.stringify(debugMessage));
    
    // Now send a transcription
    const transcriptionMessage = {
      type: 'transcription',
      text: 'This is a test transcription that should use browser TTS',
    };
    
    ws.send(JSON.stringify(transcriptionMessage));
    console.log('Sent test transcription that should use browser TTS');
    
    // Allow more time for the server to process before closing
    setTimeout(() => {
      ws.close();
      console.log('Test completed');
    }, 3000);
  }, 1000);
});

ws.on('message', function incoming(data) {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('WebSocket connection closed');
});
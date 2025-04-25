import WebSocket from 'ws';

const wsUrl = 'ws://localhost:5000/ws';
const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // Register as teacher
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US',
    settings: {
      ttsServiceType: 'openai'
    }
  };
  
  ws.send(JSON.stringify(registerMessage));
  console.log('Sent register message');
  
  // Wait a bit before sending settings update
  setTimeout(() => {
    const settingsMessage = {
      type: 'settings',
      ttsServiceType: 'browser'
    };
    
    ws.send(JSON.stringify(settingsMessage));
    console.log('Sent settings message to change TTS to browser');
    
    // Wait a bit before sending a transcription
    setTimeout(() => {
      const transcriptionMessage = {
        type: 'transcription',
        text: 'This is a test transcription using browser TTS'
      };
      
      ws.send(JSON.stringify(transcriptionMessage));
      console.log('Sent test transcription');
      
      // Allow some time for the server to process, then close
      setTimeout(() => {
        ws.close();
        console.log('Test completed');
      }, 2000);
    }, 1000);
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
import WebSocket from 'ws';

const protocol = 'ws:';
const host = 'localhost:5000';
const wsUrl = `${protocol}//${host}/ws`;

console.log(`Testing connection to: ${wsUrl}`);

let success = false;
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ CONNECTION SUCCESSFUL - WebSocket connected');
  
  // Send a registration message
  const registerMsg = {
    type: 'register',
    role: 'student',
    languageCode: 'es-ES'
  };
  
  console.log('Sending registration message:', JSON.stringify(registerMsg));
  ws.send(JSON.stringify(registerMsg));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:', JSON.stringify(message, null, 2));
    
    if (message.type === 'connection') {
      console.log('✅ CONNECTION CONFIRMATION RECEIVED');
      success = true;
    }
    
    if (message.type === 'register' && message.status === 'success') {
      console.log('✅ REGISTRATION SUCCESSFUL');
      console.log('Test completed successfully');
      
      // Close connection after success
      setTimeout(() => {
        ws.close();
        console.log('Test complete - WebSocket closed');
        process.exit(success ? 0 : 1);
      }, 1000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ CONNECTION FAILED - WebSocket error:', error.message);
  process.exit(1);
});

// Set timeout for connection
setTimeout(() => {
  if (!success) {
    console.error('❌ TEST FAILED - Timeout waiting for server response');
    process.exit(1);
  }
}, 5000);

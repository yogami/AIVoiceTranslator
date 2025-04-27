import { WebSocket } from 'ws';

console.log('Testing WebSocket connection locally...');

// Function to determine the WebSocket URL based on environment
function getWebSocketURL() {
  // Default to local development URL
  return 'ws://localhost:5000/ws';
}

const wsUrl = getWebSocketURL();
console.log(`Connecting to WebSocket server at ${wsUrl}`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ WebSocket connection established successfully');
  
  // Send a registration message
  const registerMessage = {
    type: 'register',
    role: 'student',
    name: 'TestStudent',
    language: 'es'
  };
  
  console.log('Sending registration message:', JSON.stringify(registerMessage));
  ws.send(JSON.stringify(registerMessage));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Message received:', message);
  
  // After receiving confirmation, close the connection
  if (message.type === 'register_confirm') {
    console.log('✓ Registration confirmed with session ID:', message.sessionId);
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('✗ WebSocket connection error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
  process.exit(0);
});

// Set a timeout to exit if no response
setTimeout(() => {
  console.error('✗ Test timed out - no response from server');
  process.exit(1);
}, 5000);

import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

console.log('Starting WebSocket handler debug test...');

// Create a simple WebSocket server for testing
const wss = new WebSocketServer({ port: 8765 });

wss.on('connection', (ws) => {
  console.log('✅ WebSocket connection established');
  
  // Set up message handler
  ws.on('message', (data) => {
    console.log('✅ Message received:', data.toString());
    ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
  });
  
  // Send connection confirmation
  ws.send(JSON.stringify({ type: 'connection_confirmed' }));
});

console.log('WebSocket server listening on port 8765');

// Create a client to test
const client = new WebSocket('ws://localhost:8765');

client.on('open', () => {
  console.log('✅ Client connected');
  
  // Wait a moment then send a test message
  setTimeout(() => {
    console.log('📤 Sending test message...');
    client.send(JSON.stringify({ type: 'test', message: 'hello' }));
  }, 100);
});

client.on('message', (data) => {
  console.log('📥 Client received:', data.toString());
});

// Clean up after 5 seconds
setTimeout(() => {
  console.log('🧹 Cleaning up...');
  client.close();
  wss.close();
  process.exit(0);
}, 5000);

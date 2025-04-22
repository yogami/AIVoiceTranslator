import { WebSocket } from 'ws';

// Function that attempts to connect to WebSocket server
function testWebSocketConnection() {
  console.log('Attempting to connect to WebSocket server...');
  
  // Create WebSocket connection
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  // Connection opened
  ws.on('open', function() {
    console.log('Connection established successfully');
    
    // Send a simple test message
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: Date.now()
    }));
  });
  
  // Listen for messages
  ws.on('message', function(data) {
    console.log('Message received from server:', data.toString());
    setTimeout(() => {
      ws.close();
      console.log('Connection closed after receiving response');
    }, 1000);
  });
  
  // Handle errors
  ws.on('error', function(error) {
    console.error('WebSocket connection error:', error.message);
  });
  
  // Connection closed
  ws.on('close', function() {
    console.log('Connection closed');
  });
}

// Run the test
testWebSocketConnection();
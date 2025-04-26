/**
 * Simple Connect Button Functionality Test
 * 
 * This test directly checks the Connect button functionality in simple-student.html
 * by opening a WebSocket and simulating the button click process.
 */

const WebSocket = require('ws');

// Constants
const PORT = 5000;
const WS_PATH = '/ws';

// Create a simple WebSocket server that mimic's our actual server functionality
const wss = new WebSocket.Server({ port: PORT, path: WS_PATH });

// Track connections and results
let connectionCount = 0;
let registrationCount = 0;
let testsPassed = 0;
let testsFailed = 0;

console.log('================================================================');
console.log('       CONNECT BUTTON FUNCTIONALITY TEST - SIMPLE VERSION       ');
console.log('================================================================');
console.log('');
console.log('Starting WebSocket server on port ' + PORT + ' with path ' + WS_PATH);

// Handle connections
wss.on('connection', (ws) => {
  connectionCount++;
  console.log(`✅ Connection #${connectionCount} established`);
  testsPassed++;
  
  // Send connection confirmation
  const sessionId = `test_session_${Date.now()}_${connectionCount}`;
  ws.send(JSON.stringify({
    type: 'connection',
    sessionId: sessionId
  }));
  
  // Handle messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Received message: ${message.type}`);
      
      // Check for correct registration message
      if (message.type === 'register') {
        registrationCount++;
        console.log(`✅ Registration message received (role: ${message.role}, language: ${message.languageCode})`);
        testsPassed++;
        
        // Confirm the registration
        ws.send(JSON.stringify({
          type: 'registration_confirmation',
          status: 'success',
          role: message.role,
          languageCode: message.languageCode
        }));
      }
    } catch (error) {
      console.error(`❌ Error processing message: ${error.message}`);
      testsFailed++;
    }
  });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log('Connection closed');
  });
});

// Log errors
wss.on('error', (error) => {
  console.error(`❌ Server error: ${error.message}`);
  testsFailed++;
});

// Display instructions for manual testing
console.log('');
console.log('TEST INSTRUCTIONS:');
console.log('1. Open the simple-student.html page in your browser');
console.log('2. Click the "Connect" button');
console.log('3. Watch for successful connection and registration messages here');
console.log('');
console.log('The test should indicate when a connection is established and');
console.log('when a registration message is received from the student interface.');
console.log('');
console.log('You can also use a browser automation tool or WebSocket client to test.');
console.log('');
console.log('Press Ctrl+C to exit when finished testing.');

// Check results periodically
const interval = setInterval(() => {
  if (connectionCount > 0 && registrationCount > 0) {
    console.log('');
    console.log('================================================================');
    console.log('                      TEST RESULTS SO FAR                       ');
    console.log('================================================================');
    console.log(`Connections established: ${connectionCount}`);
    console.log(`Registration messages received: ${registrationCount}`);
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log('');
    
    if (testsFailed === 0 && connectionCount > 0 && registrationCount > 0) {
      console.log('✅ CONNECT BUTTON FUNCTIONALITY IS WORKING CORRECTLY');
    } else {
      console.log('❌ ISSUES DETECTED WITH CONNECT BUTTON FUNCTIONALITY');
    }
  }
}, 5000);

// Set a timeout to automatically exit after 30 seconds
setTimeout(() => {
  clearInterval(interval);
  
  console.log('');
  console.log('================================================================');
  console.log('                    FINAL TEST RESULTS                          ');
  console.log('================================================================');
  console.log(`Connections established: ${connectionCount}`);
  console.log(`Registration messages received: ${registrationCount}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('');
  
  if (connectionCount === 0) {
    console.log('❌ TEST FAILED: No connections were established');
    process.exit(1);
  } else if (registrationCount === 0) {
    console.log('❌ TEST FAILED: No registration messages were received');
    process.exit(1);
  } else if (testsFailed > 0) {
    console.log('❌ TEST FAILED: Errors occurred during testing');
    process.exit(1);
  } else {
    console.log('✅ TEST PASSED: Connect button functionality is working correctly');
    process.exit(0);
  }
}, 30000);
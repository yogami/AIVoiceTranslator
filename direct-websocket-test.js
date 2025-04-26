/**
 * Direct WebSocket Test for Student Interface
 * 
 * This script directly tests the WebSocket functionality by creating
 * a WebSocket connection to the server and verifying that the proper
 * protocol for student registration is working.
 * 
 * It simulates what happens when the Connect button is clicked.
 */

import { WebSocket } from 'ws';

// Connect to the server's WebSocket endpoint
console.log('Starting direct WebSocket test for student connect functionality...');

// Create a WebSocket connection to the server
const protocol = 'ws'; // Use 'wss' for secure connections
const host = 'localhost:5000';
const wsUrl = `${protocol}://${host}/ws`;

console.log(`Connecting to WebSocket at: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

// Track connection status
let connected = false;
let registrationSent = false;
let registrationConfirmed = false;
let sessionId = null;

// Set timeout to fail test if not completed within 10 seconds
const testTimeout = setTimeout(() => {
  if (!connected || !registrationSent || !registrationConfirmed) {
    console.error('❌ TEST FAILED: Timed out waiting for WebSocket operations');
    displayResults();
    process.exit(1);
  }
}, 10000);

// Handle WebSocket events
ws.on('open', () => {
  console.log('✅ WebSocket connection established');
  connected = true;
  
  // Send registration as student with default language
  setTimeout(() => {
    console.log('Sending student registration message...');
    const registerMessage = {
      type: 'register',
      role: 'student',
      languageCode: 'es' // Spanish
    };
    
    ws.send(JSON.stringify(registerMessage));
    registrationSent = true;
    console.log('Registration message sent');
  }, 500);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`Received message type: ${message.type}`);
    
    // Handle connection confirmation
    if (message.type === 'connection') {
      sessionId = message.sessionId;
      console.log(`Connection confirmed with sessionId: ${sessionId}`);
    }
    
    // Handle registration confirmation
    if (message.type === 'registration_confirmation' || 
        (message.type === 'status' && message.action === 'register')) {
      console.log('Registration confirmed:', message);
      registrationConfirmed = true;
      
      // Test succeeded, display results and exit
      setTimeout(() => {
        displayResults();
        process.exit(0);
      }, 1000);
    }
  } catch (error) {
    console.error(`Error processing message: ${error.message}`);
  }
});

ws.on('error', (error) => {
  console.error(`WebSocket error: ${error.message}`);
  displayResults();
  process.exit(1);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
  
  // If closed before registration confirmed, fail test
  if (!registrationConfirmed) {
    console.error('❌ TEST FAILED: Connection closed before registration confirmed');
    displayResults();
    process.exit(1);
  }
});

// Display test results
function displayResults() {
  console.log('\n===== WEBSOCKET TEST RESULTS =====');
  console.log(`Connection established: ${connected ? '✅ YES' : '❌ NO'}`);
  console.log(`Registration sent: ${registrationSent ? '✅ YES' : '❌ NO'}`);
  console.log(`Registration confirmed: ${registrationConfirmed ? '✅ YES' : '❌ NO'}`);
  console.log(`Session ID received: ${sessionId ? '✅ YES' : '❌ NO'}`);
  
  if (connected && registrationSent && registrationConfirmed && sessionId) {
    console.log('\n✅ TEST PASSED: Student connect functionality is working correctly');
  } else {
    console.log('\n❌ TEST FAILED: Student connect functionality has issues');
  }
}

// Ensure we exit if something unexpected happens
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`);
  displayResults();
  process.exit(1);
});
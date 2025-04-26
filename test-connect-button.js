// test-connect-button.js
// This script tests the Connect button functionality in the student interface

// Import required modules
import WebSocket from 'ws';
import http from 'http';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';

console.log("Running Connect Button functionality test...");

// Create a WebSocket server to act as the AIVoiceTranslator server
const wss = new WebSocket.Server({ port: 8080, path: '/ws' });

// Track test status
let connectionReceived = false;
let registrationReceived = false;
let testPassed = false;

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log("✅ Connection received from client");
  connectionReceived = true;
  
  // Send connection confirmation (mimicking server behavior)
  const sessionId = `test_session_${Date.now()}`;
  ws.send(JSON.stringify({
    type: 'connection',
    sessionId: sessionId
  }));
  
  // Handle messages from the client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Received message: ${message.type}`);
      
      // Check for registration message
      if (message.type === 'register') {
        console.log("✅ Registration message received:");
        console.log(`   Role: ${message.role}`);
        console.log(`   Language: ${message.languageCode}`);
        registrationReceived = true;
        
        // Test is successful if we get a properly formatted registration message
        testPassed = (message.role === 'student' && message.languageCode);
        
        // Exit test with appropriate code
        setTimeout(() => {
          wss.close();
          console.log(testPassed 
            ? "✅ TEST PASSED: Connect button creates WebSocket connection and sends registration"
            : "❌ TEST FAILED: Connect button functionality not working correctly");
          process.exit(testPassed ? 0 : 1);
        }, 1000);
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });
});

console.log("WebSocket test server started on port 8080");
console.log("Waiting for WebSocket connections...");

// Use a timeout to ensure test doesn't hang indefinitely
setTimeout(() => {
  wss.close();
  console.log("❌ TEST FAILED: No WebSocket connection received within timeout");
  console.log(`   Connection received: ${connectionReceived ? 'Yes' : 'No'}`);
  console.log(`   Registration received: ${registrationReceived ? 'Yes' : 'No'}`);
  process.exit(1);
}, 10000);

// This test script requires manual connection from a browser
console.log("\nTo complete the test:");
console.log("1. Open the student interface in your browser");
console.log("2. Manually edit the WebSocket URL to point to 'ws://localhost:8080/ws'");
console.log("3. Click the Connect button");
console.log("4. Watch for successful connection and registration in this console");
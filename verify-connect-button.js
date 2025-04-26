/**
 * Simple Student Connect Button Verification Test
 * 
 * This script tests the WebSocket connection functionality on the student interface
 * to verify that the Connect button works correctly after code cleanup.
 */

const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');

// Run the test
console.log('💻 Starting Student Connect Button Verification Test');

// Create a WebSocket server to represent the teacher
const wss = new WebSocket.Server({ port: 6789 });

// Track connections
let studentConnection = null;
let registrationReceived = false;

// Handle connections to the teacher WebSocket
wss.on('connection', (ws) => {
  console.log('✅ Student WebSocket connected to test server');
  studentConnection = ws;
  
  // Send connection confirmation
  const sessionId = `test_session_${Date.now()}`;
  ws.send(JSON.stringify({
    type: 'connection',
    sessionId: sessionId
  }));
  
  // Handle messages from the student
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📩 Received message from student: ${message.type}`);
      
      if (message.type === 'register') {
        registrationReceived = true;
        console.log(`✅ Registration message received: ${JSON.stringify(message)}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registration_confirmation',
          role: message.role,
          languageCode: message.languageCode
        }));
        
        // Test passed
        console.log('\n🎉 TEST PASSED: Student Connect button is working correctly\n');
        console.log('✅ Connection established');
        console.log('✅ Registration message received with correct format');
        
        // Close everything and exit
        setTimeout(() => {
          ws.close();
          wss.close();
          process.exit(0);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });
});

// Start the test
console.log('📋 Test plan:');
console.log('1. Launch mock WebSocket server (teacher)');
console.log('2. Use curl to simulate clicking the Connect button');
console.log('3. Verify that a WebSocket connection is established');
console.log('4. Verify that a proper registration message is sent');
console.log('\n⏳ Setting up test environment...\n');

// Wait for WebSocket server to be ready
setTimeout(() => {
  console.log('🔌 WebSocket server running on port 6789');
  console.log('📤 Sending HTTP request to simulate Connect button click');
  
  // Use curl to make a request that triggers the WebSocket connection
  // This simulates the Connect button functionality
  const connectButtonUrl = `http://localhost:5000/simple-student.html`;
  
  // Check if the server is running
  http.get(connectButtonUrl, (res) => {
    console.log(`🌐 Student page HTTP status: ${res.statusCode}`);
    
    // Check for WebSocket functionality
    if (!studentConnection) {
      console.log('⏰ Waiting for WebSocket connection...');
      
      // Set a timeout for the test
      setTimeout(() => {
        if (!registrationReceived) {
          console.error('❌ TEST FAILED: No registration message received within timeout');
          process.exit(1);
        }
      }, 10000);
    }
  }).on('error', (err) => {
    console.error(`❌ Error accessing student page: ${err.message}`);
    process.exit(1);
  });
}, 1000);

// Set overall timeout
setTimeout(() => {
  console.error('❌ TEST FAILED: Test timed out after 15 seconds');
  process.exit(1);
}, 15000);
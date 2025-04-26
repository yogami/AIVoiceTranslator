/**
 * Simple Student Connect Button Verification Test
 * 
 * This script tests the WebSocket connection functionality on the student interface
 * to verify that the Connect button works correctly after code cleanup.
 */

import WebSocket from 'ws';
import http from 'http';

// Configuration
const SERVER_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';
const TIMEOUT = 5000; // milliseconds

/**
 * Test the WebSocket connection functionality
 */
async function testWebSocketConnection() {
  console.log('🧪 Starting WebSocket connection test...');

  // First test the server is up
  try {
    console.log('✓ Checking if server is running...');
    await fetch(SERVER_URL);
    console.log('✓ Server is running');
  } catch (error) {
    console.error('❌ Server is not running:', error.message);
    return false;
  }

  // Create WebSocket connection
  console.log('✓ Creating WebSocket connection...');
  const ws = new WebSocket(WS_URL);
  
  // Create promise that resolves when connection is established
  const connectionPromise = new Promise((resolve, reject) => {
    // Success: connection established
    ws.on('open', () => {
      console.log('✓ WebSocket connection established');
      resolve(true);
    });
    
    // Connection error
    ws.on('error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      reject(error);
    });
    
    // Connection timeout
    setTimeout(() => {
      reject(new Error(`Connection timed out after ${TIMEOUT}ms`));
    }, TIMEOUT);
  });
  
  try {
    // Wait for connection to be established
    await connectionPromise;
    
    // Simulate sending registration message (as if Connect button was clicked)
    console.log('✓ Simulating Connect button click (sending registration)...');
    const registrationMessage = {
      type: 'register',
      role: 'student',
      languageCode: 'es-ES'
    };
    ws.send(JSON.stringify(registrationMessage));
    
    // Create promise that waits for server response
    const responsePromise = new Promise((resolve, reject) => {
      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('✓ Received response from server:', message);
          
          if (message.type === 'connection-confirmation') {
            console.log('✓ Connection confirmation received with session ID:', message.sessionId);
            resolve(true);
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error.message);
        }
      });
      
      // Response timeout
      setTimeout(() => {
        reject(new Error(`No response received after ${TIMEOUT}ms`));
      }, TIMEOUT);
    });
    
    // Wait for server response
    await responsePromise;
    
    // Close connection after test
    ws.close();
    console.log('✓ WebSocket connection closed');
    
    console.log('\n✅ TEST PASSED: WebSocket connection works correctly');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    return false;
  }
}

// Run the test
testWebSocketConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
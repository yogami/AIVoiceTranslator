/**
 * Direct WebSocket Test for Connect Button Functionality
 * 
 * This script directly tests the WebSocket functionality that underlies the 
 * Connect button in the student interface, without requiring a browser.
 * 
 * It verifies that:
 * 1. A WebSocket connection can be established
 * 2. The server sends a connection confirmation with session ID
 * 3. The client can send a registration message
 * 4. The server confirms registration
 * 
 * This is a headless test suitable for CI/CD environments.
 */

const WebSocket = require('ws');
const assert = require('assert');
const http = require('http');

// Test settings
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const SERVER_HOST = SERVER_URL.replace(/^https?:\/\//, '').split(':')[0];
const SERVER_PORT = SERVER_URL.includes(':') ? SERVER_URL.split(':')[2] : '5000';
const WS_PROTOCOL = SERVER_URL.startsWith('https') ? 'wss' : 'ws';
const WS_URL = `${WS_PROTOCOL}://${SERVER_HOST}:${SERVER_PORT}/ws`;

// Test timeouts
const CONNECTION_TIMEOUT = 5000;
const REGISTRATION_TIMEOUT = 5000;

// Test state
let sessionId = null;
let isRegistered = false;
let errors = [];

/**
 * Run the WebSocket connection test
 */
async function testConnectButtonWebSocket() {
  console.log('🧪 Starting Direct WebSocket Connection Test');
  console.log(`🔌 Connecting to WebSocket server at: ${WS_URL}`);
  
  return new Promise((resolve, reject) => {
    // Set an overall timeout
    const testTimeout = setTimeout(() => {
      reject(new Error('Test timed out after 15 seconds'));
    }, 15000);
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket(WS_URL);
      
      // Connection error handler
      ws.onerror = (error) => {
        console.error('❌ WebSocket connection error:', error.message || 'Unknown error');
        errors.push(`WebSocket error: ${error.message || 'Unknown error'}`);
        clearTimeout(testTimeout);
        reject(new Error('WebSocket connection error'));
      };
      
      // Connection opened handler
      ws.onopen = () => {
        console.log('✅ WebSocket connection established');
        
        // Set a timeout for receiving the connection confirmation
        const connectionConfirmationTimeout = setTimeout(() => {
          ws.close();
          clearTimeout(testTimeout);
          reject(new Error('Timed out waiting for connection confirmation'));
        }, CONNECTION_TIMEOUT);
        
        // Message handler
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(`📥 Received message: ${JSON.stringify(message)}`);
            
            // Handle connection confirmation
            if (message.type === 'connection' && message.sessionId) {
              console.log(`✅ Received connection confirmation with session ID: ${message.sessionId}`);
              sessionId = message.sessionId;
              clearTimeout(connectionConfirmationTimeout);
              
              // Send registration message
              console.log('📤 Sending student registration message...');
              ws.send(JSON.stringify({
                type: 'register',
                role: 'student',
                sessionId: sessionId,
                languageCode: 'es', // Spanish as test language
                name: 'Test Student'
              }));
              
              // Set timeout for registration confirmation
              const registrationTimeout = setTimeout(() => {
                ws.close();
                clearTimeout(testTimeout);
                reject(new Error('Timed out waiting for registration confirmation'));
              }, REGISTRATION_TIMEOUT);
              
              // Update message handler for registration confirmation
              ws.onmessage = (event) => {
                try {
                  const regMessage = JSON.parse(event.data);
                  console.log(`📥 Received message: ${JSON.stringify(regMessage)}`);
                  
                  // Check for registration confirmation
                  if (regMessage.type === 'registration_success') {
                    console.log('✅ Registration confirmed by server');
                    isRegistered = true;
                    clearTimeout(registrationTimeout);
                    
                    // Complete the test successfully
                    ws.close();
                    clearTimeout(testTimeout);
                    resolve(true);
                  }
                } catch (err) {
                  console.error('❌ Error parsing message:', err);
                  errors.push(`Error parsing message: ${err.message}`);
                }
              };
            }
          } catch (err) {
            console.error('❌ Error parsing message:', err);
            errors.push(`Error parsing message: ${err.message}`);
          }
        };
      };
      
      // Connection closed handler
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (!isRegistered) {
          clearTimeout(testTimeout);
          reject(new Error('WebSocket closed before registration was confirmed'));
        }
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      clearTimeout(testTimeout);
      reject(error);
    }
  });
}

/**
 * Verify the server is running
 */
async function checkServerRunning() {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Checking if server is running at ${SERVER_URL}`);
    
    const req = http.get(SERVER_URL, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log(`✅ Server is running (Status: ${res.statusCode})`);
        resolve(true);
      } else {
        console.error(`❌ Server returned status code: ${res.statusCode}`);
        reject(new Error(`Server returned status code: ${res.statusCode}`));
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ Error connecting to server:', error.message);
      reject(new Error(`Error connecting to server: ${error.message}`));
    });
    
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error('Server connection timed out'));
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       CONNECT BUTTON FUNCTIONALITY - DIRECT WEBSOCKET TEST     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`Testing against server: ${SERVER_URL}`);
  
  try {
    // First check if the server is running
    await checkServerRunning();
    
    // Then test the WebSocket connection
    const success = await testConnectButtonWebSocket();
    
    if (success) {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                         TEST RESULTS                           ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('✅ Success: Connect Button WebSocket Functionality Works Correctly');
      console.log('- WebSocket connection established successfully');
      console.log('- Server sent connection confirmation with session ID');
      console.log('- Client sent registration message');
      console.log('- Server confirmed registration');
      
      process.exit(0);
    } else {
      throw new Error('Test completed without explicit success or failure');
    }
  } catch (error) {
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║                         TEST RESULTS                           ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('❌ Failed: Connect Button WebSocket Functionality Test Failed');
    console.error(`Error: ${error.message}`);
    
    if (errors.length > 0) {
      console.error('\nDetailed errors:');
      errors.forEach((err, i) => console.error(`${i+1}. ${err}`));
    }
    
    console.error('\nDebug information:');
    console.error(`- Session ID received: ${sessionId ? 'Yes' : 'No'}`);
    console.error(`- Registration confirmed: ${isRegistered ? 'Yes' : 'No'}`);
    
    process.exit(1);
  }
}

// Run the tests
runTests();
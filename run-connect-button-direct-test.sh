#!/bin/bash

# Run Connect Button Direct WebSocket Test in CI/CD Environment
# This script runs a direct WebSocket test to verify the Connect button functionality
# without requiring a browser.

# Set color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CONNECT BUTTON FUNCTIONALITY - DIRECT WEBSOCKET TEST     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# For GitHub Actions CI environment
if [ -n "$GITHUB_ACTIONS" ]; then
  # Running in GitHub Actions
  echo "Running in GitHub Actions environment"
  
  # Start the server for testing
  echo "Starting server..."
  NODE_ENV=test node server/index.js > server-output.log 2>&1 &
  SERVER_PID=$!
  
  # Wait for server to be ready
  SERVER_URL="http://localhost:5000"
  for i in {1..15}; do
    if curl -s $SERVER_URL > /dev/null; then
      echo "Server is up and running!"
      break
    fi
    if [ $i -eq 15 ]; then
      echo "Server failed to start within the timeout period"
      cat server-output.log
      kill $SERVER_PID
      exit 1
    fi
    echo "Waiting for server... (attempt $i)"
    sleep 1
  done
else
  # Running on Replit
  # Use the Replit-provided URL if available
  REPLIT_URL="https://$REPL_SLUG-$REPL_OWNER.replit.app"
  if [ -n "$REPLIT_URL" ]; then
    echo "Testing against Replit URL: $REPLIT_URL"
    SERVER_URL="$REPLIT_URL"
  else
    echo "Testing against local server: http://localhost:5000"
    SERVER_URL="http://localhost:5000"
  fi
fi

# Run the direct WebSocket test
echo "🔍 Checking if server is running at $SERVER_URL"
curl -s $SERVER_URL > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Server is running (Status: 200)"
else
  echo "❌ Server is not running or not accessible"
  exit 1
fi

echo "🧪 Starting Direct WebSocket Connection Test"
# Extract WebSocket URL from server URL
if [[ "$SERVER_URL" == "http://localhost"* ]]; then
  WS_URL="ws://localhost:5000/ws"
else
  WS_PROTOCOL=$(echo $SERVER_URL | sed -E 's|^(http[s]?)://.*|\1|')
  WS_PROTOCOL=${WS_PROTOCOL/http/ws}
  WS_PROTOCOL=${WS_PROTOCOL/https/wss}
  WS_HOST=$(echo $SERVER_URL | sed -E 's|^http[s]?://([^/]*).*|\1|')
  WS_URL="${WS_PROTOCOL}://${WS_HOST}/ws"
fi
echo "🔌 Connecting to WebSocket server at: $WS_URL"
export WS_URL="$WS_URL"

# Run the verify-connect-button-direct.js script if it exists
if [ -f "verify-connect-button-direct.js" ]; then
  node verify-connect-button-direct.js
  TEST_RESULT=$?
else
  # Create a simple test script if one doesn't exist
  cat > connect-button-direct-test.js << 'EOF'
/**
 * Direct WebSocket Test for Connect Button
 * 
 * This script tests the WebSocket functionality that is used by the Connect button
 * without requiring a browser.
 */

const WebSocket = require('ws');
const http = require('http');

// Test configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws';
const CONNECTION_TIMEOUT = 5000;
const TEST_TIMEOUT = 15000;

// Test state
let connected = false;
let sessionId = null;
let registered = false;
let errors = [];

// Start test
console.log('🧪 Starting Direct WebSocket Test');
console.log(`🔌 Connecting to WebSocket server at: ${WS_URL}`);

// Set an overall timeout
const testTimeout = setTimeout(() => {
  console.error('❌ Test timed out after 15 seconds');
  process.exit(1);
}, TEST_TIMEOUT);

// Create WebSocket connection
const ws = new WebSocket(WS_URL);

// Connection error handler
ws.on('error', (error) => {
  console.error('❌ WebSocket connection error:', error.message);
  clearTimeout(testTimeout);
  process.exit(1);
});

// Connection opened handler
ws.on('open', () => {
  console.log('✅ WebSocket connection established');
  connected = true;
  
  // Set a timeout for the connection confirmation
  const connectionConfirmationTimeout = setTimeout(() => {
    console.error('❌ Timed out waiting for connection confirmation');
    ws.close();
    clearTimeout(testTimeout);
    process.exit(1);
  }, CONNECTION_TIMEOUT);
  
  // Message handler
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📥 Received message: ${message}`);
      
      // Handle connection confirmation
      if (data.type === 'connection' && data.sessionId) {
        console.log(`✅ Received connection confirmation with session ID: ${data.sessionId}`);
        sessionId = data.sessionId;
        clearTimeout(connectionConfirmationTimeout);
        
        // Send registration message
        console.log('📤 Sending student registration message...');
        ws.send(JSON.stringify({
          type: 'register',
          role: 'student',
          languageCode: 'es'
        }));
        
        // Set timeout for registration confirmation
        const registrationTimeout = setTimeout(() => {
          console.error('❌ Timed out waiting for registration confirmation');
          ws.close();
          clearTimeout(testTimeout);
          process.exit(1);
        }, CONNECTION_TIMEOUT);
        
        // Update message handler for registration confirmation
        ws.removeAllListeners('message');
        ws.on('message', (regMessage) => {
          try {
            const regData = JSON.parse(regMessage);
            console.log(`📥 Received message: ${regMessage}`);
            
            // Check for registration confirmation
            if (regData.type === 'register') {
              console.log('✅ Registration confirmed by server');
              registered = true;
              clearTimeout(registrationTimeout);
              
              // Complete the test successfully
              ws.close();
              clearTimeout(testTimeout);
              
              // Log test results
              console.log('╔════════════════════════════════════════════════════════════════╗');
              console.log('║                         TEST RESULTS                           ║');
              console.log('╚════════════════════════════════════════════════════════════════╝');
              console.log('✅ Success: Connect Button WebSocket Functionality Works Correctly');
              console.log('- WebSocket connection established successfully');
              console.log('- Server sent connection confirmation with session ID');
              console.log('- Client sent registration message');
              console.log('- Server confirmed registration');
              process.exit(0);
            }
          } catch (error) {
            console.error('❌ Error parsing registration message:', error);
            process.exit(1);
          }
        });
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
      process.exit(1);
    }
  });
});

// Connection closed handler
ws.on('close', () => {
  console.log('WebSocket connection closed');
  if (!registered) {
    console.error('❌ WebSocket closed before registration was confirmed');
    clearTimeout(testTimeout);
    process.exit(1);
  }
});
EOF

  # Run the test script
  node connect-button-direct-test.js
  TEST_RESULT=$?
fi

# Stop the server if in GitHub Actions
if [ -n "$GITHUB_ACTIONS" ] && [ -n "$SERVER_PID" ]; then
  kill $SERVER_PID
fi

# Report results
if [ $TEST_RESULT -eq 0 ]; then
  exit 0
else
  exit 1
fi
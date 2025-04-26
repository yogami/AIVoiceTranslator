#!/bin/bash

# Run Connect Button Test
# This script runs a test to verify the Connect button functionality via WebSocket

# Set color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CONNECT BUTTON FUNCTIONALITY TEST              ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

# Environment information
echo -e "Environment Information:"
echo -e "Node.js version: $(node -v)"
echo -e "npm version: $(npm -v)"
echo ""

# Stop any running servers
echo -e "Stopping any running servers..."
pkill -f "node server/index.js" || true
pkill -f "tsx server/index.ts" || true
sleep 2

# Start the server in the background
echo -e "Starting server..."
NODE_ENV=test npm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo -e "Waiting for server to start..."
for i in {1..10}; do
  if curl -s http://localhost:5000 > /dev/null; then
    echo -e "Server is up and running!"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}Server failed to start within the timeout period${NC}"
    kill $SERVER_PID
    exit 1
  fi
  sleep 1
done

echo ""
echo -e "Running WebSocket connection test..."
node verify-connect-button.js
TEST_RESULT=$?

# Stop the server
echo -e "Stopping server..."
kill $SERVER_PID

echo ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     TEST RESULTS                    ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ PASSED: Connect Button Functionality Test${NC}"
  exit 0
else
  echo -e "${RED}❌ FAILED: Connect Button Functionality Test${NC}"
  exit 1
fi
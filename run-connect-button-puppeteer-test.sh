#!/bin/bash

# Run Connect Button Puppeteer Test in CI/CD Environment
# This script runs a Puppeteer test to verify the Connect button functionality
# in a CI/CD environment with headless browser testing.

# Set color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CONNECT BUTTON PUPPETEER TEST (CI/CD)          ║${NC}"
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
NODE_ENV=test npm run dev > server-output.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo -e "Waiting for server to start..."
for i in {1..15}; do
  if curl -s http://localhost:5000 > /dev/null; then
    echo -e "Server is up and running!"
    break
  fi
  if [ $i -eq 15 ]; then
    echo -e "${RED}Server failed to start within the timeout period${NC}"
    echo -e "Server logs:"
    cat server-output.log
    kill $SERVER_PID
    exit 1
  fi
  echo -e "Waiting for server... (attempt $i)"
  sleep 1
done

echo ""
echo -e "Running Puppeteer Connect Button test..."
mkdir -p test-results
# Set SERVER_URL environment variable for the test
export SERVER_URL="http://localhost:5000"
node tests/puppeteer/verify_connect_button.cjs 2>&1 | tee test-results/connect-button-puppeteer-test.log
TEST_RESULT=${PIPESTATUS[0]}

# Save server logs
cat server-output.log >> test-results/server-output.log

# Stop the server
echo -e "Stopping server..."
kill $SERVER_PID

echo ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     TEST RESULTS                    ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ PASSED: Connect Button Puppeteer Test${NC}"
  echo -e "The Connect button has been fixed and works correctly!"
  exit 0
else
  echo -e "${RED}❌ FAILED: Connect Button Puppeteer Test${NC}"
  echo -e "${YELLOW}See test-results/connect-button-puppeteer-test.log for details${NC}"
  echo -e "${YELLOW}Server logs are available in test-results/server-output.log${NC}"
  exit 1
fi
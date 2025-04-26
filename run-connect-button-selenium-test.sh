#!/bin/bash

# Run Connect Button Selenium Test in CI/CD Environment
# This script runs a Selenium test to verify the Connect button functionality
# in a CI/CD environment with headless Chrome.

# Set color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CONNECT BUTTON SELENIUM TEST (CI/CD)           ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

# Environment information
echo -e "Environment Information:"
echo -e "Node.js version: $(node -v)"
echo -e "npm version: $(npm -v)"
echo ""

# Check if Selenium and ChromeDriver are available
echo -e "Checking test environment..."
if ! node -e "require('selenium-webdriver')" 2>/dev/null; then
  echo -e "${RED}Error: selenium-webdriver is not installed. Run 'npm install selenium-webdriver' first.${NC}"
  exit 1
fi

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
echo -e "Running Selenium Connect Button test..."
mkdir -p test-results
# Set SERVER_URL environment variable for the test
export SERVER_URL="http://localhost:5000"
node tests/selenium/verify_connect_button.js 2>&1 | tee test-results/connect-button-test.log
TEST_RESULT=${PIPESTATUS[0]}

# Stop the server
echo -e "Stopping server..."
kill $SERVER_PID

echo ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     TEST RESULTS                    ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ PASSED: Connect Button Selenium Test${NC}"
  exit 0
else
  echo -e "${RED}❌ FAILED: Connect Button Selenium Test${NC}"
  echo -e "${YELLOW}See test-results/connect-button-test.log for details${NC}"
  exit 1
fi
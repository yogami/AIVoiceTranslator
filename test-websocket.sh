#!/bin/bash

# Script to test WebSocket connections for AIVoiceTranslator
# This provides a quick way to verify WebSocket functionality without browser tests

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting WebSocket connection test...${NC}"

# Check for required tools
if ! [ -x "$(command -v node)" ]; then
  echo -e "${RED}Error: node is not installed.${NC}" >&2
  exit 1
fi

# Default server URL
SERVER_URL=${1:-"ws://localhost:5000/ws"}

echo -e "Using WebSocket server URL: ${YELLOW}${SERVER_URL}${NC}"
echo "Testing student and teacher connections..."

# Run the test using Node.js to avoid browser dependency
node test-websocket-client.ts "$SERVER_URL"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}✓ WebSocket tests passed successfully${NC}"
else
  echo -e "\n${RED}✗ WebSocket tests failed${NC}"
fi

exit $EXIT_CODE
#!/bin/bash
# Teacher TTS Service Selection Tests Runner
# This script runs the teacher TTS service selection end-to-end tests

# Terminal colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=======================================${NC}"
echo -e "${YELLOW}  Teacher TTS Selection Tests Runner  ${NC}"
echo -e "${YELLOW}=======================================${NC}"

# Check if server is running
if ! curl -s http://localhost:5000 > /dev/null; then
  echo -e "${YELLOW}Starting server...${NC}"
  npm run dev &
  SERVER_PID=$!
  echo -e "${YELLOW}Waiting for server to start...${NC}"
  sleep 5
  SERVER_STARTED=true
else
  echo -e "${YELLOW}Server already running.${NC}"
  SERVER_STARTED=false
fi

# Run the tests
echo -e "${YELLOW}Running teacher TTS service selection tests...${NC}"
APP_URL=http://localhost:5000 NODE_ENV=test npx jest tests/e2e/teacher-tts-selection.test.js
TEST_STATUS=$?

# Update test metrics (if applicable)
if [ -f "./test-metrics-api.js" ]; then
  echo -e "${YELLOW}Updating test metrics...${NC}"
  node test-metrics-api.js --test-type=e2e --test-name=teacher-tts-selection --update-results
fi

# Stop server if we started it
if [ "$SERVER_STARTED" = true ]; then
  echo -e "${YELLOW}Stopping server...${NC}"
  kill $SERVER_PID
fi

# Print final status
if [ $TEST_STATUS -eq 0 ]; then
  echo -e "${GREEN}✅ Teacher TTS service selection tests completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}❌ Teacher TTS service selection tests failed!${NC}"
  exit 1
fi
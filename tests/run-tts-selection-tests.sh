#!/usr/bin/env bash

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_URL=${APP_URL:-"http://localhost:3000"}
TEST_FILE="$(dirname "$0")/e2e/tts-service-selection.test.js"

# Banner
echo -e "${YELLOW}===== TTS Service Selection Test Configuration =====${NC}"
echo -e "App URL: ${APP_URL}"
echo -e "Test file: ${TEST_FILE}"
echo -e "${YELLOW}=================================================${NC}"

# Don't try to install Chrome in Replit environment
# Check if we have Chrome installed
if ! command -v google-chrome &> /dev/null; then
  echo -e "${YELLOW}Chrome not detected. Using headless mode with existing environment.${NC}"
  export CI=true
fi

# Install required Node.js dependencies
echo -e "${YELLOW}Installing test dependencies...${NC}"
npm install --no-save selenium-webdriver@4.14.0 mocha@10.2.0 chromedriver@115.0.0

# Run the test with Mocha using Node.js ES modules
echo -e "${YELLOW}Running TTS service selection tests...${NC}"
NODE_OPTIONS="--experimental-vm-modules" APP_URL=$APP_URL npx mocha $TEST_FILE --timeout 60000 --reporter spec

# Capture exit code
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}TTS service selection tests passed successfully!${NC}"
else
  echo -e "\n${RED}TTS service selection tests failed with exit code: $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
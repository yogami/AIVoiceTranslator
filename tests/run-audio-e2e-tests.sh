#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}AIVoiceTranslator Audio E2E Tests${NC}"
echo -e "${YELLOW}=================================${NC}"

# Check if application URL is provided
if [ -z "$APP_URL" ]; then
  APP_URL="https://AIVoiceTranslator.replit.app"
  echo -e "${YELLOW}Using default APP_URL:${NC} $APP_URL"
fi

# Check if OpenAI API key is available (required for translation)
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${RED}Error: OPENAI_API_KEY is not set.${NC}"
  echo -e "Audio E2E tests require a valid OpenAI API key for translation."
  echo -e "Please set the OPENAI_API_KEY environment variable."
  exit 1
fi

# Check if test audio file exists
TEST_AUDIO_PATH="tests/test-assets/test-audio-english.mp3"
if [ ! -f "$TEST_AUDIO_PATH" ]; then
  echo -e "${YELLOW}Warning: Test audio file not found at ${TEST_AUDIO_PATH}${NC}"
  echo -e "Creating placeholder audio file notice..."
  mkdir -p tests/test-assets
  echo "Please add a real test audio file here named 'test-audio-english.mp3'" > tests/test-assets/README.md
fi

# Install Selenium and audio testing dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install --no-save selenium-webdriver@4.14.0 mocha@10.2.0 chromedriver@115.0.0

# Install Chrome and audio tools for testing
echo -e "\n${YELLOW}Setting up Chrome for audio testing...${NC}"
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
apt-get update
apt-get install -y google-chrome-stable ffmpeg

# Run the audio E2E tests
echo -e "\n${YELLOW}Running audio E2E tests against:${NC} $APP_URL"
APP_URL=$APP_URL OPENAI_API_KEY=$OPENAI_API_KEY npx mocha tests/selenium/audio-e2e-test.js --timeout 60000 --reporter spec

# Capture exit code
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}Audio E2E tests passed successfully!${NC}"
else
  echo -e "\n${RED}Audio E2E tests failed with exit code:${NC} $EXIT_CODE"
fi

exit $EXIT_CODE
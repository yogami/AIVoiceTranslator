#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}AIVoiceTranslator Selenium Tests${NC}"
echo -e "${YELLOW}===============================${NC}"

# Check if application URL is provided
if [ -z "$APP_URL" ]; then
  APP_URL="https://AIVoiceTranslator.replit.app"
  echo -e "${YELLOW}Using default APP_URL:${NC} $APP_URL"
fi

# Install Selenium dependencies
echo -e "\n${YELLOW}Installing Selenium dependencies...${NC}"
npm install --no-save selenium-webdriver@4.14.0 mocha@10.2.0 chromedriver@115.0.0

# Install Chrome for headless testing
echo -e "\n${YELLOW}Setting up Chrome for headless testing...${NC}"
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
apt-get update
apt-get install -y google-chrome-stable

# Run Selenium tests
echo -e "\n${YELLOW}Running Selenium tests against:${NC} $APP_URL"
APP_URL=$APP_URL npx mocha tests/selenium/ui-tests.js --timeout 30000 --reporter spec

# Capture exit code
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}Selenium tests passed successfully!${NC}"
else
  echo -e "\n${RED}Selenium tests failed with exit code:${NC} $EXIT_CODE"
fi

exit $EXIT_CODE
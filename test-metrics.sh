#!/bin/bash

# Set up colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  AIVoiceTranslator Metrics Tests   ${NC}"
echo -e "${GREEN}=====================================${NC}"

echo -e "\n${YELLOW}Testing Metrics API Endpoints...${NC}"
node test-metrics-api.js

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}All metrics tests passed successfully!${NC}"
  exit 0
else
  echo -e "\n${RED}Some metrics tests failed!${NC}"
  exit 1
fi
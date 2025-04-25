#!/bin/bash

# Set up colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   Benedictaitor WebSocket Tests    ${NC}"
echo -e "${GREEN}=====================================${NC}"

echo -e "\n${YELLOW}Testing WebSocket Client...${NC}"
npx tsx test-websocket-client.ts

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}WebSocket client tests passed!${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}Some WebSocket client tests failed!${NC}"
  EXIT_CODE=1
fi

echo -e "\n${GREEN}All tests completed!${NC}"
exit $EXIT_CODE
#!/bin/bash

# Classroom Simulation Load Test Runner
# 
# This script runs the classroom simulation load test which is intended
# for staging/production deployment validation only.
# 
# These tests are resource-intensive and not meant to run in regular CI/CD pipelines.

# Text formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   CLASSROOM SIMULATION LOAD TEST RUNNER     ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo

# Check if server is running
if ! curl -s http://localhost:5000/health > /dev/null; then
  echo -e "${RED}Error: Server not running on port 5000${NC}"
  echo -e "${YELLOW}Please start the server first with: npm run dev${NC}"
  exit 1
fi

# Ensure uuid package is installed
if ! npm list | grep -q uuid; then
  echo -e "${YELLOW}Installing required dependencies...${NC}"
  npm install uuid
fi

# Optional parameters
SERVER_URL=${1:-"ws://localhost:5000/ws"}
NUM_STUDENTS=${2:-25}

# Export variables for the test
export TEST_SERVER_URL="$SERVER_URL"
export TEST_NUM_STUDENTS="$NUM_STUDENTS"

echo -e "${YELLOW}Running classroom simulation with:${NC}"
echo -e "  - Server: ${SERVER_URL}"
echo -e "  - Students: ${NUM_STUDENTS}"
echo

# Create test results directory if it doesn't exist
mkdir -p test-results

# Run the load test
echo -e "${GREEN}Starting classroom simulation load test...${NC}"
node tests/load-tests/classroom_simulation_load_test.js

# Get the exit code
EXIT_CODE=$?

# Check results
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}Load test completed successfully!${NC}"
else
  echo -e "\n${RED}Load test failed!${NC}"
fi

echo -e "\n${BLUE}Complete test results are available in the test-results directory.${NC}"
echo -e "${YELLOW}Note: These load tests should only be run before staging/production deployments.${NC}"

exit $EXIT_CODE
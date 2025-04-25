#!/bin/bash

# Run tests script for Benedictaitor
# This script provides a convenient way to run different levels of tests
# according to the testing pyramid

# Set up colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}    Benedictaitor Test Runner       ${NC}"
echo -e "${GREEN}=====================================${NC}"

# Function to run unit tests
run_unit_tests() {
  echo -e "\n${YELLOW}Running Unit Tests...${NC}"
  npx jest tests/unit
}

# Function to run only non-websocket tests (for Replit environment)
run_safe_tests() {
  echo -e "\n${YELLOW}Running Safe Tests (excluding WebSocket tests)...${NC}"
  # The --testPathIgnorePatterns flag excludes WebSocket test files
  npx jest --testPathIgnorePatterns="websocket"
}

# Function to run integration tests
run_integration_tests() {
  echo -e "\n${YELLOW}Running Integration Tests...${NC}"
  npx jest tests/integration
}

# Function to run e2e tests
run_e2e_tests() {
  echo -e "\n${YELLOW}Running End-to-End Tests...${NC}"
  npx jest tests/e2e
}

# Function to run all tests
run_all_tests() {
  echo -e "\n${YELLOW}Running All Tests...${NC}"
  npx jest
}

# Function to run tests with coverage
run_coverage() {
  echo -e "\n${YELLOW}Running Tests with Coverage Report...${NC}"
  npx jest --coverage
}

# Check command line arguments
case "$1" in
  "unit")
    run_unit_tests
    ;;
  "integration")
    run_integration_tests
    ;;
  "e2e")
    run_e2e_tests
    ;;
  "all")
    run_all_tests
    ;;
  "coverage")
    run_coverage
    ;;
  "safe")
    run_safe_tests
    ;;
  *)
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  $0 unit        - Run unit tests"
    echo -e "  $0 integration - Run integration tests"
    echo -e "  $0 e2e         - Run end-to-end tests"
    echo -e "  $0 all         - Run all tests"
    echo -e "  $0 coverage    - Run tests with coverage report"
    echo -e "  $0 safe        - Run only non-WebSocket tests (for Replit)"
    ;;
esac

echo -e "\n${GREEN}Tests completed!${NC}"
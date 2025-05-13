#!/bin/bash

# Script to run all translation-related tests

# Set colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Running All Translation Tests =====${NC}"
echo 

# Check if test results directory exists, if not create it
if [ ! -d "test-results" ]; then
  mkdir -p test-results
fi

# Function to run a test and log its output
run_test() {
  local test_name=$1
  local command=$2
  local output_file="test-results/${test_name}_$(date +%Y%m%d_%H%M%S).log"
  
  echo -e "${YELLOW}Running ${test_name}...${NC}"
  
  # Run the test command and capture exit code
  eval $command > $output_file 2>&1
  local exit_code=$?
  
  # Report result based on exit code
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ ${test_name} passed!${NC}"
  else
    echo -e "${RED}✗ ${test_name} failed! Check $output_file for details${NC}"
    echo -e "${RED}Last 10 lines of output:${NC}"
    tail -n 10 $output_file
  fi
  
  echo
  return $exit_code
}

# Variable to track overall status
ALL_PASSED=true

# Run TranslationService.spec.ts (ESM) tests using Vitest
echo -e "${YELLOW}===== TranslationService Tests (Vitest) =====${NC}"
run_test "TranslationService_Vitest" "node test-scripts/run-translation-tests.mjs"
if [ $? -ne 0 ]; then ALL_PASSED=false; fi

# Run Translation.test.ts (CommonJS) tests using Jest
echo -e "${YELLOW}===== Translation Facade Tests (Jest) =====${NC}"
run_test "Translation_Jest" "npx jest tests/unit/services/Translation.test.ts"
if [ $? -ne 0 ]; then ALL_PASSED=false; fi

# Final status report
echo -e "${YELLOW}===== Test Summary =====${NC}"
if [ "$ALL_PASSED" = true ]; then
  echo -e "${GREEN}All translation tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some translation tests failed. See logs in test-results directory.${NC}"
  exit 1
fi
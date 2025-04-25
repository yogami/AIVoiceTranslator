#!/bin/bash

# Script to run tests for the AIVoiceTranslator project
# Usage: ./run-tests.sh [test-type]
# Where test-type can be: unit, integration, e2e, audio, tts-autoplay, or all (default)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TEST_TYPE=${1:-"all"}

# Function to run tests and return success/failure
run_test() {
  local test_pattern=$1
  local test_name=$2
  
  echo -e "${BLUE}Running ${test_name} tests...${NC}"
  npx jest --testPathPattern=tests/${test_pattern}
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${test_name} tests passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${test_name} tests failed${NC}"
    return 1
  fi
}

# Check if OpenAI API key is available for integration and e2e tests
check_api_key() {
  if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}Warning: OPENAI_API_KEY environment variable is not set.${NC}"
    echo "Integration and E2E tests may fail without a valid API key."
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# Main execution
case $TEST_TYPE in
  "unit")
    run_test "unit" "Unit"
    exit $?
    ;;
    
  "integration")
    check_api_key
    run_test "integration" "Integration"
    exit $?
    ;;
    
  "e2e")
    check_api_key
    run_test "e2e" "End-to-End"
    exit $?
    ;;
    
  "audio")
    check_api_key
    run_test "audio" "Audio"
    exit $?
    ;;
    
  "all")
    echo -e "${BLUE}Running all tests...${NC}"
    
    # Keep track of overall success
    OVERALL_SUCCESS=0
    
    # Run unit tests
    run_test "unit" "Unit"
    UNIT_RESULT=$?
    [ $UNIT_RESULT -ne 0 ] && OVERALL_SUCCESS=1
    
    # Check API key before running other tests
    check_api_key
    
    # Run integration tests
    run_test "integration" "Integration" 
    INTEGRATION_RESULT=$?
    [ $INTEGRATION_RESULT -ne 0 ] && OVERALL_SUCCESS=1
    
    # Run E2E tests
    run_test "e2e" "End-to-End"
    E2E_RESULT=$?
    [ $E2E_RESULT -ne 0 ] && OVERALL_SUCCESS=1
    
    # Run audio tests
    run_test "audio" "Audio"
    AUDIO_RESULT=$?
    [ $AUDIO_RESULT -ne 0 ] && OVERALL_SUCCESS=1
    
    # Report overall results
    if [ $OVERALL_SUCCESS -eq 0 ]; then
      echo -e "\n${GREEN}✓ All tests passed successfully${NC}"
    else
      echo -e "\n${RED}✗ Some tests failed${NC}"
      
      # Show summary of failures
      [ $UNIT_RESULT -ne 0 ] && echo -e "${RED}✗ Unit tests failed${NC}"
      [ $INTEGRATION_RESULT -ne 0 ] && echo -e "${RED}✗ Integration tests failed${NC}"
      [ $E2E_RESULT -ne 0 ] && echo -e "${RED}✗ End-to-End tests failed${NC}"
      [ $AUDIO_RESULT -ne 0 ] && echo -e "${RED}✗ Audio tests failed${NC}"
    fi
    
    exit $OVERALL_SUCCESS
    ;;
    
  *)
    echo -e "${RED}Error: Invalid test type '${TEST_TYPE}'${NC}"
    echo "Usage: ./run-tests.sh [test-type]"
    echo "Where test-type can be: unit, integration, e2e, audio, or all (default)"
    exit 1
    ;;
esac
#!/bin/bash
# TTS Service Test Suite Runner
# This script runs all TTS service-related tests and updates the dashboard

# Terminal colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}     TTS Service Test Suite Runner     ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Run the TTS service selection tests
echo -e "${YELLOW}Running TTS service selection tests...${NC}"
./tests/run-tts-selection-tests.sh
TTS_SELECTION_STATUS=$?

# Run other TTS-related tests (could be added in the future)
# echo -e "${YELLOW}Running additional TTS tests...${NC}"
# ./tests/run-other-tts-tests.sh
# OTHER_TTS_STATUS=$?

# Trigger GitHub Actions workflow if token is available
if [ ! -z "$GITHUB_TOKEN" ]; then
  echo -e "${YELLOW}Triggering GitHub Actions workflow for TTS service tests...${NC}"
  echo -e "${YELLOW}Using repository CI/CD trigger script...${NC}"
  
  # Add TTS service tests to the payload in ci-cd-trigger.sh (if needed)
  # This has already been done in earlier steps
  
  # Run the trigger script
  ./ci-cd-trigger.sh
  GITHUB_TRIGGER_STATUS=$?
  
  if [ $GITHUB_TRIGGER_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ GitHub Actions workflow triggered successfully!${NC}"
  else
    echo -e "${RED}❌ Failed to trigger GitHub Actions workflow!${NC}"
  fi
else
  echo -e "${YELLOW}GITHUB_TOKEN not set. Skipping GitHub Actions workflow trigger.${NC}"
  echo -e "${YELLOW}To trigger CI/CD pipeline, set GITHUB_TOKEN environment variable.${NC}"
fi

# Update metrics dashboard data
echo -e "${YELLOW}Updating metrics dashboard with test results...${NC}"
node test-metrics-api.js --test-type=e2e --test-name=tts-service-selection --update-results

# Report final status
if [ $TTS_SELECTION_STATUS -eq 0 ]; then
  echo -e "${GREEN}✅ All TTS service tests completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some TTS service tests failed!${NC}"
  exit 1
fi
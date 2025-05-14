#!/bin/bash

# AIVoiceTranslator Comprehensive Test Runner Script
# 
# This script orchestrates our hybrid testing strategy:
# - Vitest for ESM modules with specific compatibility issues (TranslationService)
# - Jest for other components (WebSocketService, etc.)
#
# It provides colorful output and summary information for all tests

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Print header
function print_header {
  echo -e "\n${CYAN}===============================================${RESET}"
  echo -e "${CYAN}====${RESET} $1 ${CYAN}====${RESET}"
  echo -e "${CYAN}===============================================${RESET}\n"
}

# Print success message
function print_success {
  echo -e "${GREEN}✓ $1${RESET}"
}

# Print error message
function print_error {
  echo -e "${RED}✗ $1${RESET}"
}

# Print info message
function print_info {
  echo -e "${BLUE}ℹ $1${RESET}"
}

# Track overall success/failure
OVERALL_SUCCESS=true

# Change to project root
cd "$(dirname "$0")/.."

# Print welcome message
print_header "AIVoiceTranslator Testing Suite"
print_info "Running comprehensive test suite with hybrid strategy"

# Step 1: Run TranslationService tests with Vitest
print_info "Running TranslationService tests with Vitest..."
node ./test-scripts/run-translation-tests.mjs
if [ $? -eq 0 ]; then
  print_success "TranslationService tests passed!"
else
  print_error "TranslationService tests failed!"
  OVERALL_SUCCESS=false
fi

# Step 2: Run WebSocketService tests with Jest
print_info "Running WebSocketService tests with Jest..."
node ./test-scripts/run-websocket-tests.js
if [ $? -eq 0 ]; then
  print_success "WebSocketService tests passed!"
else
  print_error "WebSocketService tests failed!"
  OVERALL_SUCCESS=false
fi

# Print summary
print_header "Test Suite Summary"
if [ "$OVERALL_SUCCESS" = true ]; then
  print_success "All tests completed successfully!"
  echo -e "\n${GREEN}AIVoiceTranslator test suite passed!${RESET}"
  exit 0
else
  print_error "Some tests failed! Please check the logs above."
  echo -e "\n${RED}AIVoiceTranslator test suite failed!${RESET}"
  exit 1
fi
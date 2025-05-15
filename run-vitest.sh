#!/bin/bash

# Set the test environment variables
export NODE_ENV=test
export SKIP_THEME_PLUGIN=true

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Define the Vitest config file path
VITEST_CONFIG="--config=test-config/vitest/vitest.no-theme.mjs"

# Function to run unit tests
run_unit_tests() {
  echo -e "${YELLOW}Running unit tests with Vitest...${NC}"
  npx vitest run $VITEST_CONFIG --testMatch "tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)"
}

# Function to run specific test file
run_specific_test() {
  echo -e "${YELLOW}Running specific test file: $1${NC}"
  npx vitest run $VITEST_CONFIG "$@"
}

# Function to run tests with coverage
run_coverage() {
  echo -e "${YELLOW}Running tests with coverage...${NC}"
  npx vitest run $VITEST_CONFIG --coverage
}

# Function to run tests in watch mode
run_watch() {
  echo -e "${YELLOW}Running tests in watch mode...${NC}"
  npx vitest $VITEST_CONFIG
}

# Clean test output
clean_tests() {
  echo -e "${YELLOW}Cleaning test output...${NC}"
  rm -rf coverage
}

# Parse command line arguments
case "$1" in
  "unit")
    run_unit_tests
    ;;
  "coverage")
    run_coverage
    ;;
  "watch")
    run_watch
    ;;
  "clean")
    clean_tests
    ;;
  "file")
    if [ -z "$2" ]; then
      echo -e "${RED}Error: You must specify a test file path${NC}"
      exit 1
    fi
    run_specific_test "$2"
    ;;
  *)
    echo -e "${GREEN}Usage: $0 {unit|coverage|watch|clean|file}${NC}"
    echo "  unit       - Run unit tests"
    echo "  coverage   - Run tests with coverage"
    echo "  watch      - Run tests in watch mode"
    echo "  clean      - Clean test output"
    echo "  file <path> - Run a specific test file"
    exit 1
    ;;
esac

exit 0
#!/bin/bash

# Set the test environment variables
export NODE_ENV=test

# Function to run unit tests
run_unit_tests() {
  echo "Running unit tests..."
  npx jest --testPathPattern=tests/unit
}

# Function to run specific test file
run_specific_test() {
  echo "Running specific test file: $1"
  npx jest "$1"
}

# Function to run integration tests
run_integration_tests() {
  echo "Running integration tests..."
  npx jest --testPathPattern=tests/integration
}

# Function to run e2e tests
run_e2e_tests() {
  echo "Running e2e tests..."
  npx playwright test
}

# Function to run all tests
run_all_tests() {
  run_unit_tests
  run_integration_tests
  run_e2e_tests
}

# Function to run tests with coverage
run_coverage() {
  echo "Running tests with coverage..."
  npx jest --coverage
}

# Clean test output
clean_tests() {
  echo "Cleaning test output..."
  rm -rf coverage
  rm -rf .jest-cache
}

# Parse command line arguments
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
  "clean")
    clean_tests
    ;;
  "file")
    if [ -z "$2" ]; then
      echo "Error: You must specify a test file path"
      exit 1
    fi
    run_specific_test "$2"
    ;;
  *)
    echo "Usage: $0 {unit|integration|e2e|all|coverage|clean|file}"
    echo "  unit       - Run unit tests"
    echo "  integration - Run integration tests"
    echo "  e2e        - Run end-to-end tests"
    echo "  all        - Run all tests"
    echo "  coverage   - Run tests with coverage"
    echo "  clean      - Clean test output"
    echo "  file <path> - Run a specific test file"
    exit 1
    ;;
esac

exit 0
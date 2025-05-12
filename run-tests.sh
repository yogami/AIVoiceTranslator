#!/bin/bash

# Set the test environment variables
export NODE_ENV=test

# Function to run unit tests
run_unit_tests() {
  echo "Running unit tests..."
  NODE_OPTIONS="--experimental-vm-modules" npx jest --testPathPattern=tests/unit --no-cache
}

# Function to run integration tests
run_integration_tests() {
  echo "Running integration tests..."
  NODE_OPTIONS="--experimental-vm-modules" npx jest --testPathPattern=tests/integration --no-cache
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
  NODE_OPTIONS="--experimental-vm-modules" npx jest --coverage --no-cache
}

# Clean test output
clean_tests() {
  echo "Cleaning test output..."
  rm -rf dist-tests
  rm -rf coverage
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
  *)
    echo "Usage: $0 {unit|integration|e2e|all|coverage|clean}"
    echo "  unit       - Run unit tests"
    echo "  integration - Run integration tests"
    echo "  e2e        - Run end-to-end tests"
    echo "  all        - Run all tests"
    echo "  coverage   - Run tests with coverage"
    echo "  clean      - Clean test output"
    exit 1
    ;;
esac

exit 0
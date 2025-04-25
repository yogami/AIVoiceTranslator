#!/bin/bash

# This script helps run tests without modifying package.json

# Make the script executable
chmod +x run-tests.sh

# Functions for Cypress test commands
run_cypress_tests() {
  echo "Running all Cypress end-to-end tests..."
  npx cypress run
}

open_cypress() {
  echo "Opening Cypress test runner..."
  npx cypress open
}

run_teacher_tests() {
  echo "Running teacher interface E2E tests..."
  npx cypress run --spec 'cypress/e2e/teacher-interface.cy.ts'
}

run_student_tests() {
  echo "Running student interface E2E tests..."
  npx cypress run --spec 'cypress/e2e/student-interface.cy.ts'
}

run_navigation_tests() {
  echo "Running navigation E2E tests..."
  npx cypress run --spec 'cypress/e2e/navigation.cy.ts'
}

# Functions for Jest test commands
run_jest_tests() {
  echo "Running all Jest unit tests..."
  npx jest
}

run_utils_tests() {
  echo "Running utility unit tests..."
  npx jest openai-utils
}

run_websocket_tests() {
  echo "Running WebSocket client unit tests..."
  npx jest websocket-client
}

# Functions to run simple tests
run_simple_tests() {
  echo "Running simple utility tests (no framework required)..."
  node run-simple-tests.js
}

run_simple_websocket_tests() {
  echo "Running simple WebSocket client tests (no framework required)..."
  node run-websocket-tests.js
}

run_simple_audio_tests() {
  echo "Running simple audio utilities tests (no framework required)..."
  node run-audio-utils-tests.js
}

# Show usage if no arguments provided
if [ "$#" -eq 0 ]; then
  echo "Usage: ./run-tests.sh [option]"
  echo "Options:"
  echo "  # Cypress E2E Tests (require system dependencies)"
  echo "  e2e            - Run all Cypress E2E tests"
  echo "  open           - Open Cypress test runner"
  echo "  teacher        - Run teacher interface E2E tests"
  echo "  student        - Run student interface E2E tests"
  echo "  navigation     - Run navigation E2E tests"
  echo ""
  echo "  # Jest Unit Tests (require Jest to be properly configured)"
  echo "  unit           - Run all Jest unit tests"
  echo "  utils          - Run utility unit tests with Jest"
  echo "  websocket      - Run WebSocket client unit tests with Jest"
  echo ""
  echo "  # Simple Tests (no dependencies or frameworks required)"
  echo "  simple         - Run simple utility tests"
  echo "  simple-websocket - Run simple WebSocket client tests"
  echo "  simple-audio   - Run simple audio utilities tests"
  echo "  all-simple     - Run all simple tests"
  exit 1
fi

# Parse command line argument
case "$1" in
  e2e)
    run_cypress_tests
    ;;
  open)
    open_cypress
    ;;
  teacher)
    run_teacher_tests
    ;;
  student)
    run_student_tests
    ;;
  navigation)
    run_navigation_tests
    ;;
  unit)
    run_jest_tests
    ;;
  utils)
    run_utils_tests
    ;;
  websocket)
    run_websocket_tests
    ;;
  simple)
    run_simple_tests
    ;;
  simple-websocket)
    run_simple_websocket_tests
    ;;
  simple-audio)
    run_simple_audio_tests
    ;;
  all-simple)
    run_simple_tests
    run_simple_websocket_tests
    run_simple_audio_tests
    ;;
  *)
    echo "Unknown option: $1"
    echo "Usage: ./run-tests.sh [e2e|open|teacher|student|navigation|unit|utils|websocket|simple|simple-websocket|simple-audio|all-simple]"
    exit 1
    ;;
esac
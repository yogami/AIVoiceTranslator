#!/bin/bash

# This script helps run Cypress tests without modifying package.json

# Make the script executable
chmod +x run-tests.sh

# Functions for different test commands
run_all_tests() {
  echo "Running all Cypress tests..."
  npx cypress run
}

open_cypress() {
  echo "Opening Cypress test runner..."
  npx cypress open
}

run_teacher_tests() {
  echo "Running teacher interface tests..."
  npx cypress run --spec 'cypress/e2e/teacher-interface.cy.ts'
}

run_student_tests() {
  echo "Running student interface tests..."
  npx cypress run --spec 'cypress/e2e/student-interface.cy.ts'
}

run_navigation_tests() {
  echo "Running navigation tests..."
  npx cypress run --spec 'cypress/e2e/navigation.cy.ts'
}

# Show usage if no arguments provided
if [ "$#" -eq 0 ]; then
  echo "Usage: ./run-tests.sh [option]"
  echo "Options:"
  echo "  all        - Run all tests"
  echo "  open       - Open Cypress test runner"
  echo "  teacher    - Run teacher interface tests"
  echo "  student    - Run student interface tests"
  echo "  navigation - Run navigation tests"
  exit 1
fi

# Parse command line argument
case "$1" in
  all)
    run_all_tests
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
  *)
    echo "Unknown option: $1"
    echo "Usage: ./run-tests.sh [all|open|teacher|student|navigation]"
    exit 1
    ;;
esac
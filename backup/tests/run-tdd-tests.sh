#!/bin/bash
# Run all automated tests for Benedictaitor
# Following TDD principles and proper test pyramid

echo "Running Benedictaitor TDD Test Suite"
echo "==================================="

# Run all tests with coverage report
npx jest --coverage

echo "\n✅ All tests completed"

# Generate and display detailed coverage summary
echo "\n📊 Code Coverage Summary"
echo "----------------------"
node generate-coverage-summary.js || echo "Failed to generate coverage summary"
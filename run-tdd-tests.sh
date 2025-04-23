#!/bin/bash
# Run all automated tests for Benedictaitor
# Following TDD principles and proper test pyramid

echo "Running Benedictaitor TDD Test Suite"
echo "==================================="

# Unit Tests
echo "\n🧪 Running Unit Tests"
echo "-------------------"
npx jest __tests__/unit/* --verbose

# Integration Tests
echo "\n🔄 Running Integration Tests"
echo "-------------------------"
npx jest __tests__/integration/* --verbose

# End-to-End Tests
echo "\n🌐 Running End-to-End Tests"
echo "-------------------------"
npx jest __tests__/e2e/* --verbose

echo "\n✅ All tests completed"
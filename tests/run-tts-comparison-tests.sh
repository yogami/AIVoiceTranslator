#!/bin/bash
# TTS Comparison Service Tests Runner
# This script runs the TTS comparison service end-to-end tests

# Set environment variables for testing
export NODE_ENV=test
export APP_URL=http://localhost:5000

# Ensure the server is running (assumes it's already started in a separate process)
echo "Checking if application server is running..."
curl -s http://localhost:5000/health > /dev/null
if [ $? -ne 0 ]; then
  echo "Error: Application server is not running. Please start it with 'npm run dev' first."
  exit 1
fi

# Run the TTS comparison tests
echo "Running TTS comparison end-to-end tests..."
npx mocha tests/e2e/tts-comparison.test.js --timeout 60000

# Check the test result
TEST_EXIT_CODE=$?
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ TTS comparison tests completed successfully!"
else
  echo "❌ TTS comparison tests failed with exit code $TEST_EXIT_CODE"
  exit $TEST_EXIT_CODE
fi

# Run the coverage report to update metrics
echo "Updating test coverage metrics..."
npx nyc report --reporter=text-summary

exit 0
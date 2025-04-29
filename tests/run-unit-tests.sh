#!/bin/bash
# Run unit tests with Node.js in ES modules mode

# Set environment variables for testing
export NODE_ENV=test

# Run the TTS comparison unit tests
echo "Running TTS comparison unit tests..."
node --experimental-vm-modules node_modules/mocha/bin/mocha.js tests/unit/tts-comparison.test.js --timeout 10000

# Check the test result
TEST_EXIT_CODE=$?
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ TTS comparison unit tests completed successfully!"
else
  echo "❌ TTS comparison unit tests failed with exit code $TEST_EXIT_CODE"
  exit $TEST_EXIT_CODE
fi

exit 0
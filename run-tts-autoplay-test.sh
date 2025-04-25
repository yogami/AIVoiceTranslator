#!/bin/bash

# Run TTS Autoplay Verification Test
# This script runs the Selenium-based TTS autoplay verification test 
# to ensure both OpenAI and Browser TTS services automatically play audio

echo "========================================================"
echo "  TTS AUTOPLAY VERIFICATION TEST"
echo "========================================================"
echo "This test verifies that browser speech automatically plays"
echo "when the autoPlay flag is set to true in the speech params."
echo 

# Check if the application is running
if ! curl -s http://localhost:5000 > /dev/null; then
  echo "⚠️  Application doesn't seem to be running on port 5000"
  echo "Please start the application first with 'npm run dev' and try again."
  exit 1
fi

# Ensure we have Selenium WebDriver installed
if ! npm list selenium-webdriver > /dev/null 2>&1; then
  echo "Installing Selenium WebDriver..."
  npm install selenium-webdriver
fi

# Ensure we have test directory for screenshots
mkdir -p tests/screenshots

# Set environment variables for the test
export TEST_URL="http://localhost:5000"

# Run the test
echo "Running TTS autoplay verification test..."
echo "------------------------------------------------------"
echo "Test output:"
echo 

# Create test run directory for this execution
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p test-results/tts-autoplay-tests/$timestamp

# Run the test and capture output
node tests/selenium/tts_autoplay_verification.js | tee test-results/tts-autoplay-tests/$timestamp/output.log

# Capture exit code
test_exit_code=${PIPESTATUS[0]}

echo 
echo "------------------------------------------------------"

# Check test result
if [ $test_exit_code -eq 0 ]; then
  echo "✅ TTS AUTOPLAY TEST PASSED"
else
  echo "❌ TTS AUTOPLAY TEST FAILED (exit code $test_exit_code)"
  echo "See test-results/tts-autoplay-tests/$timestamp/output.log for details"
fi

# Write test summary
cat > test-results/tts-autoplay-tests/$timestamp/summary.md << EOL
# TTS Autoplay Test Summary

- **Date:** $(date)
- **Status:** $([ $test_exit_code -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- **Target URL:** $TEST_URL
- **Test File:** tests/selenium/tts_autoplay_verification.js

## Details
The test $([ $test_exit_code -eq 0 ] && echo "successfully verified" || echo "failed to verify") that browser speech synthesis auto-plays when the autoPlay flag is set to true.

See [output.log](output.log) for the complete test output.
EOL

echo "Test summary written to test-results/tts-autoplay-tests/$timestamp/summary.md"
exit $test_exit_code
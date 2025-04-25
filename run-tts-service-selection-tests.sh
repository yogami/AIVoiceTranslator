#!/bin/bash
#
# TTS Service Selection Verification Test Runner
#
# This script runs the Selenium end-to-end tests for verifying TTS service selection.
# It is designed to be executed in a CI/CD environment with proper browser support.
#
# Usage: ./run-tts-service-selection-tests.sh
#

# Exit on error
set -e

# Configuration
TIMEOUT=120  # Timeout in seconds
LOG_DIR="test-results"
SCREENSHOT_DIR="$LOG_DIR/screenshots"
TEST_FILE="tests/selenium/verify_tts_service_selection.js"

# Create log directories
mkdir -p "$LOG_DIR"
mkdir -p "$SCREENSHOT_DIR"

echo "╔═════════════════════════════════════════════════════╗"
echo "║      TTS SERVICE SELECTION VERIFICATION TESTS       ║"
echo "╚═════════════════════════════════════════════════════╝"
echo ""

# Print system information
echo "Environment Information:"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
if command -v google-chrome &> /dev/null; then
    echo "Chrome version: $(google-chrome --version)"
fi
if command -v firefox &> /dev/null; then
    echo "Firefox version: $(firefox --version)"
fi
echo ""

# Check if chromedriver is installed
if ! command -v chromedriver &> /dev/null; then
    echo "ChromeDriver not found. Installing..."
    npm install --no-save chromedriver
fi

# Make sure server is not running from previous tests
echo "Stopping any running servers..."
pkill -f "node.*server" || true
sleep 2

# Start the server
echo "Starting server..."
npm run dev > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:5000 > /dev/null; then
        echo "Server is up and running!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Server failed to start within timeout"
        exit 1
    fi
    sleep 1
done

# Run the test with timeout
echo ""
echo "Running TTS service selection verification tests..."
echo "Test timeout: $TIMEOUT seconds"
echo ""

# Start timestamp
start_time=$(date +%s)

# Run the test with timeout
timeout $TIMEOUT node "$TEST_FILE" 2>&1 | tee "$LOG_DIR/test-output.log" || TEST_EXIT_CODE=$?

# End timestamp
end_time=$(date +%s)
duration=$((end_time - start_time))

# Clean up server
echo ""
echo "Stopping server..."
kill $SERVER_PID || true
sleep 2

# Display results
echo ""
echo "╔═════════════════════════════════════════════════════╗"
echo "║                     TEST RESULTS                    ║"
echo "╚═════════════════════════════════════════════════════╝"
echo ""
echo "Test Duration: $duration seconds"

# Check exit code
if [ ${TEST_EXIT_CODE:-0} -eq 0 ]; then
    echo "✅ PASSED: TTS Service Selection Tests"
    exit 0
else
    echo "❌ FAILED: TTS Service Selection Tests"
    echo "See log file for details: $LOG_DIR/test-output.log"
    
    # Display the last few lines of the log
    echo ""
    echo "Last 10 lines of test output:"
    tail -n 10 "$LOG_DIR/test-output.log"
    exit 1
fi
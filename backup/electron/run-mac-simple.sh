#!/bin/bash
# Super-simple Mac test runner - No dependencies required

echo "===================================="
echo "  Benedictaitor Simple Test Runner  "
echo "===================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Create temp directory
mkdir -p tests_output

# Show available tests
echo "Available tests:"
echo "1. WebSocket Test"
echo "2. Speech Test"
echo "3. Audio Utils Test"
echo "4. Real Hardware Test"
echo "5. E2E Selenium Test"
echo ""
echo "Enter test number to run (1-5) or 'q' to quit: "
read selection

case $selection in
  1)
    echo "Running WebSocket Test..."
    node tests/websocket-tests.js | tee tests_output/websocket-test-results.txt
    ;;
  2)
    echo "Running Speech Test..."
    node tests/speech-test.js | tee tests_output/speech-test-results.txt
    ;;
  3)
    echo "Running Audio Utils Test..."
    node tests/audio-utils-tests.js | tee tests_output/audio-utils-results.txt
    ;;
  4)
    echo "Running Real Hardware Test..."
    node tests/real-hardware-test.js | tee tests_output/hardware-test-results.txt
    ;;
  5)
    echo "Running E2E Selenium Test..."
    node tests/e2e-selenium-test.js | tee tests_output/e2e-test-results.txt
    ;;
  q)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid selection. Please run again and select 1-5."
    exit 1
    ;;
esac

echo ""
echo "Test completed. Results saved to tests_output/ directory."
echo "Press Enter to exit..."
read
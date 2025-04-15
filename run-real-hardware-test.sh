#!/bin/bash

# Run the real hardware test with proper environment setup
# This script is a simple wrapper for the more advanced run-real-audio-test.js script

echo "=== BENEDICTAITOR REAL HARDWARE TEST ==="
echo "This test uses your actual microphone and speakers to"
echo "evaluate the speech recognition capabilities of the system."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js to run this test"
    exit 1
fi

# Run the test script
node run-real-audio-test.js

# Exit with the same exit code as the test
exit $?
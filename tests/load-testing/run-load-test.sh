#!/bin/bash
# Load Testing Script for AIVoiceTranslator
# This script runs the load test with 50 concurrent connections

echo "Starting AIVoiceTranslator load test..."

# Ensure server is running
echo "Checking if server is running..."
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "Server doesn't appear to be running. Starting it..."
  npm run dev &
  SERVER_PID=$!
  echo "Waiting for server to start..."
  sleep 10
else
  echo "Server is already running."
fi

# Run the load test
echo "Running load test with 50 concurrent connections..."
node tests/load-testing/load-test.js

# If we started the server, shut it down
if [ ! -z "$SERVER_PID" ]; then
  echo "Shutting down server..."
  kill $SERVER_PID
fi

echo "Load testing complete. Results saved to tests/load-testing/results.json"
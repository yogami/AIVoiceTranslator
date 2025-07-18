#!/bin/bash
# Start backend server for E2E tests, run Cypress, then shut down the server

PORT=5001

# Kill any existing process on the test port
lsof -ti:$PORT | xargs kill -9 2>/dev/null

# Start backend server in background
npm run dev:test &
SERVER_PID=$!

# Wait for server to be ready (adjust as needed)
sleep 10

# Run Cypress E2E tests (all or specific spec)
if [ -n "$1" ]; then
  npx cypress run --spec "$1"
  TEST_EXIT_CODE=$?
else
  npx cypress run
  TEST_EXIT_CODE=$?
fi

# Kill backend server
kill $SERVER_PID

exit $TEST_EXIT_CODE

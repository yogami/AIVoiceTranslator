#!/bin/bash
# Start backend server for E2E tests, run Cypress, then shut down the server

PORT=5001

# Start backend server in background
npm run dev:test &
SERVER_PID=$!

# Wait for server to be ready (adjust as needed)
sleep 10

# Run Cypress E2E tests
npx cypress run
TEST_EXIT_CODE=$?

# Kill backend server

# Ensure backend server is killed on port 5001
npx kill-port 5001

exit $TEST_EXIT_CODE

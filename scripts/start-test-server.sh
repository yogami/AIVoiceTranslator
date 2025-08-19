#!/bin/bash
# Test server startup script that ensures proper environment isolation

set -e

# Clear any existing DATABASE_URL to ensure clean state
unset DATABASE_URL

# Load environment variables from .env.test file
if [ -f .env.test ]; then
  export $(grep -v '^#' .env.test | xargs)
else
  echo "Error: .env.test file not found"
  exit 1
fi

# Ensure critical environment variables are set and match Playwright webServer
# Default to development so Vite middleware serves pages in e2e
export NODE_ENV=${NODE_ENV:-development}
export E2E_TEST_MODE=true
export ANALYTICS_PASSWORD=""
export HOST=${HOST:-127.0.0.1}
export PORT=${PORT:-5001}
export VITE_PORT=${VITE_PORT:-5001}
export VITE_API_URL=${VITE_API_URL:-http://127.0.0.1:5001}
export VITE_WS_URL=${VITE_WS_URL:-ws://127.0.0.1:5001}
export FEATURE_TWO_WAY_COMMUNICATION=${FEATURE_TWO_WAY_COMMUNICATION:-1}
export LOG_LEVEL=${LOG_LEVEL:-debug}

# Start the server on HOST:PORT expected by Playwright
npx tsx server/index.ts

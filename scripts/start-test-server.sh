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

# Ensure critical environment variables are set
export NODE_ENV=test
export E2E_TEST_MODE=true
export ANALYTICS_PASSWORD=""

# Start the server
npx tsx server/index.ts

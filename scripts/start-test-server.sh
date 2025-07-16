#!/bin/bash
# Test server startup script that ensures proper environment isolation

set -e

# Clear any existing DATABASE_URL to ensure clean state
unset DATABASE_URL

# Export environment variables from .env.test
export NODE_ENV=test
export E2E_TEST_MODE=true
export LOG_LEVEL=info
export PORT=5001
export HOST=127.0.0.1
export DATABASE_URL=postgres://avnadmin:AVNS_Gr-3uSaTzidPW5i1EcP@pg-2a0a4062-aivoicetranslator.d.aivencloud.com:26621/defaultdb?sslmode=require
export ANALYTICS_PASSWORD=""

# Start the server
npx tsx server/index.ts

#!/bin/bash

# Script to run E2E tests with proper environment isolation
# This ensures that system environment variables don't interfere with test configuration

echo "🔧 Setting up E2E test environment..."

# Unset any system-level DATABASE_URL that might interfere
unset DATABASE_URL

# Verify the correct database URL is loaded from .env.test
echo "🔍 Verifying test database configuration..."
TEST_DB_URL=$(npx dotenv-cli -f .env.test -- node -e "console.log(process.env.DATABASE_URL)")
echo "✅ Test database URL: $TEST_DB_URL"

# Run the E2E tests with proper environment isolation
echo "🚀 Running E2E tests..."
NODE_ENV=test E2E_TEST_MODE=true npx dotenv-cli -f .env.test -- npx playwright test --config=test-config/playwright.config.ts "$@"

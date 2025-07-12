#!/bin/bash

# Clean Test Runner
# This script ensures tests run with a clean environment, using only .env.test variables

echo "🧹 Running tests with clean environment..."

# Temporarily unset DATABASE_URL to ensure .env.test takes precedence
unset DATABASE_URL

# Run the requested test command
exec "$@"

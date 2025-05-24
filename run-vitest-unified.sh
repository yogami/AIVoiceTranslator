#!/bin/bash

# Script to run Vitest with the unified configuration
# Usage: ./run-vitest-unified.sh [test-mode] [additional-options]
# Examples:
#   ./run-vitest-unified.sh           # Run all tests
#   ./run-vitest-unified.sh unit      # Run unit tests only
#   ./run-vitest-unified.sh integration # Run integration tests
#   ./run-vitest-unified.sh all --coverage # Run all tests with coverage

TEST_MODE=${1:-all}
shift 1 || true

echo "Running tests in mode: $TEST_MODE"
TEST_MODE=$TEST_MODE npx vitest --config test-config/vitest/vitest.unified.config.mjs "$@"
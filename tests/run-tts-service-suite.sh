#!/bin/bash
# TTS Comparison Service Test Suite Runner
# This script runs the complete test pyramid for the TTS comparison feature
# and updates the test metrics

set -e  # Exit on error

# Set environment variables for testing
export NODE_ENV=test
export APP_URL=http://localhost:5000
export TTS_SERVICE_TYPE=browser

# Display banner
echo "========================================================"
echo "      TTS Comparison Feature - Full Test Suite          "
echo "========================================================"
echo "Running tests at all levels of the testing pyramid..."
echo ""

# Create directory for test results
mkdir -p test-results

# 1. Run Unit Tests (Bottom of pyramid)
echo "========================================================"
echo "RUNNING UNIT TESTS"
echo "========================================================"
npx mocha tests/unit/tts-comparison.test.js --reporter spec
UNIT_RESULT=$?

if [ $UNIT_RESULT -eq 0 ]; then
  echo "✅ Unit tests PASSED"
else
  echo "❌ Unit tests FAILED with exit code $UNIT_RESULT"
  exit $UNIT_RESULT
fi

echo ""

# 2. Run Integration Tests (Middle of pyramid)
echo "========================================================"
echo "RUNNING INTEGRATION TESTS"
echo "========================================================"
npx mocha tests/integration/tts-comparison-integration.test.js --reporter spec
INTEGRATION_RESULT=$?

if [ $INTEGRATION_RESULT -eq 0 ]; then
  echo "✅ Integration tests PASSED"
else
  echo "❌ Integration tests FAILED with exit code $INTEGRATION_RESULT"
  exit $INTEGRATION_RESULT
fi

echo ""

# 3. Check if application server is running for E2E tests
echo "Checking if application server is running..."
curl -s http://localhost:5000/health > /dev/null
if [ $? -ne 0 ]; then
  echo "⚠️ Application server is not running. Starting server for E2E tests..."
  
  # Start server in background
  npm run dev &
  SERVER_PID=$!
  
  # Wait for server to start
  echo "Waiting for server to start..."
  for i in {1..30}; do
    if curl -s http://localhost:5000/health > /dev/null; then
      echo "Server started successfully."
      break
    fi
    
    if [ $i -eq 30 ]; then
      echo "❌ Server failed to start within timeout period."
      exit 1
    fi
    
    echo -n "."
    sleep 1
  done
  
  STARTED_SERVER=true
else
  echo "✅ Application server is already running."
  STARTED_SERVER=false
fi

# 4. Run E2E Tests (Top of pyramid)
echo "========================================================"
echo "RUNNING END-TO-END TESTS"
echo "========================================================"
echo "Running TTS Comparison E2E tests..."
npx mocha tests/e2e/tts-comparison.test.js --timeout 60000 --reporter spec
TTS_E2E_RESULT=$?

echo "Running Language Selector Modal E2E tests..."
npx mocha tests/e2e/language-selector-modal.test.js --timeout 60000 --reporter spec
LANG_E2E_RESULT=$?

# Combine results
if [ $TTS_E2E_RESULT -eq 0 ] && [ $LANG_E2E_RESULT -eq 0 ]; then
  E2E_RESULT=0
else
  E2E_RESULT=1
fi

if [ $E2E_RESULT -eq 0 ]; then
  echo "✅ End-to-end tests PASSED"
else
  echo "❌ End-to-end tests FAILED with exit code $E2E_RESULT"
  
  # Stop server if we started it
  if [ "$STARTED_SERVER" = true ]; then
    echo "Stopping server (PID: $SERVER_PID)..."
    kill $SERVER_PID
  fi
  
  exit $E2E_RESULT
fi

# Stop server if we started it
if [ "$STARTED_SERVER" = true ]; then
  echo "Stopping server (PID: $SERVER_PID)..."
  kill $SERVER_PID
fi

echo ""

# 5. Generate Coverage Report
echo "========================================================"
echo "GENERATING COVERAGE REPORT"
echo "========================================================"
npx nyc report --reporter=text-summary --reporter=html
COVERAGE_RESULT=$?

if [ $COVERAGE_RESULT -eq 0 ]; then
  echo "✅ Coverage report generated successfully"
  
  # Extract coverage percentage
  COVERAGE_PCT=$(npx nyc report --reporter=text-summary | grep "All files" | awk '{print $3}')
  echo "📊 Total code coverage: $COVERAGE_PCT"
else
  echo "⚠️ Failed to generate coverage report"
fi

echo ""

# 6. Update Metrics Dashboard
echo "========================================================"
echo "UPDATING TEST METRICS DASHBOARD"
echo "========================================================"

# Create metrics report
cat > test-results/tts-comparison-metrics.json << EOL
{
  "feature": "TTS Comparison",
  "lastRun": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "results": {
    "unit": {
      "status": "passed",
      "exitCode": $UNIT_RESULT
    },
    "integration": {
      "status": "passed",
      "exitCode": $INTEGRATION_RESULT
    },
    "e2e": {
      "status": "passed",
      "exitCode": $E2E_RESULT,
      "details": {
        "tts_comparison": {
          "status": $TTS_E2E_RESULT == 0 ? "\"passed\"" : "\"failed\"",
          "exitCode": $TTS_E2E_RESULT
        },
        "language_selector_modal": {
          "status": $LANG_E2E_RESULT == 0 ? "\"passed\"" : "\"failed\"",
          "exitCode": $LANG_E2E_RESULT
        }
      }
    }
  },
  "coverage": "${COVERAGE_PCT:-"unknown"}"
}
EOL

echo "✅ Test metrics updated successfully"
echo "📊 Metrics saved to: test-results/tts-comparison-metrics.json"

echo ""
echo "========================================================"
echo "           ALL TESTS COMPLETED SUCCESSFULLY             "
echo "========================================================"

exit 0
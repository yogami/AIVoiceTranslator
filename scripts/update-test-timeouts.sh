#!/bin/bash

# Script to update hardcoded timeout values in test files
# This replaces specific timeout patterns with environment-variable-based values

cd /Users/yamijala/gitprojects/AIVoiceTranslator

echo "Updating hardcoded timeout values in E2E tests..."

# File to update
TEST_FILE="tests/e2e/teacher.spec.ts"

# Update teacher registration timeouts (10000ms)
sed -i '' 's/timeout: 10000/timeout: testConfig.ui.teacherRegistrationTimeout/g' "$TEST_FILE"

# Update specific connection status timeouts 
sed -i '' 's/#connection-status.*Connected.*timeout: testConfig.ui.teacherRegistrationTimeout/#connection-status.*Connected.*timeout: testConfig.ui.connectionStatusTimeout/g' "$TEST_FILE"

# Update record button timeout (5000ms)
sed -i '' 's/timeout: 5000/timeout: testConfig.ui.recordButtonTimeout/g' "$TEST_FILE"

# Update speech recognition unavailable timeout (3000ms)  
sed -i '' 's/timeout: 3000/timeout: testConfig.ui.speechRecognitionUnavailableTimeout/g' "$TEST_FILE"

# Update remaining wait timeouts manually since they need context
echo "Manual updates needed for waitForTimeout calls - checking current state..."
grep -n "waitForTimeout" "$TEST_FILE"

echo "Timeout update script completed."

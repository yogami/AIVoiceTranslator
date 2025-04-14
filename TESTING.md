# Testing Guide for Benedictaitor

This document outlines the testing strategy and instructions for the Benedictaitor real-time voice translation application.

## Overview

The Benedictaitor project uses two testing approaches:

1. **Jest** for unit testing key utility functions and classes
2. **Cypress** for end-to-end testing of UI components and application logic

Both test suites ensure that the application works as expected, especially the microphone recording features and WebSocket communication.

## Test Structure

### Unit Tests (Jest)

Unit tests are organized in the `__tests__` directory and focus on testing individual components in isolation:

1. **OpenAI Utilities** (`__tests__/openai-utils.test.ts`)
   - Tests language code mapping functions
   - Verifies formatting utilities for latency and duration
   - Checks edge cases in utility functions

2. **WebSocket Client** (`__tests__/websocket-client.test.ts`)
   - Tests WebSocket connection and communication
   - Verifies event handling
   - Checks reconnection logic

### End-to-End Tests (Cypress)

E2E tests are organized in the `cypress/e2e` directory and test the application's overall functionality:

1. **Teacher Interface Tests** (`cypress/e2e/teacher-interface.cy.ts`)
   - Tests the recording functionality (start/stop)
   - Verifies UI state changes during recording
   - Checks audio visualization components

2. **Student Interface Tests** (`cypress/e2e/student-interface.cy.ts`)
   - Tests language selection
   - Verifies translation display
   - Checks connection status indicators

3. **Navigation Tests** (`cypress/e2e/navigation.cy.ts`)
   - Verifies routing between different application views
   - Tests navigation links
   - Checks URL parameters and state persistence

## Running Tests

We've included a convenient shell script to run tests without modifying package.json. Use the following commands:

### Unit Tests

#### Simple Tests (No Framework Required)

```bash
# Run simple utility tests
./run-tests.sh simple

# Run simple WebSocket client tests
./run-tests.sh simple-websocket

# Run simple audio utilities tests
./run-tests.sh simple-audio

# Run all simple tests
./run-tests.sh all-simple
```

These tests run directly with Node.js without requiring any testing framework, making them ideal for quick validation and environments where testing frameworks might be difficult to set up. They provide a lightweight alternative to the more complex testing frameworks.

#### Jest Tests (If Available)

```bash
# Run all unit tests with Jest
./run-tests.sh unit

# Run specific unit test categories with Jest
./run-tests.sh utils     # Run OpenAI utility tests
./run-tests.sh websocket # Run WebSocket client tests
```

Note: Jest tests require additional configuration and may not run in all environments due to dependency requirements.

### End-to-End Tests (Cypress)

```bash
# Run all E2E tests
./run-tests.sh e2e

# Open Cypress test runner GUI
./run-tests.sh open

# Run specific E2E test suites
./run-tests.sh teacher
./run-tests.sh student
./run-tests.sh navigation
```

## Mock Implementations

For consistent testing, we've implemented mocks for:

1. **WebSocket API** - Simulates server-client communication
2. **MediaRecorder API** - Emulates audio recording without requiring real microphone access
3. **MediaDevices API** - Provides simulated audio device data

These mocks ensure tests can run in CI environments and produce consistent results across different machines without relying on real hardware.

## Test Coverage

Our tests verify that:

### Simple Utility Tests
- Core utility functions work correctly with various inputs
- Language code to voice mapping is accurate
- Language code to name mapping is correct
- Time formatting functions handle edge cases properly

### WebSocket Tests
- WebSocket connection lifecycle works as expected
- Status changes are properly tracked and reported
- Messages are correctly sent and received
- Disconnection is handled gracefully

### Audio Utility Tests
- Blob to Base64 conversion functions correctly
- Base64 to ArrayBuffer conversion is accurate 
- Audio element creation from Base64 works properly
- Duration formatting handles various time inputs

### End-to-End Tests
- Recording can be started and stopped properly
- The UI accurately reflects the current application state
- Language selection works correctly
- Navigation between pages functions as expected
- Audio visualization components respond properly to state changes
- Error handling functions as designed

## Test Results and Interpretation

When running tests, you'll see output like this:

```
Testing getVoiceForLanguage:
  en-US -> alloy (expected: alloy)
  es -> shimmer (expected: shimmer)
  unknown -> alloy (expected: alloy)
```

This indicates:
- The test name ("Testing getVoiceForLanguage")
- Each test case with input (e.g., "en-US") and actual/expected output
- Whether the test passed (shown by matching values)

For WebSocket tests, success looks like:

```
Test 1: Connection management
  ✅ PASS: Initial status should be disconnected
  ...
  ✅ PASS: Status should be connected after connect()
```

Each ✅ indicates a passing assertion. If a test fails, you'll see ❌ with details about what went wrong, helping you quickly identify and fix issues.

## Running Tests in Different Environments

### Local Development
The Jest unit tests should run in any Node.js environment. The Cypress tests require additional system dependencies.

### CI/CD Integration
For CI/CD environments, the unit tests can be run without special configuration. For Cypress tests, you'll need to install the required system dependencies as specified in the Cypress documentation.

## Future Testing Improvements

- Add integration tests for the OpenAI API interactions
- Include performance testing for latency measurements
- Add more comprehensive error condition testing
- Add snapshot tests for UI components
- Implement API mocking for more reliable testing

## Troubleshooting Common Testing Issues

### Permission Issues
If you encounter "Permission denied" errors when running the test script:
```
bash: line 1: ./run-tests.sh: Permission denied
```
Fix by making the script executable:
```bash
chmod +x run-tests.sh
```

### TypeScript Errors in Test Files
The TypeScript compiler may show errors in test files due to:
1. Custom Cypress commands not being recognized
2. Jest types not being properly loaded
3. Missing type definitions for mock objects

These errors can be ignored if the tests run successfully, or you can add appropriate type definitions.

### Test Runner Dependencies
If you encounter errors with Jest or Cypress not being found:
1. Ensure all dependencies are installed
2. Fall back to the simple test runner which has no framework dependencies

### Environment-Specific Issues
On some platforms, WebSocket or MediaRecorder APIs may behave differently. Our tests include:
- Environment detection and fallbacks
- Browser API mocking for Node.js environment
- Robust error handling for missing APIs
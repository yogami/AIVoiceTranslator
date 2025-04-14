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

### Unit Tests (Jest)

```bash
# Run all unit tests
./run-tests.sh unit

# Run specific unit test categories
./run-tests.sh utils     # Run OpenAI utility tests
./run-tests.sh websocket # Run WebSocket client tests
```

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

- Core utility functions work correctly with various inputs
- WebSocket communication follows expected patterns
- Recording can be started and stopped properly
- The UI accurately reflects the current application state
- Language selection works correctly
- Navigation between pages functions as expected
- Audio visualization components respond properly to state changes
- Error handling functions as designed

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
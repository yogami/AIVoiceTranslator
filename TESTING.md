# Testing Guide for Benedictaitor

This document outlines the testing strategy and instructions for the Benedictaitor real-time voice translation application.

## Overview

The Benedictaitor project uses Cypress for end-to-end testing of both UI components and application logic. Tests ensure that all functionality works as expected, especially the microphone recording features and WebSocket communication.

## Test Structure

Tests are organized into three main categories:

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

```bash
# Run all tests
./run-tests.sh all

# Open Cypress test runner GUI
./run-tests.sh open

# Run specific test suites
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

Tests verify that:

- Recording can be started and stopped properly
- The UI accurately reflects the current application state
- Language selection works correctly
- Navigation between pages functions as expected
- Audio visualization components respond properly to state changes
- Error handling functions as designed

## Future Testing Improvements

- Add integration tests for the OpenAI API interactions
- Include performance testing for latency measurements
- Add more comprehensive error condition testing
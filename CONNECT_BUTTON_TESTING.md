# Connect Button Functionality Testing Guide

This document outlines the testing process for the Connect button functionality in the AIVoiceTranslator, focusing on CI/CD integration testing with Selenium.

## Testing Overview

The Connect button is a critical UI component in the student interface that establishes a WebSocket connection to the teacher's session. After recent code cleanup removing the TTS comparison functionality, it's essential to verify that the Connect button still works correctly.

## Local Testing vs CI/CD Testing

### Local Testing

For quick verification during development, you can use:

```bash
# Run WebSocket connection test (doesn't require browser)
node verify-connect-button.js
```

This test verifies that:
1. The WebSocket server accepts connections
2. Registration messages are properly processed
3. Success responses are returned

### CI/CD Testing

For comprehensive end-to-end testing in the CI/CD pipeline, we use Selenium with headless Chrome:

```bash
# This will be run automatically in the GitHub Actions workflow
node tests/selenium/verify_connect_button.js
```

The CI/CD test verifies that:
1. The student UI loads correctly
2. The Connect button is clickable
3. Clicking the button establishes a WebSocket connection
4. The UI updates correctly (disabled Connect button, enabled Disconnect button, status text)
5. The registration message is properly sent through the WebSocket

## GitHub Actions Workflow

The Connect button test is integrated into the CI/CD pipeline with GitHub Actions in `.github/workflows/connect-button-test.yml`. This workflow:

1. Sets up Node.js and Chrome
2. Installs dependencies
3. Starts the server
4. Runs the Selenium test in headless mode

## Debugging Test Failures

If the Connect button test fails in CI/CD:

1. Check the GitHub Actions logs for detailed error messages
2. Verify that the student interface HTML has properly functioning Connect and Disconnect buttons
3. Ensure the WebSocket server is correctly handling registration messages
4. Look for any CSS or JS errors that might prevent the UI from properly updating

## Known Issues and Solutions

### ChromeDriver Version Mismatch

If you see errors like `SessionNotCreatedException: session not created: This version of ChromeDriver only supports Chrome version X`, ensure that:

1. The ChromeDriver version matches the Chrome version in your CI/CD environment
2. The setup-chrome GitHub Action is properly configured

### Connection Timeout Issues

If tests timeout waiting for connections:

1. Check that the server is properly binding to the correct host/port
2. Verify that WebSocket paths are correctly configured
3. Ensure no firewalls or network restrictions are blocking WebSocket connections

## Manual Verification (Last Resort)

If automated tests are failing and you need to manually verify:

1. Launch the application locally
2. Open the student interface in a browser
3. Open browser developer tools to monitor WebSocket connections
4. Click the Connect button
5. Verify the WebSocket connection is established
6. Check that registration messages are sent and properly acknowledged

Manual verification should only be used as a last resort when automated tests cannot be fixed in a timely manner. The goal is to always rely on automated testing in the CI/CD pipeline.
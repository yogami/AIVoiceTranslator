# Comprehensive Automated Testing for AIVoiceTranslator

This document explains the advanced testing infrastructure for AIVoiceTranslator using Selenium WebDriver, with a focus on audio testing capabilities.

## Overview

We've set up a sophisticated CI/CD pipeline that automatically runs multiple test suites against the application whenever changes are pushed to the repository. This comprehensive testing approach ensures that all aspects of the application work as expected, including advanced audio processing features.

## Testing Philosophy

Following the London School of Test-Driven Development (TDD), our testing approach:
1. Prioritizes automation over manual testing
2. Follows a clear Arrange-Act-Assert pattern
3. Tests both individual components and full end-to-end flows
4. Ensures deterministic, repeatable results
5. Maintains a complete testing pyramid (unit, integration, end-to-end)

## How It Works

1. When you push changes to the repository (or trigger the CI/CD pipeline manually), the system:
   - Runs unit and integration tests for core functionality
   - Deploys the application to the target environment
   - Runs basic Selenium UI tests to verify interface functionality
   - Executes specialized audio end-to-end tests in a properly configured environment

2. The testing infrastructure verifies:
   - Teacher interface loads correctly and captures speech
   - Student interface loads correctly and plays translated audio
   - Audio translation pipeline functions properly
   - WebSocket connections handle real-time communication
   - End-to-end audio processing and translation completes successfully

## Triggering Tests

You can trigger the CI/CD pipeline (including Selenium tests) in two ways:

### Option 1: Using the CI/CD Trigger Script

```bash
./ci-cd-trigger.sh
```

This script:
- Pushes your changes to GitHub
- Triggers the GitHub Actions workflow
- Provides a link to view the test results

### Option 2: Push Directly to GitHub

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## Viewing Test Results

Test results are available on GitHub Actions:
https://github.com/yogami/AIVoiceTranslator/actions

## Types of Selenium Tests

The project includes two types of Selenium-based tests:

### 1. Basic UI Tests (`tests/selenium/ui-tests.js`)

These tests verify that the UI components load correctly and basic functionality works:
- Verify pages load correctly
- Check that important elements are present
- Test WebSocket connections are established
- Confirm metrics dashboard data loads

Run these tests with:
```bash
./tests/run-selenium-tests.sh
```

### 2. Audio End-to-End Tests (`tests/selenium/audio-e2e-test.js`)

These more advanced tests verify the complete audio flow:
- Run two browser instances (teacher and student)
- Simulate audio input on the teacher side
- Verify translation appears on the student side
- Test the complete pipeline including speech recognition and translation

Run these tests with:
```bash
./tests/run-audio-e2e-tests.sh
```

**Note:** Audio E2E tests require:
- A test audio file (MP3 format) in `tests/test-assets/`
- A valid OpenAI API key for translation
- Chrome with audio capabilities (non-headless mode)

## Writing New Selenium Tests

To add new Selenium tests:

1. Add them to the appropriate test file:
   - Basic UI tests: `tests/selenium/ui-tests.js`
   - Audio E2E tests: `tests/selenium/audio-e2e-test.js`
2. Follow the existing pattern of using WebDriver to interact with the application
3. Use assertions to verify expected behavior

Example:

```javascript
it('should have a working feature X', async function() {
  await driver.get(`${APP_URL}/page-with-feature-x.html`);
  
  // Interact with the feature
  const button = await driver.findElement(By.id('feature-button'));
  await button.click();
  
  // Wait for response
  await driver.wait(until.elementLocated(By.id('result')), 5000);
  
  // Verify the result
  const resultElement = await driver.findElement(By.id('result'));
  const resultText = await resultElement.getText();
  assert.equal(resultText, 'Expected Result');
});
```

## Test Environment

- The basic UI tests run in a headless Chrome browser on Ubuntu Linux.
- The audio E2E tests require a non-headless Chrome browser with audio capabilities.
- The application URL defaults to https://AIVoiceTranslator.replit.app but can be configured.
- Basic tests will time out after 30 seconds; audio tests after 60 seconds.

## Audio Testing Infrastructure

### Environment Setup

The audio testing environment in GitHub Actions includes specialized configuration:

1. **Virtual Display Server**: Using Xvfb to enable browser GUI operations in the headless CI environment
2. **Audio Device Support**: Virtual audio devices configured through ALSA
3. **Browser Configuration**: Chrome with media stream flags for audio testing
4. **Audio Asset Management**: Test audio files stored in version control

### Audio Testing Approaches

We support multiple approaches to test the audio capabilities:

1. **Full Browser Audio Testing**: Using two browser instances (teacher and student) to test the complete flow
2. **WebSocket Audio Testing**: Direct testing of the WebSocket API with simulated audio data
3. **Manual Audio Testing**: A script that connects to the WebSocket API and retrieves audio for manual verification

### Creating Test Audio Files

For audio E2E tests, you need test audio files in the `tests/test-assets/audio/` directory:

1. Create MP3 files with clear spoken English at 16kHz sampling rate
2. Name them according to language and purpose: `test-audio-english.mp3`, etc.
3. See `tests/test-assets/README.md` for detailed instructions and examples

## Troubleshooting

If Selenium tests are failing:

1. Check the GitHub Actions logs for detailed error messages
2. Verify that the application is deployed and accessible
3. Make sure the HTML elements being tested exist with the expected IDs/classes
4. For audio tests, verify:
   - The test audio file exists and is valid
   - The OpenAI API key is set and valid
   - Chrome is configured with audio capabilities
5. Check for timing issues (you may need to add waits for elements to load)
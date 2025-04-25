# Continuous Testing with Selenium for AIVoiceTranslator

This document explains the continuous testing setup for AIVoiceTranslator using Selenium WebDriver.

## Overview

We've set up a CI/CD pipeline that automatically runs Selenium tests against the deployed application whenever changes are pushed to the repository. This ensures that the application's UI and functionality continue to work as expected.

## How It Works

1. When you push changes to the repository (or trigger the CI/CD pipeline manually), the system:
   - Runs unit and API tests
   - Deploys the application to Replit
   - Runs Selenium UI tests against the deployed application

2. The Selenium tests verify:
   - Teacher interface loads correctly
   - Student interface loads correctly 
   - Metrics dashboard displays properly
   - WebSocket connections work as expected
   - End-to-end audio processing and translation (through special audio E2E tests)

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

## Creating Test Audio Files

For audio E2E tests, you need test audio files in the `tests/test-assets/` directory:

1. Create an MP3 file with clear spoken English
2. Name it `test-audio-english.mp3`
3. See `tests/test-assets/README.md` for detailed instructions

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
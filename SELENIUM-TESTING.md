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

## Writing New Selenium Tests

To add new Selenium tests:

1. Add them to the `tests/selenium/ui-tests.js` file
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

- The tests run in a headless Chrome browser on Ubuntu Linux.
- The application URL defaults to https://AIVoiceTranslator.replit.app but can be configured.
- Tests will time out after 30 seconds to prevent hanging runs.

## Troubleshooting

If Selenium tests are failing:

1. Check the GitHub Actions logs for detailed error messages
2. Verify that the application is deployed and accessible
3. Make sure the HTML elements being tested exist with the expected IDs/classes
4. Check for timing issues (you may need to add waits for elements to load)
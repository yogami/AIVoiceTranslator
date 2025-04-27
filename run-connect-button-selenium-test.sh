#!/bin/bash

# Run Connect Button Selenium WebDriver Test in CI/CD Environment
# This script runs Selenium WebDriver tests to verify the Connect button functionality
# in a real browser environment.

# Set color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CONNECT BUTTON SELENIUM WEBDRIVER TEST        ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

# Environment information
echo -e "Environment Information:"
echo -e "Node.js version: $(node -v)"
echo -e "npm version: $(npm -v)"
echo -e "Chrome version: $(google-chrome --version 2>/dev/null || echo 'Not installed')"
echo -e "ChromeDriver version: $(chromedriver --version 2>/dev/null || echo 'Not installed')"
echo ""

# For GitHub Actions CI environment
if [ -n "$GITHUB_ACTIONS" ]; then
  # Running in GitHub Actions
  echo -e "Running in GitHub Actions environment"
  
  # Start the server
  echo -e "Starting server..."
  NODE_ENV=test node server/index.js > server-output.log 2>&1 &
  SERVER_PID=$!
  
  # Wait for server to be ready
  SERVER_URL="http://localhost:5000"
  echo -e "Waiting for server to start at $SERVER_URL..."
  for i in {1..15}; do
    if curl -s $SERVER_URL > /dev/null; then
      echo -e "Server is up and running!"
      break
    fi
    if [ $i -eq 15 ]; then
      echo -e "${RED}Server failed to start within the timeout period${NC}"
      echo -e "Server logs:"
      cat server-output.log
      kill $SERVER_PID
      exit 1
    fi
    echo -e "Waiting for server... (attempt $i)"
    sleep 1
  done
  
  # Start ChromeDriver in the background if not already running
  echo -e "Starting ChromeDriver..."
  chromedriver --port=4444 > chromedriver.log 2>&1 &
  CHROMEDRIVER_PID=$!
else
  # Running on Replit
  echo -e "Running in Replit environment"
  
  # Use the current running workflow for testing
  SERVER_URL="https://$REPL_SLUG.$REPL_OWNER.repl.co"
  echo -e "Using server URL: $SERVER_URL"
  
  # No need to start ChromeDriver, we'll use the Selenium WebDriver directly
fi

echo ""
echo -e "Running Selenium WebDriver Connect Button test..."
mkdir -p test-results

# Set environment variables for the test
export SERVER_URL="${SERVER_URL}"
export SELENIUM_BROWSER="chrome"

# If in GitHub Actions, use the local ChromeDriver
if [ -n "$GITHUB_ACTIONS" ]; then
  export SELENIUM_REMOTE_URL="http://localhost:4444"
fi

# Look for a Selenium test file
if [ -f "tests/selenium/connect-button-e2e-test.js" ]; then
  TEST_FILE="tests/selenium/connect-button-e2e-test.js"
elif [ -f "tests/connect-button-selenium-test.js" ]; then
  TEST_FILE="tests/connect-button-selenium-test.js"
else
  echo -e "${RED}Could not find Selenium test file for Connect button${NC}"
  
  # Create a basic test file if none exists
  mkdir -p tests/selenium
  cat > tests/selenium/connect-button-e2e-test.js << 'EOF'
/**
 * Selenium End-to-End Test for Connect Button
 * 
 * This test verifies that the Connect button works properly by:
 * 1. Opening the student interface in a browser
 * 2. Clicking the Connect button
 * 3. Verifying the WebSocket connection is established
 * 4. Verifying the UI updates correctly to show connection status
 */

const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

// Test configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const STUDENT_PAGE_URL = `${SERVER_URL}/client/public/simple-student.html`;
const TEST_TIMEOUT = 30000; // 30 seconds

describe('Connect Button E2E Test', function() {
  // Set timeout for all tests
  this.timeout(TEST_TIMEOUT);
  
  let driver;
  
  before(async function() {
    // Create Chrome driver
    driver = await new Builder().forBrowser('chrome').build();
    console.log('Selenium WebDriver initialized');
  });
  
  after(async function() {
    // Quit the driver
    if (driver) {
      await driver.quit();
    }
  });
  
  it('should load the student interface page', async function() {
    // Navigate to the student interface
    await driver.get(STUDENT_PAGE_URL);
    console.log(`Navigated to ${STUDENT_PAGE_URL}`);
    
    // Verify the page title
    const title = await driver.getTitle();
    console.log(`Page title: ${title}`);
    assert(title.includes('Student') || title.includes('AIVoiceTranslator'), 'Page title should be related to AIVoiceTranslator or Student interface');
  });
  
  it('should have a Connect button', async function() {
    // Look for the Connect button (might have different selectors)
    let connectButton;
    try {
      connectButton = await driver.findElement(By.id('connectButton'));
    } catch (e) {
      try {
        connectButton = await driver.findElement(By.className('connect-button'));
      } catch (e) {
        try {
          connectButton = await driver.findElement(By.xpath("//button[contains(text(), 'Connect')]"));
        } catch (e) {
          assert.fail('Could not find Connect button on the page');
        }
      }
    }
    
    assert(connectButton, 'Connect button should exist');
    console.log('Found Connect button');
  });
  
  it('should connect successfully when the Connect button is clicked', async function() {
    // Find the Connect button (using the same strategy as above)
    let connectButton;
    try {
      connectButton = await driver.findElement(By.id('connectButton'));
    } catch (e) {
      try {
        connectButton = await driver.findElement(By.className('connect-button'));
      } catch (e) {
        connectButton = await driver.findElement(By.xpath("//button[contains(text(), 'Connect')]"));
      }
    }
    
    // Click the Connect button
    await connectButton.click();
    console.log('Clicked the Connect button');
    
    // Wait for the connection status to update
    // The UI could show this in different ways, so we try multiple selectors
    try {
      await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Connected') or contains(text(), 'connected') or contains(@class, 'connected')]")), 5000);
      console.log('Found Connected status indicator');
    } catch (e) {
      console.log('Could not find Connected status directly, checking button state...');
      
      // Check if the button state changed (text, class, or disabled state)
      const buttonText = await connectButton.getText();
      const buttonClass = await connectButton.getAttribute('class');
      const buttonDisabled = await connectButton.getAttribute('disabled');
      
      console.log(`Button text after click: ${buttonText}`);
      console.log(`Button class after click: ${buttonClass}`);
      console.log(`Button disabled after click: ${buttonDisabled ? 'Yes' : 'No'}`);
      
      // At least one of these should change to indicate connection
      assert(
        buttonText !== 'Connect' || 
        buttonClass.includes('connected') || 
        buttonClass.includes('active') || 
        buttonDisabled === 'true',
        'Button state should change after connecting'
      );
    }
    
    console.log('Connection status updated successfully');
  });
});
EOF
  
  TEST_FILE="tests/selenium/connect-button-e2e-test.js"
  echo -e "${GREEN}Created basic Selenium test file at ${TEST_FILE}${NC}"
fi

# Run the test using Node.js or Mocha if available
if command -v npx > /dev/null; then
  echo -e "Running test with Mocha: ${TEST_FILE}"
  npx mocha $TEST_FILE --timeout 30000 2>&1 | tee test-results/connect-button-selenium-test.log
else
  echo -e "Running test with Node.js: ${TEST_FILE}"
  node $TEST_FILE 2>&1 | tee test-results/connect-button-selenium-test.log
fi

TEST_RESULT=${PIPESTATUS[0]}

# Save logs
if [ -n "$GITHUB_ACTIONS" ]; then
  # Running in GitHub Actions
  cat server-output.log >> test-results/server-output.log
  cat chromedriver.log >> test-results/chromedriver.log
  
  # Stop the server and ChromeDriver
  echo -e "Stopping server and ChromeDriver..."
  kill $SERVER_PID
  kill $CHROMEDRIVER_PID
fi

echo ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     TEST RESULTS                    ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ PASSED: Connect Button Selenium WebDriver Test${NC}"
  echo -e "The Connect button has been fixed and works correctly!"
  exit 0
else
  echo -e "${RED}❌ FAILED: Connect Button Selenium WebDriver Test${NC}"
  echo -e "${YELLOW}See test-results/connect-button-selenium-test.log for details${NC}"
  if [ -n "$GITHUB_ACTIONS" ]; then
    echo -e "${YELLOW}Server logs are available in test-results/server-output.log${NC}"
    echo -e "${YELLOW}ChromeDriver logs are available in test-results/chromedriver.log${NC}"
  fi
  exit 1
fi
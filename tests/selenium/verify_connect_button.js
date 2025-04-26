/**
 * Selenium Test for Connect Button Functionality
 * 
 * This test verifies that the Connect button in the student interface works correctly.
 * It loads the student page, clicks the Connect button, and verifies successful connection.
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Test settings
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const STUDENT_PAGE_URL = `${SERVER_URL}/simple-student.html`;
const TEST_TIMEOUT = 15000;
const LOG_INTERVAL = 1000;

// Configure options for headless Chrome
function getChromeOptions() {
  console.log('Setting up Chrome options for headless testing...');
  
  const options = new chrome.Options();
  options.addArguments('--headless');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1280,1024');
  
  // Log Chrome version if available
  try {
    const chromeVersion = require('child_process').execSync('google-chrome --version').toString().trim();
    console.log(`Chrome version: ${chromeVersion}`);
  } catch (error) {
    console.log('Could not determine Chrome version');
  }
  
  return options;
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       CONNECT BUTTON TEST - SELENIUM WEBDRIVER                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`Testing student page at: ${STUDENT_PAGE_URL}`);
  
  let driver;
  let success = false;
  
  try {
    // Build the driver with Chrome options
    console.log('Initializing Chrome WebDriver...');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(getChromeOptions())
      .build();
    
    // Set script timeout for WebDriver
    await driver.manage().setTimeouts({ script: TEST_TIMEOUT });
    
    // Navigate to the student page
    console.log(`Navigating to student page: ${STUDENT_PAGE_URL}`);
    await driver.get(STUDENT_PAGE_URL);
    
    // Wait for the page to load and the Connect button to be available
    console.log('Waiting for page to load...');
    const connectButton = await driver.wait(
      until.elementLocated(By.id('connect-button')),
      TEST_TIMEOUT,
      'Connect button not found within timeout period'
    );
    
    // Before clicking, check the initial connection status
    const initialConnectionState = await driver.executeScript(function() {
      return {
        isConnected: window.isConnected || false,
        hasSessionId: !!window.sessionId,
        logContent: document.getElementById('log-container')?.textContent || 'Log not found'
      };
    });
    
    console.log('Initial connection state:');
    console.log(`- isConnected: ${initialConnectionState.isConnected}`);
    console.log(`- hasSessionId: ${initialConnectionState.hasSessionId}`);
    console.log('- Log content available: ' + (initialConnectionState.logContent.length > 0 ? 'Yes' : 'No'));
    
    // Check that we're not already connected
    assert.strictEqual(initialConnectionState.isConnected, false, 'Already connected before clicking button');
    
    // Click the Connect button
    console.log('Clicking Connect button...');
    await connectButton.click();
    
    // Wait for connection to be established - poll every second for status
    console.log('Waiting for WebSocket connection...');
    let isConnected = false;
    let hasSessionId = false;
    let attempts = 0;
    const maxAttempts = TEST_TIMEOUT / LOG_INTERVAL;
    
    while (attempts < maxAttempts) {
      // Poll connection status
      const connectionState = await driver.executeScript(function() {
        return {
          isConnected: window.isConnected || false,
          hasSessionId: !!window.sessionId,
          sessionId: window.sessionId || null,
          logContent: document.getElementById('log-container')?.textContent || 'Log not found'
        };
      });
      
      isConnected = connectionState.isConnected;
      hasSessionId = connectionState.hasSessionId;
      
      console.log(`Attempt ${attempts + 1}/${maxAttempts}:`);
      console.log(`- isConnected: ${isConnected}`);
      console.log(`- hasSessionId: ${hasSessionId}`);
      console.log(`- sessionId: ${connectionState.sessionId}`);
      
      // Check if connection is established and session ID is received
      if (isConnected && hasSessionId) {
        console.log('✅ Connection established successfully!');
        console.log(`- Session ID: ${connectionState.sessionId}`);
        
        // Print log content for debugging
        console.log('Log Content:');
        console.log(connectionState.logContent);
        
        success = true;
        break;
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, LOG_INTERVAL));
      attempts++;
    }
    
    // Check final results
    if (!success) {
      throw new Error('Timed out waiting for WebSocket connection to be established');
    }
    
    // Verify registration was successful by checking for success message
    const successMessage = await driver.executeScript(function() {
      const successElement = document.querySelector('.success-message');
      return successElement ? successElement.textContent : null;
    });
    
    console.log(`Success message: ${successMessage}`);
    if (successMessage && successMessage.includes('Connected')) {
      console.log('✅ Registration success message found');
    } else {
      console.log('⚠️ Registration success message not found, but connection was established');
    }
    
    // Final verification
    assert.strictEqual(isConnected, true, 'Should be connected after clicking button');
    assert.strictEqual(hasSessionId, true, 'Should have a session ID after connection');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('✅ Success: Connect Button Functionality Works Correctly');
    console.log('- Page loaded successfully');
    console.log('- Connect button clicked');
    console.log('- WebSocket connection established');
    console.log('- Session ID received');
    
    return true;
  } catch (error) {
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║                         TEST RESULTS                           ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('❌ Failed: Connect Button Functionality Test Failed');
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    
    // Try to get additional debug information
    if (driver) {
      try {
        const debugInfo = await driver.executeScript(function() {
          return {
            windowError: window.lastError || null,
            isConnected: window.isConnected || false,
            sessionId: window.sessionId || null,
            logContent: document.getElementById('log-container')?.textContent || 'Log not found'
          };
        });
        
        console.error('\nDebug information:');
        console.error(`- Window error: ${debugInfo.windowError}`);
        console.error(`- isConnected: ${debugInfo.isConnected}`);
        console.error(`- sessionId: ${debugInfo.sessionId}`);
        console.error('- Log content:');
        console.error(debugInfo.logContent);
      } catch (debugError) {
        console.error('Could not retrieve debug information:', debugError.message);
      }
    }
    
    return false;
  } finally {
    // Always quit the driver
    if (driver) {
      console.log('Closing WebDriver...');
      await driver.quit().catch(err => console.error('Error closing WebDriver:', err.message));
    }
  }
}

// Run the test directly if this script is executed directly
if (require.main === module) {
  (async () => {
    try {
      const success = await runTest();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Unhandled error in test:', error);
      process.exit(1);
    }
  })();
}

// Export for use in other scripts
module.exports = { runTest };
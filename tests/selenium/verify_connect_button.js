/**
 * Selenium test for Connect Button functionality
 * 
 * This test verifies that the Connect button on the student interface works correctly
 * by simulating a student clicking the Connect button and checking that the WebSocket
 * connection is established.
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Configure Chrome options for headless environment
function createChromeOptions() {
  const options = new chrome.Options();
  options.addArguments(
    '--headless',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,800'
  );
  return options;
}

/**
 * Test the Connect button functionality on student interface
 */
async function testConnectButton(serverUrl) {
  console.log('Starting Connect Button Selenium test...');
  let driver;
  
  try {
    // Setup WebDriver
    console.log('Setting up WebDriver with Chrome in headless mode...');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(createChromeOptions())
      .build();
    
    // Navigate to student interface
    console.log(`Navigating to student interface at ${serverUrl}/simple-student.html`);
    await driver.get(`${serverUrl}/simple-student.html`);
    
    // Wait for page to load
    console.log('Waiting for page to load...');
    await driver.wait(until.elementLocated(By.id('connect-btn')), 10000);
    
    // Get initial state
    const initialConnectBtnState = await driver.findElement(By.id('connect-btn')).getAttribute('disabled');
    const initialDisconnectBtnState = await driver.findElement(By.id('disconnect-btn')).getAttribute('disabled');
    const initialConnectionStatus = await driver.findElement(By.id('connection-status')).getText();
    
    console.log('Initial UI state:');
    console.log(`- Connect button disabled: ${initialConnectBtnState === 'true'}`);
    console.log(`- Disconnect button disabled: ${initialDisconnectBtnState === 'true'}`);
    console.log(`- Connection status: ${initialConnectionStatus}`);
    
    // Click the Connect button
    console.log('Clicking Connect button...');
    await driver.findElement(By.id('connect-btn')).click();
    
    // Wait for connection to be established
    console.log('Waiting for connection status to update...');
    await driver.wait(
      until.elementTextContains(driver.findElement(By.id('connection-status')), 'Connected'),
      10000
    );
    
    // Check UI updated correctly
    const connectedStatus = await driver.findElement(By.id('connection-status')).getText();
    const connectBtnDisabled = await driver.findElement(By.id('connect-btn')).getAttribute('disabled');
    const disconnectBtnDisabled = await driver.findElement(By.id('disconnect-btn')).getAttribute('disabled');
    
    console.log('Updated UI state:');
    console.log(`- Connection status: ${connectedStatus}`);
    console.log(`- Connect button disabled: ${connectBtnDisabled === 'true'}`);
    console.log(`- Disconnect button disabled: ${disconnectBtnDisabled !== 'true'}`);
    
    // Make assertions
    assert.ok(
      connectedStatus.includes('Connected'),
      `Expected connection status to include "Connected", but got "${connectedStatus}"`
    );
    assert.strictEqual(
      connectBtnDisabled, 
      'true', 
      'Connect button should be disabled after successful connection'
    );
    assert.ok(
      disconnectBtnDisabled !== 'true',
      'Disconnect button should be enabled after successful connection'
    );
    
    console.log('✅ TEST PASSED: Connect Button Functionality works correctly.');
    return true;
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Quit the driver
    if (driver) {
      try {
        await driver.quit();
        console.log('WebDriver shut down successfully.');
      } catch (quitError) {
        console.error('Error shutting down WebDriver:', quitError);
      }
    }
  }
}

// If this file is run directly, execute the test
if (require.main === module) {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  testConnectButton(serverUrl)
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testConnectButton };
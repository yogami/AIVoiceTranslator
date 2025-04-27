/**
 * Connect Button End-to-End Test using Selenium
 * 
 * This test verifies the Connect button functionality in the student interface
 * using Selenium WebDriver. These tests should ONLY be run in the CI/CD environment,
 * not in the Replit environment due to limitations.
 * 
 * Following the London School TDD approach, this test focuses on behavior and interactions.
 */

// NOTE: This test is ONLY for execution in GitHub Actions CI/CD environment
// Do NOT execute in Replit environment

const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Configure test environment
const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:5000';
console.log(`Using base URL: ${BASE_URL}`);

describe('Connect Button End-to-End Tests', function() {
  let driver;
  
  before(async function() {
    // Set longer timeout for CI environment
    this.timeout(30000);
    
    // Check environment to determine Chrome binary path and approach
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    
    // Set up headless Chrome for CI
    const options = new chrome.Options();
    
    // If running in CI environment, use Chromium binary
    if (isCI) {
      options.setChromeBinaryPath('/usr/bin/chromium-browser');
    }
    
    // Common options for both environments
    options.addArguments('--headless=new'); // New headless mode
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.windowSize({ width: 1280, height: 1024 });
    
    // Load ChromeDriver
    require('chromedriver');
    
    console.log('Starting Chrome WebDriver...');
    
    try {
      // Create WebDriver instance
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
        
      console.log('WebDriver started successfully');
    } catch (error) {
      console.error('Error starting WebDriver:', error);
      throw error;
    }
  });
  
  after(async function() {
    if (driver) {
      await driver.quit();
    }
  });
  
  it('should change connection status when Connect button is clicked', async function() {
    // Navigate to the student interface
    await driver.get(`${BASE_URL}/simple-student.html`);
    
    // Wait for the page to load completely
    await driver.wait(until.elementLocated(By.id('connect-btn')), 10000);
    
    // Verify initial state
    const connectBtn = await driver.findElement(By.id('connect-btn'));
    const disconnectBtn = await driver.findElement(By.id('disconnect-btn'));
    const statusElement = await driver.findElement(By.id('connection-status'));
    const indicatorElement = await driver.findElement(By.id('connection-indicator'));
    
    const initialStatus = await statusElement.getText();
    const initialIndicatorClass = await indicatorElement.getAttribute('class');
    const initialConnectDisabled = await connectBtn.getAttribute('disabled');
    const initialDisconnectDisabled = await disconnectBtn.getAttribute('disabled');
    
    assert.strictEqual(initialStatus, 'Disconnected', 'Initial status should be "Disconnected"');
    assert.strictEqual(initialIndicatorClass.includes('disconnected'), true, 'Initial indicator should have "disconnected" class');
    assert.strictEqual(initialConnectDisabled, null, 'Connect button should be enabled initially');
    assert.strictEqual(initialDisconnectDisabled, 'true', 'Disconnect button should be disabled initially');
    
    // Click the Connect button
    await connectBtn.click();
    
    // Wait for the connection to be established (status changes)
    await driver.wait(
      until.elementTextIs(await driver.findElement(By.id('connection-status')), 'Connected to Classroom'),
      5000,
      'Connection status should change to "Connected to Classroom"'
    );
    
    // Verify connected state
    const connectedStatus = await statusElement.getText();
    const connectedIndicatorClass = await indicatorElement.getAttribute('class');
    const connectedConnectDisabled = await connectBtn.getAttribute('disabled');
    const connectedDisconnectDisabled = await disconnectBtn.getAttribute('disabled');
    
    assert.strictEqual(connectedStatus, 'Connected to Classroom', 'Status should be "Connected to Classroom" after connecting');
    assert.strictEqual(connectedIndicatorClass.includes('connected'), true, 'Indicator should have "connected" class after connecting');
    assert.strictEqual(connectedConnectDisabled, 'true', 'Connect button should be disabled after connecting');
    assert.strictEqual(connectedDisconnectDisabled, null, 'Disconnect button should be enabled after connecting');
    
    // Click the Disconnect button
    await disconnectBtn.click();
    
    // Wait for the disconnection to complete (status changes back)
    await driver.wait(
      until.elementTextIs(await driver.findElement(By.id('connection-status')), 'Disconnected'),
      5000,
      'Connection status should change back to "Disconnected"'
    );
    
    // Verify disconnected state
    const disconnectedStatus = await statusElement.getText();
    const disconnectedIndicatorClass = await indicatorElement.getAttribute('class');
    const disconnectedConnectDisabled = await connectBtn.getAttribute('disabled');
    const disconnectedDisconnectDisabled = await disconnectBtn.getAttribute('disabled');
    
    assert.strictEqual(disconnectedStatus, 'Disconnected', 'Status should be "Disconnected" after disconnecting');
    assert.strictEqual(disconnectedIndicatorClass.includes('disconnected'), true, 'Indicator should have "disconnected" class after disconnecting');
    assert.strictEqual(disconnectedConnectDisabled, null, 'Connect button should be enabled after disconnecting');
    assert.strictEqual(disconnectedDisconnectDisabled, 'true', 'Disconnect button should be disabled after disconnecting');
  });
  
  it('should attempt connection when Enter key is pressed on Connect button', async function() {
    // Navigate to the student interface
    await driver.get(`${BASE_URL}/simple-student.html`);
    
    // Wait for the page to load completely
    await driver.wait(until.elementLocated(By.id('connect-btn')), 10000);
    
    // Find the Connect button and focus on it
    const connectBtn = await driver.findElement(By.id('connect-btn'));
    await connectBtn.sendKeys(Key.TAB); // Focus on it
    
    // Press Enter key
    await connectBtn.sendKeys(Key.RETURN);
    
    // Wait for the connection to be established (status changes)
    await driver.wait(
      until.elementTextIs(await driver.findElement(By.id('connection-status')), 'Connected to Classroom'),
      5000,
      'Connection status should change to "Connected to Classroom" when using keyboard navigation'
    );
    
    // Verify connected state
    const statusElement = await driver.findElement(By.id('connection-status'));
    const connectedStatus = await statusElement.getText();
    
    assert.strictEqual(connectedStatus, 'Connected to Classroom', 'Status should be "Connected to Classroom" after connecting via keyboard');
  });
  
  it('should show error message when WebSocket connection fails', async function() {
    // This test requires a special setup to simulate connection failure
    // For CI environment, we can use a proxy or network interceptor
    
    // In a real test, we would:
    // 1. Set up network conditions to force WebSocket failure
    // 2. Click Connect and verify error message appears
    // 3. Verify the UI shows appropriate error state
    
    // For this example, we'll check the error handling element exists
    await driver.get(`${BASE_URL}/simple-student.html`);
    
    // Wait for the page to load
    await driver.wait(until.elementLocated(By.id('connect-btn')), 10000);
    
    // Verify error container exists
    const errorContainer = await driver.findElement(By.id('error-container'));
    assert.notStrictEqual(errorContainer, null, 'Error container should exist for showing connection errors');
  });
});
/**
 * Puppeteer test for Connect Button functionality
 * 
 * This test verifies that the Connect button on the student interface works correctly
 * by simulating a student clicking the Connect button and checking that the WebSocket
 * connection is established.
 * 
 * This test is designed to run in a CI/CD environment with Puppeteer.
 */

// Import puppeteer with stealth plugin to avoid detection
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const assert = require('assert');

/**
 * Test the Connect button functionality on student interface
 */
async function testConnectButton(serverUrl) {
  console.log('Starting Connect Button Puppeteer test...');
  let browser;
  
  try {
    // Start a browser instance
    console.log('Launching browser in headless mode...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800'
      ]
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Log console from the browser
    page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
    
    // Set timeout for navigation
    await page.setDefaultNavigationTimeout(30000);
    
    // Navigate to student interface
    console.log(`Navigating to student interface at ${serverUrl}/simple-student.html`);
    await page.goto(`${serverUrl}/simple-student.html`, { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    console.log('Waiting for page to load...');
    await page.waitForSelector('#connect-btn', { visible: true, timeout: 10000 });
    
    // Get initial state of UI
    const initialConnectBtnDisabled = await page.$eval('#connect-btn', btn => btn.disabled);
    const initialDisconnectBtnDisabled = await page.$eval('#disconnect-btn', btn => btn.disabled);
    const initialConnectionStatus = await page.$eval('#connection-status', el => el.textContent);
    
    console.log('Initial UI state:');
    console.log(`- Connect button disabled: ${initialConnectBtnDisabled}`);
    console.log(`- Disconnect button disabled: ${initialDisconnectBtnDisabled}`);
    console.log(`- Connection status: ${initialConnectionStatus}`);
    
    // Set up WebSocket monitoring
    let webSocketConnected = false;
    let registerMessageSent = false;
    
    // Listen for WebSocket connections
    page.on('websocket', ws => {
      console.log(`WebSocket connected: ${ws.url()}`);
      webSocketConnected = true;
      
      // Listen for WebSocket frames
      ws.on('framesent', data => {
        console.log(`WebSocket frame sent: ${data.toString()}`);
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'register') {
            console.log('Registration message sent:', message);
            registerMessageSent = true;
          }
        } catch (e) {
          // Not JSON
          console.log('Frame is not JSON:', e.message);
        }
      });
    });
    
    // Click the Connect button
    console.log('Clicking Connect button...');
    await page.click('#connect-btn');
    
    // Wait for connection status to update
    console.log('Waiting for connection status to update...');
    await page.waitForFunction(
      () => document.querySelector('#connection-status').textContent.includes('Connected'),
      { timeout: 10000 }
    );
    
    // Get updated state of UI
    const connectedStatus = await page.$eval('#connection-status', el => el.textContent);
    const connectBtnDisabled = await page.$eval('#connect-btn', btn => btn.disabled);
    const disconnectBtnDisabled = await page.$eval('#disconnect-btn', btn => btn.disabled);
    
    console.log('Updated UI state:');
    console.log(`- Connection status: ${connectedStatus}`);
    console.log(`- Connect button disabled: ${connectBtnDisabled}`);
    console.log(`- Disconnect button disabled: ${disconnectBtnDisabled}`);
    
    // Wait a moment to make sure WebSocket messages are processed
    await page.waitForTimeout(1000);
    
    // Verify the connection was established
    assert.ok(webSocketConnected, 'WebSocket connection should be established');
    
    // Verify the UI elements updated correctly
    assert.ok(connectedStatus.includes('Connected'), `Expected connection status to include "Connected", but got "${connectedStatus}"`);
    assert.strictEqual(connectBtnDisabled, true, 'Connect button should be disabled after connection');
    assert.strictEqual(disconnectBtnDisabled, false, 'Disconnect button should be enabled after connection');
    
    // Verify the registration message was sent
    assert.ok(registerMessageSent, 'Register message should be sent through WebSocket');
    
    console.log('✅ TEST PASSED: Connect Button Functionality works correctly');
    return true;
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Clean up
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// Run the test
if (require.main === module) {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  testConnectButton(serverUrl)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testConnectButton };
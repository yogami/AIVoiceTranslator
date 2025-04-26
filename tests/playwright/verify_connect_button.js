/**
 * Playwright test for Connect Button functionality
 * 
 * This test verifies that the Connect button on the student interface works correctly
 * by simulating a student clicking the Connect button and checking that the WebSocket
 * connection is established.
 */

import { chromium } from 'playwright';
import assert from 'assert';

/**
 * Test the Connect button functionality on student interface
 */
async function testConnectButton(serverUrl) {
  console.log('Starting Connect Button Playwright test...');
  let browser;
  
  try {
    // Setup Browser
    console.log('Launching browser in headless mode...');
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Create a new context
    const context = await browser.newContext();
    
    // Create a new page
    const page = await context.newPage();
    
    // Enable console log collection
    page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
    
    // Enable WebSocket monitoring
    let webSocketConnected = false;
    let webSocketMessages = [];
    
    page.on('websocket', ws => {
      console.log(`WebSocket connected: ${ws.url()}`);
      webSocketConnected = true;
      
      ws.on('framesent', data => {
        try {
          const message = JSON.parse(data);
          console.log('WebSocket message sent:', message);
          webSocketMessages.push(message);
        } catch (e) {
          // Not JSON, ignore
        }
      });
      
      ws.on('framereceived', data => {
        try {
          const message = JSON.parse(data);
          console.log('WebSocket message received:', message);
          webSocketMessages.push(message);
        } catch (e) {
          // Not JSON, ignore
        }
      });
    });
    
    // Navigate to student interface
    console.log(`Navigating to student interface at ${serverUrl}/simple-student.html`);
    await page.goto(`${serverUrl}/simple-student.html`);
    
    // Wait for page to load
    console.log('Waiting for page to load...');
    await page.waitForSelector('#connect-btn', { state: 'visible' });
    
    // Get initial state
    const initialConnectBtnDisabled = await page.isDisabled('#connect-btn');
    const initialDisconnectBtnDisabled = await page.isDisabled('#disconnect-btn');
    const initialConnectionStatus = await page.textContent('#connection-status');
    
    console.log('Initial UI state:');
    console.log(`- Connect button disabled: ${initialConnectBtnDisabled}`);
    console.log(`- Disconnect button disabled: ${initialDisconnectBtnDisabled}`);
    console.log(`- Connection status: ${initialConnectionStatus}`);
    
    // Click the Connect button
    console.log('Clicking Connect button...');
    await page.click('#connect-btn');
    
    // Wait for connection to be established
    console.log('Waiting for connection status to update...');
    await page.waitForFunction(() => {
      const status = document.querySelector('#connection-status').textContent;
      return status.includes('Connected');
    }, { timeout: 10000 });
    
    // Check UI updated correctly
    const connectedStatus = await page.textContent('#connection-status');
    const connectBtnDisabled = await page.isDisabled('#connect-btn');
    const disconnectBtnDisabled = await page.isDisabled('#disconnect-btn');
    
    console.log('Updated UI state:');
    console.log(`- Connection status: ${connectedStatus}`);
    console.log(`- Connect button disabled: ${connectBtnDisabled}`);
    console.log(`- Disconnect button disabled: ${disconnectBtnDisabled}`);
    
    // Make assertions
    assert.ok(
      connectedStatus.includes('Connected'),
      `Expected connection status to include "Connected", but got "${connectedStatus}"`
    );
    assert.strictEqual(
      connectBtnDisabled, 
      true, 
      'Connect button should be disabled after successful connection'
    );
    assert.strictEqual(
      disconnectBtnDisabled,
      false,
      'Disconnect button should be enabled after successful connection'
    );
    
    // Check WebSocket message flow
    assert.ok(webSocketConnected, 'WebSocket connection should be established');
    
    // Find register message
    const registerMessage = webSocketMessages.find(msg => 
      msg.type === 'register' && msg.role === 'student'
    );
    
    assert.ok(
      registerMessage,
      'Should have sent a register message through the WebSocket'
    );
    
    console.log('✅ TEST PASSED: Connect Button Functionality works correctly.');
    return true;
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Close browser
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully.');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

// Automatically run the test if this is the main module
const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
testConnectButton(serverUrl)
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });

export { testConnectButton };
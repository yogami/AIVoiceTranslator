/**
 * Connect Button Functionality Verification
 * 
 * This script uses Puppeteer to directly test the Connect button
 * functionality in the student interface.
 */

import puppeteer from 'puppeteer';

async function testConnectButton() {
  console.log('Starting Connect Button functionality test with Puppeteer...');
  
  let browser;
  try {
    // Launch headless browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Open new page
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to student page
    console.log('Navigating to student interface...');
    await page.goto('http://localhost:5000/simple-student.html', { waitUntil: 'networkidle2' });
    
    // Set up WebSocket monitoring
    let wsConnected = false;
    let wsRegistrationSent = false;
    
    // Monitor WebSocket connections
    page.on('websocket', ws => {
      console.log(`WebSocket connected: ${ws.url()}`);
      wsConnected = true;
      
      ws.on('framesent', data => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'register') {
            console.log('Registration message sent:', message);
            wsRegistrationSent = true;
          }
        } catch (e) {
          // Not JSON, ignore
        }
      });
    });
    
    // Wait for page to be ready
    console.log('Waiting for page to be ready...');
    await page.waitForSelector('#connect-btn', { timeout: 5000 });
    
    // Click the Connect button
    console.log('Clicking Connect button...');
    await page.click('#connect-btn');
    
    // Wait for WebSocket connection to be established
    console.log('Waiting for WebSocket to connect...');
    await page.waitForFunction(() => {
      return document.querySelector('#connection-status').textContent.includes('Connected');
    }, { timeout: 5000 });
    
    // Verify the connection status UI
    const connectionStatus = await page.evaluate(() => {
      return document.querySelector('#connection-status').textContent;
    });
    
    // Verify UI elements state
    const connectBtnDisabled = await page.evaluate(() => {
      return document.querySelector('#connect-btn').disabled;
    });
    
    const disconnectBtnEnabled = await page.evaluate(() => {
      return !document.querySelector('#disconnect-btn').disabled;
    });
    
    // Check results
    const uiStateCorrect = connectionStatus.includes('Connected') && 
                           connectBtnDisabled && 
                           disconnectBtnEnabled;
    
    // Report results
    console.log('\n===== TEST RESULTS =====');
    console.log(`WebSocket connected: ${wsConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`Registration message sent: ${wsRegistrationSent ? '✅ Yes' : '❌ No'}`);
    console.log(`Connection status shows connected: ${connectionStatus.includes('Connected') ? '✅ Yes' : '❌ No'}`);
    console.log(`Connect button becomes disabled: ${connectBtnDisabled ? '✅ Yes' : '❌ No'}`);
    console.log(`Disconnect button becomes enabled: ${disconnectBtnEnabled ? '✅ Yes' : '❌ No'}`);
    
    if (wsConnected && uiStateCorrect) {
      console.log('\n✅ TEST PASSED: Connect button functionality works correctly');
      return true;
    } else {
      console.log('\n❌ TEST FAILED: Connect button functionality has issues');
      return false;
    }
  } catch (error) {
    console.error('Test error:', error);
    return false;
  } finally {
    // Close browser
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testConnectButton()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
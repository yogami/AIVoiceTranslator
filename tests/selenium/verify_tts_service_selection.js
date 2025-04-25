/**
 * TTS Service Selection End-to-End Test with Selenium
 * 
 * This script verifies that when a teacher selects a specific TTS service,
 * that selection is correctly propagated to student interfaces.
 * 
 * This test is designed to run in a CI/CD environment with:
 * - ChromeDriver and Firefox driver available
 * - Proper audio playback capability with headless flags
 * - Network access for WebSocket connections
 * 
 * Test flow:
 * 1. Open two browser windows (teacher and student)
 * 2. Set up WebSocket connections for both
 * 3. Set TTS service to 'browser' on teacher interface
 * 4. Send a test message from teacher
 * 5. Verify student receives with correct TTS service type
 * 6. Repeat with 'openai' TTS service
 * 7. Verify proper audio elements and playback
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const serverUrl = 'http://localhost:5000'; // Adjust based on your CI/CD setup
const studentPageUrl = `${serverUrl}/simple-student.html`;
const teacherPageUrl = `${serverUrl}/websocket-diagnostics.html`; // Using diagnostic page for teacher
const testTimeout = 30000; // 30 seconds for each test

// Test messages for each service type
const testMessages = {
  browser: "This is a test message for browser TTS service.",
  openai: "This is a test message for OpenAI TTS service.",
  silent: "This is a test message for silent mode (no audio)."
};

/**
 * Configure a Chrome driver with proper audio settings
 * @returns {WebDriver} Configured Chrome driver
 */
async function setupChromeDriver() {
  // Chrome options to enable audio in headless mode
  const options = new chrome.Options()
    .addArguments('--use-fake-ui-for-media-stream')     // Fake user media
    .addArguments('--use-fake-device-for-media-stream') // Fake devices for testing
    .addArguments('--allow-file-access-from-files')     // Needed for some audio operations
    .addArguments('--no-sandbox')                       // CI/CD compatibility
    .addArguments('--disable-dev-shm-usage')            // CI/CD compatibility
    .addArguments('--autoplay-policy=no-user-gesture-required'); // Allow autoplay

  // Uncomment for headless mode in CI/CD:
  // options.addArguments('--headless=new');

  return await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

/**
 * Start the server if not already running
 */
function ensureServerRunning() {
  try {
    // Simple check if server is responsive
    execSync(`curl -s ${serverUrl} > /dev/null`);
    console.log('Server already running, continuing...');
  } catch (error) {
    console.log('Starting server...');
    // This command would be adjusted based on your actual start command
    execSync('npm run dev > server.log 2>&1 &');
    // Wait for server to be ready
    execSync('sleep 5');
  }
}

/**
 * Run the complete TTS service selection test
 */
async function runTTSServiceSelectionTest() {
  let teacherDriver = null;
  let studentDriver = null;

  try {
    console.log('Setting up test environment...');
    ensureServerRunning();

    // Create browser instances
    teacherDriver = await setupChromeDriver();
    studentDriver = await setupChromeDriver();

    // Set timeout for async operations
    teacherDriver.manage().setTimeouts({ implicit: 10000, pageLoad: 10000, script: 10000 });
    studentDriver.manage().setTimeouts({ implicit: 10000, pageLoad: 10000, script: 10000 });

    // Open pages
    console.log('Opening teacher interface...');
    await teacherDriver.get(teacherPageUrl);
    
    console.log('Opening student interface...');
    await studentDriver.get(studentPageUrl);
    
    // Wait for pages to be fully loaded
    await teacherDriver.wait(until.elementLocated(By.id('connect-btn')), 10000);
    await studentDriver.wait(until.elementLocated(By.id('connect-btn')), 10000);

    // Connect teacher WebSocket
    console.log('Connecting teacher WebSocket...');
    await teacherDriver.findElement(By.id('connect-btn')).click();
    await teacherDriver.wait(until.elementLocated(By.css('.connected')), 5000);
    
    // Register as teacher
    await teacherDriver.findElement(By.id('role-select')).sendKeys('teacher');
    await teacherDriver.findElement(By.id('register-btn')).click();
    
    // Connect student WebSocket
    console.log('Connecting student WebSocket...');
    await studentDriver.findElement(By.id('connect-btn')).click();
    await studentDriver.wait(until.elementLocated(By.css('.connected')), 5000);
    
    // Select Spanish language for student
    await studentDriver.findElement(By.id('language-select')).sendKeys('es');
    
    // Test each TTS service type
    for (const service of ['browser', 'openai']) {
      console.log(`\n--- Testing ${service} TTS service ---`);
      
      // Set TTS service on teacher interface
      console.log(`Setting TTS service to: ${service}`);
      await teacherDriver.executeScript(`
        // Use the WebSocket instance directly
        const message = {
          type: 'settings',
          ttsServiceType: '${service}'
        };
        window.socket.send(JSON.stringify(message));
        console.log('Sent settings with TTS service: ${service}');
        return true;
      `);
      
      // Wait a bit for settings to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send test message from teacher
      const testMessage = testMessages[service];
      console.log(`Sending test message: "${testMessage}"`);
      await teacherDriver.executeScript(`
        const message = {
          type: 'transcription',
          text: "${testMessage}",
          languageCode: 'en-US'
        };
        window.socket.send(JSON.stringify(message));
        console.log('Sent test message');
        return true;
      `);
      
      // Wait for translation to appear in student interface
      console.log('Waiting for translation in student interface...');
      await studentDriver.wait(until.elementTextContains(
        By.id('translation-box'), 
        testMessage.substring(0, 10) // Look for the first part of the message
      ), 10000);
      
      // Verify TTS service used in student interface
      const translationBox = await studentDriver.findElement(By.id('translation-box'));
      const translationHtml = await translationBox.getAttribute('innerHTML');
      
      console.log('Verifying correct TTS service was used...');
      const expectedServiceText = service === 'browser' ? 'Browser Speech' : 'OpenAI TTS';
      
      // Check if the displayed service matches what we expect
      const hasCorrectService = translationHtml.includes(expectedServiceText);
      assert(hasCorrectService, `Failed to find "${expectedServiceText}" in translation display`);
      
      // Verify audio element is set up correctly for the service
      const audioSrc = await studentDriver.executeScript(`
        return document.getElementById('audio-player').src;
      `);
      
      if (service === 'silent') {
        // Silent mode should have no audio source
        assert(!audioSrc || audioSrc === '', 'Silent mode should not have audio source');
      } else {
        // Other modes should have audio source
        assert(audioSrc && audioSrc !== '', `${service} mode should have audio source`);
      }
      
      console.log(`✅ ${service} TTS service test PASSED`);
      
      // Wait a bit before next test
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ All TTS service selection tests PASSED');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    throw error;
  } finally {
    // Clean up
    if (teacherDriver) {
      await teacherDriver.quit();
    }
    if (studentDriver) {
      await studentDriver.quit();
    }
  }
}

// Run the test if executed directly
if (require.main === module) {
  (async function() {
    try {
      await runTTSServiceSelectionTest();
      process.exit(0);
    } catch (error) {
      console.error('Test execution failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  runTTSServiceSelectionTest
};
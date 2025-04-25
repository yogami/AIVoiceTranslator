/**
 * TTS Service Auto-Play Verification Test
 * 
 * This test verifies that both OpenAI TTS and Browser TTS services automatically 
 * play audio when a translation is received, providing a consistent user experience.
 * 
 * The test:
 * 1. Opens a teacher interface and a student interface in separate tabs
 * 2. Tests auto-play behavior with OpenAI TTS service
 * 3. Switches to Browser TTS service and verifies it also auto-plays
 * 4. Ensures the correct TTS service information is displayed
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
const TEACHER_URL = `${BASE_URL}/simple-speech-test.html`;
const STUDENT_URL = `${BASE_URL}/simple-student.html`;
const DIAGNOSTICS_URL = `${BASE_URL}/websocket-diagnostics.html`;
const TEST_TIMEOUT = 60000; // 60 seconds timeout for the entire test

async function runTest() {
  // Set up Chrome options for audio testing
  const options = new chrome.Options()
    .addArguments('--use-fake-ui-for-media-stream')       // Fake user media
    .addArguments('--use-fake-device-for-media-stream')   // Fake media devices
    .addArguments('--allow-file-access-from-files')       // Allow file access
    .addArguments('--no-sandbox')                         // Required for CI environments
    .addArguments('--disable-dev-shm-usage')              // Overcome limited resource issues
    .addArguments('--autoplay-policy=no-user-gesture-required') // Allow autoplay
    .addArguments('--headless')                          // Run in headless mode (no UI)
    .addArguments('--disable-gpu')                       // Recommended for headless
    .setChromeBinaryPath('/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser'); // Use the installed Chromium browser

  console.log('Starting WebDriver with Chromium (headless)...');
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log('Test starting: TTS Service Auto-Play Verification');

    // Step 1: Open WebSocket Diagnostics page to configure TTS service
    console.log('Opening WebSocket Diagnostics page to configure TTS service...');
    await driver.get(DIAGNOSTICS_URL);
    await driver.manage().setTimeouts({ implicit: 10000 });

    // Wait for Connect button to be available and click it
    const connectBtn = await driver.findElement(By.id('teacher-connect-btn'));
    await connectBtn.click();
    
    // Wait for connection to establish
    await driver.wait(
      until.elementTextContains(
        await driver.findElement(By.id('teacher-status')), 
        'Connected'
      ), 
      5000
    );
    console.log('Connected to WebSocket server as teacher');

    // Step 2: First set TTS service to OpenAI (to test before and after)
    console.log('Setting TTS service to OpenAI...');
    const openaiBtn = await driver.findElement(By.id('teacher-tts-openai-btn'));
    await openaiBtn.click();
    
    // Wait for TTS service update confirmation
    await driver.wait(
      until.elementTextContains(
        await driver.findElement(By.id('current-tts-service')), 
        'openai'
      ), 
      3000
    );
    console.log('Successfully set TTS service to OpenAI');

    // Step 3: Open a new tab for the Student interface
    await driver.executeScript('window.open()');
    const windows = await driver.getAllWindowHandles();
    await driver.switchTo().window(windows[1]);
    
    console.log('Opening Student interface...');
    await driver.get(STUDENT_URL);
    await driver.manage().setTimeouts({ implicit: 5000 });
    
    // Wait for the Student interface to load and connect
    const studentConnectBtn = await driver.findElement(By.id('connect-btn'));
    await studentConnectBtn.click();
    
    // Wait for student connection to establish
    await driver.wait(
      until.elementTextContains(
        await driver.findElement(By.id('connection-status')), 
        'Connected'
      ), 
      5000
    );
    console.log('Connected to WebSocket server as student');
    
    // Step 4: Switch back to Teacher tab
    await driver.switchTo().window(windows[0]);
    
    // Step 5: Send a test message with OpenAI TTS
    console.log('Sending test message with OpenAI TTS...');
    const messageInput = await driver.findElement(By.id('teacher-message'));
    await messageInput.sendKeys('This is a test message with OpenAI TTS service');
    
    const sendBtn = await driver.findElement(By.id('teacher-send-btn'));
    await sendBtn.click();
    
    // Step 6: Switch to student tab to verify auto-play behavior
    await driver.switchTo().window(windows[1]);
    
    // Wait for the translation to appear
    await driver.wait(
      until.elementLocated(By.css('.translation-card')),
      7000
    );
    
    // Check that the TTS service indicator shows OpenAI
    const ttsServiceIndicator = await driver.findElement(By.id('current-tts-service'));
    const openaiTtsText = await ttsServiceIndicator.getText();
    assert.ok(
      openaiTtsText.toLowerCase().includes('openai'), 
      `Expected TTS service indicator to show OpenAI, but got: ${openaiTtsText}`
    );
    console.log('Verified OpenAI TTS service is active in student interface');
    
    // Wait for audio to auto-play (look for "Playing..." indicator in logs)
    await driver.wait(
      until.elementLocated(By.xpath("//div[contains(text(), 'Playing with OpenAI TTS')]")),
      5000,
      'Timed out waiting for OpenAI TTS auto-play confirmation in logs'
    );
    console.log('Verified OpenAI TTS auto-play behavior');
    
    // Step 7: Switch back to Teacher tab to change TTS service to Browser
    await driver.switchTo().window(windows[0]);
    
    console.log('Changing TTS service to Browser...');
    const browserBtn = await driver.findElement(By.id('teacher-tts-browser-btn'));
    await browserBtn.click();
    
    // Wait for TTS service update confirmation
    await driver.wait(
      until.elementTextContains(
        await driver.findElement(By.id('current-tts-service')), 
        'browser'
      ), 
      3000
    );
    console.log('Successfully changed TTS service to Browser');
    
    // Step 8: Send another test message with Browser TTS
    console.log('Sending test message with Browser TTS...');
    await messageInput.clear();
    await messageInput.sendKeys('This is a test message with Browser TTS service');
    await sendBtn.click();
    
    // Step 9: Switch to student tab to verify Browser TTS auto-play behavior
    await driver.switchTo().window(windows[1]);
    
    // Wait for the new translation to appear and check for Browser TTS indicator
    await driver.wait(
      until.elementTextContains(
        await driver.findElement(By.id('current-tts-service')),
        'browser'
      ),
      5000
    );
    console.log('Verified Browser TTS service is active in student interface');
    
    // Wait for auto-play log message that should include "Auto-playing browser speech"
    await driver.wait(
      until.elementLocated(By.xpath("//div[contains(text(), 'Auto-playing browser speech') or contains(text(), 'Auto-playing browser speech synthesis due to autoPlay flag')]")),
      5000,
      'Timed out waiting for Browser TTS auto-play confirmation in logs'
    );
    
    // Get the actual log message to verify speech parameters parsing
    const autoPlayLogElement = await driver.findElement(
      By.xpath("//div[contains(text(), 'Auto-playing browser speech') or contains(text(), 'Auto-playing browser speech synthesis due to autoPlay flag')]")
    );
    const autoPlayLogText = await autoPlayLogElement.getText();
    console.log('Found auto-play log message:', autoPlayLogText);
    
    // Verify the autoPlay flag is explicitly mentioned and is set to true
    assert.ok(
      autoPlayLogText.includes('autoPlay flag') || autoPlayLogText.includes('autoPlay = true'),
      'autoPlay flag was not explicitly mentioned in log message'
    );
    
    console.log('Verified Browser TTS auto-play behavior with autoPlay flag');
    
    // Step 10: Verify TTS service update is reflected in UI
    const finalTtsIndicator = await driver.findElement(By.id('current-tts-service'));
    const browserTtsText = await finalTtsIndicator.getText();
    assert.ok(
      browserTtsText.toLowerCase().includes('browser'),
      `Expected TTS service to be Browser, but got: ${browserTtsText}`
    );
    
    console.log('✅ TEST PASSED: Both OpenAI TTS and Browser TTS services auto-play correctly');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    throw error;
  } finally {
    console.log('Closing WebDriver...');
    await driver.quit();
  }
}

// Run the test and handle errors
if (require.main === module) {
  (async () => {
    try {
      await runTest();
      process.exit(0); // Success
    } catch (err) {
      console.error('Test execution failed:', err);
      process.exit(1); // Failure
    }
  })();
}

module.exports = { runTest };
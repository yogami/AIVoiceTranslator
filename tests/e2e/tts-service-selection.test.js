/**
 * TTS Service Selection End-to-End Test
 * 
 * This test verifies that the student interface can select different TTS services
 * and that the selection is properly sent to the server and handled correctly.
 * 
 * Following TDD and Clean Code principles:
 * - Tests are self-contained with clear Arrange-Act-Assert structure
 * - Each test has a single responsibility
 * - Tests are deterministic and repeatable
 * - Clear naming conventions
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds

// Enable more detailed logging for debugging in CI environment
const VERBOSE_LOGGING = process.env.CI === 'true';

// Helper function to log information only in verbose mode
function log(message) {
  if (VERBOSE_LOGGING) {
    console.log(`[TTS Service Test] ${message}`);
  }
}

describe('AIVoiceTranslator TTS Service Selection Tests', function() {
  this.timeout(TEST_TIMEOUT);
  
  let teacherDriver;
  let studentDriver;
  
  /**
   * Setup test environment - create browser instances
   */
  before(async function() {
    log('Setting up test environment');
    
    // Create Chrome options with audio enabled
    const options = new chrome.Options()
      .addArguments('--use-fake-device-for-media-stream')
      .addArguments('--use-fake-ui-for-media-stream')
      .addArguments('--no-sandbox')
      .addArguments('--disable-dev-shm-usage')
      .addArguments('--autoplay-policy=no-user-gesture-required');
    
    if (process.env.CI === 'true') {
      options.addArguments('--headless=new');
    }
    
    // Create teacher browser instance
    teacherDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    // Create student browser instance with same options
    studentDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    log('Browser instances created');
  });
  
  /**
   * Clean up after tests
   */
  after(async function() {
    log('Cleaning up test environment');
    if (teacherDriver) {
      await teacherDriver.quit();
    }
    if (studentDriver) {
      await studentDriver.quit();
    }
  });
  
  /**
   * Test: TTS Service Selection UI Elements
   * 
   * Verifies that the TTS service selection UI elements exist and are interactive
   */
  it('should display TTS service selection dropdown and apply button', async function() {
    log('Starting TTS service selection UI test');
    
    // Load student page
    await studentDriver.get(`${APP_URL}/simple-student.html`);
    
    // Verify TTS service dropdown exists
    const ttsServiceSelect = await studentDriver.findElement(By.id('tts-service'));
    assert.ok(ttsServiceSelect, 'TTS service dropdown not found');
    
    // Verify the dropdown has the expected options
    const options = await ttsServiceSelect.findElements(By.css('option'));
    assert.ok(options.length >= 3, 'TTS service dropdown should have at least 3 options');
    
    // Verify apply button exists and is enabled
    const applyButton = await studentDriver.findElement(By.id('apply-tts-btn'));
    const isButtonEnabled = await applyButton.isEnabled();
    assert.ok(isButtonEnabled, 'Apply TTS service button should be enabled');
    
    log('TTS service selection UI elements test passed');
  });
  
  /**
   * Test: Changing TTS Service
   * 
   * Verifies that changing the TTS service and clicking Apply updates the configuration
   */
  it('should allow changing TTS service after connecting', async function() {
    const testLanguage = 'es'; // Spanish
    const testText = 'This is a test of the translation system';
    
    log('Starting TTS service change test');
    
    // ARRANGE: Set up teacher and student pages
    await teacherDriver.get(`${APP_URL}/simple-speech-test.html`);
    await studentDriver.get(`${APP_URL}/simple-student.html?lang=${testLanguage}`);
    
    // Wait for pages to load
    await teacherDriver.sleep(1000);
    await studentDriver.sleep(1000);
    
    // Connect student to WebSocket
    const connectButton = await studentDriver.findElement(By.id('connect-btn'));
    await connectButton.click();
    
    // Wait for connection to establish
    await studentDriver.wait(until.elementLocated(By.css('.indicator.connected')), 5000);
    log('Student connected to WebSocket');
    
    // ACT: Change TTS service to "OpenAI TTS"
    const ttsServiceSelect = await studentDriver.findElement(By.id('tts-service'));
    await ttsServiceSelect.sendKeys('openai');
    
    const applyButton = await studentDriver.findElement(By.id('apply-tts-btn'));
    await applyButton.click();
    
    log('Changed TTS service to OpenAI');
    await studentDriver.sleep(1000);
    
    // Simulate teacher speaking
    const transcriptionInput = await teacherDriver.findElement(By.id('transcription-input'));
    await transcriptionInput.clear();
    await transcriptionInput.sendKeys(testText);
    
    const sendButton = await teacherDriver.findElement(By.id('send-button'));
    await sendButton.click();
    
    log('Sent test text from teacher');
    
    // Wait for translation to appear (up to 5 seconds)
    await studentDriver.wait(async () => {
      try {
        const translationBox = await studentDriver.findElement(By.id('translation-box'));
        const text = await translationBox.getText();
        return text.length > 0 && !text.includes('Connect and select a language');
      } catch (e) {
        return false;
      }
    }, 5000, 'Translation did not appear');
    
    // ASSERT: Verify translation appeared with the correct TTS service info
    const translationBox = await studentDriver.findElement(By.id('translation-box'));
    const translationText = await translationBox.getText();
    
    log(`Received translation: "${translationText}"`);
    
    // Check if the translation box mentions OpenAI TTS
    assert.ok(
      translationText.includes('OpenAI TTS') || 
      translationText.toLowerCase().includes('emotion'),
      'Translation should indicate it is using OpenAI TTS service'
    );
    
    // Check if play button exists and is enabled (unless it's silent mode)
    const playButton = await studentDriver.findElement(By.id('play-button'));
    const isPlayButtonEnabled = await playButton.isEnabled();
    assert.ok(isPlayButtonEnabled, 'Play button should be enabled after translation with TTS service');
    
    log('TTS service change test passed');
  });
  
  /**
   * Test: Silent TTS Mode
   * 
   * Verifies that the silent TTS mode disables audio playback
   */
  it('should disable audio playback when using Silent TTS mode', async function() {
    const testLanguage = 'fr'; // French
    const testText = 'This is a test of the silent mode';
    
    log('Starting Silent TTS mode test');
    
    // ARRANGE: Set up teacher and student pages
    await teacherDriver.get(`${APP_URL}/simple-speech-test.html`);
    await studentDriver.get(`${APP_URL}/simple-student.html?lang=${testLanguage}`);
    
    // Wait for pages to load
    await teacherDriver.sleep(1000);
    await studentDriver.sleep(1000);
    
    // Connect student to WebSocket
    const connectButton = await studentDriver.findElement(By.id('connect-btn'));
    await connectButton.click();
    
    // Wait for connection to establish
    await studentDriver.wait(until.elementLocated(By.css('.indicator.connected')), 5000);
    log('Student connected to WebSocket');
    
    // ACT: Change TTS service to "Silent"
    const ttsServiceSelect = await studentDriver.findElement(By.id('tts-service'));
    await ttsServiceSelect.sendKeys('silent');
    
    const applyButton = await studentDriver.findElement(By.id('apply-tts-btn'));
    await applyButton.click();
    
    log('Changed TTS service to Silent');
    await studentDriver.sleep(1000);
    
    // Simulate teacher speaking
    const transcriptionInput = await teacherDriver.findElement(By.id('transcription-input'));
    await transcriptionInput.clear();
    await transcriptionInput.sendKeys(testText);
    
    const sendButton = await teacherDriver.findElement(By.id('send-button'));
    await sendButton.click();
    
    log('Sent test text from teacher');
    
    // Wait for translation to appear (up to 5 seconds)
    await studentDriver.wait(async () => {
      try {
        const translationBox = await studentDriver.findElement(By.id('translation-box'));
        const text = await translationBox.getText();
        return text.length > 0 && !text.includes('Connect and select a language');
      } catch (e) {
        return false;
      }
    }, 5000, 'Translation did not appear');
    
    // ASSERT: Verify translation appeared but play button is disabled
    const translationBox = await studentDriver.findElement(By.id('translation-box'));
    const translationText = await translationBox.getText();
    
    log(`Received translation: "${translationText}"`);
    
    // Check if the translation box mentions Silent mode
    assert.ok(
      translationText.includes('Silent Mode') || 
      translationText.includes('Audio: Silent'),
      'Translation should indicate it is using Silent mode'
    );
    
    // Get play button text and status
    const playButton = await studentDriver.findElement(By.id('play-button'));
    const buttonText = await playButton.getText();
    const isPlayButtonEnabled = await playButton.isEnabled();
    
    log(`Play button text: "${buttonText}", enabled: ${isPlayButtonEnabled}`);
    
    // Check that play button is disabled in silent mode
    assert.ok(!isPlayButtonEnabled, 'Play button should be disabled in Silent mode');
    assert.ok(buttonText.includes('Disabled') || buttonText.includes('🔇'), 
              'Play button should indicate audio is disabled');
    
    log('Silent TTS mode test passed');
  });
});
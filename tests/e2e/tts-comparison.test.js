/**
 * TTS Service Comparison End-to-End Test
 * 
 * This test verifies that the student interface can compare different TTS services
 * in real-time and that the comparison functionality works correctly.
 * 
 * Following TDD and Clean Code principles:
 * - Tests are self-contained with clear Arrange-Act-Assert structure
 * - Each test has a single responsibility
 * - Tests are deterministic and repeatable
 * - Clear naming conventions
 * 
 * Following Test Pyramid principles:
 * - This is a UI end-to-end test at the top of the pyramid
 * - It complements unit tests for the underlying TextToSpeechService components
 * - Validates the complete feature from end-user perspective
 */

const { Builder, By, until, Key, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Set test configuration from environment or defaults
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds
const TEST_TIMEOUT = 60000; // 60 seconds for entire test (TTS comparisons take time)

function log(message) {
  console.log(`[TTS-Comparison-Test] ${message}`);
}

describe('TTS Service Comparison Tests', function() {
  this.timeout(TEST_TIMEOUT);
  
  let driver;
  
  /**
   * Setup test environment - create browser instance
   */
  beforeEach(async function() {
    log('Setting up test environment...');
    
    // Configure Chrome options for testing
    const options = new chrome.Options();
    
    // Add arguments for CI environments
    if (process.env.CI) {
      log('Running in CI environment, using headless mode');
      options.addArguments('--headless');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
    }
    
    // Add arguments for browser audio
    options.addArguments('--use-fake-ui-for-media-stream');
    options.addArguments('--use-fake-device-for-media-stream');
    options.addArguments('--allow-file-access-from-files');
    
    // Enable browser console logs
    options.setLoggingPrefs({ browser: 'ALL' });
    
    // Initialize WebDriver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Navigate to student page
    await driver.get(`${APP_URL}/client/public/simple-student.html`);
    log(`Navigated to ${APP_URL}/client/public/simple-student.html`);
    
    // Wait for page to fully load
    await driver.sleep(2000);
    
    // Connect to the WebSocket server to enable testing
    try {
      const connectButton = await driver.findElement(By.id('connect-btn'));
      await connectButton.click();
      log('Clicked connect button');
      
      // Wait for connection indicator to show connected
      await driver.wait(
        until.elementLocated(By.css('.indicator.connected')),
        TIMEOUT,
        'Failed to connect to WebSocket server'
      );
      
      log('Successfully connected to WebSocket server');
    } catch (error) {
      console.error('Error connecting to WebSocket server:', error);
      throw error;
    }
  });
  
  /**
   * Clean up after tests
   */
  afterEach(async function() {
    if (driver) {
      // Get browser console logs for debugging
      try {
        const logs = await driver.manage().logs().get(logging.Type.BROWSER);
        if (logs.length > 0) {
          console.log('Browser console logs:');
          logs.forEach(entry => console.log(`  ${entry.level.name}: ${entry.message}`));
        }
      } catch (error) {
        console.error('Error retrieving browser logs:', error.message);
      }
      
      // Try to disconnect WebSocket connection
      try {
        const disconnectButton = await driver.findElement(By.id('disconnect-btn'));
        await disconnectButton.click();
        log('Clicked disconnect button');
        await driver.sleep(1000);
      } catch (error) {
        // Ignore disconnect errors
      }
      
      await driver.quit();
      log('Test driver closed');
    }
  });
  
  /**
   * Test: TTS Comparison Panel Existence
   * 
   * Verifies that the TTS comparison panel exists and can be displayed
   */
  it('should have a TTS comparison panel that can be displayed', async function() {
    // Wait for the refresh comparison button to be present
    const refreshButton = await driver.wait(
      until.elementLocated(By.id('refresh-comparison')),
      TIMEOUT,
      'Refresh comparison button not found'
    );
    
    // Click the refresh button to show the comparison panel
    await refreshButton.click();
    
    // Wait for the comparison panel to be displayed
    const comparisonPanel = await driver.wait(
      until.elementIsVisible(driver.findElement(By.id('audio-comparison'))),
      TIMEOUT,
      'Comparison panel not displayed'
    );
    
    // Assert that the panel is visible
    const isDisplayed = await comparisonPanel.isDisplayed();
    assert(isDisplayed, 'Comparison panel should be visible after clicking refresh button');
    
    log('Successfully verified comparison panel display');
  });
  
  /**
   * Test: TTS Service Demo Play Buttons
   * 
   * Verifies that the TTS service demo play buttons exist and are properly configured
   */
  it('should have working TTS service demo play buttons', async function() {
    // Check if all play demo buttons exist
    const playButtons = await driver.findElements(By.css('.play-demo-btn'));
    assert(playButtons.length >= 3, `Expected at least 3 play demo buttons, found ${playButtons.length}`);
    
    // Check if each button has the correct data-service attribute
    const browserPlayButton = await driver.findElement(By.css('.play-demo-btn[data-service="browser"]'));
    const openaiPlayButton = await driver.findElement(By.css('.play-demo-btn[data-service="openai"]'));
    const silentPlayButton = await driver.findElement(By.css('.play-demo-btn[data-service="silent"]'));
    
    assert(browserPlayButton, 'Browser TTS play button should exist');
    assert(openaiPlayButton, 'OpenAI TTS play button should exist');
    assert(silentPlayButton, 'Silent mode play button should exist');
    
    log('Successfully verified TTS service play buttons');
  });
  
  /**
   * Test: Window Audio Cache Initialization
   * 
   * Verifies that the window.audioCache object is initialized correctly
   */
  it('should initialize window.audioCache object', async function() {
    // Execute JavaScript to check if window.audioCache exists
    const hasAudioCache = await driver.executeScript('return window.audioCache !== undefined');
    assert(hasAudioCache, 'window.audioCache should be initialized');
    
    log('Successfully verified audio cache initialization');
  });
  
  /**
   * Test: TTS Comparison Feature After Receiving Translation
   * 
   * This test simulates receiving a translation and then tries to use
   * the comparison feature to play it with different TTS services
   */
  it('should allow comparing TTS services after receiving a translation', async function() {
    // This test requires simulating a translation reception
    // First, let's manually set window.lastTranslationData for testing
    
    await driver.executeScript(`
      window.lastTranslationData = {
        text: "This is a test translation for TTS comparison",
        languageCode: "es",
        ttsService: "browser", 
        originalText: "This is the original text"
      };
      
      // Also update the translation box
      document.getElementById('translation-box').innerHTML = 
        '<p>This is a test translation for TTS comparison</p>';
        
      // Log for debugging
      console.log("Set test translation data:", window.lastTranslationData);
    `);
    
    // Now click the refresh comparison button to show the panel
    const refreshButton = await driver.findElement(By.id('refresh-comparison'));
    await refreshButton.click();
    
    // Wait for the comparison panel to become visible
    await driver.wait(
      until.elementIsVisible(driver.findElement(By.id('audio-comparison'))),
      TIMEOUT,
      'Comparison panel not displayed'
    );
    
    // Check if the comparison text shows our test text
    const comparisonPanel = await driver.findElement(By.id('comparison-options'));
    const comparisonText = await comparisonPanel.getText();
    
    assert(
      comparisonText.includes('This is a test translation for TTS comparison'),
      'Comparison panel should display the test translation text'
    );
    
    // Check if all comparison buttons exist
    const comparisonButtons = await driver.findElements(By.css('#comparison-options button'));
    assert(comparisonButtons.length >= 3, 'Should have at least 3 comparison buttons');
    
    log('Successfully verified TTS comparison capability with test translation');
  });
});
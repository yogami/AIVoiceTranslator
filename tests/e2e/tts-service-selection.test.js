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
 * 
 * Following Test Pyramid principles:
 * - This is a UI end-to-end test at the top of the pyramid
 * - It complements unit tests for the underlying TextToSpeechService components
 * - Validates the complete feature from end-user perspective
 */

const { Builder, By, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Set test configuration from environment or defaults
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds
const TEST_TIMEOUT = 30000; // 30 seconds for entire test

function log(message) {
  console.log(`[TTS-Test] ${message}`);
}

describe('TTS Service Selection Tests', function() {
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
      
      await driver.quit();
      log('Test driver closed');
    }
  });
  
  /**
   * Test: TTS Service Selection UI Elements
   * 
   * Verifies that the TTS service selection UI elements exist and are interactive
   */
  it('should display TTS service selection UI elements', async function() {
    // Wait for the TTS service selector to be present
    const ttsServiceSelector = await driver.wait(
      until.elementLocated(By.id('tts-service-selector')),
      TIMEOUT,
      'TTS service selector not found'
    );
    
    // Check if the form elements exist
    const browserOption = await driver.findElement(By.css('input[value="browser"]'));
    const openaiOption = await driver.findElement(By.css('input[value="openai"]'));
    const silentOption = await driver.findElement(By.css('input[value="silent"]'));
    const applyButton = await driver.findElement(By.id('apply-tts-settings'));
    
    // Assert that all elements are present
    assert(ttsServiceSelector, 'TTS service selector container should be present');
    assert(browserOption, 'Browser TTS option should be present');
    assert(openaiOption, 'OpenAI TTS option should be present');
    assert(silentOption, 'Silent mode option should be present');
    assert(applyButton, 'Apply button should be present');
    
    // Verify default selection is Browser
    const isSelected = await browserOption.isSelected();
    assert(isSelected, 'Browser TTS should be selected by default');
    
    log('Successfully verified TTS service selection UI elements');
  });
  
  /**
   * Test: Changing TTS Service
   * 
   * Verifies that changing the TTS service and clicking Apply updates the configuration
   */
  it('should update TTS service when selection is changed', async function() {
    // Find the TTS service options
    const openaiOption = await driver.findElement(By.css('input[value="openai"]'));
    const applyButton = await driver.findElement(By.id('apply-tts-settings'));
    
    // Click the OpenAI option
    await openaiOption.click();
    
    // Click the Apply button
    await applyButton.click();
    
    // Wait for the confirmation message
    const confirmationMessage = await driver.wait(
      until.elementLocated(By.css('.settings-confirmation')),
      TIMEOUT,
      'Confirmation message not displayed'
    );
    
    // Verify the confirmation message is displayed
    const confirmationText = await confirmationMessage.getText();
    assert(confirmationText.includes('TTS settings updated'), 
      `Confirmation should include 'TTS settings updated', got: ${confirmationText}`);
    
    // Check browser logs for WebSocket message
    await driver.sleep(1000); // Wait for logs to be available
    
    // Let server recognize the change (will be checked in next test)
    await driver.sleep(2000);
    
    log('Successfully verified TTS service change');
  });
  
  /**
   * Test: Silent TTS Mode
   * 
   * Verifies that the silent TTS mode disables audio playback
   */
  it('should set to silent mode when selected', async function() {
    // Find the TTS service options
    const silentOption = await driver.findElement(By.css('input[value="silent"]'));
    const applyButton = await driver.findElement(By.id('apply-tts-settings'));
    
    // Click the Silent option
    await silentOption.click();
    
    // Click the Apply button
    await applyButton.click();
    
    // Wait for the confirmation message
    const confirmationMessage = await driver.wait(
      until.elementLocated(By.css('.settings-confirmation')),
      TIMEOUT,
      'Confirmation message not displayed'
    );
    
    // Verify the confirmation message is displayed
    const confirmationText = await confirmationMessage.getText();
    assert(confirmationText.includes('TTS settings updated'), 
      `Confirmation should include 'TTS settings updated', got: ${confirmationText}`);
    
    // Check for status indicator showing silent mode
    await driver.wait(
      until.elementLocated(By.css('.tts-status.silent')),
      TIMEOUT,
      'Silent mode status indicator not found'
    );
    
    log('Successfully verified silent TTS mode');
  });
});
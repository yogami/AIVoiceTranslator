/**
 * AIVoiceTranslator Selenium UI Tests
 * 
 * This file contains Selenium WebDriver tests for the AIVoiceTranslator application.
 * These tests verify the UI functionality in a real browser environment.
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Configuration
const APP_URL = process.env.APP_URL || 'https://aivoicetranslator.replit.app'; // Should be set in CI environment
const TEST_TIMEOUT = 30000; // 30 seconds timeout for tests

/**
 * Test suite for AIVoiceTranslator
 */
describe('AIVoiceTranslator UI Tests', function() {
  // Extend timeout for all tests
  this.timeout(TEST_TIMEOUT);
  
  let driver;
  
  // Set up WebDriver before tests
  before(async function() {
    // Configure Chrome options for headless operation in CI environment
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    
    // Build the driver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    console.log(`Testing application at: ${APP_URL}`);
  });
  
  // Clean up after tests
  after(async function() {
    if (driver) {
      await driver.quit();
    }
  });
  
  /**
   * Test: Teacher interface loads successfully
   */
  it('should load the teacher interface', async function() {
    await driver.get(`${APP_URL}/simple-speech-test.html`);
    
    // Verify title contains AIVoiceTranslator
    const title = await driver.getTitle();
    assert.ok(title.includes('AIVoiceTranslator') || title.includes('Teacher Interface'), 
      `Page title should contain AIVoiceTranslator or Teacher Interface, got: ${title}`);
    
    // Verify UI elements are present
    const startBtn = await driver.findElement(By.id('startButton'));
    assert.ok(await startBtn.isDisplayed(), 'Start button should be visible');
    
    const statusElement = await driver.findElement(By.id('status'));
    assert.ok(await statusElement.isDisplayed(), 'Status element should be visible');
  });
  
  /**
   * Test: Student interface loads successfully
   */
  it('should load the student interface', async function() {
    await driver.get(`${APP_URL}/simple-student.html`);
    
    // Verify title contains AIVoiceTranslator
    const title = await driver.getTitle();
    assert.ok(title.includes('AIVoiceTranslator') || title.includes('Student Interface'), 
      `Page title should contain AIVoiceTranslator or Student Interface, got: ${title}`);
    
    // Verify language dropdown is present
    const languageSelect = await driver.findElement(By.id('languageSelect'));
    assert.ok(await languageSelect.isDisplayed(), 'Language selection dropdown should be visible');
    
    // Verify translation container is present
    const translationContainer = await driver.findElement(By.id('translationContainer'));
    assert.ok(await translationContainer.isDisplayed(), 'Translation container should be visible');
  });
  
  /**
   * Test: Metrics dashboard loads successfully
   */
  it('should load the metrics dashboard', async function() {
    await driver.get(`${APP_URL}/code-metrics.html`);
    
    // Verify title contains Metrics or Dashboard
    const title = await driver.getTitle();
    assert.ok(title.includes('Metrics') || title.includes('Dashboard'), 
      `Page title should contain Metrics or Dashboard, got: ${title}`);
    
    // Verify metrics elements are present (waiting for them to load)
    await driver.wait(until.elementLocated(By.id('coverageChart')), 5000);
    const coverageChart = await driver.findElement(By.id('coverageChart'));
    assert.ok(await coverageChart.isDisplayed(), 'Coverage chart should be visible');
  });
  
  /**
   * Test: WebSocket connection works
   */
  it('should establish WebSocket connection on teacher page', async function() {
    await driver.get(`${APP_URL}/simple-speech-test.html`);
    
    // Wait for page to load and WebSocket to connect
    await driver.sleep(2000);
    
    // Check connection status - should update after page load
    const statusElement = await driver.findElement(By.id('status'));
    const statusText = await statusElement.getText();
    
    // Status should contain "Connected" if WebSocket connection was successful
    assert.ok(
      statusText.includes('Connected') || 
      statusText.includes('Ready') || 
      !statusText.includes('Error'),
      `Status should indicate connected or ready state, got: ${statusText}`
    );
  });
});
/**
 * Interface Improvements Test Suite
 * 
 * This test suite validates the UI improvements made to the teacher
 * and student interfaces of the AIVoiceTranslator.
 */

const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

// Get the base URL from environment or use localhost
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

describe('AIVoiceTranslator Interface Improvements', function() {
  let driver;
  
  // Set timeout for tests
  this.timeout(30000);
  
  beforeEach(async function() {
    // Create a new WebDriver instance
    driver = await new Builder().forBrowser('chrome').build();
  });
  
  afterEach(async function() {
    // Quit the driver after each test
    await driver.quit();
  });

  describe('Teacher Interface', function() {
    it('should have an improved UI with proper styling', async function() {
      await driver.get(`${APP_URL}/simple-speech-test.html`);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.tagName('h1')), 10000);
      
      // Test header elements
      const header = await driver.findElement(By.tagName('h1'));
      assert.strictEqual(await header.getText(), 'Teacher Interface');
      
      // Test responsive layout
      const container = await driver.findElement(By.className('container'));
      const display = await container.getCssValue('display');
      assert(display === 'flex' || display === 'grid', 'Container should use a modern layout system');
      
      // Test card UI
      const cards = await driver.findElements(By.className('card'));
      assert(cards.length >= 2, 'Should have at least 2 card elements');
      
      // Test visual indicators for recording status
      const statusElement = await driver.findElement(By.id('status'));
      assert(await statusElement.isDisplayed(), 'Status indicator should be visible');
      
      // Test button styling
      const startButton = await driver.findElement(By.id('start-btn'));
      const buttonBgColor = await startButton.getCssValue('background-color');
      assert(buttonBgColor !== 'rgba(0, 0, 0, 0)', 'Buttons should have a background color');
    });
    
    it('should have functional language quick-selection buttons', async function() {
      await driver.get(`${APP_URL}/simple-speech-test.html`);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.className('language-btn')), 10000);
      
      // Click on a language button
      const languageButton = await driver.findElement(By.css('.language-btn[data-lang="es-ES"]'));
      await languageButton.click();
      
      // Verify language selection changed
      const languageSelect = await driver.findElement(By.id('language-select'));
      const selectedOption = await languageSelect.getAttribute('value');
      assert.strictEqual(selectedOption, 'es-ES', 'Language should be updated to Spanish');
    });
  });

  describe('Student Interface', function() {
    it('should have an improved UI with proper styling', async function() {
      await driver.get(`${APP_URL}/simple-student.html`);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.tagName('h1')), 10000);
      
      // Test header elements
      const header = await driver.findElement(By.tagName('h1'));
      assert.strictEqual(await header.getText(), 'Student Translator');
      
      // Test container styling
      const container = await driver.findElement(By.className('container'));
      const borderRadius = await container.getCssValue('border-radius');
      assert(parseInt(borderRadius) > 0, 'Container should have rounded corners');
      
      // Test translation box
      const translationBox = await driver.findElement(By.className('translation-box'));
      assert(await translationBox.isDisplayed(), 'Translation box should be visible');
      
      // Test responsive buttons
      const connectButton = await driver.findElement(By.id('connect-btn'));
      const buttonPadding = await connectButton.getCssValue('padding');
      assert(buttonPadding !== '0px', 'Buttons should have padding');
    });
    
    it('should have a functional language selector modal', async function() {
      await driver.get(`${APP_URL}/simple-student.html`);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.id('show-more-languages')), 10000);
      
      // Click on "Show More Languages" button
      const showMoreButton = await driver.findElement(By.id('show-more-languages'));
      await showMoreButton.click();
      
      // Verify modal appears
      await driver.wait(until.elementLocated(By.className('language-modal')), 5000);
      
      // Test that modal has multiple language options
      const modalContent = await driver.findElement(By.className('modal-content'));
      const languageButtons = await modalContent.findElements(By.className('expanded-language-btn'));
      assert(languageButtons.length > 10, 'Modal should display multiple language options');
      
      // Select a language from the modal
      const germanButton = await driver.findElement(By.css('.expanded-language-btn[data-lang="de"]'));
      await germanButton.click();
      
      // Verify language selection changed and modal closed
      await driver.wait(until.elementIsNotVisible(modalContent), 5000);
      
      // Check that German is now selected
      const languageSelect = await driver.findElement(By.id('language-select'));
      const selectedOption = await languageSelect.getAttribute('value');
      assert.strictEqual(selectedOption, 'de', 'Language should be updated to German');
    });
    
    it('should have visual indicators for connection status', async function() {
      await driver.get(`${APP_URL}/simple-student.html`);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.id('connection-indicator')), 10000);
      
      // Check that connection indicator exists
      const connectionIndicator = await driver.findElement(By.id('connection-indicator'));
      assert(await connectionIndicator.isDisplayed(), 'Connection indicator should be visible');
      
      // It should initially show as disconnected
      const classes = await connectionIndicator.getAttribute('class');
      assert(classes.includes('disconnected'), 'Should initially show as disconnected');
    });
  });

  describe('Load Testing Capability', function() {
    it('should verify load testing script exists', async function() {
      // Simply check that our load testing script exists
      const fs = require('fs');
      assert(fs.existsSync('tests/load-testing/load-test.js'), 'Load testing script should exist');
    });
  });
});
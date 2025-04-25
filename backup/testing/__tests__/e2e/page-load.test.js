/**
 * End-to-End Test for Page Loading
 * 
 * This test uses Selenium WebDriver to verify that all pages in the application
 * load correctly without any JavaScript errors.
 */
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// Set up Chrome options
const chromeOptions = new chrome.Options();
chromeOptions.addArguments('--headless'); // Run in headless mode
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');

// Pages to test
const pagesToTest = [
  '/',
  '/simple-test.html',
  '/simple-test-student.html',
  '/websocket-diagnostics.html'
];

// Test function
async function testPageLoad(page) {
  let driver;
  
  try {
    // Create Chrome driver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    
    // Capture JavaScript errors
    const jsErrors = [];
    await driver.executeScript(`
      window.onerror = function(message, source, lineno, colno, error) {
        window.jsErrors = window.jsErrors || [];
        window.jsErrors.push({
          message: message,
          source: source,
          lineno: lineno,
          colno: colno
        });
        return true;
      };
      window.jsErrors = [];
    `);
    
    // Set timeout to 10 seconds
    await driver.manage().setTimeouts({ implicit: 10000 });
    
    // Navigate to the page
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    await driver.get(`${baseUrl}${page}`);
    
    // Wait for page to load
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);
    
    // Get any JavaScript errors
    const errors = await driver.executeScript('return window.jsErrors');
    
    // Check if errors occurred
    if (errors && errors.length > 0) {
      console.error(`JavaScript errors on ${page}:`, errors);
      throw new Error(`JavaScript errors found on ${page}: ${JSON.stringify(errors)}`);
    }
    
    // Log success
    console.log(`✓ Page ${page} loaded successfully`);
    
    return true;
  } catch (error) {
    console.error(`Error testing ${page}:`, error);
    throw error;
  } finally {
    // Close the driver
    if (driver) {
      await driver.quit();
    }
  }
}

// Run tests for each page
describe('Page Load Tests', function() {
  // Set timeout to 60 seconds for the entire test suite
  this.timeout(60000);
  
  pagesToTest.forEach(page => {
    it(`should load ${page} without errors`, async function() {
      const result = await testPageLoad(page);
      expect(result).to.be.true;
    });
  });
});
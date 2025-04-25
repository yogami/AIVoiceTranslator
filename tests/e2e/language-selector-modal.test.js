/**
 * End-to-End Test for Language Selector Modal Functionality
 * 
 * This test verifies that:
 * 1. The "More Languages" button shows the language modal
 * 2. The modal contains all expected language options
 * 3. Languages filter correctly based on TTS service selection
 * 4. Clicking on a language properly updates the selection
 */

const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const chrome = require('selenium-webdriver/chrome');

describe('Language Selector Modal Tests', function() {
  let driver;
  
  // This test may take longer due to browser loading
  this.timeout(30000);
  
  beforeEach(async function() {
    // Set up Chrome options for testing
    const options = new chrome.Options()
      .addArguments('--headless')
      .addArguments('--no-sandbox')
      .addArguments('--disable-dev-shm-usage');
    
    // Create driver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Navigate to student page
    await driver.get('http://localhost:5000/simple-student.html');
    
    // Wait for page to fully load
    await driver.wait(until.elementLocated(By.id('language-select')), 10000);
  });
  
  afterEach(async function() {
    // Quit the driver after each test
    if (driver) {
      await driver.quit();
    }
  });
  
  it('should display the language modal when "More Languages" button is clicked', async function() {
    const moreLanguagesButton = await driver.findElement(By.id('show-more-languages'));
    
    // First check that modal is initially hidden
    const modalBeforeClick = await driver.findElement(By.id('language-modal'));
    const displayBeforeClick = await modalBeforeClick.getCssValue('display');
    assert.strictEqual(displayBeforeClick, 'none', 'Modal should be hidden initially');
    
    // Click the "More Languages" button
    await moreLanguagesButton.click();
    
    // Check that modal is now visible
    await driver.wait(until.elementIsVisible(modalBeforeClick), 5000);
    const displayAfterClick = await modalBeforeClick.getCssValue('display');
    assert.notStrictEqual(displayAfterClick, 'none', 'Modal should be visible after clicking More Languages');
    
    // Check that language list is populated
    const expandedList = await driver.findElement(By.id('expanded-language-list'));
    const languageButtons = await expandedList.findElements(By.className('expanded-language-btn'));
    assert(languageButtons.length > 10, 'Modal should display multiple language buttons');
  });
  
  it('should filter languages based on TTS service selection', async function() {
    // First select browser TTS service
    const browserRadio = await driver.findElement(By.css('input[value="browser"]'));
    await browserRadio.click();
    
    // Open the modal
    const moreLanguagesButton = await driver.findElement(By.id('show-more-languages'));
    await moreLanguagesButton.click();
    
    // Wait for modal to be visible
    const modal = await driver.findElement(By.id('language-modal'));
    await driver.wait(until.elementIsVisible(modal), 5000);
    
    // Count unsupported languages with browser TTS
    const unsupportedWithBrowser = await driver.findElements(By.css('.expanded-language-btn.unsupported'));
    const countWithBrowser = unsupportedWithBrowser.length;
    
    // Close the modal
    const closeButton = await driver.findElement(By.id('close-modal'));
    await closeButton.click();
    
    // Switch to OpenAI TTS
    const openaiRadio = await driver.findElement(By.css('input[value="openai"]'));
    await openaiRadio.click();
    
    // Reopen the modal
    await moreLanguagesButton.click();
    await driver.wait(until.elementIsVisible(modal), 5000);
    
    // Count unsupported languages with OpenAI TTS (should be 0)
    const unsupportedWithOpenai = await driver.findElements(By.css('.expanded-language-btn.unsupported'));
    
    // OpenAI should support more languages than browser
    assert(unsupportedWithOpenai.length < countWithBrowser, 
           'OpenAI TTS should support more languages than browser TTS');
  });
  
  it('should update language selection when a language is clicked in the modal', async function() {
    // Open the modal
    const moreLanguagesButton = await driver.findElement(By.id('show-more-languages'));
    await moreLanguagesButton.click();
    
    // Wait for modal to be visible
    const modal = await driver.findElement(By.id('language-modal'));
    await driver.wait(until.elementIsVisible(modal), 5000);
    
    // Get initial language
    const languageSelect = await driver.findElement(By.id('language-select'));
    const initialLanguage = await languageSelect.getAttribute('value');
    
    // Find a different language in the modal and click it
    const frenchButton = await driver.findElement(By.css('.expanded-language-btn[data-lang="fr"]'));
    await frenchButton.click();
    
    // Get updated language
    const updatedLanguage = await languageSelect.getAttribute('value');
    
    // Language should have changed to selected language
    assert.strictEqual(updatedLanguage, 'fr', 'Language should update to French after clicking French button');
  });
});
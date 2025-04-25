/**
 * Selenium UI Tests for Benedictaitor
 * 
 * These tests verify the UI functionality of the application using Selenium WebDriver.
 */
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
require('chromedriver');

// Test configuration
const APP_URL = 'http://localhost:5000';
const TEACHER_URL = `${APP_URL}/teacher`;
const STUDENT_URL = `${APP_URL}/student`;
const TEST_TIMEOUT = 30000; // 30 seconds
const TEST_TEXT = 'This is a test message for Benedictaitor';

/**
 * Helper to create a properly configured WebDriver instance for Replit
 */
async function createDriver() {
  try {
    // Configure Chrome options for headless operation in Replit
    const options = new chrome.Options();
    options.addArguments(
      '--headless=new',  // Use the newer headless mode
      '--no-sandbox',    // Required in container environments like Replit
      '--disable-dev-shm-usage', // Overcome limited /dev/shm in Replit
      '--disable-gpu',   // Disable GPU acceleration in headless mode
      '--window-size=1280,1024', // Set reasonable window size
      '--disable-extensions',    // Disable extensions for stability
      '--disable-infobars',      // Hide info bars
      '--ignore-certificate-errors' // Ignore cert errors for testing
    );
    
    console.log('Creating real Selenium WebDriver for Chrome with headless configuration');
    
    return new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  } catch (error) {
    console.error('Failed to create WebDriver:', error);
    throw error; // Rethrow to fail the test properly rather than silently proceeding
  }
}

/**
 * Helper to take a screenshot for debugging
 */
async function takeScreenshot(driver, name) {
  const screenshot = await driver.takeScreenshot();
  const screenshotPath = path.join(__dirname, `../../screenshots/${name}.png`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(screenshotPath, screenshot, 'base64');
  console.log(`Screenshot saved to ${screenshotPath}`);
}

/**
 * Helper to check if element exists
 */
async function elementExists(driver, selector, timeout = 5000) {
  try {
    await driver.wait(until.elementLocated(By.css(selector)), timeout);
    return true;
  } catch (error) {
    console.warn(`Element not found: ${selector}`);
    return false;
  }
}

/**
 * Test: Teacher Interface UI Elements
 */
async function testTeacherInterfaceUI() {
  const driver = await createDriver();
  
  try {
    console.log('Testing Teacher Interface UI...');
    
    // Navigate to teacher page
    await driver.get(TEACHER_URL);
    await driver.wait(until.titleContains('Benedictaitor'), 5000);
    
    // Check for essential UI elements
    const headerExists = await elementExists(driver, 'header');
    const startButtonExists = await elementExists(driver, 'button[data-testid="start-recording"]');
    const stopButtonExists = await elementExists(driver, 'button[data-testid="stop-recording"]');
    const transcriptContainerExists = await elementExists(driver, '[data-testid="transcript-container"]');
    
    await takeScreenshot(driver, 'teacher-interface');
    
    return {
      success: headerExists && startButtonExists && stopButtonExists && transcriptContainerExists,
      details: {
        headerExists,
        startButtonExists,
        stopButtonExists,
        transcriptContainerExists
      }
    };
  } catch (error) {
    console.error('Error testing teacher interface:', error);
    await takeScreenshot(driver, 'teacher-interface-error');
    throw error;
  } finally {
    await driver.quit();
  }
}

/**
 * Test: Student Interface UI Elements
 */
async function testStudentInterfaceUI() {
  const driver = await createDriver();
  
  try {
    console.log('Testing Student Interface UI...');
    
    // Navigate to student page
    await driver.get(STUDENT_URL);
    await driver.wait(until.titleContains('Benedictaitor'), 5000);
    
    // Check for essential UI elements
    const headerExists = await elementExists(driver, 'header');
    const languageSelectorExists = await elementExists(driver, 'select[data-testid="language-selector"]');
    const translationContainerExists = await elementExists(driver, '[data-testid="translation-container"]');
    
    await takeScreenshot(driver, 'student-interface');
    
    return {
      success: headerExists && languageSelectorExists && translationContainerExists,
      details: {
        headerExists,
        languageSelectorExists,
        translationContainerExists
      }
    };
  } catch (error) {
    console.error('Error testing student interface:', error);
    await takeScreenshot(driver, 'student-interface-error');
    throw error;
  } finally {
    await driver.quit();
  }
}

/**
 * Test: Language Selection
 */
async function testLanguageSelection() {
  const driver = await createDriver();
  
  try {
    console.log('Testing Language Selection...');
    
    // Navigate to student page
    await driver.get(STUDENT_URL);
    await driver.wait(until.titleContains('Benedictaitor'), 5000);
    
    // Find language selector
    const languageSelector = await driver.findElement(By.css('select[data-testid="language-selector"]'));
    await languageSelector.click();
    
    // Select Spanish
    const spanishOption = await driver.findElement(By.css('option[value="es-ES"]'));
    await spanishOption.click();
    
    // Wait briefly for selection to take effect
    await driver.sleep(500);
    
    // Check if the selected value is Spanish
    const selectedValue = await languageSelector.getAttribute('value');
    const success = selectedValue === 'es-ES';
    
    await takeScreenshot(driver, 'language-selection');
    
    return {
      success,
      details: {
        selectedLanguage: selectedValue
      }
    };
  } catch (error) {
    console.error('Error testing language selection:', error);
    await takeScreenshot(driver, 'language-selection-error');
    throw error;
  } finally {
    await driver.quit();
  }
}

/**
 * Test: Recording Button Functionality
 */
async function testRecordingButtons() {
  const driver = await createDriver();
  
  try {
    console.log('Testing Recording Buttons...');
    
    // Navigate to teacher page
    await driver.get(TEACHER_URL);
    await driver.wait(until.titleContains('Benedictaitor'), 5000);
    
    // Get the start button
    const startButton = await driver.findElement(By.css('button[data-testid="start-recording"]'));
    
    // Check initial state - stop button should be disabled
    const stopButton = await driver.findElement(By.css('button[data-testid="stop-recording"]'));
    const initialStopDisabled = await stopButton.getAttribute('disabled');
    
    // Click start button
    await startButton.click();
    
    // Wait for UI to update
    await driver.sleep(1000);
    
    // Check that stop button is now enabled
    const stopEnabledAfterStart = !(await stopButton.getAttribute('disabled'));
    
    // Click stop button
    await stopButton.click();
    
    // Wait for UI to update
    await driver.sleep(1000);
    
    // Check that stop button is disabled again
    const stopDisabledAfterStop = await stopButton.getAttribute('disabled');
    
    await takeScreenshot(driver, 'recording-buttons');
    
    return {
      success: initialStopDisabled && stopEnabledAfterStart && stopDisabledAfterStop,
      details: {
        initialStopDisabled: Boolean(initialStopDisabled),
        stopEnabledAfterStart,
        stopDisabledAfterStop: Boolean(stopDisabledAfterStop)
      }
    };
  } catch (error) {
    console.error('Error testing recording buttons:', error);
    await takeScreenshot(driver, 'recording-buttons-error');
    throw error;
  } finally {
    await driver.quit();
  }
}

/**
 * Test: Real-time Transcription Display
 * This simulates speech by injecting text into the WebSocket
 */
async function testTranscriptionDisplay() {
  const driver = await createDriver();
  
  try {
    console.log('Testing Transcription Display...');
    
    // Navigate to teacher page
    await driver.get(TEACHER_URL);
    await driver.wait(until.titleContains('Benedictaitor'), 5000);
    
    // Inject test transcription by running JavaScript in the browser
    const testText = 'This is a test transcription message';
    await driver.executeScript(`
      // Create a fake WebSocket message event
      const event = {
        data: JSON.stringify({
          type: 'transcription',
          text: '${testText}',
          isFinal: true
        })
      };
      
      // Call the message handler directly if it exists
      if (window.webSocketClient && window.webSocketClient.ws && window.webSocketClient.ws.onmessage) {
        window.webSocketClient.ws.onmessage(event);
      } else {
        // If not accessible, dispatch a custom event that our app listens to
        document.dispatchEvent(new CustomEvent('test-transcription', {
          detail: {
            text: '${testText}',
            isFinal: true
          }
        }));
      }
    `);
    
    // Wait for the transcription to appear
    await driver.wait(
      until.elementLocated(By.xpath(`//*[contains(text(), '${testText}')]`)),
      5000
    );
    
    // Verify transcription is displayed
    const transcriptElements = await driver.findElements(By.xpath(`//*[contains(text(), '${testText}')]`));
    const success = transcriptElements.length > 0;
    
    await takeScreenshot(driver, 'transcription-display');
    
    return {
      success,
      details: {
        transcriptionFound: success,
        elementsFound: transcriptElements.length
      }
    };
  } catch (error) {
    console.error('Error testing transcription display:', error);
    await takeScreenshot(driver, 'transcription-display-error');
    throw error;
  } finally {
    await driver.quit();
  }
}

/**
 * Main test runner function
 */
async function runSeleniumTests() {
  console.log('Starting Selenium UI Tests...');
  
  const results = {
    teacherInterface: null,
    studentInterface: null,
    languageSelection: null,
    recordingButtons: null,
    transcriptionDisplay: null
  };
  
  try {
    // Run all tests sequentially
    results.teacherInterface = await testTeacherInterfaceUI();
    results.studentInterface = await testStudentInterfaceUI();
    results.languageSelection = await testLanguageSelection();
    results.recordingButtons = await testRecordingButtons();
    results.transcriptionDisplay = await testTranscriptionDisplay();
    
    // Calculate overall success
    const allSucceeded = Object.values(results).every(result => result && result.success);
    
    console.log('\n----- Selenium UI Test Results -----');
    console.log(`Teacher Interface: ${results.teacherInterface.success ? 'PASS' : 'FAIL'}`);
    console.log(`Student Interface: ${results.studentInterface.success ? 'PASS' : 'FAIL'}`);
    console.log(`Language Selection: ${results.languageSelection.success ? 'PASS' : 'FAIL'}`);
    console.log(`Recording Buttons: ${results.recordingButtons.success ? 'PASS' : 'FAIL'}`);
    console.log(`Transcription Display: ${results.transcriptionDisplay.success ? 'PASS' : 'FAIL'}`);
    console.log('');
    console.log(`Overall Result: ${allSucceeded ? 'PASS' : 'FAIL'}`);
    console.log('------------------------------------');
    
    return results;
  } catch (error) {
    console.error('Error running Selenium tests:', error);
    throw error;
  }
}

// Export test functions for individual use
module.exports = {
  testTeacherInterfaceUI,
  testStudentInterfaceUI,
  testLanguageSelection,
  testRecordingButtons,
  testTranscriptionDisplay,
  runSeleniumTests
};

// Add Jest test structure
describe('Selenium UI Tests', () => {
  jest.setTimeout(TEST_TIMEOUT);
  
  test('Teacher Interface UI Elements', async () => {
    const result = await testTeacherInterfaceUI();
    expect(result.success).toBe(true);
  });
  
  test('Student Interface UI Elements', async () => {
    const result = await testStudentInterfaceUI();
    expect(result.success).toBe(true);
  });
  
  test('Language Selection', async () => {
    const result = await testLanguageSelection();
    expect(result.success).toBe(true);
  });
  
  test('Recording Button Functionality', async () => {
    const result = await testRecordingButtons();
    expect(result.success).toBe(true);
  });
  
  test('Real-time Transcription Display', async () => {
    const result = await testTranscriptionDisplay();
    expect(result.success).toBe(true);
  });
});

// If this script is run directly, execute all tests
if (require.main === module) {
  runSeleniumTests().catch(console.error);
}
/**
 * Teacher TTS Service Selection End-to-End Test
 * 
 * This test verifies that the teacher interface can select different TTS services
 * and that the selection is properly sent to the server and applied to all student connections.
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
const TEST_TIMEOUT = 60000; // 60 seconds for entire test

// Helper function for logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

describe('Teacher TTS Service Selection Tests', function() {
  this.timeout(TEST_TIMEOUT);
  
  let teacherDriver, studentDriver;
  
  /**
   * Setup test environment - create browser instances for teacher and student
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
    
    // Initialize WebDrivers (one for teacher, one for student)
    teacherDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    studentDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Navigate to pages
    await teacherDriver.get(`${APP_URL}/client/public/websocket-diagnostics.html`);
    log(`Teacher navigated to ${APP_URL}/client/public/websocket-diagnostics.html`);
    
    await studentDriver.get(`${APP_URL}/client/public/simple-student.html`);
    log(`Student navigated to ${APP_URL}/client/public/simple-student.html`);
    
    // Wait for pages to fully load
    await teacherDriver.sleep(2000);
    await studentDriver.sleep(2000);
    
    // Connect teacher
    const teacherConnectBtn = await teacherDriver.findElement(By.id('teacher-connect-btn'));
    await teacherConnectBtn.click();
    log('Teacher connect button clicked');
    
    // Wait for teacher to connect
    await teacherDriver.wait(
      until.elementLocated(By.css('.status.connected')),
      TIMEOUT,
      'Teacher failed to connect'
    );
    log('Teacher connected');
    
    // Connect student
    const studentConnectBtn = await studentDriver.findElement(By.id('connect-btn'));
    await studentConnectBtn.click();
    log('Student connect button clicked');
    
    // Wait for student to connect
    await studentDriver.wait(
      until.elementLocated(By.css('.connection-status.connected')),
      TIMEOUT,
      'Student failed to connect'
    );
    log('Student connected');
    
    // Wait for stable connection
    await teacherDriver.sleep(1000);
  });
  
  /**
   * Clean up after tests
   */
  afterEach(async function() {
    if (teacherDriver) {
      // Get browser console logs for debugging
      try {
        const logs = await teacherDriver.manage().logs().get(logging.Type.BROWSER);
        if (logs.length > 0) {
          console.log('Teacher browser console logs:');
          logs.forEach(entry => console.log(`  ${entry.level.name}: ${entry.message}`));
        }
      } catch (error) {
        console.error('Error retrieving teacher browser logs:', error.message);
      }
      
      await teacherDriver.quit();
      log('Teacher driver closed');
    }
    
    if (studentDriver) {
      // Get browser console logs for debugging
      try {
        const logs = await studentDriver.manage().logs().get(logging.Type.BROWSER);
        if (logs.length > 0) {
          console.log('Student browser console logs:');
          logs.forEach(entry => console.log(`  ${entry.level.name}: ${entry.message}`));
        }
      } catch (error) {
        console.error('Error retrieving student browser logs:', error.message);
      }
      
      await studentDriver.quit();
      log('Student driver closed');
    }
  });
  
  /**
   * Test: Teacher TTS Service Selection UI Elements
   * 
   * Verifies that the TTS service selection UI elements exist in the teacher interface
   */
  it('should display TTS service selection UI elements in teacher interface', async function() {
    // Check if the TTS service buttons exist
    const ttsBrowserBtn = await teacherDriver.findElement(By.id('teacher-tts-browser-btn'));
    const ttsOpenaiBtn = await teacherDriver.findElement(By.id('teacher-tts-openai-btn'));
    const ttsSilentBtn = await teacherDriver.findElement(By.id('teacher-tts-silent-btn'));
    
    // Assert that all elements are present
    assert(ttsBrowserBtn, 'Browser TTS button should be present');
    assert(ttsOpenaiBtn, 'OpenAI TTS button should be present');
    assert(ttsSilentBtn, 'Silent TTS button should be present');
    
    // Verify Browser button is active by default
    const isBrowserActive = await ttsBrowserBtn.getAttribute('class');
    assert(isBrowserActive.includes('active'), 'Browser TTS should be active by default');
    
    log('Successfully verified TTS service selection UI elements in teacher interface');
  });
  
  /**
   * Test: Changing Teacher TTS Service
   * 
   * Verifies that changing the TTS service as a teacher affects the student's received translations
   */
  it('should change TTS service for student when teacher changes selection', async function() {
    // Find the TTS service buttons
    const ttsOpenaiBtn = await teacherDriver.findElement(By.id('teacher-tts-openai-btn'));
    
    // Click the OpenAI button
    await ttsOpenaiBtn.click();
    log('OpenAI TTS button clicked');
    
    // Wait for TTS service to update
    await teacherDriver.sleep(1000);
    
    // Check current TTS service display
    const currentTtsService = await teacherDriver.findElement(By.id('current-tts-service'));
    const serviceText = await currentTtsService.getText();
    assert.strictEqual(serviceText, 'openai', 'Current TTS service should be "openai"');
    
    // Send a transcription from teacher
    const messageInput = await teacherDriver.findElement(By.id('teacher-message'));
    await messageInput.sendKeys('This is a test message using OpenAI TTS');
    
    const sendBtn = await teacherDriver.findElement(By.id('teacher-send-btn'));
    await sendBtn.click();
    log('Test message sent from teacher');
    
    // Wait for translation to appear for student
    await studentDriver.wait(
      until.elementLocated(By.css('.translation')),
      TIMEOUT,
      'Translation not received by student'
    );
    
    // Check for logs indicating OpenAI TTS
    const logsEl = await teacherDriver.findElement(By.id('teacher-logs'));
    const logsText = await logsEl.getText();
    
    // Log TTS service information for debugging
    log(`Teacher logs: ${logsText}`);
    
    // Check if OpenAI was used (will be in logs)
    assert(logsText.includes('ttsService') && logsText.includes('openai'), 
      'Logs should indicate OpenAI TTS service was used');
    
    log('Successfully verified teacher TTS service selection impacts student translations');
  });
  
  /**
   * Test: Silent TTS Mode
   * 
   * Verifies that the silent TTS mode selection by teacher disables audio for students
   */
  it('should set to silent mode for students when selected by teacher', async function() {
    // Find the Silent TTS button
    const ttsSilentBtn = await teacherDriver.findElement(By.id('teacher-tts-silent-btn'));
    
    // Click the Silent button
    await ttsSilentBtn.click();
    log('Silent TTS button clicked');
    
    // Wait for TTS service to update
    await teacherDriver.sleep(1000);
    
    // Check current TTS service display
    const currentTtsService = await teacherDriver.findElement(By.id('current-tts-service'));
    const serviceText = await currentTtsService.getText();
    assert.strictEqual(serviceText, 'silent', 'Current TTS service should be "silent"');
    
    // Send a transcription from teacher
    const messageInput = await teacherDriver.findElement(By.id('teacher-message'));
    await messageInput.sendKeys('This is a test message with silent TTS');
    
    const sendBtn = await teacherDriver.findElement(By.id('teacher-send-btn'));
    await sendBtn.click();
    log('Test message sent from teacher');
    
    // Wait for translation to appear for student
    await studentDriver.wait(
      until.elementLocated(By.css('.translation')),
      TIMEOUT,
      'Translation not received by student'
    );
    
    // Check for logs indicating Silent TTS
    const logsEl = await teacherDriver.findElement(By.id('teacher-logs'));
    const logsText = await logsEl.getText();
    
    // Check if Silent mode was used (will be in logs)
    assert(logsText.includes('ttsService') && logsText.includes('silent'), 
      'Logs should indicate Silent TTS service was used');
    
    log('Successfully verified silent TTS mode selection by teacher');
  });
});
/**
 * Teacher TTS Service Selection End-to-End Test
 * 
 * This test verifies that the teacher interface can select different TTS services
 * and that the selection is properly sent to the server and applied to all student connections.
 * It also verifies that the correct audio type plays based on the teacher's selection.
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
 * 
 * Tests the new architectural change:
 * - TTS service selection is centrally controlled by teachers
 * - Students can see but not change the active TTS service
 * - The right audio system is used based on teacher's preference
 */

const { Builder, By, until, logging, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Set test configuration from environment or defaults
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds
const TEST_TIMEOUT = 90000; // 90 seconds for entire test (audio tests take time)

// Helper function for logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Helper function to check if audio is playing
async function isAudioPlaying(driver) {
  try {
    const isPlaying = await driver.executeScript(`
      const audioElements = document.querySelectorAll('audio');
      for (const audio of audioElements) {
        if (!audio.paused && !audio.ended && audio.currentTime > 0) {
          return true;
        }
      }
      return false;
    `);
    return isPlaying;
  } catch (error) {
    log(`Error checking audio playback: ${error.message}`);
    return false;
  }
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
    
    // Add arguments for browser audio support
    options.addArguments('--use-fake-ui-for-media-stream');
    options.addArguments('--use-fake-device-for-media-stream');
    options.addArguments('--allow-file-access-from-files');
    options.addArguments('--autoplay-policy=no-user-gesture-required');
    
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
  
  /**
   * Test: Verify Browser TTS Audio Playback
   * 
   * Verifies that when the teacher selects Browser TTS,
   * the correct audio system plays on the student side
   */
  it('should play Browser TTS audio when teacher selects Browser TTS', async function() {
    // Select Browser TTS (usually default, but let's set it explicitly)
    const ttsBrowserBtn = await teacherDriver.findElement(By.id('teacher-tts-browser-btn'));
    await ttsBrowserBtn.click();
    log('Browser TTS button clicked');
    
    // Wait for TTS service to update
    await teacherDriver.sleep(1000);
    
    // Verify teacher's TTS selection
    const currentTtsService = await teacherDriver.findElement(By.id('current-tts-service'));
    const serviceText = await currentTtsService.getText();
    assert.strictEqual(serviceText, 'browser', 'Current TTS service should be "browser"');
    
    // Send a test message from teacher
    const messageInput = await teacherDriver.findElement(By.id('teacher-message'));
    await messageInput.clear();
    await messageInput.sendKeys('This is a test message using Browser TTS');
    
    const sendBtn = await teacherDriver.findElement(By.id('teacher-send-btn'));
    await sendBtn.click();
    log('Test message sent from teacher with Browser TTS');
    
    // Wait for translation to appear for student
    await studentDriver.wait(
      until.elementLocated(By.css('.translation')),
      TIMEOUT,
      'Translation not received by student'
    );
    
    // Verify the student's displayed TTS service
    try {
      const studentTtsDisplay = await studentDriver.findElement(By.id('active-tts-service'));
      const displayedService = await studentTtsDisplay.getText();
      assert(displayedService.includes('browser'), 'Student should display Browser as the active TTS service');
      log('Student correctly displays Browser as active TTS service');
    } catch (error) {
      log(`Error checking student TTS display: ${error.message}`);
      assert.fail('Could not verify student TTS service display');
    }
    
    // Wait briefly for audio to start playing (if applicable)
    await studentDriver.sleep(2000);
    
    // Check if audio is playing on student side (for Browser TTS, SpeechSynthesis should be active)
    const isSpeechSynthesisActive = await studentDriver.executeScript(`
      return (window.speechSynthesis && 
              window.speechSynthesis.speaking) ? true : false;
    `);
    
    // For browser TTS, we should see speechSynthesis.speaking is true
    assert(isSpeechSynthesisActive, 'Browser Speech Synthesis should be active when Browser TTS is selected');
    
    log('Successfully verified Browser TTS audio playback');
  });
  
  /**
   * Test: Student TTS Service UI is Read-Only
   * 
   * Verifies that student cannot change the TTS service, but can see
   * the teacher's selection and can compare other TTS services
   */
  it('should show teacher-controlled TTS service to students as read-only', async function() {
    // First, set to Browser TTS
    const ttsBrowserBtn = await teacherDriver.findElement(By.id('teacher-tts-browser-btn'));
    await ttsBrowserBtn.click();
    log('Browser TTS button clicked by teacher');
    
    // Wait for TTS service to update and propagate
    await teacherDriver.sleep(1000);
    
    // Send a test message from teacher
    const messageInput = await teacherDriver.findElement(By.id('teacher-message'));
    await messageInput.clear();
    await messageInput.sendKeys('This is a message to check TTS service display');
    
    const sendBtn = await teacherDriver.findElement(By.id('teacher-send-btn'));
    await sendBtn.click();
    log('Test message sent from teacher');
    
    // Wait for translation to appear for student
    await studentDriver.wait(
      until.elementLocated(By.css('.translation')),
      TIMEOUT,
      'Translation not received by student'
    );
    
    // Check if the student UI shows the teacher-controlled section
    const teacherControlled = await studentDriver.executeScript(`
      return document.body.innerHTML.includes('Teacher-Controlled TTS Service');
    `);
    
    assert(teacherControlled, 'Student UI should display the Teacher-Controlled TTS Service section');
    
    // Verify student can see TTS service comparison section
    const hasComparisonSection = await studentDriver.executeScript(`
      return document.getElementById('tts-comparison-section') !== null;
    `);
    
    assert(hasComparisonSection, 'Student UI should display the TTS comparison section');
    
    // Check if student can play comparison examples but not change the active service
    const hasPlayExampleButtons = await studentDriver.executeScript(`
      return document.querySelectorAll('.play-example-btn').length > 0;
    `);
    
    assert(hasPlayExampleButtons, 'Student should have play example buttons for TTS comparison');
    
    // Verify no change service buttons are present
    const hasChangeButtons = await studentDriver.executeScript(`
      return document.querySelectorAll('.change-tts-btn').length === 0;
    `);
    
    assert(hasChangeButtons, 'Student should not have buttons to change TTS service');
    
    log('Successfully verified student TTS UI is read-only with comparison functionality');
  });
});
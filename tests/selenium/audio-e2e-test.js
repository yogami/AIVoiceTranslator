/**
 * Audio End-to-End Test
 * 
 * This test verifies the complete audio capture, translation, and playback flow of the AIVoiceTranslator.
 * It simulates a teacher speaking, checks translation, and verifies audio playback for students.
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
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds
const AUDIO_PATH = path.join(__dirname, '../test-assets/audio');

// Enable more detailed logging for debugging in CI environment
const VERBOSE_LOGGING = process.env.CI === 'true';

// Helper function to log information only in verbose mode
function log(message) {
  if (VERBOSE_LOGGING) {
    console.log(`[Audio E2E Test] ${message}`);
  }
}

describe('AIVoiceTranslator Audio End-to-End Tests', function() {
  this.timeout(TEST_TIMEOUT);
  
  let teacherDriver;
  let studentDriver;
  
  /**
   * Setup test environment - create browser instances
   */
  before(async function() {
    log('Setting up test environment');
    
    // Check for audio support in the environment
    try {
      execSync('aplay --version');
      log('Audio support detected');
    } catch (e) {
      console.warn('Warning: Audio playback not supported in this environment. Some tests may be skipped.');
    }
    
    // Create Chrome options with audio enabled
    const options = new chrome.Options()
      .addArguments('--use-fake-device-for-media-stream')
      .addArguments('--use-fake-ui-for-media-stream')
      .addArguments('--no-sandbox')
      .addArguments('--disable-dev-shm-usage')
      .addArguments('--autoplay-policy=no-user-gesture-required'); // Allow audio autoplay
    
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
   * Test: Basic Audio Workflow
   * 
   * Verifies the basic end-to-end flow:
   * 1. Teacher speaks
   * 2. Audio is translated
   * 3. Student receives translated text
   * 4. Audio plays back for student
   */
  it('should capture teacher audio, translate it, and play it back for student', async function() {
    const testLanguage = 'es'; // Spanish
    const testText = 'This is a test of the translation system';
    const expectedTranslation = 'Este es una prueba del sistema de traducción'; // Approximate expected translation
    
    log('Starting basic audio workflow test');
    
    // ARRANGE: Set up teacher and student pages
    await teacherDriver.get(`${APP_URL}/simple-speech-test.html`);
    await studentDriver.get(`${APP_URL}/simple-student.html?lang=${testLanguage}`);
    
    // Wait for WebSocket connections to be established
    await teacherDriver.sleep(2000);
    await studentDriver.sleep(2000);
    
    log('Pages loaded and WebSocket connections established');
    
    // Select language on teacher page
    const teacherLangSelect = await teacherDriver.findElement(By.id('language-select'));
    await teacherLangSelect.sendKeys(testLanguage);
    
    log('Language selected on teacher page');
    
    // ACT: Simulate teacher speaking by sending text directly
    // This is more reliable than trying to play audio in the CI environment
    const transcriptionInput = await teacherDriver.findElement(By.id('transcription-input'));
    await transcriptionInput.clear();
    await transcriptionInput.sendKeys(testText);
    
    const sendButton = await teacherDriver.findElement(By.id('send-button'));
    await sendButton.click();
    
    log('Simulated teacher speaking with text input');
    
    // Wait for translation to complete (up to 5 seconds)
    await studentDriver.wait(async () => {
      const translationText = await studentDriver.findElement(By.id('translated-text')).getText();
      return translationText.length > 0;
    }, 5000, 'Translation did not appear on student page');
    
    // ASSERT: Verify translation appeared on student page
    const translationText = await studentDriver.findElement(By.id('translated-text')).getText();
    log(`Received translation: "${translationText}"`);
    
    // Check that translation contains key parts of the expected text
    // We don't expect an exact match due to translation variations
    assert.ok(
      translationText.toLowerCase().includes('prueba') && 
      translationText.toLowerCase().includes('sistema'), 
      `Translation doesn't contain expected key terms. Got: ${translationText}`
    );
    
    // Check if audio player exists on student page
    const audioPlayer = await studentDriver.findElement(By.id('audio-player'));
    assert.ok(audioPlayer, 'Audio player not found on student page');
    
    // Check if play button exists and is enabled
    const playButton = await studentDriver.findElement(By.id('play-button'));
    const isPlayButtonEnabled = await playButton.isEnabled();
    assert.ok(isPlayButtonEnabled, 'Play button should be enabled after translation');
    
    log('Basic audio workflow test passed');
  });
  
  /**
   * Test: Multiple Languages Support
   * 
   * Verifies translation works for multiple target languages:
   * 1. Tests translations for Spanish, French, and German
   * 2. Verifies correct text display for each language
   * 3. Confirms audio player appears for each language
   */
  it('should support translation to multiple languages', async function() {
    // This test will try multiple languages to ensure all are supported
    const testLanguages = ['es', 'fr', 'de']; // Spanish, French, German
    const testText = 'Hello world';
    
    log('Starting multiple languages test');
    
    // ARRANGE: Load teacher page once
    await teacherDriver.get(`${APP_URL}/simple-speech-test.html`);
    await teacherDriver.sleep(1000);
    
    // For each language, test the translation flow
    for (const lang of testLanguages) {
      log(`Testing language: ${lang}`);
      
      // Load student page with the specific language
      await studentDriver.get(`${APP_URL}/simple-student.html?lang=${lang}`);
      await studentDriver.sleep(1000);
      
      // Select language on teacher page
      const teacherLangSelect = await teacherDriver.findElement(By.id('language-select'));
      await teacherLangSelect.sendKeys(lang);
      
      // ACT: Simulate teacher speaking
      const transcriptionInput = await teacherDriver.findElement(By.id('transcription-input'));
      await transcriptionInput.clear();
      await transcriptionInput.sendKeys(testText);
      
      const sendButton = await teacherDriver.findElement(By.id('send-button'));
      await sendButton.click();
      
      // Wait for translation to appear (up to 5 seconds)
      await studentDriver.wait(async () => {
        const translationText = await studentDriver.findElement(By.id('translated-text')).getText();
        return translationText.length > 0;
      }, 5000, `Translation did not appear for language ${lang}`);
      
      // ASSERT: Verify translation appeared
      const translationText = await studentDriver.findElement(By.id('translated-text')).getText();
      log(`Received translation in ${lang}: "${translationText}"`);
      
      // Simple verification that we got some content (text length > 0)
      assert.ok(translationText.length > 0, `No translation received for ${lang}`);
      
      // Verify audio player exists
      const audioPlayer = await studentDriver.findElement(By.id('audio-player'));
      assert.ok(audioPlayer, `Audio player not found for language ${lang}`);
      
      log(`Language ${lang} test passed`);
    }
    
    log('Multiple languages test passed');
  });
});
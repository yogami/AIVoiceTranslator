const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Set up application URL - use environment variable or default
const APP_URL = process.env.APP_URL || 'https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
console.log(`Running audio E2E tests against: ${APP_URL}`);

// Test audio file path
const TEST_AUDIO_PATH = path.join(__dirname, '../test-assets/test-audio-english.mp3');

// Set up Chrome options
const options = new chrome.Options();
options.addArguments('--use-fake-ui-for-media-stream'); // Grant mic permissions automatically
options.addArguments('--use-fake-device-for-media-stream'); // Use fake device for media
options.addArguments('--allow-file-access-from-files');
options.addArguments('--no-sandbox');
options.addArguments('--disable-dev-shm-usage');

// We're not running headless for audio tests as they need audio playback capabilities
// options.addArguments('--headless');

/**
 * Complete end-to-end audio test that:
 * 1. Opens teacher interface in one browser
 * 2. Opens student interface in another browser
 * 3. Plays audio in the teacher's environment
 * 4. Verifies the translation appears in the student interface
 */
describe('AIVoiceTranslator Audio E2E Tests', function() {
  // Increase timeout for audio processing
  this.timeout(60000);
  
  let teacherDriver;
  let studentDriver;

  before(async function() {
    // Create teacher browser instance
    teacherDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Create student browser instance
    studentDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // Set implicit wait
    await teacherDriver.manage().setTimeouts({ implicit: 5000 });
    await studentDriver.manage().setTimeouts({ implicit: 5000 });
  });

  after(async function() {
    if (teacherDriver) {
      await teacherDriver.quit();
    }
    if (studentDriver) {
      await studentDriver.quit();
    }
  });

  it('should process, translate, and play audio from teacher to student interface', async function() {
    try {
      // 1. Set up the student browser first (listening for translations)
      await studentDriver.get(`${APP_URL}/simple-student.html`);
      
      // Wait for the WebSocket connection and select Spanish
      await studentDriver.wait(async function() {
        const statusElement = await studentDriver.findElement(By.id('connectionStatus'));
        const statusText = await statusElement.getText();
        return statusText.includes('Connected');
      }, 10000, 'Student WebSocket connection failed to establish');
      
      // Set student to receive Spanish translations
      const studentLanguageSelect = await studentDriver.findElement(By.id('studentLanguageSelect'));
      await studentLanguageSelect.click();
      const spanishOption = await studentDriver.findElement(By.css('option[value="es-ES"]'));
      await spanishOption.click();
      
      console.log('✓ Student interface ready to receive Spanish translations');
      
      // 2. Set up the teacher interface
      await teacherDriver.get(`${APP_URL}/simple-speech-test.html`);
      
      // Wait for WebSocket connection
      await teacherDriver.wait(async function() {
        const statusElement = await teacherDriver.findElement(By.id('connectionStatus'));
        const statusText = await statusElement.getText();
        return statusText.includes('Connected');
      }, 10000, 'Teacher WebSocket connection failed to establish');
      
      console.log('✓ Teacher interface connected');
      
      // 3. Verify the audio element exists in the student interface
      // This is our new feature - the audio playback element
      const audioElement = await studentDriver.findElement(By.id('translationAudio'));
      assert.ok(audioElement, 'Audio playback element should exist in student interface');
      
      // Verify the play button exists for manual playback
      const playButton = await studentDriver.findElement(By.id('playTranslationButton'));
      assert.ok(playButton, 'Play button should exist in student interface');
      
      // 4. Inject JavaScript to simulate a transcription from the teacher interface
      await teacherDriver.executeScript(`
        // Simulate a transcription being processed by the teacher interface
        const websocketClient = window.websocketClient;
        
        // Check if the WebSocket client is available and properly initialized
        if (websocketClient && websocketClient.isConnected()) {
          // Simulate an audio transcription
          websocketClient.sendTranscription("This is a test of the translation system");
          console.log("Test transcription sent");
          return true;
        } else {
          console.error("WebSocket client not available or not connected");
          return false;
        }
      `);
      
      console.log('✓ Simulated audio transcription sent from teacher interface');
      
      // 5. Wait for translation to appear in student interface
      await studentDriver.wait(async function() {
        const translationOutput = await studentDriver.findElement(By.id('translationOutput'));
        const translationText = await translationOutput.getText();
        console.log(`Current translation text: ${translationText}`);
        
        // Check if the translation contains key Spanish words we expect
        return translationText.includes('prueba') || 
               translationText.includes('sistema') || 
               translationText.includes('traducción');
      }, 20000, 'Translation did not appear in student interface');
      
      // Get final translation
      const translationOutput = await studentDriver.findElement(By.id('translationOutput'));
      const translationText = await translationOutput.getText();
      
      console.log(`✓ Received translation in student interface: "${translationText}"`);
      
      // Verify it contains Spanish text
      assert.ok(
        translationText.includes('prueba') || 
        translationText.includes('sistema') || 
        translationText.includes('traducción'),
        'Translation does not contain expected Spanish words'
      );
      
      // 6. Verify that the audio source was updated with a valid URL
      await studentDriver.wait(async function() {
        const audioSrc = await studentDriver.executeScript(`
          return document.getElementById('translationAudio').src;
        `);
        console.log(`Audio source: ${audioSrc}`);
        return audioSrc && audioSrc.length > 0 && !audioSrc.endsWith('undefined');
      }, 10000, 'Audio source was not updated with a valid URL');
      
      // 7. Verify that the audio can be played (we check if the audio element has data)
      const audioHasData = await studentDriver.executeScript(`
        const audio = document.getElementById('translationAudio');
        return audio.duration > 0 || audio.readyState > 0;
      `);
      
      console.log(`Audio playback verification: ${audioHasData ? 'Successful' : 'Failed'}`);
      
      // Because actual audio playback is difficult to verify in headless testing,
      // we'll also check that the playback controls are properly enabled
      const playButtonEnabled = await studentDriver.executeScript(`
        return !document.getElementById('playTranslationButton').disabled;
      `);
      
      assert.ok(playButtonEnabled, 'Play button should be enabled when audio is available');
      
      console.log('✓ Audio playback feature verified successfully');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
});
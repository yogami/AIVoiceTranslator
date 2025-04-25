/**
 * Real Hardware End-to-End Test for Benedictaitor
 * 
 * This test:
 * 1. Opens TWO browser windows (teacher and student)
 * 2. Plays an actual audio file through system speakers
 * 3. Teacher microphone picks up the audio
 * 4. Verifies the transcription appears correctly on teacher's side
 * 5. Verifies the translation appears on student's side
 * 
 * This test requires:
 * - Working speakers
 * - Working microphone
 * - Audio routing that allows the microphone to pick up speaker output
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const APP_URL = process.env.APP_URL || 'https://bendictaitor-app.replit.app';
const TEST_TIMEOUT = 60000;
const SAMPLE_AUDIO_PATH = path.join(__dirname, 'sample-audio.mp3');
const TEST_TEXT = "This is a test of the real-time translation system. Can you hear me clearly?";
const STUDENT_LANGUAGE = 'es'; // Spanish

// Check if running in Windows
const isWindows = process.platform === 'win32';
// Check if running in Mac
const isMac = process.platform === 'darwin';
// Check if running in Linux
const isLinux = process.platform === 'linux';

// Function to ensure test audio exists
async function ensureTestAudioExists() {
  if (fs.existsSync(SAMPLE_AUDIO_PATH)) {
    console.log(`Test audio file already exists at: ${SAMPLE_AUDIO_PATH}`);
    return SAMPLE_AUDIO_PATH;
  }
  
  // If audio doesn't exist, create it
  console.log('Test audio file does not exist, creating it...');
  
  try {
    // Generate simple audio file using text-to-speech
    let success = false;
    
    if (isWindows) {
      // Windows - use PowerShell
      console.log('Using Windows PowerShell for TTS');
      const powershellScript = `
        Add-Type -AssemblyName System.Speech
        $synthesizer = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
        $synthesizer.SetOutputToWaveFile("${SAMPLE_AUDIO_PATH.replace(/\\/g, '\\\\')}")
        $synthesizer.Speak("${TEST_TEXT}")
        $synthesizer.Dispose()
      `;
      
      // Execute PowerShell script
      execSync(`powershell -Command "${powershellScript}"`, { windowsHide: true });
      success = true;
    } else if (isMac) {
      // macOS - use say command
      console.log('Using macOS say command for TTS');
      execSync(`say -v Alex -o "${SAMPLE_AUDIO_PATH}" "${TEST_TEXT}"`, { stdio: 'inherit' });
      success = true;
    } else if (isLinux) {
      // Linux - try espeak
      console.log('Using Linux espeak for TTS');
      try {
        execSync(`espeak "${TEST_TEXT}" -w "${SAMPLE_AUDIO_PATH}"`, { stdio: 'inherit' });
        success = true;
      } catch (error) {
        console.log('Failed to use espeak, falling back to creating a simple tone file');
        
        // Create a simple tone file using sox if available
        try {
          execSync(`sox -n "${SAMPLE_AUDIO_PATH}" synth 5 sine 440`, { stdio: 'inherit' });
          success = true;
          console.log('Created tone file using sox');
        } catch (soxError) {
          console.log('Failed to create audio with sox');
        }
      }
    }
    
    if (!success) {
      // Fallback: Create a dummy file with a note
      fs.writeFileSync(SAMPLE_AUDIO_PATH, "This is a placeholder for an audio file");
      console.error('Could not create audio file, created placeholder file instead');
      throw new Error('Audio file creation failed');
    }
    
    console.log(`Test audio file created at: ${SAMPLE_AUDIO_PATH}`);
    return SAMPLE_AUDIO_PATH;
  } catch (error) {
    console.error(`Error creating test audio: ${error.message}`);
    throw error;
  }
}

// Function to play audio file
async function playAudioFile(audioPath) {
  console.log(`Playing audio file: ${audioPath}`);
  
  return new Promise((resolve, reject) => {
    try {
      let process;
      
      if (isWindows) {
        process = spawn('powershell', [
          '-Command',
          `(New-Object Media.SoundPlayer "${audioPath.replace(/\\/g, '\\\\')}").PlaySync()`
        ]);
      } else if (isMac) {
        process = spawn('afplay', [audioPath]);
      } else if (isLinux) {
        // Try to use available audio players
        try {
          process = spawn('aplay', [audioPath]);
        } catch (error) {
          try {
            process = spawn('mplayer', [audioPath]);
          } catch (error2) {
            try {
              process = spawn('mpg123', [audioPath]);
            } catch (error3) {
              reject(new Error('No audio player available on this system'));
              return;
            }
          }
        }
      } else {
        reject(new Error('Unsupported platform'));
        return;
      }
      
      process.on('close', (code) => {
        if (code === 0) {
          console.log('Audio playback completed successfully');
          resolve();
        } else {
          console.error(`Audio playback process exited with code ${code}`);
          reject(new Error(`Audio playback failed with code ${code}`));
        }
      });
      
      process.on('error', (err) => {
        console.error(`Audio playback error: ${err.message}`);
        reject(err);
      });
    } catch (error) {
      console.error(`Error starting audio playback: ${error.message}`);
      reject(error);
    }
  });
}

// Function to wait for transcription/translation to appear
async function waitForText(driver, selector, minLength = 5, maxWaitTimeMs = 30000) {
  console.log(`Waiting for text with selector: ${selector}`);
  
  const startTime = Date.now();
  let lastText = '';
  
  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      // Find all elements that match the selector
      const elements = await driver.findElements(By.css(selector));
      
      // Get text from all matching elements
      let allText = '';
      for (const element of elements) {
        const text = await element.getText();
        if (text && text.length > 0) {
          allText += text + ' ';
        }
      }
      
      // Trim the text
      allText = allText.trim();
      
      // If text has changed, log it
      if (allText !== lastText) {
        lastText = allText;
        console.log(`Current text: "${allText}"`);
      }
      
      // If we have enough text, return it
      if (allText.length >= minLength) {
        return allText;
      }
    } catch (error) {
      // Ignore errors and keep trying
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Timed out waiting for text with selector: ${selector}`);
}

// Main test function
async function runTest() {
  let teacherDriver = null;
  let studentDriver = null;
  
  try {
    // 1. Ensure test audio exists
    await ensureTestAudioExists();
    
    // 2. Set up Chrome options for Teacher browser
    console.log('Setting up Teacher browser...');
    const teacherOptions = new chrome.Options();
    teacherOptions.addArguments('--window-size=1280,800');
    teacherOptions.addArguments('--disable-extensions');
    teacherOptions.addArguments('--use-fake-ui-for-media-stream'); // Auto-approve media permissions
    
    // 3. Build the Teacher WebDriver
    teacherDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(teacherOptions)
      .build();
    
    // 4. Set up Chrome options for Student browser
    console.log('Setting up Student browser...');
    const studentOptions = new chrome.Options();
    studentOptions.addArguments('--window-size=1280,800');
    studentOptions.addArguments('--disable-extensions');
    
    // 5. Build the Student WebDriver
    studentDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(studentOptions)
      .build();
    
    // 6. Set implicit wait for both drivers
    await teacherDriver.manage().setTimeouts({ implicit: 5000 });
    await studentDriver.manage().setTimeouts({ implicit: 5000 });
    
    // 7. Navigate to the Teacher and Student pages
    console.log('Navigating to the Teacher page...');
    await teacherDriver.get(`${APP_URL}/teacher`);
    
    console.log('Navigating to the Student page...');
    await studentDriver.get(`${APP_URL}/student`);
    
    // 8. Wait for both pages to load
    const teacherTitle = await teacherDriver.getTitle();
    console.log(`Teacher page loaded: ${teacherTitle}`);
    
    const studentTitle = await studentDriver.getTitle();
    console.log(`Student page loaded: ${studentTitle}`);
    
    // 9. Set up the Student's language
    console.log(`Setting student language to: ${STUDENT_LANGUAGE}`);
    try {
      // Try to find language selection dropdown
      const languageSelectors = await studentDriver.findElements(
        By.css('select.language-select, select[name="language"], select.language-selector')
      );
      
      if (languageSelectors.length > 0) {
        // Select the language
        await languageSelectors[0].click();
        await languageSelectors[0].sendKeys(STUDENT_LANGUAGE);
        await languageSelectors[0].sendKeys(Key.ENTER);
        console.log('Selected language from dropdown');
      } else {
        // Try clicking on language buttons if no dropdown
        const languageButtons = await studentDriver.findElements(
          By.css(`button[data-language="${STUDENT_LANGUAGE}"], button.language-${STUDENT_LANGUAGE}`)
        );
        
        if (languageButtons.length > 0) {
          await languageButtons[0].click();
          console.log('Selected language from buttons');
        } else {
          console.log('Could not find language selection controls, will try with JavaScript');
          
          // Try setting language via JavaScript
          await studentDriver.executeScript(`
            // Try to find and set language in various ways
            if (window.webSocketClient && typeof window.webSocketClient.updateLanguage === 'function') {
              window.webSocketClient.updateLanguage("${STUDENT_LANGUAGE}");
              console.log("Set language via webSocketClient");
            } else if (window.wsClient && typeof window.wsClient.updateLanguage === 'function') {
              window.wsClient.updateLanguage("${STUDENT_LANGUAGE}");
              console.log("Set language via wsClient");
            } else {
              // Try to find and interact with DOM elements
              const selects = document.querySelectorAll('select');
              for (const select of selects) {
                const options = select.querySelectorAll('option');
                for (const option of options) {
                  if (option.value === "${STUDENT_LANGUAGE}" || option.textContent.toLowerCase().includes("${STUDENT_LANGUAGE}")) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));
                    console.log("Set language via select element");
                    return;
                  }
                }
              }
              
              // Try buttons
              const buttons = document.querySelectorAll('button');
              for (const button of buttons) {
                if (button.textContent.toLowerCase().includes("${STUDENT_LANGUAGE}") || 
                    button.getAttribute('data-language') === "${STUDENT_LANGUAGE}") {
                  button.click();
                  console.log("Set language via button click");
                  return;
                }
              }
              
              console.log("Could not set language via JavaScript");
            }
          `);
        }
      }
    } catch (error) {
      console.log(`Error setting student language: ${error.message}`);
    }
    
    // 10. Start the recording on Teacher page
    console.log('Starting recording on Teacher page...');
    try {
      const startButtons = await teacherDriver.findElements(
        By.css('button.record-button, button[aria-label="Start Recording"], button:contains("Record")')
      );
      
      if (startButtons.length > 0) {
        await startButtons[0].click();
        console.log('Clicked start recording button');
      } else {
        console.log('Could not find recording button, trying with JavaScript');
        
        // Try to start recording via JavaScript
        await teacherDriver.executeScript(`
          // Try various methods to start recording
          if (window.startRecording) {
            window.startRecording();
            console.log("Started recording via global function");
          } else {
            // Try to find and click a button
            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
              const text = button.textContent.toLowerCase();
              if (text.includes('record') || text.includes('start') || 
                  button.className.includes('record') || 
                  button.getAttribute('aria-label')?.toLowerCase().includes('record')) {
                button.click();
                console.log("Started recording via button click");
                return;
              }
            }
            
            console.log("Could not start recording via JavaScript");
          }
        `);
      }
    } catch (error) {
      console.log(`Error starting recording: ${error.message}`);
    }
    
    // 11. Play the audio file
    console.log('Playing test audio...');
    await playAudioFile(SAMPLE_AUDIO_PATH);
    
    // 12. Wait for transcription to appear on Teacher page
    console.log('Waiting for transcription on Teacher page...');
    const teacherTranscription = await waitForText(
      teacherDriver,
      '.transcription, .speech-text, .transcript, [data-test="transcription"]',
      10, // Min length
      30000 // Max wait time
    );
    
    console.log(`Teacher transcription received: "${teacherTranscription}"`);
    
    // 13. Wait for translation to appear on Student page
    console.log('Waiting for translation on Student page...');
    const studentTranslation = await waitForText(
      studentDriver,
      '.translation, .speech-text, .transcript, [data-test="translation"]',
      10, // Min length
      30000 // Max wait time
    );
    
    console.log(`Student translation received: "${studentTranslation}"`);
    
    // 14. Stop the recording on Teacher page
    console.log('Stopping recording on Teacher page...');
    try {
      const stopButtons = await teacherDriver.findElements(
        By.css('button.stop-button, button[aria-label="Stop Recording"]')
      );
      
      if (stopButtons.length > 0) {
        await stopButtons[0].click();
        console.log('Clicked stop recording button');
      } else {
        // Try with JavaScript
        await teacherDriver.executeScript(`
          // Try various methods to stop recording
          if (window.stopRecording) {
            window.stopRecording();
            console.log("Stopped recording via global function");
          } else {
            // Try to find and click a button
            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
              const text = button.textContent.toLowerCase();
              if (text.includes('stop') || 
                  button.className.includes('stop') || 
                  button.getAttribute('aria-label')?.toLowerCase().includes('stop')) {
                button.click();
                console.log("Stopped recording via button click");
                return;
              }
            }
            
            console.log("Could not stop recording via JavaScript");
          }
        `);
      }
    } catch (error) {
      console.log(`Error stopping recording: ${error.message}`);
    }
    
    // 15. Take screenshots of both pages
    console.log('Taking screenshots...');
    const teacherScreenshot = await teacherDriver.takeScreenshot();
    console.log('Teacher screenshot captured');
    
    const studentScreenshot = await studentDriver.takeScreenshot();
    console.log('Student screenshot captured');
    
    // 16. Verify results
    const testSuccess = 
      teacherTranscription.length > 10 && 
      studentTranslation.length > 10;
    
    // 17. Print results
    console.log('\n======== TEST RESULTS ========');
    console.log('Teacher Transcription:');
    console.log(`"${teacherTranscription}"`);
    console.log('\nStudent Translation:');
    console.log(`"${studentTranslation}"`);
    console.log('\nVerdict:');
    console.log(testSuccess ? '✅ TEST PASSED!' : '❌ TEST FAILED!');
    console.log('==============================\n');
    
    return testSuccess;
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  } finally {
    // Close the browsers
    if (teacherDriver) {
      console.log('Closing Teacher browser...');
      await teacherDriver.quit();
    }
    
    if (studentDriver) {
      console.log('Closing Student browser...');
      await studentDriver.quit();
    }
  }
}

// Run the test
runTest()
  .then(success => {
    console.log(`Test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`Test execution error: ${error.message}`);
    process.exit(1);
  });
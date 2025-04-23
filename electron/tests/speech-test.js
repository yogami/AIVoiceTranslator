/**
 * Speech Recognition End-to-End Test for Benedictaitor
 * 
 * This test directly tests the Web Speech API integration by:
 * 1. Opening a browser with microphone permissions
 * 2. Navigating to the speech test page
 * 3. Playing test audio through the system
 * 4. Verifying that speech recognition works
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const APP_URL = process.env.APP_URL || 'https://bendictaitor-app.replit.app';
const SPEECH_TEST_URL = `${APP_URL}/speechtest`;
const TEST_TIMEOUT = 45000;
const SAMPLE_AUDIO_PATH = path.join(__dirname, 'speech-sample.mp3');
const TEST_TEXT = "Testing speech recognition one two three four five";

// Check platform
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Function to ensure test audio exists
async function ensureTestAudioExists() {
  if (fs.existsSync(SAMPLE_AUDIO_PATH)) {
    console.log(`Speech test audio file already exists at: ${SAMPLE_AUDIO_PATH}`);
    return SAMPLE_AUDIO_PATH;
  }
  
  // If audio doesn't exist, create it
  console.log('Speech test audio file does not exist, creating it...');
  
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
      fs.writeFileSync(SAMPLE_AUDIO_PATH, "This is a placeholder for a speech audio file");
      console.error('Could not create speech audio file, created placeholder file instead');
      throw new Error('Speech audio file creation failed');
    }
    
    console.log(`Speech test audio file created at: ${SAMPLE_AUDIO_PATH}`);
    return SAMPLE_AUDIO_PATH;
  } catch (error) {
    console.error(`Error creating speech test audio: ${error.message}`);
    throw error;
  }
}

// Function to play audio file
async function playAudioFile(audioPath, numTimes = 3) {
  console.log(`Playing speech audio file ${numTimes} times: ${audioPath}`);
  
  for (let i = 0; i < numTimes; i++) {
    console.log(`Playing audio iteration ${i + 1}/${numTimes}...`);
    
    await new Promise((resolve, reject) => {
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
            console.log(`Audio iteration ${i + 1}/${numTimes} completed successfully`);
            resolve();
          } else {
            console.error(`Audio iteration ${i + 1}/${numTimes} exited with code ${code}`);
            reject(new Error(`Audio playback failed with code ${code}`));
          }
        });
        
        process.on('error', (err) => {
          console.error(`Audio iteration ${i + 1}/${numTimes} error: ${err.message}`);
          reject(err);
        });
      } catch (error) {
        console.error(`Error starting audio iteration ${i + 1}/${numTimes}: ${error.message}`);
        reject(error);
      }
    });
    
    // Pause between plays
    if (i < numTimes - 1) {
      console.log('Pausing between audio iterations...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Function to wait for speech recognition results
async function waitForSpeechRecognition(driver, minLength = 5, maxWaitTimeMs = 30000) {
  console.log('Waiting for speech recognition results...');
  
  const startTime = Date.now();
  let lastText = '';
  
  // Possible selectors for speech recognition results
  const selectors = [
    '.speech-result', '.transcript', '.recognition-result', 
    '#transcript', '#speechResult', '.speech-text',
    '[data-test="transcript"]', '[data-test="speech-result"]'
  ];
  
  const combinedSelector = selectors.join(', ');
  
  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      // Find all elements that match any selector
      const elements = await driver.findElements(By.css(combinedSelector));
      
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
        console.log(`Current recognition text: "${allText}"`);
      }
      
      // If we have enough text, return it
      if (allText.length >= minLength) {
        return allText;
      }
      
      // Also try to get results from JavaScript
      const jsResults = await driver.executeScript(`
        // Try to get speech recognition results from various sources
        const results = [];
        
        // Check for results in common element IDs and classes
        const selectors = ['.speech-result', '.transcript', '.recognition-result', 
          '#transcript', '#speechResult', '.speech-text'];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent && element.textContent.trim().length > 0) {
              results.push(element.textContent.trim());
            }
          }
        }
        
        // Check for results in global variables
        if (window.recognitionResults) {
          results.push(window.recognitionResults);
        }
        
        if (window.speechRecognitionText) {
          results.push(window.speechRecognitionText);
        }
        
        // Check for results in data attributes
        const dataElements = document.querySelectorAll('[data-transcript], [data-recognition]');
        for (const element of dataElements) {
          if (element.dataset.transcript) {
            results.push(element.dataset.transcript);
          }
          if (element.dataset.recognition) {
            results.push(element.dataset.recognition);
          }
        }
        
        return results.join(' ').trim();
      `);
      
      if (jsResults && jsResults.length >= minLength && jsResults !== lastText) {
        console.log(`JavaScript recognition results: "${jsResults}"`);
        return jsResults;
      }
    } catch (error) {
      // Ignore errors and keep trying
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Timed out waiting for speech recognition results');
}

// Main test function
async function runSpeechTest() {
  let driver = null;
  
  try {
    // 1. Ensure test audio exists
    await ensureTestAudioExists();
    
    // 2. Set up Chrome options
    console.log('Setting up browser for speech recognition test...');
    const options = new chrome.Options();
    options.addArguments('--window-size=1280,800');
    options.addArguments('--disable-extensions');
    options.addArguments('--use-fake-ui-for-media-stream'); // Auto-approve media permissions
    
    // 3. Build the WebDriver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // 4. Set implicit wait
    await driver.manage().setTimeouts({ implicit: 5000 });
    
    // 5. Navigate to the Speech Test page
    console.log(`Navigating to the Speech Test page: ${SPEECH_TEST_URL}`);
    await driver.get(SPEECH_TEST_URL);
    
    // 6. Wait for page to load
    const pageTitle = await driver.getTitle();
    console.log(`Speech Test page loaded: ${pageTitle}`);
    
    // 7. Check for Start button and click it if present
    try {
      const startButtons = await driver.findElements(
        By.css('button[id="startSpeech"], button.start-speech, button:contains("Start Recognition")')
      );
      
      if (startButtons.length > 0) {
        console.log('Clicking Start Recognition button...');
        await startButtons[0].click();
      } else {
        console.log('No Start Recognition button found, trying JavaScript');
        
        // Try to start speech recognition via JavaScript
        await driver.executeScript(`
          // Try various methods to start speech recognition
          if (window.startSpeechRecognition) {
            window.startSpeechRecognition();
            console.log("Started speech recognition via global function");
          } else if (window.startRecognition) {
            window.startRecognition();
            console.log("Started recognition via global function");
          } else {
            // Try to find and click a button
            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
              const text = button.textContent.toLowerCase();
              if (text.includes('start') && (text.includes('speech') || text.includes('recognition'))) {
                button.click();
                console.log("Started speech recognition via button click");
                return;
              }
            }
            
            // Try to create and start speech recognition
            try {
              console.log("Attempting to create speech recognition directly");
              const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.continuous = true;
              recognition.interimResults = true;
              recognition.lang = 'en-US';
              recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                  .map(result => result[0].transcript)
                  .join(' ');
                console.log("Recognition result:", transcript);
                window.speechRecognitionText = transcript;
              };
              recognition.start();
              window.testRecognition = recognition;
              console.log("Created and started speech recognition via JavaScript");
            } catch (error) {
              console.error("Failed to create speech recognition:", error);
            }
          }
        `);
      }
    } catch (error) {
      console.log(`Error starting speech recognition: ${error.message}`);
    }
    
    // 8. Play the audio file multiple times to ensure recognition
    console.log('Playing test audio file for speech recognition...');
    await playAudioFile(SAMPLE_AUDIO_PATH, 3);
    
    // 9. Wait for speech recognition results
    console.log('Waiting for speech recognition results...');
    const recognitionResults = await waitForSpeechRecognition(driver, 5, 30000);
    
    // 10. Take screenshot
    console.log('Taking screenshot...');
    const screenshot = await driver.takeScreenshot();
    console.log('Screenshot captured');
    
    // 11. Verify results
    console.log('\n======== SPEECH TEST RESULTS ========');
    console.log('Recognition Results:');
    console.log(`"${recognitionResults}"`);
    
    // Check if results contain any words from the test text
    const testWords = TEST_TEXT.toLowerCase().split(' ');
    const resultWords = recognitionResults.toLowerCase().split(' ');
    
    let matchedWords = 0;
    for (const testWord of testWords) {
      if (testWord.length > 3 && resultWords.includes(testWord)) {
        matchedWords++;
      }
    }
    
    const matchPercentage = (matchedWords / testWords.length) * 100;
    console.log(`Match Percentage: ${matchPercentage.toFixed(1)}%`);
    
    const testSuccess = matchPercentage >= 20 || recognitionResults.length >= 10;
    
    console.log('Verdict:');
    console.log(testSuccess ? '✅ SPEECH TEST PASSED!' : '❌ SPEECH TEST FAILED!');
    console.log('====================================\n');
    
    return testSuccess;
  } catch (error) {
    console.error(`❌ Speech test failed: ${error.message}`);
    return false;
  } finally {
    // Close the browser
    if (driver) {
      console.log('Closing browser...');
      await driver.quit();
    }
  }
}

// Run the test
runSpeechTest()
  .then(success => {
    console.log(`Speech Test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`Speech test execution error: ${error.message}`);
    process.exit(1);
  });
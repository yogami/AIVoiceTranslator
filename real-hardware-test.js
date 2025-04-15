/**
 * Real Hardware End-to-End Test for Benedictaitor
 * 
 * This test:
 * 1. Opens a browser and navigates to the teacher interface
 * 2. Plays an actual audio file through system speakers
 * 3. Waits for the microphone to pick up the audio
 * 4. Verifies the transcription appears correctly
 * 
 * This test requires:
 * - Working speakers
 * - Working microphone
 * - Audio routing that allows the microphone to pick up speaker output
 */

import { Builder, By, until } from 'selenium-webdriver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message.wav');

// Play audio through system speakers multiple times with varying volume
async function playAudioFile(numIterations = 3) {
  return new Promise(async (resolve, reject) => {
    console.log(`Playing test audio through system speakers ${numIterations} times...`);
    
    try {
      // Try to determine the OS to use the appropriate audio player
      const platform = process.platform;
      let baseCommand;
      
      if (platform === 'darwin') {
        // macOS
        baseCommand = `afplay "${TEST_AUDIO_PATH}"`;
      } else if (platform === 'win32') {
        // Windows
        baseCommand = `powershell -c (New-Object Media.SoundPlayer '${TEST_AUDIO_PATH}').PlaySync()`;
      } else {
        // Linux and others - try to use play from sox package
        baseCommand = `play "${TEST_AUDIO_PATH}"`;
      }
      
      console.log(`Base command: ${baseCommand}`);
      
      // Play the audio multiple times at different volumes for better chance of pickup
      let successCount = 0;
      
      for (let i = 0; i < numIterations; i++) {
        // For Linux/macOS, we can set volume level
        let command = baseCommand;
        if (platform !== 'win32' && i > 0) {
          // Increase volume for each subsequent play (Linux/macOS)
          const volume = (i + 1) * 0.3; // 0.3, 0.6, 0.9, etc.
          command = platform === 'darwin' 
            ? `${baseCommand} --volume ${volume}` 
            : `${baseCommand} vol ${volume}`;
        }
        
        console.log(`Iteration ${i+1}/${numIterations} - Executing command: ${command}`);
        
        // Execute the command and wait for it to finish
        await new Promise(resolvePlay => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error playing audio (iteration ${i+1}): ${error.message}`);
              if (i === 0) {
                console.error(`You may need to install: 
                  - On Linux: sudo apt-get install sox
                  - On macOS: brew install sox
                  - On Windows: No additional software needed
                `);
              }
              resolvePlay(false);
            } else {
              console.log(`Audio played successfully (iteration ${i+1})`);
              successCount++;
              resolvePlay(true);
            }
          });
        });
        
        // Wait 1 second between plays
        if (i < numIterations - 1) {
          console.log('Waiting 1 second before next play...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      console.log(`Audio playback completed. Successful plays: ${successCount}/${numIterations}`);
      resolve(successCount > 0);
    } catch (error) {
      console.error('Error attempting to play audio:', error);
      resolve(false);
    }
  });
}

// Ensure test audio file exists
async function ensureTestAudioExists() {
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Test audio file not found, creating it...');
    
    // This is the same test audio from e2e-speech-test.js
    const TEST_AUDIO_BASE64 = `
    UklGRrAYAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YYwYAAAAADYPXh6+IHEi
    +yIgIT4gMiIvGUoOFBNwJDQVtAhPGUMZUhCmF0odURNICRwcgBXMErQjShhSFlkhkRMEBnoe
    cRONDHQOUQyoFiwXFQV3CDcbSBmcDYQJUByKFtYHeC22KvITTAmkHh0clgK5FlIbLxD+CKIY
    sRRoBkUSjCIZEGwHuyu9JNUMhSc/IwQHUhl6L7AQvwk0MRshqxrFJVIEAgAkHxIYeg1/FYYt
    GRImDnUvTRWOBeUrPyXLCPEfGyU6AmwWuyyLAS8I0CZ5GecOXRG+JV0TBA0DLt4fcwnzJFoe
    wwK4GYcsfA1CCrEkMCLeDFYMjS2QIb8ITRsHLlMLsQvYJd0WPAV9E7MlrRO/B+UkXCOICzUJ
    xS2wJC0IBxa+J4UInQUgHgMgTAaHEg8jCAyjCUwZXSWMCF8D5SC3IDwIbQmbJEYbwwHqF9go
    cQOsBdwW2xyrCxIIHCKwGx0DiQzwGFARXAVTDrUYFw+cEzAaYhTwBnIQpBmMDSgMKhpyDlIG
    +RJ2GOMNYgXMF2QQVgkfEiYY7gz7BVESMRg/B+4JdRdODo0JYRl3FTkF4QyJG+gGkAOBFQsO
    OAf6FsUVHQZzBwoX5Qv7DS4YUwpdB5oXSA0HA8ISpgqoBj8SgxTJChUJ+Rf0CpYDihF+DOwG
    +RXbFjIMbg+eF4cFNQYyHF8M/APZFWUSVwadBxwZnwyxCsEYZg0VAx0YVxXqBlQGZhleDJkB
    GRmKEqcDxgl1F+wEOAJzHXIKFAD2FaMZSwOrCA4XIgg8C/QXRQp4A08UghV/BsMJQiMGDR4C
    xROFDnUTiBDbFFICxhCJHoYHHQXhHdIMoAs2H38PFAdPGNwUnABxDCkgKwcfBS4btBAJDZwU
    Mgm9DRIVwQ5qCPQQwxZ8CN8JlBZrDCwExRVFEi0Eww9nFUAJ4Qx5EJkL3Q4XDhoOCwvaCZcQ
    hwv0ByASnQ1NBtwOrxXyBpUMaBZtCw8NQBG/Cd8IuRRZB5oEkBUrDM0D9g43ErYHjwisFhUP
    9AlkE9sMKAZHD0oQggJoC78WcwOZBZgVWgfbBUkVXwRxAGMNkw4RAlQCuxeQBMkFPxoGA2QD
    ixBGBN8KYQxXCWsMGg0EBpYLLRGWBGkKwRFyAvANnw0TAk8LshHzCTkGTRMfBkIHJRMdCBwJ
    BA8oDpIGQwm/EMoEuAf/Dx0J8wTwCXgRXgFSB5QPcQNaBW0O2QuSA/4PrBGaA2YHbRZXAgMF
    6hVCBZQDohR9CBgCow8IDJIFBRMpC2gBzgvkENr/KQT9FJoCGQL+EaMMagK3DrIN4wN0C/oR
    WAMyBb8TBwWtAvUUXgS7BKgWvAEI/7wIKAXxA0sLlAssBNEQJgw2BAgMkQvb/8EAARSuBGgC
    FRRRBLcBIQ7/BwAD0wiwCPYD0woQDhUFTQoLE7cDdwOnE/cFqAGNEtMIagAyDFENwP9+BQwJ
    zACVB7MIvQNPBykVMQMgApgNbf+XAs0OAgHdANYIFQpiBRQMIgkEAkkKFg1PAFYEVwwxBWIF
    mA4VBPkBDg8eBj0CPQx0CRcDywzECA0A0AYqDuX7JwNADbL8QwJuCHv/ZAhPDb8DKgC0CzgD
    l/49BuYFmP9tBSALuwLyAcAKOQRYAGEMRgQ+/YoO4ARk+wULsAbM+3AJJQWv/0YJTgcBAecL
    BgMz/NkJHAZF/2cNIwPS/SwK9AHs/6UJ2ACb/aQKYQC7/qUK9wR9/YAFbghb/NQDXQrH/JcF
    LAdA/bUHuwNj/gAIPwTZ/SoKGQJl/EYFQgTf/TgGJgN1AKMJsf9f/QwJmP+U/jIJ/wGc/4AE
    ngEh/88HvgHm/VUG/wX3/F4FHwcp/RIKMgN9/IwH+wE2/eYGsASx/SoDKgbf/2UEPQSp/IYG
    1AD+/NEJMv+C/2YGif/mAOgEHP8V/mAFxwHu/UUE6wKK/gUDPgOz/8gA5wLK/1UC7wGH/nsD
    uQFZ/0cCDwGHADYAvAHc/jEDrAG4/eUD2AIJ/hcC/wHU/14BUgKO/r4BNgJg/wIBiwCw/r8C
    IgGK/isAyAK6ALP/LgCLANQA6QDZ/1YAUQBFALH/cP+dAAUBaAA1AFUA/gAFAEYA9v+//67/
    fQDpAJX/t/++/5b/rgCvAFj/pf/c/07/LADQ/4b/yf8+AOz/9f9V/+f/6/9F/7D/FQCT/9T/
    LwAz/+D/+P8BAAMAAQAYAB4AEgDx/wgA3/8JAPH/xf8xAJz/5P/j/y0Ayf/u/wYAJADz/xIA
    6P/8/yEADADs/xMA+v8FAPL/5f/+/wwA5f8XAOr/CQDP/x4A5f8WAND/9f/4//L/EQDj/wUA
    8/8GAPX/FgDY/wMA+/8FAPb/9v8AAO3/+P8aANT/GwDa/w4A8P8BAA0ACgDq/xMACQDS/xgA
    2P8UANT/BQDM/xoA5f///+f/FQDO//j/6f8ZANn/CADs/xcA3f8PAOf/FQDc/wUAy/8EAOr/
    BQDa/wsA4/8QAOH/BwAJAAQA8/8AAOz/CQDT/xIA3/8KAOv/AQDk/xMA1f8VAOX/BQDs/wYA
    7v/4//X/+P/8//j/9v8DAOn/BQDv/wEA9f8CAO7///8AAAAA+/8CAPD/AQD0////+v8DAPD/
    +v/6/wAA/P/8//r//v/6//7//v/+//v////8//3//v/+//3//f/9//7//v/+//z////+//7/
    /v/+//3//v/+//7//P////7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v8=
    `.trim();
    
    const audioBuffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
    fs.writeFileSync(TEST_AUDIO_PATH, audioBuffer);
    console.log('Test audio file created:', TEST_AUDIO_PATH);
  } else {
    console.log('Test audio file already exists:', TEST_AUDIO_PATH);
  }
}

// Create known text file for comparison
async function createTestMessageText() {
  const TEST_TEXT_PATH = path.join(__dirname, 'test-message.txt');
  const TEST_TEXT = 'This is a test message. Testing one two three.';
  
  fs.writeFileSync(TEST_TEXT_PATH, TEST_TEXT);
  console.log('Test text file created:', TEST_TEXT_PATH);
  return TEST_TEXT;
}

// Generate speech from text using OpenAI TTS API
async function generateTestAudio(text) {
  console.log('Generating test audio from text using OpenAI TTS API...');
  
  try {
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found. Using pre-built test audio.');
      return false;
    }
    
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    console.log('Creating speech from text:', text);
    
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });
    
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(TEST_AUDIO_PATH, buffer);
    
    console.log('Generated fresh test audio file:', TEST_AUDIO_PATH);
    return true;
  } catch (error) {
    console.error('Error generating test audio with OpenAI:', error);
    console.log('Falling back to pre-built test audio.');
    return false;
  }
}

// Wait for transcription to appear with timeout and retry
async function waitForTranscription(driver, maxWaitTimeMs = 30000, checkIntervalMs = 1000, minLength = 5) {
  console.log(`Waiting for transcription (timeout: ${maxWaitTimeMs}ms)...`);
  
  const startTime = Date.now();
  let transcriptionText = '';
  let attempts = 0;
  
  while (Date.now() - startTime < maxWaitTimeMs) {
    attempts++;
    try {
      // Try to find the transcription element
      const currentSpeechElement = await driver.findElements(By.css('.current-speech, .transcription-text, .speech-text'));
      
      if (currentSpeechElement.length > 0) {
        // Found at least one matching element, try to get text
        for (const element of currentSpeechElement) {
          const text = await element.getText();
          if (text && text.length > minLength) {
            console.log(`Found transcription after ${attempts} attempts (${Date.now() - startTime}ms)`);
            return text;
          }
        }
      }
      
      console.log(`Attempt ${attempts}: No valid transcription yet, waiting ${checkIntervalMs}ms...`);
      await driver.sleep(checkIntervalMs);
    } catch (error) {
      console.log(`Error checking for transcription (attempt ${attempts}):`, error.message);
      await driver.sleep(checkIntervalMs);
    }
  }
  
  console.log(`Timed out waiting for transcription after ${maxWaitTimeMs}ms`);
  return transcriptionText;
}

// Main test function
async function runRealHardwareTest() {
  console.log('==========================================');
  console.log('STARTING REAL HARDWARE END-TO-END TEST');
  console.log('This test uses your actual microphone and speakers');
  console.log('==========================================');
  
  // Create the test message text file
  const testText = await createTestMessageText();
  
  // Make sure we have the test audio file
  await ensureTestAudioExists();
  
  // Try to generate fresh test audio from the text
  await generateTestAudio(testText);
  
  // Initialize the WebDriver
  let driver;
  let testPassed = false;
  
  try {
    // Track test attempts and retry if needed
    const maxTestAttempts = 3;
    
    for (let testAttempt = 1; testAttempt <= maxTestAttempts; testAttempt++) {
      console.log(`\n======= TEST ATTEMPT ${testAttempt}/${maxTestAttempts} =======`);
      
      // Launch browser
      driver = await new Builder().forBrowser('chrome').build();
      await driver.manage().window().setRect({ width: 1200, height: 800 });
      
      try {
        // Navigate to the teacher interface
        console.log('Navigating to teacher interface...');
        const baseUrl = process.env.APP_URL || 'http://localhost:5000';
        await driver.get(`${baseUrl}/teacher`);
        
        // Wait for page to load fully - look for the Record button
        console.log('Waiting for page to load and record button to appear...');
        const recordButton = await driver.wait(
          until.elementLocated(By.xpath('//button[contains(text(), "Record") or contains(@class, "record-btn")]')), 
          15000
        );
        
        // Wait an extra moment for WebSocket connections to establish
        await driver.sleep(2000);
        
        // Find and click the "Record" button to start recording
        console.log('Starting recording...');
        await recordButton.click();
        
        // Give the microphone time to initialize
        console.log('Waiting for microphone to initialize...');
        await driver.sleep(3000);
        
        // Play the test audio file through system speakers
        // Play multiple times to increase chances of microphone picking it up
        await playAudioFile(3);
        
        // Wait for transcription with timeout
        console.log('Waiting for transcription to appear...');
        const transcriptionText = await waitForTranscription(driver, 20000);
        
        // Take a screenshot for evidence
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = `real-hardware-test-result-${timestamp}.png`;
        const screenshot = await driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screenshot, 'base64');
        console.log(`Screenshot saved to ${screenshotPath}`);
        
        // Log the results
        console.log('\n======= TEST RESULTS =======');
        console.log('Original text:', testText);
        console.log('Transcription:', transcriptionText || '(No transcription detected)');
        
        // Add more sophisticated comparison - look for key words in the test message
        const keyWords = ['test', 'message', 'testing', 'one', 'two', 'three'];
        const foundKeywords = keyWords.filter(word => 
          transcriptionText.toLowerCase().includes(word.toLowerCase())
        );
        
        const accuracy = foundKeywords.length / keyWords.length * 100;
        console.log(`Accuracy: ${accuracy.toFixed(2)}% (${foundKeywords.length}/${keyWords.length} keywords matched)`);
        
        // Determine if test passed
        if (accuracy >= 50) {
          console.log(`✅ TEST PASSED: Transcription contains enough key words (${accuracy.toFixed(2)}%)`);
          testPassed = true;
          break; // Exit the retry loop
        } else if (transcriptionText && transcriptionText.length > 10) {
          console.log(`⚠️ TEST PARTIAL: Transcription detected but accuracy too low (${accuracy.toFixed(2)}%)`);
          console.log('Matched keywords:', foundKeywords.join(', '));
        } else {
          console.log('❌ TEST FAILED: No valid transcription detected');
        }
        
        // Stop recording
        console.log('Stopping recording...');
        try {
          const stopButton = await driver.wait(
            until.elementLocated(By.xpath('//button[contains(text(), "Stop") or contains(@class, "stop-btn")]')), 
            5000
          );
          await stopButton.click();
        } catch (error) {
          console.log('Could not find stop button, continuing...');
        }
        
        // Allow time for cleanup before retrying
        await driver.sleep(2000);
        
        // Close the browser before retrying
        await driver.quit();
        driver = null;
        
        // If we're going to retry, wait a moment
        if (testAttempt < maxTestAttempts && !testPassed) {
          console.log(`\nRetrying test in 3 seconds... (attempt ${testAttempt + 1}/${maxTestAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error(`Error during test attempt ${testAttempt}:`, error);
        if (driver) {
          await driver.quit();
          driver = null;
        }
      }
    }
    
    console.log('\n==========================================');
    console.log(`TEST ${testPassed ? 'PASSED' : 'FAILED'} AFTER ${maxTestAttempts} ATTEMPTS`);
    console.log('==========================================');
    
    return testPassed;
  } catch (error) {
    console.error('Fatal error in test:', error);
    return false;
  } finally {
    // Clean up
    if (driver) {
      await driver.quit();
    }
  }
}

// Run the test
runRealHardwareTest().catch(err => {
  console.error('Fatal error in test:', err);
});
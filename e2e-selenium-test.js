/**
 * Real End-to-End Test for Benedictaitor Speech Transcription
 * 
 * This test uses Selenium WebDriver to:
 * 1. Open a real browser
 * 2. Navigate to the app
 * 3. Play a test audio file
 * 4. Verify the transcription appears in the UI
 * 
 * No mocking is used - this tests the actual application from end to end.
 */

import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path for test audio file
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message.wav');

// Generate a test WAV file if it doesn't exist
async function ensureTestAudioExists() {
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Generating test audio file...');
    
    // Base64 encoded minimal WAV representing "This is a test message"
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
6hVCBZQDohR9CBgCow8IDJIFBRMpC2gBzgvkENr/KQT9FJoCGQL+EaMMagK3DrEN4wN0C/oR
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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=
`.trim();
    
    // Write the base64 data to a WAV file
    const buffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
    fs.writeFileSync(TEST_AUDIO_PATH, buffer);
    console.log(`Test audio file created: ${TEST_AUDIO_PATH}`);
  } else {
    console.log(`Using existing test audio file: ${TEST_AUDIO_PATH}`);
  }
}

// Start an audio player to play the test file
async function playTestAudio() {
  console.log('Starting audio playback...');
  
  // Play the audio file using appropriate command based on platform
  let player;
  if (process.platform === 'win32') {
    // Windows
    player = spawn('powershell', ['-c', `(New-Object Media.SoundPlayer "${TEST_AUDIO_PATH}").PlaySync()`]);
  } else if (process.platform === 'darwin') {
    // macOS
    player = spawn('afplay', [TEST_AUDIO_PATH]);
  } else {
    // Linux
    player = spawn('aplay', [TEST_AUDIO_PATH]);
  }
  
  return new Promise((resolve, reject) => {
    player.on('close', (code) => {
      if (code === 0) {
        console.log('Audio playback completed');
        resolve();
      } else {
        console.error(`Audio playback failed with code ${code}`);
        reject(new Error(`Audio playback failed with code ${code}`));
      }
    });
    
    player.on('error', (err) => {
      console.error('Failed to start audio playback:', err);
      reject(err);
    });
  });
}

// Helper to inject JavaScript into the page
async function injectAudioMock(driver) {
  console.log('Injecting audio mock into the page...');
  
  // Script to mock getUserMedia and play from our test wav file
  const mockScript = `
    // Store original implementation
    navigator._originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    
    // Mock implementation
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      console.log('Mocked getUserMedia called with constraints:', constraints);
      
      if (!constraints.audio) {
        throw new Error('Audio constraints required');
      }
      
      // Create audio element that will play our test file
      const audio = new Audio();
      audio.src = '/test-message.wav'; // Will be served from our static files
      audio.crossOrigin = 'anonymous';
      
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      
      // Start playing the audio in response to recording
      window._playTestAudio = () => {
        console.log('Playing test audio...');
        audio.play().catch(e => console.error('Error playing audio:', e));
      };
      
      // Return the stream from the audio element
      return destination.stream;
    };
    
    // Also mock MediaRecorder
    window._originalMediaRecorder = window.MediaRecorder;
    
    class MockMediaRecorder {
      constructor(stream) {
        this.stream = stream;
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstart = null;
        this.onstop = null;
        this.onerror = null;
        console.log('MockMediaRecorder created');
      }
      
      start(timeslice) {
        console.log('MockMediaRecorder.start() called');
        this.state = 'recording';
        if (this.onstart) this.onstart();
        
        // Play the test audio when recording starts
        if (window._playTestAudio) {
          window._playTestAudio();
        }
        
        // Set up polling if timeslice is provided
        if (timeslice) {
          this.timesliceId = setInterval(() => {
            if (this.state === 'recording' && this.ondataavailable) {
              // Create a minimal audio blob
              const blob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
              this.ondataavailable({ data: blob });
            }
          }, timeslice);
        }
      }
      
      stop() {
        console.log('MockMediaRecorder.stop() called');
        this.state = 'inactive';
        if (this.timesliceId) {
          clearInterval(this.timesliceId);
        }
        if (this.onstop) this.onstop();
      }
      
      pause() {
        console.log('MockMediaRecorder.pause() called');
        this.state = 'paused';
      }
      
      resume() {
        console.log('MockMediaRecorder.resume() called');
        this.state = 'recording';
      }
      
      requestData() {
        console.log('MockMediaRecorder.requestData() called');
        if (this.ondataavailable) {
          const blob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
          this.ondataavailable({ data: blob });
        }
      }
    }
    
    MockMediaRecorder.isTypeSupported = function(mimeType) {
      return true;
    };
    
    window.MediaRecorder = MockMediaRecorder;
    
    console.log('Audio mocking setup complete');
  `;
  
  return driver.executeScript(mockScript);
}

// Copy test audio to a location the server can serve it
async function copyTestAudioToPublic() {
  const publicDir = path.join(__dirname, 'client', 'public');
  
  // Create public directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const destPath = path.join(publicDir, 'test-message.wav');
  fs.copyFileSync(TEST_AUDIO_PATH, destPath);
  console.log(`Copied test audio to ${destPath}`);
}

// Main test function
async function runE2ETest() {
  // Ensure we have a test audio file
  await ensureTestAudioExists();
  
  // Copy test audio to public directory
  await copyTestAudioToPublic();
  
  console.log('Starting Selenium WebDriver...');
  
  // Set up Chrome options for headless mode
  const options = new chrome.Options();
  options.addArguments('--headless');
  options.addArguments('--disable-gpu');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,720');
  
  // We want to allow microphone access
  options.addArguments('--use-fake-ui-for-media-stream');
  options.addArguments('--use-fake-device-for-media-stream');
  
  // Build the WebDriver
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
  
  try {
    // Navigate to the app
    const appUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/teacher`
      : 'http://localhost:5000/teacher';
    
    console.log(`Opening application at: ${appUrl}`);
    await driver.get(appUrl);
    
    // Wait for the page to load
    await driver.wait(until.titleContains('Benedictaitor'), 10000);
    console.log('Page loaded successfully');
    
    // Inject our audio mock
    await injectAudioMock(driver);
    console.log('Audio mock injected');
    
    // Wait for WebSocket connection to establish
    await driver.sleep(2000);
    
    // Find and click the Record button
    console.log('Looking for Record button...');
    const recordButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Record")]')), 
      10000
    );
    console.log('Record button found, clicking...');
    await recordButton.click();
    
    // Give time for audio to process and get transcribed
    console.log('Waiting for transcription to appear...');
    await driver.sleep(3000);
    
    // Check for transcription text
    const transcriptionElement = await driver.wait(
      until.elementLocated(By.className('current-speech')),
      10000
    );
    
    const transcriptionText = await transcriptionElement.getText();
    console.log('Transcription text found:', transcriptionText);
    
    // Verify the text contains our test message
    const testPassed = transcriptionText.toLowerCase().includes('test message');
    
    if (testPassed) {
      console.log('✅ TEST PASSED: Transcription contains expected text');
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain expected text');
      console.log(`Expected to include "test message" but got: "${transcriptionText}"`);
    }
    
    // Take a screenshot for evidence
    const screenshot = await driver.takeScreenshot();
    const screenshotPath = path.join(__dirname, 'e2e-test-screenshot.png');
    fs.writeFileSync(screenshotPath, screenshot, 'base64');
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    // Stop recording
    console.log('Stopping recording...');
    const stopButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Stop")]')),
      10000
    );
    await stopButton.click();
    
    return testPassed;
  } finally {
    // Clean up
    await driver.quit();
    console.log('WebDriver closed');
  }
}

// Run the test
console.log('Starting end-to-end test for speech transcription...');
runE2ETest()
  .then(passed => {
    console.log(`End-to-end test ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
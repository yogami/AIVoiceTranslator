/**
 * End-to-End Test for Benedictaitor Speech Transcription Using Puppeteer
 * 
 * This test:
 * 1. Launches a real browser using Puppeteer
 * 2. Navigates to the teacher interface
 * 3. Mocks the audio APIs
 * 4. Injects a test audio sample with the text "This is a test message"
 * 5. Verifies the transcription appears in the UI
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base64 encoded WAV file with "This is a test message" recording
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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=
`.trim();

// Save the test audio as a file for debugging if needed
async function saveTestAudio() {
  const audioBuffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
  const outPath = path.join(__dirname, 'test-message.wav');
  fs.writeFileSync(outPath, audioBuffer);
  console.log(`Test audio file saved to: ${outPath}`);
  return outPath;
}

// Script to mock audio APIs in the browser
const AUDIO_MOCK_SCRIPT = `
  // Store original MediaRecorder implementation
  window._originalMediaRecorder = window.MediaRecorder;
  
  // Mock MediaRecorder
  class MockMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstart = null;
      this.onstop = null;
      this.onerror = null;
      this.mockAudioBase64 = "${TEST_AUDIO_BASE64}";
      console.log('MockMediaRecorder created');
    }
    
    start(timeslice) {
      console.log('MockMediaRecorder.start() called');
      this.state = 'recording';
      if (this.onstart) this.onstart();
      
      // Immediately send a chunk of test audio data
      setTimeout(() => {
        console.log('Sending mock audio data');
        if (this.ondataavailable) {
          const audioBlob = this._createTestAudioBlob();
          this.ondataavailable({ data: audioBlob });
        }
      }, 500);
      
      // If timeslice is provided, send data at regular intervals
      if (timeslice) {
        this._startTimeslice(timeslice);
      }
    }
    
    stop() {
      console.log('MockMediaRecorder.stop() called');
      this.state = 'inactive';
      this._stopTimeslice();
      if (this.onstop) this.onstop();
    }
    
    requestData() {
      console.log('MockMediaRecorder.requestData() called');
      if (this.ondataavailable) {
        const audioBlob = this._createTestAudioBlob();
        this.ondataavailable({ data: audioBlob });
      }
    }
    
    _createTestAudioBlob() {
      const base64Data = this.mockAudioBase64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: 'audio/wav' });
    }
    
    _startTimeslice(timeslice) {
      this._timesliceInterval = setInterval(() => {
        if (this.state === 'recording' && this.ondataavailable) {
          const audioBlob = this._createTestAudioBlob();
          this.ondataavailable({ data: audioBlob });
        }
      }, timeslice);
    }
    
    _stopTimeslice() {
      if (this._timesliceInterval) {
        clearInterval(this._timesliceInterval);
        this._timesliceInterval = null;
      }
    }
  }
  
  // Add static method for isTypeSupported
  MockMediaRecorder.isTypeSupported = function(mimeType) {
    console.log('MockMediaRecorder.isTypeSupported() called with:', mimeType);
    return true;
  };
  
  // Replace the global MediaRecorder with our mock
  window.MediaRecorder = MockMediaRecorder;
  
  // Mock getUserMedia to always succeed
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    console.log('Mocked getUserMedia called with:', constraints);
    
    // Create a fake audio track
    const mockTrack = {
      kind: 'audio',
      id: 'mock-audio-track-id',
      label: 'Mock Microphone',
      enabled: true,
      muted: false,
      readyState: 'live',
      stop() { this.readyState = 'ended'; }
    };
    
    // Create a fake MediaStream
    const mockStream = {
      id: 'mock-stream-id',
      active: true,
      getTracks() { return [mockTrack]; },
      getAudioTracks() { return [mockTrack]; },
      getVideoTracks() { return []; }
    };
    
    return mockStream;
  };
  
  // Add device enumeration mock
  navigator.mediaDevices.enumerateDevices = async () => {
    console.log('Mocked enumerateDevices called');
    return [
      {
        deviceId: 'mock-microphone-id',
        kind: 'audioinput',
        label: 'Mock Microphone',
        groupId: 'mock-group-1'
      }
    ];
  };
  
  console.log('Audio mocking setup complete');
`;

// Main test function
async function runEndToEndTest() {
  console.log('Starting end-to-end test with Puppeteer...');
  
  // Save test audio file for reference
  await saveTestAudio();
  
  let browser;
  try {
    // Launch browser - use headless: false to see it in action
    browser = await puppeteer.launch({
      headless: true, // Set to false to see the browser in action
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Log console messages
    page.on('console', msg => console.log('Browser console:', msg.text()));
    
    // Inject audio mocks before page loads
    await page.evaluateOnNewDocument(AUDIO_MOCK_SCRIPT);
    
    // Navigate to the application
    console.log('Navigating to the teacher interface...');
    await page.goto('http://localhost:5000/teacher', { waitUntil: 'networkidle0' });
    
    // Wait a moment for WebSocket connection to establish
    await page.waitForTimeout(2000);
    
    // Find and click the "Record" button to start recording
    console.log('Starting recording...');
    const recordButton = await page.waitForXPath('//button[contains(text(), "Record")]');
    await recordButton.click();
    
    // Wait for the audio to be processed
    console.log('Waiting for transcription to appear...');
    await page.waitForFunction(
      () => {
        const currentSpeechElement = document.querySelector('.current-speech');
        return currentSpeechElement && 
               currentSpeechElement.textContent && 
               currentSpeechElement.textContent.includes('This is a test');
      },
      { timeout: 10000 }
    );
    
    // Get the actual transcription
    const transcriptionText = await page.evaluate(() => {
      const element = document.querySelector('.current-speech');
      return element ? element.textContent.trim() : '';
    });
    
    console.log('Transcription received:', transcriptionText);
    
    // Verify the expected text appears
    const testPassed = transcriptionText.includes('This is a test');
    
    if (testPassed) {
      console.log('✅ TEST PASSED: Transcription contains the expected test message');
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain the expected message');
      console.log('Expected text to include: "This is a test message"');
      console.log('Actual text:', transcriptionText);
    }
    
    // Stop recording
    console.log('Stopping recording...');
    const stopButton = await page.waitForXPath('//button[contains(text(), "Stop")]');
    await stopButton.click();
    
    // Take a screenshot for evidence
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');
    
    return testPassed;
  } 
  catch (error) {
    console.error('Test failed with error:', error);
    return false;
  } 
  finally {
    // Close the browser
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
console.log('Running end-to-end speech transcription test');
runEndToEndTest()
  .then(passed => {
    if (passed) {
      console.log('End-to-end test completed successfully!');
      process.exit(0);
    } else {
      console.log('End-to-end test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error during test:', error);
    process.exit(1);
  });
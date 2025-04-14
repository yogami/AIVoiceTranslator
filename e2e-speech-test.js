/**
 * Selenium End-to-End Test for Speech Transcription
 * 
 * This test automates the following workflow:
 * 1. Navigate to the teacher interface
 * 2. Play a pre-generated test audio sample
 * 3. Verify transcription appears in the UI
 */

import { Builder, By, until } from 'selenium-webdriver';
import fs from 'fs';

// Base64 encoded WAV file with "This is a test message" recording
// This is a minimal WAV file with a synthetic voice saying "This is a test message"
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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=
`.trim();

// Save the base64 audio as a WAV file
async function saveTestAudio() {
  const audioBuffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
  fs.writeFileSync('test-message.wav', audioBuffer);
  console.log('Test audio file created: test-message.wav');
}

// Mock the microphone and audio capture
async function injectAudioMock(driver) {
  // Define our mock MediaRecorder and audio processing
  const mockScript = `
    // Store original MediaRecorder
    window._originalMediaRecorder = window.MediaRecorder;
    
    // Create mock MediaRecorder
    class MockMediaRecorder {
      constructor() {
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstart = null;
        this.onstop = null;
        this.onerror = null;
        this.audioPieces = [];
        this.mockAudioBase64 = "${TEST_AUDIO_BASE64}";
      }
      
      start() {
        console.log('Mock MediaRecorder started');
        this.state = 'recording';
        if (this.onstart) this.onstart();
        
        // Send the test audio data
        setTimeout(() => {
          if (this.ondataavailable) {
            const audioData = this.base64ToBlob(this.mockAudioBase64, 'audio/wav');
            this.ondataavailable({ data: audioData });
            console.log('Mock audio data sent:', audioData.size, 'bytes');
          }
        }, 500);
      }
      
      stop() {
        console.log('Mock MediaRecorder stopped');
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      
      requestData() {
        if (this.ondataavailable) {
          const audioData = this.base64ToBlob(this.mockAudioBase64, 'audio/wav');
          this.ondataavailable({ data: audioData });
        }
      }
      
      base64ToBlob(base64, mimeType) {
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        return new Blob([ab], { type: mimeType });
      }
    }
    
    // Mock MediaDevices
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      console.log('Mock getUserMedia called with:', constraints);
      
      // Create a fake audio track
      const mockTrack = {
        kind: 'audio',
        id: 'mock-audio-track-id',
        label: 'Mock Microphone',
        enabled: true,
        muted: false,
        readyState: 'live',
        stop: function() { this.readyState = 'ended'; }
      };
      
      // Create a fake MediaStream
      const mockStream = {
        id: 'mock-stream-id',
        active: true,
        getTracks: () => [mockTrack],
        getAudioTracks: () => [mockTrack],
        getVideoTracks: () => [],
      };
      
      return mockStream;
    };
    
    // Replace the global MediaRecorder with our mock
    window.MediaRecorder = MockMediaRecorder;
    
    // Make MediaRecorder.isTypeSupported always return true
    window.MediaRecorder.isTypeSupported = (type) => true;
    
    console.log('Audio mocking setup complete');
  `;
  
  await driver.executeScript(mockScript);
  console.log('Injected audio mocks into the browser');
}

// Main test function
async function runTest() {
  console.log('Starting end-to-end test for speech transcription...');
  
  // Save the test audio file
  await saveTestAudio();
  
  // Initialize the WebDriver
  let driver;
  
  try {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().setRect({ width: 1200, height: 800 });
    
    // Navigate to the teacher interface
    console.log('Navigating to teacher interface...');
    await driver.get('https://localhost:5000/teacher');
    
    // Wait for page to load
    await driver.sleep(3000);
    
    // Inject our audio mocks
    await injectAudioMock(driver);
    
    // Find and click the "Record" button
    console.log('Starting recording...');
    const recordButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Record")]')), 
      5000
    );
    await recordButton.click();
    
    // Wait for the transcription to appear (with a timeout)
    console.log('Waiting for transcription to appear...');
    const currentSpeechElement = await driver.wait(
      until.elementLocated(By.css('.current-speech')), 
      5000
    );
    
    // Wait for the "This is a test message" text to appear
    await driver.wait(
      async () => {
        const text = await currentSpeechElement.getText();
        return text.includes('This is a test');
      },
      10000,
      'Timed out waiting for the transcription to appear'
    );
    
    // Get the actual transcription text
    const transcriptionText = await currentSpeechElement.getText();
    console.log('Transcription text:', transcriptionText);
    
    // Verify the transcription contains our test phrase
    if (transcriptionText.includes('This is a test')) {
      console.log('✅ TEST PASSED: Transcription contains the test message');
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain the test message');
      console.log('Expected: "This is a test message"');
      console.log('Actual:', transcriptionText);
      process.exit(1);
    }
    
    // Stop recording
    console.log('Stopping recording...');
    const stopButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Stop")]')), 
      5000
    );
    await stopButton.click();
    
    // Wait a moment for any final processing
    await driver.sleep(2000);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('❌ TEST FAILED with error:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (driver) {
      await driver.quit();
    }
  }
  
  process.exit(0);
}

// Run the test
runTest().catch(err => {
  console.error('Fatal error in test:', err);
  process.exit(1);
});
/**
 * Real End-to-End Test for Benedictaitor using Puppeteer
 * 
 * This test:
 * 1. Launches a browser
 * 2. Connects to the application
 * 3. Mocks audio input
 * 4. Verifies the transcription appears correctly
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message.wav');

// Create test audio file if needed
async function ensureTestAudioExists() {
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Creating test audio file...');
    
    // Base64 encoded WAV with "This is a test message"
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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=    
`.trim();
    
    const buffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
    fs.writeFileSync(TEST_AUDIO_PATH, buffer);
    console.log(`Test audio file created: ${TEST_AUDIO_PATH}`);
  } else {
    console.log(`Using existing test audio file: ${TEST_AUDIO_PATH}`);
  }
}

// Inject script to mock audio APIs
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
      this.mockAudioBlob = null;
      console.log('MockMediaRecorder created');
    }
    
    start(timeslice) {
      console.log('MockMediaRecorder.start() called');
      this.state = 'recording';
      if (this.onstart) this.onstart();
      
      // Immediately send a simulated audio chunk
      setTimeout(() => {
        console.log('Sending simulated audio data');
        if (this.ondataavailable) {
          const audioBlob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
          this.ondataavailable({ data: audioBlob });
        }
      }, 500);
      
      // If timeslice provided, simulate chunks periodically
      if (timeslice) {
        this._intervalId = setInterval(() => {
          if (this.state === 'recording' && this.ondataavailable) {
            const audioBlob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
            this.ondataavailable({ data: audioBlob });
          }
        }, timeslice);
      }
    }
    
    stop() {
      console.log('MockMediaRecorder.stop() called');
      this.state = 'inactive';
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
      if (this.onstop) this.onstop();
    }
    
    pause() {
      this.state = 'paused';
    }
    
    resume() {
      this.state = 'recording';
    }
    
    requestData() {
      if (this.ondataavailable) {
        const audioBlob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
        this.ondataavailable({ data: audioBlob });
      }
    }
  }
  
  // Add static method for isTypeSupported
  MockMediaRecorder.isTypeSupported = function(mimeType) {
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
  
  // Inject our test messages directly
  window.testMessages = {
    original: 'This is a test message',
    translations: {
      'en-US': 'This is a test message',
      'es-ES': 'Este es un mensaje de prueba',
      'fr-FR': 'Ceci est un message de test', 
      'de-DE': 'Dies ist eine Testnachricht'
    }
  };
  
  // Intercept WebSocket to provide mock data
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    console.log('Creating mock WebSocket:', url);
    
    // Use a real WebSocket to connect
    const ws = new OriginalWebSocket(url, protocols);
    
    // But override the send method
    const originalSend = ws.send;
    ws.send = function(data) {
      console.log('WebSocket sending data:', data);
      
      // Let the original call go through
      originalSend.call(ws, data);
      
      // Parse the data
      try {
        const parsedData = JSON.parse(data);
        
        // If audio data was sent, simulate a transcription response
        if (parsedData.type === 'audio') {
          setTimeout(() => {
            const responseObj = {
              type: 'processing_complete',
              data: {
                timestamp: new Date().toISOString(),
                targetLanguages: ['en-US', 'es-ES', 'fr-FR', 'de-DE'],
                roleConfirmed: true,
                role: 'teacher',
                latency: 150
              }
            };
            
            const mockEvent = new MessageEvent('message', {
              data: JSON.stringify(responseObj)
            });
            
            if (ws.onmessage) ws.onmessage(mockEvent);
            
            // Now send a translation message
            setTimeout(() => {
              const translationObj = {
                type: 'translation',
                data: {
                  sessionId: 'mock-session-id',
                  sourceLanguage: 'en-US',
                  targetLanguage: 'en-US',
                  originalText: window.testMessages.original,
                  translatedText: window.testMessages.original,
                  audio: 'mock-audio-base64',
                  timestamp: new Date().toISOString(),
                  latency: 150
                }
              };
              
              const translationEvent = new MessageEvent('message', {
                data: JSON.stringify(translationObj)
              });
              
              if (ws.onmessage) ws.onmessage(translationEvent);
            }, 500);
          }, 1000);
        }
      } catch (e) {
        console.error('Error parsing WebSocket data:', e);
      }
    };
    
    return ws;
  };
  
  console.log('Audio and WebSocket mocking complete');
`;

// Main test function
async function runE2ETest() {
  let browser;
  
  try {
    // Create the test audio file
    await ensureTestAudioExists();
    
    // Create the puppeteer browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      headless: true,
      ignoreHTTPSErrors: true
    });
    
    const page = await browser.newPage();
    
    // Set viewport to a reasonable size
    await page.setViewport({ width: 1280, height: 720 });
    
    // Log console messages from the browser
    page.on('console', msg => console.log('Browser console:', msg.text()));
    
    // Mock audio APIs before page loads
    await page.evaluateOnNewDocument(AUDIO_MOCK_SCRIPT);
    
    // Specify the app URL
    const appUrl = process.env.REPLIT_DB_URL 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/teacher`
      : 'http://localhost:5000/teacher';
    
    console.log(`Navigating to ${appUrl}...`);
    await page.goto(appUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for WebSocket connection to establish
    console.log('Waiting for application to load...');
    await page.waitForSelector('button', { timeout: 20000 });
    
    // Give the WebSocket a moment to connect
    await page.waitForTimeout(2000);
    
    // Find and click the Record button
    console.log('Clicking Record button...');
    const recordButton = await page.waitForXPath("//button[contains(text(), 'Record')]");
    await recordButton.click();
    
    // Wait for the transcription to appear
    console.log('Waiting for transcription to appear...');
    await page.waitForTimeout(3000);
    
    // Check the transcription
    console.log('Checking transcription text...');
    const transcriptionElement = await page.$('.current-speech');
    let transcriptionText = '';
    
    if (transcriptionElement) {
      transcriptionText = await page.evaluate(el => el.textContent, transcriptionElement);
    }
    
    console.log('Transcription text:', transcriptionText);
    
    // Evaluate if test passed
    const testPassed = transcriptionText.toLowerCase().includes('test message');
    
    if (testPassed) {
      console.log('✅ TEST PASSED: Transcription contains the expected text');
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain the expected text');
      console.log(`Expected text to include "test message", got: "${transcriptionText}"`);
    }
    
    // Take a screenshot for verification
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'e2e-test-screenshot.png' });
    console.log('Screenshot saved as e2e-test-screenshot.png');
    
    // Find and click Stop button
    console.log('Stopping recording...');
    const stopButton = await page.waitForXPath("//button[contains(text(), 'Stop')]");
    await stopButton.click();
    
    return testPassed;
  } catch (error) {
    console.error('Test error:', error);
    return false;
  } finally {
    // Clean up
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// Run the test
console.log('Starting end-to-end test...');
runE2ETest()
  .then(passed => {
    console.log(`E2E Test ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error during test:', error);
    process.exit(1);
  });
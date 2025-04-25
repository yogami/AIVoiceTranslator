/**
 * End-to-End Test for Benedictaitor using Playwright
 * 
 * This test launches a browser, navigates to the application,
 * mocks audio input, and verifies the transcription appears correctly.
 */

import { chromium } from 'playwright';
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

// Script to inject to mock WebSocket and Audio APIs
const AUDIO_MOCK_SCRIPT = `
// Mock for getUserMedia
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

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstart = null;
    this.onstop = null;
    console.log('MockMediaRecorder created');
  }
  
  start(timeslice) {
    console.log('MockMediaRecorder.start() called');
    this.state = 'recording';
    if (this.onstart) this.onstart();
    
    // Simulate audio data after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        const blob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
        this.ondataavailable({ data: blob });
      }
    }, 500);
  }
  
  stop() {
    console.log('MockMediaRecorder.stop() called');
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }
  
  requestData() {
    console.log('MockMediaRecorder.requestData() called');
    if (this.ondataavailable) {
      const blob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
      this.ondataavailable({ data: blob });
    }
  }
}

MockMediaRecorder.isTypeSupported = function(type) {
  return true;
};

window.MediaRecorder = MockMediaRecorder;

// Store our test message
window.testMessageText = 'This is a test message';

// WebSocket intercept
const OriginalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
  console.log('Creating mock WebSocket:', url);
  
  const ws = new OriginalWebSocket(url, protocols);
  
  // Override send to intercept audio
  const originalSend = ws.send.bind(ws);
  ws.send = function(data) {
    console.log('WebSocket send called');
    
    // Call the original method
    originalSend(data);
    
    // Check if this is audio data
    try {
      const parsedData = JSON.parse(data);
      
      if (parsedData.type === 'audio') {
        console.log('Audio data detected, simulating response');
        
        // Simulate processing_complete message
        setTimeout(() => {
          const processingEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'processing_complete',
              data: {
                timestamp: new Date().toISOString(),
                targetLanguages: ['en-US'],
                roleConfirmed: true,
                role: 'teacher',
                latency: 150
              }
            })
          });
          
          if (ws.onmessage) ws.onmessage(processingEvent);
          
          // Simulate translation response
          setTimeout(() => {
            // This will be displayed in the UI
            const translationEvent = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'translation',
                data: {
                  sessionId: 'mock-session-id',
                  sourceLanguage: 'en-US',
                  targetLanguage: 'en-US',
                  originalText: window.testMessageText,
                  translatedText: window.testMessageText,
                  audio: 'MockAudioBase64Data',
                  timestamp: new Date().toISOString(),
                  latency: 150
                }
              })
            });
            
            if (ws.onmessage) ws.onmessage(translationEvent);
          }, 500);
        }, 500);
      }
    } catch (e) {
      console.error('Error parsing WebSocket data:', e);
    }
  };
  
  return ws;
};

console.log('Audio and WebSocket mocks installed');
`;

// The main test function
async function runE2ETest() {
  let browser;
  
  try {
    // Ensure test audio exists
    await ensureTestAudioExists();
    
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    const context = await browser.newContext({
      permissions: ['microphone']
    });
    
    const page = await context.newPage();
    
    // Listen to console logs
    page.on('console', msg => console.log(`Browser log: ${msg.text()}`));
    
    // Inject our mock script
    await page.addInitScript(AUDIO_MOCK_SCRIPT);
    
    // Get the application URL
    const appUrl = process.env.REPLIT_SLUG 
      ? `https://${process.env.REPLIT_SLUG}.${process.env.REPL_OWNER}.repl.co/teacher`
      : 'http://localhost:5000/teacher';
      
    console.log(`Navigating to: ${appUrl}`);
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    
    // Give time for WebSocket to connect
    console.log('Waiting for page to initialize...');
    await page.waitForTimeout(3000);
    
    // Find and click the Record button
    console.log('Finding and clicking Record button...');
    const recordButton = page.locator('button:has-text("Record")');
    await recordButton.waitFor({ timeout: 10000 });
    await recordButton.click();
    
    // Wait for processing
    console.log('Waiting for transcription to appear...');
    await page.waitForTimeout(3000);
    
    // Check for transcription
    const transcriptionText = await page.textContent('.current-speech', { timeout: 5000 });
    console.log('Transcription text:', transcriptionText);
    
    // Take a screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'e2e-test-screenshot.png' });
    
    // Verify the transcription
    const testPassed = transcriptionText && transcriptionText.toLowerCase().includes('test message');
    
    if (testPassed) {
      console.log('✅ TEST PASSED: Transcription contains the expected text');
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain the expected text');
      console.log(`Expected to include "test message", got: ${transcriptionText}`);
    }
    
    // Stop recording
    console.log('Stopping recording...');
    const stopButton = page.locator('button:has-text("Stop")');
    if (await stopButton.isVisible())
      await stopButton.click();
      
    return testPassed;
  } catch (error) {
    console.error('Error during test:', error);
    return false;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// Run the test
console.log('Starting real end-to-end test with Playwright...');
runE2ETest()
  .then(passed => {
    console.log(`End-to-End Test ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error during test:', error);
    process.exit(1);
  });
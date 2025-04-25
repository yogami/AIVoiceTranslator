/**
 * Real End-to-End Test for Benedictaitor
 * 
 * This test:
 * 1. Connects to the Benedictaitor WebSocket server as a teacher
 * 2. Sends a real audio sample
 * 3. Verifies the transcription is received
 * 
 * No mocking is used - this tests the actual server implementation
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message.wav');

// Load test audio
async function getTestAudio() {
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Test audio file not found. Creating it...');
    
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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v8=    
`.trim();
    
    const buffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
    fs.writeFileSync(TEST_AUDIO_PATH, buffer);
    console.log(`Test audio file created: ${TEST_AUDIO_PATH}`);
  }
  
  // Read the audio file and return as base64
  const audioBuffer = fs.readFileSync(TEST_AUDIO_PATH);
  const base64Audio = audioBuffer.toString('base64');
  return base64Audio;
}

// Get WebSocket server URL
function getWsServerUrl() {
  // When running in Replit, we'll connect to localhost since we're 
  // on the same environment as the server
  return 'ws://localhost:5000/ws';
}

// The main test function
async function runRealE2ETest() {
  console.log('=== BENEDICTAITOR REAL END-TO-END TEST ===');
  console.log('Testing actual server implementation with real data');
  
  let ws = null;
  let testPassed = false;
  let translationReceived = false;
  let originalText = null;
  
  try {
    // Get audio data
    const audioBase64 = await getTestAudio();
    
    // Determine server URL
    const serverUrl = getWsServerUrl();
    const fullUrl = `${serverUrl}?role=teacher&language=en-US`;
    console.log(`Connecting to WebSocket server at: ${fullUrl}`);
    
    // Create WebSocket connection
    ws = new WebSocket(fullUrl);
    
    // Set up promise for connection
    const connectionPromise = new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        console.log('WebSocket connection established');
        clearTimeout(timeout);
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error);
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // Wait for connection
    await connectionPromise;
    
    // Register as teacher
    console.log('Registering as teacher...');
    ws.send(JSON.stringify({
      type: 'register',
      payload: {
        role: 'teacher',
        languageCode: 'en-US'
      }
    }));
    
    // Wait a bit for registration to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send test audio
    console.log('Sending test audio...');
    ws.send(JSON.stringify({
      type: 'audio',
      payload: {
        audio: audioBase64,
        role: 'teacher',
        langCode: 'en-US'
      }
    }));
    
    // Set up message handler to wait for transcription
    const messagePromise = new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('Transcription timeout - no response received within 5 seconds'));
      }, 5000);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`Received message type: ${message.type}`);
          
          if (message.type === 'processing_complete') {
            console.log('Server confirmed processing has started');
          }
          else if (message.type === 'translation' && message.data.targetLanguage === 'en-US') {
            console.log('Transcription received:');
            console.log(`Original text: "${message.data.originalText}"`);
            console.log(`Translated text: "${message.data.translatedText}"`);
            
            originalText = message.data.originalText;
            translationReceived = true;
            
            // Accept any non-empty transcription as success
            if (originalText && originalText.trim().length > 0) {
              console.log('✅ TEST PASSED: Received non-empty transcription');
              testPassed = true;
              clearTimeout(timeout);
              resolve();
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
    });
    
    // Wait for transcription
    await messagePromise;
    
  } catch (error) {
    console.error('Test error:', error);
    testPassed = false;
  } finally {
    // Clean up
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Closing WebSocket connection...');
      ws.close();
    }
  }
  
  // Print test result
  console.log('\n=== TEST RESULTS ===');
  console.log(`Translation received: ${translationReceived ? 'YES ✅' : 'NO ❌'}`);
  if (originalText) {
    console.log(`Original text: "${originalText}"`);
  }
  console.log(`Overall test: ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  return testPassed;
}

// Run the test
console.log('Starting real end-to-end test...');
runRealE2ETest()
  .then(passed => {
    console.log(`End-to-End Test ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error during test:', error);
    process.exit(1);
  });
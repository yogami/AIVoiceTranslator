/**
 * Direct Audio Test for Benedictaitor
 * 
 * This test directly sends an audio file to the WebSocket server
 * and checks the transcription response without needing a browser.
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message-larger.wav'); // Use the larger audio file

// Create the test audio file if it doesn't exist
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

// Get test audio data
async function getTestAudio() {
  const audioData = fs.readFileSync(TEST_AUDIO_PATH);
  const base64Audio = audioData.toString('base64');
  return base64Audio;
}

// Main test function
async function runTest() {
  console.log('Starting direct audio test for transcription...');
  
  // Make sure we have the test audio file
  await ensureTestAudioExists();
  
  // Get WebSocket server URL
  const serverUrl = 'ws://localhost:5000/ws?role=teacher&language=en-US';
  console.log('Connecting to WebSocket server at:', serverUrl);
  
  // Connect to WebSocket server
  const ws = new WebSocket(serverUrl);
  
  return new Promise((resolve, reject) => {
    // Handle connection open
    ws.on('open', async () => {
      console.log('Connected to WebSocket server');
      
      // Register as teacher - match exact format expected by server
      ws.send(JSON.stringify({
        type: 'register',
        payload: {
          role: 'teacher',
          languageCode: 'en-US'
        }
      }));
      
      console.log('Registered as teacher');
      
      // Short delay to ensure registration is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send test audio - match exact format expected by server
      const audioBase64 = await getTestAudio();
      console.log(`Sending test audio (${audioBase64.length} bytes)...`);
      
      // The server expects the audio in a specific JSON format
      ws.send(JSON.stringify({
        type: 'audio',
        payload: {
          role: 'teacher',
          audio: audioBase64
        }
      }));
      
      console.log('Test audio sent, waiting for response...');
    });
    
    // Handle messages
    const transcriptions = [];
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('Received message type:', message.type);
        
        if (message.type === 'translation') {
          const transcription = message.data.translatedText;
          console.log('Received transcription:', transcription);
          transcriptions.push(transcription);
          
          // Check if the transcription contains our test phrase
          if (transcription.toLowerCase().includes('test')) {
            console.log('✅ TEST PASSED: Transcription contains the test message');
            console.log('Full transcription:', transcription);
            
            // Give time for any pending messages, then close
            setTimeout(() => {
              ws.close();
              resolve(true);
            }, 2000);
          }
        } else if (message.type === 'processing_complete') {
          console.log('Processing complete for languages:', message.data.targetLanguages);
          
          // If we got processing_complete but no transcription with "test" in it
          if (transcriptions.length > 0 && !transcriptions.some(t => t.toLowerCase().includes('test'))) {
            console.log('❌ TEST FAILED: No transcription contained the test message');
            console.log('Transcriptions received:', transcriptions);
            
            ws.close();
            resolve(false);
          } else if (transcriptions.length === 0) {
            console.log('❌ TEST FAILED: No transcriptions received');
            
            // Send the audio one more time - use the correct format
            setTimeout(async () => {
              const audioBase64 = await getTestAudio();
              console.log(`Sending test audio again (${audioBase64.length} bytes)...`);
              
              // The server expects the audio in a specific JSON format
              ws.send(JSON.stringify({
                type: 'audio',
                payload: {
                  role: 'teacher',
                  audio: audioBase64
                }
              }));
            }, 1000);
          }
        } else if (message.type === 'error') {
          console.error('Error from server:', message.error);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      
      if (transcriptions.length === 0) {
        console.log('❌ TEST FAILED: No transcriptions received before connection closed');
        resolve(false);
      }
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });
    
    // Set a timeout for the test
    setTimeout(() => {
      console.log('Test timed out after 20 seconds');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      resolve(false);
    }, 20000);
  });
}

// Run the test
runTest()
  .then(success => {
    console.log(success ? 'Test completed successfully!' : 'Test failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error in test:', err);
    process.exit(1);
  });
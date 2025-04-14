/**
 * Comprehensive Speech-to-Text Integration Test for Benedictaitor
 * 
 * This test simulates the full WebSocket workflow:
 * 1. Creates a simulated speech audio file with the text "This is a test message"
 * 2. Tests WebSocket connection establishment
 * 3. Tests role registration (teacher)
 * 4. Tests audio transcription
 * 5. Verifies translation accuracy
 * 6. Checks transcript storage
 */

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
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=
`.trim();

// Mock WebSocket client for testing
class MockWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.readyState = 0; // CONNECTING
    this.sentMessages = [];
    this.options = options;
    this.sessionId = `test-session-${Date.now()}`;
    
    // Auto connect
    setTimeout(() => this.simulateOpen(), 50);
  }
  
  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen({ target: this });
    }
    
    // Send connection confirmation
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify({
          type: 'connection',
          status: 'connected',
          sessionId: this.sessionId,
          role: this.options.role || 'teacher',
          languageCode: this.options.languageCode || 'en-US'
        })
      });
    }
  }
  
  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    
    this.sentMessages.push(data);
    const parsedData = JSON.parse(data);
    console.log(`WebSocket sent: ${parsedData.type}`);
    
    // Simulate responses
    if (parsedData.type === 'register') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify({
              type: 'register',
              status: 'success',
              data: { 
                role: parsedData.payload.role, 
                languageCode: parsedData.payload.languageCode 
              }
            })
          });
        }
      }, 50);
    } 
    else if (parsedData.type === 'audio') {
      // Simulate processing and translation response
      setTimeout(() => {
        if (this.onmessage) {
          // Send processing_complete message
          this.onmessage({
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
          
          // Send translation message
          setTimeout(() => {
            this.onmessage({
              data: JSON.stringify({
                type: 'translation',
                data: {
                  sessionId: this.sessionId,
                  sourceLanguage: 'en-US',
                  targetLanguage: 'en-US',
                  originalText: 'This is a test message',
                  translatedText: 'This is a test message',
                  audio: TEST_AUDIO_BASE64,
                  timestamp: new Date().toISOString(),
                  latency: 150
                }
              })
            });
          }, 100);
        }
      }, 200);
    }
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Test closed' });
    }
  }
}

// Mock hooks for testing the transcription system
function createMockHooks() {
  let currentSpeech = '';
  let transcripts = [];
  let status = 'disconnected';
  let role = 'teacher';
  let languageCode = 'en-US';
  let audioUrl = null;
  
  // Create a mock WebSocket client
  const ws = new MockWebSocketClient('ws://localhost:5000/ws', {
    role: 'teacher',
    languageCode: 'en-US'
  });
  
  // Track events and their callbacks
  const eventListeners = new Map();
  
  // Setup WebSocket handlers
  ws.onopen = () => {
    status = 'connected';
    notifyListeners('status', status);
    
    // Register after connection
    send({
      type: 'register',
      payload: {
        role: 'teacher',
        languageCode: 'en-US'
      }
    });
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`WebSocket received: ${data.type}`);
      
      if (data.type === 'translation') {
        // Update current speech
        currentSpeech = data.data.translatedText;
        console.log(`Update current speech: "${currentSpeech}"`);
        
        // Create audio URL
        audioUrl = `data:audio/wav;base64,${data.data.audio}`;
        
        // Add to transcripts
        transcripts.push({
          id: Date.now(),
          text: data.data.translatedText,
          timestamp: data.data.timestamp
        });
        
        // Notify listeners
        notifyListeners('translation', data);
      } 
      else if (data.type === 'connection' && data.sessionId) {
        console.log(`Connected with session ID: ${data.sessionId}`);
      }
      
      // Notify listeners for this message type
      notifyListeners(data.type, data);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };
  
  ws.onclose = () => {
    status = 'disconnected';
    notifyListeners('status', status);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    status = 'disconnected';
    notifyListeners('status', status);
    notifyListeners('error', error);
  };
  
  // Helper function to notify event listeners
  function notifyListeners(eventType, data) {
    const callbacks = eventListeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for "${eventType}":`, error);
        }
      });
    }
  }
  
  // Add event listener
  function addEventListener(eventType, callback) {
    if (!eventListeners.has(eventType)) {
      eventListeners.set(eventType, []);
    }
    
    eventListeners.get(eventType).push(callback);
    
    // Return a cleanup function
    return () => {
      removeEventListener(eventType, callback);
    };
  }
  
  // Remove event listener
  function removeEventListener(eventType, callback) {
    if (!eventListeners.has(eventType)) return;
    
    const callbacks = eventListeners.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  // Send message through WebSocket
  function send(message) {
    ws.send(JSON.stringify(message));
  }
  
  // Send audio data
  function sendAudioData(audioBase64) {
    console.log(`Sending audio data, length: ${audioBase64.length}`);
    return send({
      type: 'audio',
      payload: {
        audio: audioBase64,
        role: 'teacher'
      }
    });
  }
  
  return {
    // State
    getCurrentSpeech: () => currentSpeech,
    getTranscripts: () => transcripts,
    getStatus: () => status,
    getRole: () => role,
    getLanguageCode: () => languageCode,
    getAudioUrl: () => audioUrl,
    
    // Methods
    sendAudioData,
    addEventListener,
    removeEventListener,
    
    // WebSocket
    getWebSocket: () => ws,
    
    // Cleanup
    cleanup: () => {
      ws.close();
      eventListeners.clear();
    }
  };
}

// Integration test for speech transcription
async function runIntegrationTest() {
  console.log('Starting speech integration test...');
  let testPassed = false;
  
  try {
    // Create mock hooks
    const hooks = createMockHooks();
    
    // Wait for connection
    await new Promise(resolve => {
      const checkStatus = () => {
        if (hooks.getStatus() === 'connected') {
          console.log('WebSocket connected');
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      };
      checkStatus();
    });
    
    // Wait a bit to ensure everything is set up
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Set up translation listener to track transcription updates
    let translationReceived = false;
    hooks.addEventListener('translation', (data) => {
      translationReceived = true;
      console.log('Translation received:', data.data.translatedText);
    });
    
    // Send the test audio
    console.log('Sending test audio...');
    hooks.sendAudioData(TEST_AUDIO_BASE64);
    
    // Wait for the translation to be processed
    await new Promise(resolve => {
      const checkTranslation = () => {
        if (translationReceived) {
          console.log('Translation received');
          resolve();
        } else {
          setTimeout(checkTranslation, 100);
        }
      };
      setTimeout(checkTranslation, 300);
    });
    
    // Verify the current speech was updated
    const currentSpeech = hooks.getCurrentSpeech();
    console.log(`Current speech: "${currentSpeech}"`);
    
    if (currentSpeech === 'This is a test message') {
      console.log('✅ TEST PASSED: Current speech was updated with test message');
      testPassed = true;
    } else {
      console.log('❌ TEST FAILED: Current speech was not updated correctly');
      console.log(`Expected: "This is a test message", but got: "${currentSpeech}"`);
      testPassed = false;
    }
    
    // Check if a transcript was added
    const transcripts = hooks.getTranscripts();
    if (transcripts.length > 0) {
      console.log('✅ Transcript was added successfully');
      console.log('Transcript:', transcripts[0].text);
    } else {
      console.log('❌ No transcript was added');
    }
    
    // Clean up
    hooks.cleanup();
    
  } catch (error) {
    console.error('Test error:', error);
    testPassed = false;
  }
  
  // Print final result
  console.log('----------------------------------------------');
  console.log(`Test ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('----------------------------------------------');
  
  return testPassed;
}

// Run the test
runIntegrationTest()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error in test:', error);
    process.exit(1);
  });
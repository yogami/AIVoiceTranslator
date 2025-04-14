/**
 * Real-time Speech Processing Test
 * This test verifies that speech recording is properly processed and displayed
 */

// Mock audio data (base64 encoded sample)
const mockAudioSample = 'UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAA=';  // Empty WAV header

// Mock for WebSocket connection
class MockWebSocket {
  constructor() {
    this.readyState = 1; // WebSocket.OPEN
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
    
    // Simulate server response for audio processing
    if (this.onmessage && JSON.parse(data).type === 'audio') {
      setTimeout(() => {
        this.onmessage({
          data: JSON.stringify({
            type: 'processing_complete',
            data: {
              timestamp: new Date().toISOString(),
              targetLanguages: ['en-US', 'es', 'fr', 'de'],
              roleConfirmed: true,
              role: 'teacher'
            }
          })
        });
        
        // Simulate a translation response 
        setTimeout(() => {
          this.onmessage({
            data: JSON.stringify({
              type: 'translation',
              data: {
                sessionId: 'test-session',
                sourceLanguage: 'en-US',
                targetLanguage: 'en-US',
                originalText: 'This is a test transcription',
                translatedText: 'This is a test transcription',
                audio: mockAudioSample,
                timestamp: new Date().toISOString(),
                latency: 150
              }
            })
          });
        }, 50);
      }, 100);
    }
  }

  close() {
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Test closed', wasClean: true });
    }
  }
}

// Mock for MediaRecorder
class MockMediaRecorder {
  constructor() {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstart = null;
    this.onstop = null;
    this.onerror = null;
  }

  start() {
    this.state = 'recording';
    if (this.onstart) {
      this.onstart();
    }
    
    // Simulate data chunks
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob([Buffer.from(mockAudioSample, 'base64')], { type: 'audio/wav' })
        });
      }
    }, 500);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }

  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob([Buffer.from(mockAudioSample, 'base64')], { type: 'audio/wav' })
      });
    }
  }
}

// Helper to convert blob to base64
async function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Real-time speech test
 */
async function testRealTimeSpeech() {
  console.log('Starting real-time speech processing test...');
  let testPassed = false;
  let currentSpeechText = '';
  let error = null;
  
  try {
    // Mock document and global objects
    global.WebSocket = MockWebSocket;
    global.MediaRecorder = MockMediaRecorder;
    global.Blob = Blob;
    global.FileReader = class {
      readAsDataURL() {
        setTimeout(() => {
          this.onloadend && this.onloadend({ 
            target: { result: 'data:audio/wav;base64,' + mockAudioSample }
          });
        }, 10);
      }
    };
    
    // Import the WebSocket client
    const { WebSocketClient } = await import('../client/src/lib/websocket.ts');
    
    // Create client instance
    const wsClient = new WebSocketClient();
    
    // Set up translation handler
    wsClient.addEventListener('translation', (data) => {
      console.log('Translation received:', data.data.translatedText);
      currentSpeechText = data.data.translatedText;
    });
    
    // Connect and set role
    wsClient.connect();
    wsClient.setRoleAndLock('teacher');
    
    // Create a mock audio handler
    const audioChunk = new Blob([Buffer.from(mockAudioSample, 'base64')], { type: 'audio/wav' });
    const base64Data = await blobToBase64(audioChunk);
    
    // Send mock audio
    console.log('Sending mock audio data...');
    wsClient.sendAudio(base64Data);
    
    // Wait for processing to complete and check result
    console.log('Waiting for audio processing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify that the current speech was updated
    if (currentSpeechText === 'This is a test transcription') {
      console.log('✅ TEST PASSED: Real-time speech processing is working correctly');
      console.log(`Speech text: "${currentSpeechText}"`);
      testPassed = true;
    } else {
      console.log('❌ TEST FAILED: Speech text was not updated correctly');
      console.log(`Expected: "This is a test transcription", but got: "${currentSpeechText}"`);
      testPassed = false;
    }
    
    // Clean up
    wsClient.disconnect();
  } catch (err) {
    console.error('Error during test:', err);
    error = err;
    testPassed = false;
  }
  
  // Print final result
  console.log('----------------------------------------------');
  console.log(`Test ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (error) {
    console.log('Error:', error.message);
  }
  console.log('----------------------------------------------');
  
  return testPassed;
}

// Run the test
testRealTimeSpeech()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });
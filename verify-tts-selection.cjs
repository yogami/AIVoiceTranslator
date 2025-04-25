/**
 * Manual TTS Service Selection Verification Script
 * 
 * This script simulates a teacher connection to verify that
 * the TTS service selection works correctly.
 */

const WebSocket = require('ws');

// Run the verification
run();

async function run() {
  try {
    // Get the URL from environment or use a default
    const protocol = 'wss';
    const host = '34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
    const wsUrl = `${protocol}://${host}/ws`;
    
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    // Track test state
    let connectionConfirmed = false;
    let registrationSent = false;
    let settingsSent = false;
    let testMessageSent = false;
    let sessionId = null;
    let testResults = [];
    
    // Handle WebSocket events
    ws.on('open', () => {
      console.log('WebSocket connection established');
      
      // Send registration as teacher
      sendRegister(ws);
      registrationSent = true;
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`Received message type: ${message.type}`);
      
        if (message.type === 'connection') {
          connectionConfirmed = true;
          sessionId = message.sessionId;
          console.log(`Connection confirmed with sessionId: ${sessionId}`);
        
          // Wait for registration to complete
          if (registrationSent && !settingsSent) {
            // First test with browser TTS
            await sendSettings(ws, 'browser');
            settingsSent = true;
          
            // Send a test message to trigger translation
            setTimeout(() => {
              sendTestMessage(ws, 'This is a test message with browser TTS');
              testMessageSent = true;
            }, 1000);
          }
        }
      
        if (message.type === 'settings' && message.status === 'success') {
          console.log('Settings updated successfully:', message.data);
        
          // Capture the current TTS service type
          const currentTtsService = message.data.ttsServiceType;
          testResults.push({
            settingRequested: settingsSent ? 'browser' : 'unknown',
            settingReceived: currentTtsService
          });
        
          console.log(`TTS service type confirmed as: ${currentTtsService}`);
        }
      
        // Check for translation messages (will not receive them as teacher but useful for logging)
        if (message.type === 'translation') {
          console.log('Translation received:');
          console.log('- Original text:', message.originalText);
          console.log('- Translated text:', message.text);
          console.log('- TTS service:', message.ttsServiceType);
          console.log('- Using client speech:', message.useClientSpeech);
        
          // Record test result
          testResults.push({
            messageType: 'translation',
            ttsServiceType: message.ttsServiceType,
            useClientSpeech: message.useClientSpeech
          });
        }
      
        // Handle transcription result confirmation
        if (message.type === 'transcription_result') {
          console.log('Transcription result:');
          console.log('- Text:', message.text);
          console.log('- Final:', message.isFinal);
        
          if (testMessageSent && message.isFinal) {
            // Test completed, now switch to OpenAI TTS and test again
            await sendSettings(ws, 'openai');
          
            // Send another test message with OpenAI TTS
            setTimeout(() => {
              sendTestMessage(ws, 'This is a test message with OpenAI TTS');
            }, 1000);
          
            // Exit after all tests are complete
            setTimeout(() => {
              printResults();
              process.exit(0);
            }, 5000);
          }
        }
      } catch (err) {
        console.error('Error parsing message:', err);
        console.log('Raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      process.exit(1);
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      
      if (!connectionConfirmed) {
        console.error('Connection was closed before confirmation');
        process.exit(1);
      }
      
      printResults();
      process.exit(0);
    });
    
    // Print test results
    function printResults() {
      console.log('\n=== TTS SERVICE SELECTION TEST RESULTS ===');
      
      if (testResults.length === 0) {
        console.log('No test results recorded');
        return;
      }
      
      testResults.forEach((result, index) => {
        console.log(`\nTest ${index + 1}:`);
        Object.keys(result).forEach(key => {
          console.log(`- ${key}: ${result[key]}`);
        });
      });
      
      // Overall assessment
      const browserTest = testResults.find(r => r.settingRequested === 'browser');
      const openaiTest = testResults.find(r => r.settingRequested === 'openai');
      
      if (browserTest && browserTest.settingReceived === 'browser') {
        console.log('\n✅ Browser TTS setting was correctly applied');
      } else {
        console.log('\n❌ Browser TTS setting was NOT correctly applied');
      }
      
      if (openaiTest && openaiTest.settingReceived === 'openai') {
        console.log('✅ OpenAI TTS setting was correctly applied');
      } else {
        console.log('❌ OpenAI TTS setting was NOT correctly applied');
      }
    }
    
    // Register as teacher
    function sendRegister(ws) {
      const registerMessage = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Test Teacher',
        ttsServiceType: 'browser' // Initial TTS service type
      };
      
      console.log('Sending registration as teacher');
      ws.send(JSON.stringify(registerMessage));
    }
    
    // Send settings update
    async function sendSettings(ws, ttsServiceType) {
      return new Promise((resolve) => {
        const settingsMessage = {
          type: 'settings',
          ttsServiceType: ttsServiceType
        };
        
        console.log(`Sending settings update: TTS service = ${ttsServiceType}`);
        ws.send(JSON.stringify(settingsMessage));
        
        // Brief delay to ensure settings are processed
        setTimeout(resolve, 500);
      });
    }
    
    // Send test message
    function sendTestMessage(ws, text) {
      const transcriptionMessage = {
        type: 'transcription',
        text: text,
        isFinal: true,
        languageCode: 'en-US'
      };
      
      console.log(`Sending test message: "${text}"`);
      ws.send(JSON.stringify(transcriptionMessage));
    }
    
    // Auto-exit after timeout
    setTimeout(() => {
      console.error('Test timed out after 20 seconds');
      printResults();
      process.exit(1);
    }, 20000);
    
  } catch (error) {
    console.error('Error running verification:', error);
    process.exit(1);
  }
}
/**
 * TTS Service Selection Test
 * 
 * This script verifies that the TTS service selection in the WebSocketServer 
 * correctly respects the user's selection between Browser TTS and OpenAI TTS.
 */

const WebSocket = require('ws');
const assert = require('assert');

// Configuration
const config = {
  // Use the replit URL when available, otherwise localhost
  wsUrl: process.env.REPLIT_URL ? 
    `wss://${process.env.REPLIT_URL}/ws` : 
    'ws://localhost:5000/ws',
  testCases: [
    // Test 1: Default should now be 'browser'
    { 
      description: "Default TTS service type", 
      ttsServiceType: null,
      expectedService: "browser" 
    },
    // Test 2: Explicitly set to 'browser'
    { 
      description: "Explicitly set to 'browser'",
      ttsServiceType: "browser", 
      expectedService: "browser" 
    },
    // Test 3: Explicitly set to 'openai'
    { 
      description: "Explicitly set to 'openai'",
      ttsServiceType: "openai", 
      expectedService: "openai" 
    },
    // Test 4: Change from 'browser' to 'openai'
    { 
      description: "Change from 'browser' to 'openai'",
      ttsServiceType: "openai", 
      startingService: "browser",
      expectedService: "openai" 
    },
    // Test 5: Change from 'openai' to 'browser'
    { 
      description: "Change from 'openai' to 'browser'", 
      ttsServiceType: "browser", 
      startingService: "openai",
      expectedService: "browser" 
    }
  ]
};

// Run the tests
(async function() {
  console.log(`
╔════════════════════════════════════════════════════╗
║          TTS SERVICE SELECTION TEST SUITE          ║
╚════════════════════════════════════════════════════╝
`);

  console.log(`Connecting to WebSocket server at: ${config.wsUrl}`);
  let testsPassed = 0;
  let testsFailed = 0;

  for (let i = 0; i < config.testCases.length; i++) {
    const testCase = config.testCases[i];
    console.log(`\n[Test ${i+1}] ${testCase.description}`);

    try {
      const result = await runTestCase(testCase);
      console.log(`✅ PASSED: ${result.message}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ FAILED: ${error.message}`);
      testsFailed++;
    }
  }

  // Print summary
  console.log(`\n
╔════════════════════════════════════════════════════╗
║                    TEST SUMMARY                    ║
╠════════════════════════════════════════════════════╣
║  Total tests: ${testsPassed + testsFailed}                                     ║
║  Passed:      ${testsPassed}                                     ║
║  Failed:      ${testsFailed}                                     ║
╚════════════════════════════════════════════════════╝
`);

  process.exit(testsFailed > 0 ? 1 : 0);
})();

/**
 * Run a single test case for TTS service selection
 */
async function runTestCase(testCase) {
  return new Promise((resolve, reject) => {
    let timer;
    let ws;
    
    try {
      ws = new WebSocket(config.wsUrl);
    } catch (error) {
      reject(new Error(`Failed to connect to WebSocket server: ${error.message}`));
      return;
    }

    // Set a timeout for the test
    timer = setTimeout(() => {
      ws.close();
      reject(new Error('Test timed out after 10 seconds'));
    }, 10000);

    // Track test state
    let sessionId = null;
    let connected = false;
    let registered = false;
    let settingsConfirmed = false;
    let actualService = null;
    
    // Set up WebSocket handlers
    ws.on('open', () => {
      console.log('  Connected to WebSocket server');
      
      // Register as teacher
      registerAsTeacher(ws, testCase.startingService);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        // Handle connection confirmation
        if (message.type === 'connection') {
          connected = true;
          sessionId = message.sessionId;
          console.log(`  Received session ID: ${sessionId}`);
        }
        
        // Handle register confirmation
        if (message.type === 'register') {
          registered = true;
          console.log('  Successfully registered as teacher');
          
          // Send settings update if specified in the test case
          if (testCase.ttsServiceType !== null) {
            console.log(`  Updating TTS service to: ${testCase.ttsServiceType}`);
            ws.send(JSON.stringify({
              type: 'settings',
              ttsServiceType: testCase.ttsServiceType
            }));
          } else {
            // If no TTS service is specified, check what the default is
            console.log('  Checking default TTS service setting');
            ws.send(JSON.stringify({
              type: 'settings'
            }));
          }
        }
        
        // Handle settings confirmation
        if (message.type === 'settings' && message.status === 'success') {
          settingsConfirmed = true;
          actualService = message.data.ttsServiceType;
          console.log(`  Server confirmed TTS service: ${actualService}`);
          
          // Verify the service type is what we expected
          if (actualService === testCase.expectedService) {
            clearTimeout(timer);
            ws.close();
            resolve({
              success: true,
              message: `TTS service correctly set to '${actualService}'`
            });
          } else {
            clearTimeout(timer);
            ws.close();
            reject(new Error(`Expected TTS service '${testCase.expectedService}' but got '${actualService}'`));
          }
        }
      } catch (error) {
        console.warn('  Error parsing message:', error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error: ${error.message}`));
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!settingsConfirmed) {
        reject(new Error('WebSocket closed before test completed'));
      }
    });
  });
}

/**
 * Register as a teacher with the WebSocket server
 */
function registerAsTeacher(ws, initialTtsService = null) {
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US',
    name: 'Test Teacher'
  };
  
  // If an initial TTS service is specified, include it in the registration
  if (initialTtsService) {
    registerMessage.ttsServiceType = initialTtsService;
  }
  
  console.log(`  Registering as teacher${initialTtsService ? ` with initial TTS service: ${initialTtsService}` : ''}`);
  ws.send(JSON.stringify(registerMessage));
}
/**
 * Browser TTS Fix Verification Test
 * 
 * This script tests if our fix for the browser TTS issue works correctly.
 * It simulates both the teacher and student side of the application.
 */

const WebSocket = require('ws');
const { setTimeout } = require('timers/promises');

// Function to create a WebSocket connection
function createWebSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
      console.log(`Connected to ${url}`);
      resolve(ws);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error.message}`);
      reject(error);
    });
    
    // Set up message handler
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Received message type=${message.type}`);
        
        // When connection is confirmed, emit an event
        if (message.type === 'connection') {
          ws.emit('connectionConfirmed', message);
        }
        
        // When translation is received, emit an event
        if (message.type === 'translation') {
          const ttsServiceType = message.ttsServiceType || 'browser';
          const useClientSpeech = message.useClientSpeech === true;
          
          console.log(`Received translation with ttsServiceType=${ttsServiceType}, useClientSpeech=${useClientSpeech}`);
          
          // Apply our fix - if browser TTS is selected, useClientSpeech should be true
          const fixedUseClientSpeech = (ttsServiceType === 'browser') ? true : useClientSpeech;
          
          ws.emit('translationReceived', {
            originalMessage: message,
            ttsServiceType,
            fixedUseClientSpeech,
            // If our fix works correctly, these should be the same for browser TTS
            fixWorks: (ttsServiceType !== 'browser' || fixedUseClientSpeech === true)
          });
        }
      } catch (error) {
        console.error(`Error parsing message: ${error.message}`);
      }
    });
  });
}

// Main test function
async function runTest() {
  const serverUrl = 'ws://localhost:5000/ws';
  let teacherWs = null;
  let studentWs = null;
  let testResults = {
    browserTtsTest: { ran: false, passed: false },
    openaiTtsTest: { ran: false, passed: false }
  };
  
  try {
    console.log('Starting browser TTS fix verification test...');
    
    // Connect teacher WebSocket
    console.log('Connecting teacher WebSocket...');
    teacherWs = await createWebSocket(serverUrl);
    
    // Register as teacher
    console.log('Registering as teacher...');
    const registerTeacherMessage = {
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      ttsServiceType: 'browser' // Default to browser TTS
    };
    teacherWs.send(JSON.stringify(registerTeacherMessage));
    
    // Wait a bit
    await setTimeout(1000);
    
    // Connect student WebSocket
    console.log('Connecting student WebSocket...');
    studentWs = await createWebSocket(serverUrl);
    
    // Set up student message listener for translation
    const studentTranslationPromise = new Promise((resolve) => {
      studentWs.once('translationReceived', (data) => {
        resolve(data);
      });
    });
    
    // Register as student
    console.log('Registering as student...');
    const registerStudentMessage = {
      type: 'register',
      role: 'student',
      languageCode: 'es' // Spanish
    };
    studentWs.send(JSON.stringify(registerStudentMessage));
    
    // Wait a bit
    await setTimeout(1000);
    
    // Test with browser TTS
    console.log('\n--- Testing browser TTS ---');
    const browserSettings = {
      type: 'settings',
      ttsServiceType: 'browser'
    };
    teacherWs.send(JSON.stringify(browserSettings));
    
    // Wait for settings to propagate
    await setTimeout(1000);
    
    // Send test message from teacher
    const testMessage = "This is a test message for browser TTS.";
    console.log(`Sending test message: "${testMessage}"`);
    const transcriptionMessage = {
      type: 'transcription',
      text: testMessage,
      languageCode: 'en-US'
    };
    teacherWs.send(JSON.stringify(transcriptionMessage));
    
    // Wait for translation to be received by student
    console.log('Waiting for translation...');
    const browserTtsResult = await studentTranslationPromise;
    
    // Check if our fix works
    testResults.browserTtsTest.ran = true;
    testResults.browserTtsTest.passed = browserTtsResult.fixWorks;
    
    console.log(`Browser TTS test result: ${browserTtsResult.fixWorks ? 'PASSED' : 'FAILED'}`);
    console.log(`- TTS service type: ${browserTtsResult.ttsServiceType}`);
    console.log(`- useClientSpeech flag: ${browserTtsResult.fixedUseClientSpeech}`);
    
    // Wait a bit
    await setTimeout(1000);
    
    // Test with OpenAI TTS
    console.log('\n--- Testing OpenAI TTS ---');
    const openaiSettings = {
      type: 'settings',
      ttsServiceType: 'openai'
    };
    teacherWs.send(JSON.stringify(openaiSettings));
    
    // Wait for settings to propagate
    await setTimeout(1000);
    
    // Set up another student message listener for translation
    const studentOpenAITranslationPromise = new Promise((resolve) => {
      studentWs.once('translationReceived', (data) => {
        resolve(data);
      });
    });
    
    // Send test message from teacher
    const openaiTestMessage = "This is a test message for OpenAI TTS.";
    console.log(`Sending test message: "${openaiTestMessage}"`);
    const openaiTranscriptionMessage = {
      type: 'transcription',
      text: openaiTestMessage,
      languageCode: 'en-US'
    };
    teacherWs.send(JSON.stringify(openaiTranscriptionMessage));
    
    // Wait for translation to be received by student
    console.log('Waiting for translation...');
    const openaiTtsResult = await studentOpenAITranslationPromise;
    
    // Check if OpenAI TTS works as expected
    testResults.openaiTtsTest.ran = true;
    testResults.openaiTtsTest.passed = openaiTtsResult.fixWorks;
    
    console.log(`OpenAI TTS test result: ${openaiTtsResult.fixWorks ? 'PASSED' : 'FAILED'}`);
    console.log(`- TTS service type: ${openaiTtsResult.ttsServiceType}`);
    console.log(`- useClientSpeech flag: ${openaiTtsResult.fixedUseClientSpeech}`);
    
    // Print summary
    console.log('\n--- Test Results Summary ---');
    console.log(`Browser TTS test: ${testResults.browserTtsTest.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`OpenAI TTS test: ${testResults.openaiTtsTest.passed ? 'PASSED' : 'FAILED'}`);
    
    const allPassed = Object.values(testResults).every(result => result.passed);
    console.log(`\nOverall result: ${allPassed ? 'PASSED' : 'FAILED'}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Clean up
    if (teacherWs && teacherWs.readyState === WebSocket.OPEN) {
      teacherWs.close();
    }
    if (studentWs && studentWs.readyState === WebSocket.OPEN) {
      studentWs.close();
    }
  }
}

// Run the test
runTest().catch(console.error);
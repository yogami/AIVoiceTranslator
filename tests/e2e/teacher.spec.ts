/**
 * Teacher Interface Comprehensive E2E Test Suite
 * 
 * This test suite covers all teacher interface functionality including:
 * - Basic UI and WebSocket connection
 * - Audio recording and transcription
 * - Language selection
 * - Classroom code generation
 * - Teacher-student interaction flows
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Teacher Interface - Comprehensive Test Suite', () => {
  let page: Page;

  test.beforeEach(async ({ browser, browserName }) => {
    // Create a new context with permiss        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);ons (only for Chromium)
    const contextOptions: any = {};
    if (browserName === 'chromium') {
      contextOptions.permissions = ['microphone'];
    }
    const context = await browser.newContext(contextOptions);
    page = await context.newPage();
    
    // Mock getUserMedia and Speech Recognition for audio tests
    await page.addInitScript(() => {
      // Create a mock MediaStream
      const mockStream = {
        getTracks: () => [{
          kind: 'audio',
          stop: () => {},
          enabled: true
        }],
        getAudioTracks: () => [{
          kind: 'audio',
          stop: () => {},
          enabled: true
        }],
        active: true
      };
      
      // Mock MediaRecorder
      (window as any).MediaRecorder = class MockMediaRecorder {
        state = 'inactive';
        ondataavailable: ((event: any) => void) | null = null;
        onstop: (() => void) | null = null;
        
        constructor(stream: any, options: any) {
          console.log('MockMediaRecorder created with options:', options);
        }
        
        start(timeslice?: number) {
          console.log('MockMediaRecorder started with timeslice:', timeslice);
          this.state = 'recording';
          
          // Simulate data available events
          if (this.ondataavailable) {
            setTimeout(() => {
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
              if (this.ondataavailable) {
                this.ondataavailable({ data: mockBlob });
              }
            }, 150);
          }
        }
        
        stop() {
          console.log('MockMediaRecorder stopped');
          this.state = 'inactive';
          if (this.onstop) {
            this.onstop();
          }
        }
        
        static isTypeSupported(mimeType: string) {
          return mimeType === 'audio/webm' || mimeType === 'audio/ogg';
        }
      };
      
      // Mock getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: async (constraints: any) => {
            console.log('getUserMedia called with constraints:', constraints);
            return mockStream as any;
          }
        }
      });
      
      // Mock Speech Recognition
      (window as any).webkitSpeechRecognition = class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        onresult: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;
        onend: (() => void) | null = null;
        
        start() {
          console.log('Speech recognition started');
          // Simulate a transcription result after a delay
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: [{
                  isFinal: true,
                  0: { transcript: 'Hello, this is a test transcription' }
                }]
              });
            }
          }, 500);
        }
        
        stop() {
          console.log('Speech recognition stopped');
          if (this.onend) {
            this.onend();
          }
        }
      };
    });
    
    // Navigate to teacher page with E2E test flag
    await page.goto('http://127.0.0.1:5001/teacher?e2e=true'); 
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  // Basic UI Tests
  test.describe('Basic UI and Connection', () => {
  test('should default to German language on page load', async () => {
    // Wait for the language dropdown to be visible
    await expect(page.locator('#teacherLanguage')).toBeVisible();
    
    // Check that German (de-DE) is selected by default
    const selectedValue = await page.locator('#teacherLanguage').inputValue();
    expect(selectedValue).toBe('de-DE');
    
    // Also check the displayed text
    const selectedText = await page.locator('#teacherLanguage option:checked').textContent();
    expect(selectedText).toContain('German');
  });

  test('should display initial UI elements correctly', async () => {
    // Check h1 (main heading)
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText('Teacher Interface');

    // Check other essential UI elements
    await expect(page.locator('#teacherLanguage')).toBeVisible();
    
    const recordButton = page.locator('#recordButton');
    await expect(recordButton).toBeVisible();
    await expect(recordButton).toBeEnabled(); 
    await expect(recordButton).toHaveText('Start Recording'); 
    
    await expect(page.locator('#transcription')).toBeVisible(); 
  });

  test('should establish WebSocket connection automatically', async () => {
    // Wait for auto-connection status message
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
    });

    test('should display classroom code and QR code', async () => {
      // Wait for WebSocket connection and registration
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Check classroom code is displayed
      const classroomCode = page.locator('#classroom-code-display');
      await expect(classroomCode).toBeVisible();
      
      // Code should be 6 characters
      const codeText = await classroomCode.textContent();
      expect(codeText).toMatch(/^[A-Z0-9]{6}$/);
      
      // Student URL should be displayed
      const studentUrl = page.locator('#studentUrl');
      await expect(studentUrl).toContainText(`/student?code=${codeText}`);
      
      // QR code container should exist and have a canvas
      const qrCodeContainer = page.locator('#qr-code');
      await expect(qrCodeContainer).toBeVisible();
      
      // Check that QR code canvas exists (it might be inside the container)
      const qrCanvas = qrCodeContainer.locator('canvas');
      const canvasCount = await qrCanvas.count();
      expect(canvasCount).toBeGreaterThan(0);
    });
  });

  // Language Selection Tests
  test.describe('Language Selection', () => {
  test('should handle language selection', async () => {
    // Wait for connection first, as language change might trigger re-registration
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
    
    // Change language
    await page.selectOption('#teacherLanguage', 'es-ES'); // Spanish (Spain)
    const selectedValue = await page.locator('#teacherLanguage').inputValue();
    expect(selectedValue).toBe('es-ES');
    
    // The application should ideally re-register with the new language.
    await page.waitForTimeout(1000); 
  });

    test('should handle language changes during recording', async () => {
      // Wait for WebSocket connection
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Change language
      const languageSelect = page.locator('#teacherLanguage');
      await languageSelect.selectOption('es-ES');
      
      // Track registration messages
      const wsMessages: any[] = [];
      page.on('websocket', ws => {
        ws.on('framesent', event => {
          try {
            const data = JSON.parse(event.payload as string);
            if (data.type === 'register') {
              wsMessages.push(data);
            }
          } catch (e) {
            // Not JSON
          }
        });
      });
      
      // Wait a bit for the registration to be sent
      await page.waitForTimeout(500);
      
      // Start recording to verify language is used
      const recordButton = page.locator('#recordButton');
      await recordButton.click();
      
      // Verify recording started
      await expect(recordButton).toHaveText('Stop Recording');
    });
  });

  // Audio Recording Tests
  test.describe('Audio Recording and Transcription', () => {
  test('should handle recording controls', async () => {
    // Wait for WebSocket connection to be established first
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });

    // Check initial state of the record button
    const recordButton = page.locator('#recordButton');
    await expect(recordButton).toBeEnabled();
    await expect(recordButton).toHaveText('Start Recording');
    
      // Start recording
    await recordButton.click();
      
      // Wait for recording to start
      await expect(recordButton).toHaveText('Stop Recording');
      await expect(page.locator('#status')).toContainText('Recording... Speak naturally');
      
      // Stop recording
      await recordButton.click();
      await expect(recordButton).toHaveText('Start Recording');
      await expect(page.locator('#status')).toContainText('Recording stopped');
    });

    test('should display transcriptions from speech recognition', async () => {
      // Wait for WebSocket connection
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Start recording
      const recordButton = page.locator('#recordButton');
      await recordButton.click();
      
      // Wait for recording to start
      await expect(recordButton).toHaveText('Stop Recording');
      await expect(page.locator('#status')).toContainText('Recording... Speak naturally');
      
      // Wait for transcription to appear (mock speech recognition sends it after 500ms)
      await page.waitForTimeout(1000);
      
      // Check that transcription is displayed
      const transcriptionDisplay = page.locator('#transcription');
      await expect(transcriptionDisplay).toContainText('Hello, this is a test transcription');
      
      // Stop recording
      await recordButton.click();
      await expect(recordButton).toHaveText('Start Recording');
      await expect(page.locator('#status')).toContainText('Recording stopped');
    });

    test('should send transcriptions through WebSocket', async () => {
      // Navigate to a fresh page with WebSocket interception
      const wsMessages: any[] = [];
      
      // Set up WebSocket message interception before loading the page
      await page.addInitScript(() => {
        (window as any).__wsMessages = [];
        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data: any) {
          try {
            const parsed = JSON.parse(data);
            (window as any).__wsMessages.push(parsed);
          } catch (e) {
            // Not JSON, ignore
          }
          return originalSend.call(this, data);
        };
      });
      
      // Navigate to teacher page with e2e parameter
      await page.goto('http://127.0.0.1:5001/teacher?e2e=true');
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for WebSocket connection and authentication bypass
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Start recording
      const recordButton = page.locator('#recordButton');
      await recordButton.click();
      
      // Wait for transcription to be sent (mock sends after 500ms)
      await page.waitForTimeout(1500);
      
      // Get WebSocket messages
      const messages = await page.evaluate(() => (window as any).__wsMessages || []);
      
      // Find transcription messages
      const transcriptionMessages = messages.filter((msg: any) => msg.type === 'transcription');
      
      // Verify transcription message was sent
      expect(transcriptionMessages.length).toBeGreaterThan(0);
      
      const transcriptionMessage = transcriptionMessages[0];
      expect(transcriptionMessage).toMatchObject({
        type: 'transcription',
        text: 'Hello, this is a test transcription',
        timestamp: expect.any(Number),
        isFinal: true
      });
    });

    test('should send audio data through WebSocket', async () => {
      // Wait for WebSocket connection
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Intercept WebSocket messages
      const wsMessages: any[] = [];
      await page.addInitScript(() => {
        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data: any) {
          try {
            const parsed = JSON.parse(data);
            (window as any).__wsMessages = (window as any).__wsMessages || [];
            (window as any).__wsMessages.push(parsed);
          } catch (e) {
            // Not JSON, ignore
          }
          return originalSend.call(this, data);
        };
      });
      
      // Reload to apply WebSocket interception
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Start recording
      const recordButton = page.locator('#recordButton');
      await recordButton.click();
      
      // Wait for audio to be sent (MediaRecorder sends data after 150ms in our mock)
      await page.waitForTimeout(300);
      
      // Get WebSocket messages
      const messages = await page.evaluate(() => (window as any).__wsMessages || []);
      
      // Find audio messages
      const audioMessages = messages.filter((msg: any) => msg.type === 'audio');
      
      // Verify audio message was sent
      expect(audioMessages.length).toBeGreaterThan(0);
      
      const audioMessage = audioMessages[0];
      expect(audioMessage).toMatchObject({
        type: 'audio',
        sessionId: expect.any(String),
        data: expect.any(String), // base64 encoded
        isFirstChunk: true,
        isFinalChunk: false,
        language: expect.any(String)
      });
    });
  });

  // Error Handling Tests
  test.describe('Error Handling', () => {
  // TODO: Revisit this test. It's an edge case for when SpeechRecognition API is unavailable but microphone is granted. Currently hard to mock reliably in E2E.
  test.skip('should show error if trying to record when speech recognition is unavailable', async ({ browser, browserName }) => {
    const contextOptions: any = {};
    if (browserName === 'chromium') {
      contextOptions.permissions = ['microphone'];
    }
    const context = await browser.newContext(contextOptions);
    const newPage = await context.newPage(); 
    
    await newPage.addInitScript(() => {
      // Explicitly disable SpeechRecognition APIs for this specific test page.
      // This will override any mock SpeechRecognition that might be set up by a global beforeEach for this newPage.
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;

      // Note: We are intentionally NOT re-mocking getUserMedia, MediaRecorder, etc., here.
      // This newPage context will inherit the general mocks from the global beforeEach if they apply,
      // or use browser defaults if not overridden. The critical part for this test is that
      // SpeechRecognition itself is unavailable.
    });
    
    await newPage.goto('http://127.0.0.1:5001/teacher?e2e=true'); 
    await newPage.waitForLoadState('domcontentloaded');

    // Wait for the record button to be visible and then click it
    const recordButton = newPage.locator('#recordButton');
    await expect(recordButton).toBeVisible({ timeout: 5000 });
    await recordButton.click();
    
    // Assert that the status message indicates speech recognition is not available
    await expect(newPage.locator('#status')).toContainText('Speech recognition not available', { timeout: 3000 });
    
    // Record button should remain enabled as recording couldn't start
    await expect(recordButton).toBeEnabled();
    
    // Clean up: close the page and context
    await newPage.close();
    await context.close();
    });

    test('should handle recording errors gracefully', async () => {
      // Create a new page with error-triggering speech recognition
      const context = await page.context();
      const errorPage = await context.newPage();
      
      // Set up error mock before page loads
      await errorPage.addInitScript(() => {
        // Mock MediaRecorder (same as before)
        const mockStream = {
          getTracks: () => [{
            kind: 'audio',
            stop: () => {},
            enabled: true
          }],
          getAudioTracks: () => [{
            kind: 'audio',
            stop: () => {},
            enabled: true
          }],
          active: true
        };
        
        (window as any).MediaRecorder = class MockMediaRecorder {
          state = 'inactive';
          ondataavailable: ((event: any) => void) | null = null;
          onstop: (() => void) | null = null;
          
          constructor(stream: any, options: any) {
            console.log('MockMediaRecorder created');
          }
          
          start(timeslice?: number) {
            this.state = 'recording';
          }
          
          stop() {
            this.state = 'inactive';
            if (this.onstop) {
              this.onstop();
            }
          }
          
          static isTypeSupported(mimeType: string) {
            return true;
          }
        };
        
        Object.defineProperty(navigator, 'mediaDevices', {
          writable: true,
          value: {
            getUserMedia: async (constraints: any) => {
              return mockStream as any;
            }
          }
        });
        
        // Mock Speech Recognition that triggers error
        (window as any).webkitSpeechRecognition = class MockSpeechRecognition {
          continuous = false;
          interimResults = false;
          lang = 'en-US';
          onresult: ((event: any) => void) | null = null;
          onerror: ((event: any) => void) | null = null;
          onend: (() => void) | null = null;
          
          start() {
            console.log('Speech recognition started (error mock)');
            // Trigger error after a short delay
            setTimeout(() => {
              if (this.onerror) {
                this.onerror({ error: 'network' });
              }
            }, 100);
          }
          
          stop() {
            if (this.onend) {
              this.onend();
            }
          }
        };
      });
      
      // Navigate to teacher page
      await errorPage.goto('http://127.0.0.1:5001/teacher?e2e=true');
      await errorPage.waitForLoadState('domcontentloaded');
      
      // Wait for WebSocket connection
      await expect(errorPage.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      
      // Try to start recording
      const recordButton = errorPage.locator('#recordButton');
      await recordButton.click();
      
      // Wait for error to be processed
      await errorPage.waitForTimeout(500);
      
      // Check error is displayed
      await expect(errorPage.locator('#status')).toContainText('Speech recognition error: network');
      
      // Clean up
      await errorPage.close();
    });
  });

  // Teacher-Student Flow Tests
  test.describe('Teacher-Student Interaction', () => {
    test('should handle basic teacher-student interaction', async ({ browser }) => {
      // Create student context and page
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      
      try {
        // Wait for teacher to be ready
        await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
        const classroomCodeElement = page.locator('#classroom-code-display');
        await expect(classroomCodeElement).toBeVisible();
        const classroomCode = await classroomCodeElement.textContent();
        expect(classroomCode).toBeTruthy(); // Ensure classroomCode is not null or empty
        
        // Student navigates to their page with the classroom code
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');

        // Student selects a language (e.g., Spanish)
        await studentPage.selectOption('#language-dropdown', 'es-ES');
        
        // Student clicks the connect button
        await studentPage.click('#connect-btn');
        
        // Verify student connected status on student page
        await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 10000 });
        
        // Verify teacher is still ready (status might change if student connection triggers UI update)
        await expect(page.locator('#recordButton')).toBeEnabled();
        // Consider if teacher status should be re-checked or if it might change upon student connection
        // For now, let's assume it remains 'Registered as teacher' or similar non-error state.
        await expect(page.locator('#status')).toContainText('Registered as teacher'); 

      } finally {
        await studentPage.close();
        await studentContext.close();
      }
    });

    test('should handle student language changes', async ({ browser }) => {
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      
      try {
        await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
        const classroomCodeElement = page.locator('#classroom-code-display');
        const classroomCode = await classroomCodeElement.textContent();
        expect(classroomCode).toBeTruthy();
        
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');
        
        // Student selects initial language (e.g., Spanish)
        await studentPage.selectOption('#language-dropdown', 'es-ES');
        // Student clicks connect
        await studentPage.click('#connect-btn');
        await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 10000 });
        
        // Student changes language (e.g., to German)
        await studentPage.selectOption('#language-dropdown', 'de-DE');
        // Add a short wait if the language change triggers async operations like re-registering
        await studentPage.waitForTimeout(1000); // Adjust as needed
        
        // Verify student language change was processed and status remains connected or updates appropriately
        const selectedLang = await studentPage.locator('#language-dropdown').inputValue();
        expect(selectedLang).toBe('de-DE');
        // Re-check connection status if language change might affect it
        await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 5000 });

      } finally {
        await studentPage.close();
        await studentContext.close();
      }
    });

    test('should handle student reconnection', async ({ browser }) => {
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      
      try {
        await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
        const classroomCodeElement = page.locator('#classroom-code-display');
        const classroomCode = await classroomCodeElement.textContent();
        expect(classroomCode).toBeTruthy();
        
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');

        // Student selects language and connects
        await studentPage.selectOption('#language-dropdown', 'fr-FR'); // French for this test
        await studentPage.click('#connect-btn');
        await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 10000 });
        
        // Simulate reconnection by reloading
        await studentPage.reload();
        await studentPage.waitForLoadState('domcontentloaded');
        
        // After reload, student needs to select language and click connect again
        await studentPage.selectOption('#language-dropdown', 'fr-FR'); // Re-select language
        await studentPage.click('#connect-btn'); // Re-click connect

        // Verify student reconnected
        await expect(studentPage.locator('#connection-status')).toContainText('Connected', { timeout: 10000 });
        
        await expect(page.locator('#status')).toContainText('Registered as teacher');
      } finally {
        await studentPage.close();
        await studentContext.close();
      }
    });

    test('should transmit teacher\'s speech to student as translated text and enable audio playback', async ({ browser }) => {
      // 1. Teacher Setup
      await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      const classroomCodeElement = page.locator('#classroom-code-display');
      await expect(classroomCodeElement).toBeVisible();
      const classroomCode = await classroomCodeElement.textContent();
      expect(classroomCode).toBeTruthy();
      if (classroomCode) { // Type guard for classroomCode
        expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
      } else {
        throw new Error("Classroom code was null or empty");
      }

      // 2. Student Setup  
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      
      // Small delay to ensure teacher session is stable before student connects
      await page.waitForTimeout(100);
      
      try {
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');

        // Student selects Spanish
        await studentPage.selectOption('#language-dropdown', 'es-ES');
        // Assuming the #selected-language display updates like: "Selected: 🇪🇸 Spanish (Spain)"
        await expect(studentPage.locator('#selected-language')).toContainText('Selected: 🇪🇸 Spanish (Spain)', { timeout: 2000 });

        // Student connects
        await studentPage.click('#connect-btn');
        await expect(studentPage.locator('#connection-status span')).toContainText('Connected', { timeout: 10000 });
        await expect(studentPage.locator('#translation-display')).toContainText('Waiting for teacher to start speaking...');

        // 3. Teacher Action
        const recordButton = page.locator('#recordButton');
        await recordButton.click(); // Start recording
        await expect(page.locator('#status')).toContainText('Recording... Speak naturally');

        const teacherTranscription = 'Hello, this is a test transcription';
        // Wait for teacher's UI to show the mock transcription
        await expect(page.locator('#transcription')).toContainText(teacherTranscription, { timeout: 3000 });

        // 4. Student Verification
        const studentTranslationDisplay = studentPage.locator('#translation-display');
        
        // Check that the "waiting" message is gone and something appears
        await expect(studentTranslationDisplay).not.toContainText('Waiting for teacher to start speaking...', { timeout: 15000 });
        
        // Students receive translated text, not original. Check for Spanish translation
        // The translation could vary slightly, so check for key parts
        await expect(studentTranslationDisplay).toContainText('Hola', { timeout: 10000 }); 
        await expect(studentTranslationDisplay).toContainText('transcripción de prueba', { timeout: 10000 }); 

        // Stop recording
        await recordButton.click(); 
        await expect(page.locator('#status')).toContainText('Recording stopped');

        // Check if Play Audio button is enabled (assuming server sends TTS audio)
        const playButton = studentPage.locator('#play-button');
        await expect(playButton).toBeEnabled({ timeout: 5000 });

      } finally {
        // Cleanup
        await studentPage.close();
        await studentContext.close();
      }
    });
  });

  // TODO: Revisit this test. Simulating network disconnection reliably in E2E is complex.
  test.skip('should handle connection loss and reconnection', async () => {
    // This test is skipped because simulating network disconnection reliably in an E2E test
    // without external tools or complex browser manipulation is difficult and can be flaky.
    // Testing WebSocket reconnection logic is often better suited for integration tests
    // where WebSocket server behavior can be more directly controlled and observed.
  });
});
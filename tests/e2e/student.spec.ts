import { test, expect, Page } from '@playwright/test';
import { getStudentURL, getTeacherURL } from './helpers/test-config.js';
import { testConfig } from './helpers/test-timeouts.js';

test.describe('Student Interface - Basic Scenarios', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Navigation will happen within each test for student page due to query params
  });

  test.afterEach(async () => {
    if (page) {
    await page.close();
    }
  });

  test('should display correctly when no classroom code is provided', async () => {
    await page.goto('http://127.0.0.1:5001/student'); // Use correct port for test environment
    await page.waitForLoadState('domcontentloaded');

    // Verify connection status display (still visible for no-code case)
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus).toBeVisible({ timeout: testConfig.ui.elementVisibilityTimeout });
    await expect(connectionStatus.locator('span')).toContainText('No classroom code provided');
    
    // Verify translation display shows the error
    const translationDisplay = page.locator('#translation-display');
    await expect(translationDisplay).toBeVisible({ timeout: testConfig.ui.elementVisibilityTimeout });
    await expect(translationDisplay).toContainText('Missing Classroom Code');

    // Verify connect button is disabled
    const connectButton = page.locator('#connect-btn');
    await expect(connectButton).toBeVisible({ timeout: testConfig.ui.elementVisibilityTimeout });
    await expect(connectButton).toBeDisabled();
  });

  test('should display correctly and prepare for connection when classroom code is provided in URL', async () => {
    const classroomCode = 'TESTCODE123'; // Example classroom code
    await page.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`); // Use correct port for test environment
    await page.waitForLoadState('domcontentloaded');

    // Verify the "Joining Classroom" info bar is displayed
    // The selector might need to be more specific if '.container' is too generic
    await expect(page.locator('body')).toContainText(`Joining Classroom: ${classroomCode}`);

    // New UX: language not auto-selected
    const languageDropdown = page.locator('#language-dropdown');
    await expect(languageDropdown).toHaveValue('');

    // Selected language display starts empty
    await expect(page.locator('#selected-language')).toHaveText('');

    // Connection status hidden until language is selected
    const connectionStatus2 = page.locator('#connection-status');
    await expect(connectionStatus2).toBeHidden();
    // await expect(connectionStatus.locator('.indicator')).toHaveClass(/disconnected/); // Class check can be sensitive, let's focus on text for now

    // Translation area hidden until connected
    const translationContainer = page.locator('#translation-step');
    await expect(translationContainer).toBeHidden();

    // Select a language to reveal connect controls
    await page.selectOption('#language-dropdown', { index: 1 });
    const connectButton = page.locator('#connect-btn');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
    await expect(connectButton).toHaveText('Connect to Session', { timeout: testConfig.ui.elementVisibilityTimeout });

    // Verify Play Audio button is disabled
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should show error immediately for non-existent classroom code and keep connect hidden', async () => {
    const nonExistentCode = 'NONEXISTENTCODE123';
    await page.goto(`http://127.0.0.1:5001/student?code=${nonExistentCode}`); // Use correct port for test environment
    await page.waitForLoadState('domcontentloaded');

    // New UX: invalid code shows error and no connect controls initially
    await expect(page.locator('#connection-status')).toBeHidden();

    // Wait for the error message in the translation display (allow formatted prefix like "❌ Error")
    const translationDisplay = page.locator('#translation-display');
    await expect(translationDisplay).toContainText('Classroom session expired or invalid. Please ask teacher for new link.', { timeout: testConfig.ui.teacherRegistrationTimeout });

    // Status remains hidden for invalid code path
    const connectionStatus3 = page.locator('#connection-status');
    await expect(connectionStatus3).toBeHidden();
    // await expect(connectionStatus.locator('.indicator')).toHaveClass(/disconnected/);

    // Selecting a language should NOT reveal connect when code is invalid
    await page.selectOption('#language-dropdown', { index: 1 });
    const connectButton2 = page.locator('#connect-btn');
    await expect(connectButton2).toBeHidden();

    // Play button should remain disabled
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should allow a student to connect to a teacher-generated session and receive a mocked translation', async ({ browser }) => {
    let teacherPage: Page | undefined;
    let studentPage: Page | undefined;

    try {
      // 1. Teacher Setup
      teacherPage = await browser.newPage();
      await teacherPage.goto('http://127.0.0.1:5001/teacher?e2e=true'); // Use correct port for test environment
      await expect(teacherPage.locator('#status')).toContainText('Registered as teacher', { timeout: testConfig.ui.teacherRegistrationTimeout });
      const classroomCodeElement = teacherPage.locator('#classroom-code-display');
      await expect(classroomCodeElement).toBeVisible({ timeout: testConfig.ui.teacherRegistrationTimeout });
      
      await expect(classroomCodeElement).not.toBeEmpty({ timeout: testConfig.ui.recordButtonTimeout }); 
      await expect(classroomCodeElement).not.toHaveText('LIVE', { timeout: testConfig.ui.classroomCodeTimeout });
      const classroomCode = await classroomCodeElement.innerText();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // 2. Student Setup
      studentPage = await browser.newPage();
      await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
      await studentPage.waitForLoadState('domcontentloaded');
      // New UX: explicitly select a language first
      await studentPage.selectOption('#language-dropdown', { index: 1 });
      const studentConnectButton = studentPage.locator('#connect-btn');
      await expect(studentConnectButton).toBeEnabled();

      // 3. Student Connects
      await studentConnectButton.click();
      await expect(studentPage.locator('#connection-status span')).toContainText('Connected', { timeout: testConfig.ui.connectionStatusTimeout });
      await expect(studentConnectButton).toHaveText('Disconnect', { timeout: testConfig.ui.elementVisibilityTimeout });

      // 4. Mock Translation on Student Page
      const mockTranslationPayload = {
        type: 'translation',
        originalText: 'Hello from teacher (mocked)',
        translatedText: 'Bonjour de l\'enseignant (moqué)',
        sourceLanguage: 'en-US', // Language of originalText
        targetLanguage: 'fr-FR', // Language of translatedText (student should be listening for this)
        ttsServiceType: 'openai', // Or whatever is expected
        latency: { total:100, serverCompleteTime: Date.now(), components: { translation:50, tts:30, processing:20}},
        audioData: null,
        // Provide original audio so Play Original (AI) should enable
        originalAudioData: Buffer.from('mock-original').toString('base64'),
        originalAudioFormat: 'mp3',
        useClientSpeech: false 
        // speechParams could be added if useClientSpeech were true
      };

      await studentPage.evaluate((payload) => {
        if (typeof (window as any).handleWebSocketMessage === 'function') {
          (window as any).handleWebSocketMessage(payload);
    } else {
          console.error('handleWebSocketMessage function not found on student page for mocking.');
          throw new Error('handleWebSocketMessage function not found on student page for mocking.');
        }
      }, mockTranslationPayload);

      // 5. Student Verifies Received Translation
      const translationDisplay = studentPage.locator('#translation-display');
      await expect(translationDisplay).toContainText(mockTranslationPayload.originalText);
      await expect(translationDisplay).toContainText(mockTranslationPayload.translatedText);

      // Check play button state based on audioData
      if (mockTranslationPayload.audioData) {
        await expect(studentPage.locator('#play-button')).toBeEnabled();
      } else {
        await expect(studentPage.locator('#play-button')).toBeDisabled();
      }

      // New: Original audio button should be enabled when originalAudioData exists
      await expect(studentPage.locator('#play-original-button')).toBeEnabled();

    } finally {
      // 6. Cleanup
      if (teacherPage) await teacherPage.close();
      if (studentPage) await studentPage.close();
    }
  });

});
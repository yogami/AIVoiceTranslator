/**
 * Student Interface E2E Test
 * 
 * This test checks the functionality of the student interface.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Student Interface E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create a new page for each test to ensure isolation
    page = await browser.newPage();
    // Note: We will navigate to specific URLs within each test initially,
    // as the student page behavior heavily depends on query parameters.
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should display correctly when no classroom code is provided', async () => {
    await page.goto('/student');
    await page.waitForLoadState('domcontentloaded');
    console.log('Page content for /student:', await page.content());

    // Verify connection status display
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus).toBeVisible();
    await expect(connectionStatus.locator('span')).toContainText('No classroom code provided');
    await expect(connectionStatus.locator('.indicator')).toHaveClass(/disconnected/);

    // Verify translation display shows the error
    const translationDisplay = page.locator('#translation-display');
    await expect(translationDisplay).toBeVisible();
    await expect(translationDisplay).toContainText('❌ Missing Classroom Code');
    await expect(translationDisplay).toContainText('Please get the correct link from your teacher.');
    await expect(translationDisplay).toContainText('The link should look like: /student?code=ABC123');

    // Verify connect button is disabled
    const connectButton = page.locator('#connect-btn');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeDisabled();
    await expect(connectButton).toHaveText('Connect to Session');

    // Verify language selection display
    await expect(page.locator('#selected-language')).toContainText('No language selected');

    // Verify Play Audio button is disabled
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should display correctly and prepare for connection when classroom code is provided in URL', async () => {
    const classroomCode = 'TESTCODE123'; // Example classroom code
    await page.goto(`/student?code=${classroomCode}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify the "Joining Classroom" info bar is displayed
    await expect(page.locator('.container')).toContainText(`Joining Classroom: ${classroomCode}`);

    // Verify language is auto-selected (assuming 'en-US' is the first real option)
    const languageDropdown = page.locator('#language-dropdown');
    await expect(languageDropdown).toHaveValue('en-US');

    // Verify selected language display is updated
    await expect(page.locator('#selected-language')).toContainText('Selected: 🇺🇸 English (United States)');

    // Verify connection status is initially disconnected
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus.locator('span')).toContainText('Disconnected');
    await expect(connectionStatus.locator('.indicator')).toHaveClass(/disconnected/);

    // Verify translation display shows the waiting message
    const translationDisplay = page.locator('#translation-display');
    await expect(translationDisplay).toContainText('Waiting for teacher to start speaking...');

    // Verify Connect button is enabled and has correct text
    const connectButton = page.locator('#connect-btn');
    await expect(connectButton).toBeEnabled();
    await expect(connectButton).toHaveText('Connect to Session');

    // Verify Play Audio button is disabled
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should attempt to connect and handle failure for a non-existent classroom code', async () => {
    const nonExistentCode = 'NONEXISTENTCODE123';
    await page.goto(`/student?code=${nonExistentCode}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify initial state: language auto-selected, connect button enabled
    await expect(page.locator('#language-dropdown')).toHaveValue('en-US');
    await expect(page.locator('#selected-language')).toContainText('Selected: 🇺🇸 English (United States)');
    const connectButton = page.locator('#connect-btn');
    await expect(connectButton).toBeEnabled();
    await expect(connectButton).toHaveText('Connect to Session');

    // Click the connect button
    await connectButton.click();

    // Wait for the error message in the translation display
    const translationDisplay = page.locator('#translation-display');
    await expect(translationDisplay).toContainText('Error: Classroom session expired or invalid. Please ask teacher for new link.', { timeout: 10000 });

    // Verify connection status updates to disconnected
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus.locator('span')).toContainText('Disconnected');
    await expect(connectionStatus.locator('.indicator')).toHaveClass(/disconnected/);

    // Connect button should be enabled again and show "Connect to Session"
    await expect(connectButton).toBeEnabled();
    await expect(connectButton).toHaveText('Connect to Session');
    await expect(connectButton).not.toHaveClass(/connected/);

    // Play button should remain disabled
    await expect(page.locator('#play-button')).toBeDisabled();
  });

  test('should allow a student to connect to a teacher-generated session and receive a mocked translation', async ({ browser }) => {
    let teacherPage: Page | undefined;
    let studentPage: Page | undefined;

    try {
      // 1. Teacher Setup
      teacherPage = await browser.newPage();
      await teacherPage.goto('/teacher');
      await expect(teacherPage.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      const classroomCodeElement = teacherPage.locator('#classroom-code-display');
      await expect(classroomCodeElement).toBeVisible();
      const classroomCode = await classroomCodeElement.innerText();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // 2. Student Setup
      studentPage = await browser.newPage();
      await studentPage.goto(`/student?code=${classroomCode}`);
      await studentPage.waitForLoadState('domcontentloaded');
      await expect(studentPage.locator('#language-dropdown')).toHaveValue('en-US');
      await expect(studentPage.locator('#selected-language')).toContainText('Selected: 🇺🇸 English (United States)');
      const studentConnectButton = studentPage.locator('#connect-btn');
      await expect(studentConnectButton).toBeEnabled();

      // 3. Student Connects
      await studentConnectButton.click();
      await expect(studentPage.locator('#connection-status span')).toContainText('Connected', { timeout: 5000 });
      await expect(studentConnectButton).toHaveText('Disconnect');

      // 4. Mock Translation on Student Page
      const mockTranslationPayload = {
        type: 'translation',
        originalText: 'Hello from teacher (mocked)',
        translatedText: "Bonjour de l\'enseignant (moqué)", // Ensuring apostrophe is escaped for JS string literal
        languageCode: 'fr-FR',
        audioData: null
      };

      await studentPage.evaluate((payload) => {
        // This assumes `handleWebSocketMessage` is globally accessible on the student page
        if (typeof (window as any).handleWebSocketMessage === 'function') {
          (window as any).handleWebSocketMessage(payload);
        } else {
          console.error('handleWebSocketMessage function not found on student page for mocking.');
        }
      }, mockTranslationPayload);

      // 5. Student Verifies Received Translation
      const translationDisplay = studentPage.locator('#translation-display');
      await expect(translationDisplay).toContainText(mockTranslationPayload.originalText);
      await expect(translationDisplay).toContainText(mockTranslationPayload.translatedText);

      if (mockTranslationPayload.audioData) {
        await expect(studentPage.locator('#play-button')).toBeEnabled();
      } else {
        await expect(studentPage.locator('#play-button')).toBeDisabled();
      }

    } finally {
      // 6. Cleanup
      if (teacherPage) await teacherPage.close();
      if (studentPage) await studentPage.close();
    }
  });
});
import { test, expect, Page } from '@playwright/test';
import { getBaseURL } from './helpers/test-config.js';
import { testConfig } from './helpers/test-timeouts.js';

test.describe('Student Two-Way Communication - PTT and Send', () => {
  let teacher: Page;
  let student: Page;

  test.afterEach(async () => {
    try { await teacher?.close(); } catch { /* noop */ }
    try { await student?.close(); } catch { /* noop */ }
  });

  test('PTT button enables on connect and Send button enables with text', async ({ browser }) => {
    // Start teacher and get classroom code
    teacher = await browser.newPage();
    await teacher.goto(`${getBaseURL()}/teacher.html?e2e=true&twoWay=1`);
    await expect(teacher.locator('#status')).toContainText('Registered as teacher', { timeout: testConfig.ui.teacherRegistrationTimeout });
    await expect(teacher.locator('#classroom-code-display')).toBeVisible({ timeout: testConfig.ui.teacherRegistrationTimeout });
    // Wait until code is assigned (not LIVE)
    await expect(teacher.locator('#classroom-code-display')).not.toHaveText('LIVE', { timeout: testConfig.ui.classroomCodeTimeout });
    const code = await teacher.locator('#classroom-code-display').innerText();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // Open student with twoWay and code
    student = await browser.newPage();
    await student.goto(`${getBaseURL()}/student?code=${code}&twoWay=1`);
    await student.waitForLoadState('domcontentloaded');
    await student.selectOption('#language-dropdown', { index: 1 });

    // Connect
    const connectButton = student.locator('#connect-btn');
    if (await connectButton.isVisible()) {
      await expect(connectButton).toBeEnabled();
      await connectButton.click();
    }
    await expect(student.locator('#connection-status .indicator + span')).toContainText('Connected', { timeout: testConfig.ui.connectionStatusTimeout });

    // Two-way section visible
    await expect(student.locator('#ask-step')).toBeVisible();

    // PTT should be enabled now
    await expect(student.locator('#ask-ptt')).toBeEnabled();

    // Send button enables with text
    await expect(student.locator('#ask-send')).toBeDisabled();
    await student.fill('#ask-input', 'Hello teacher');
    // allow input listener to run
    await student.waitForTimeout(300);
    await expect(student.locator('#ask-send')).toBeEnabled();
  });
});



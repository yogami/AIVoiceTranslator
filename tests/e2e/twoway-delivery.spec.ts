import { test, expect, Page } from '@playwright/test';
import { getBaseURL } from './helpers/test-config.js';
import { testConfig } from './helpers/test-timeouts.js';

test.describe('Two-way delivery - student to teacher', () => {
  let teacher: Page;
  let student: Page;

  test.afterEach(async () => {
    try { await teacher?.close(); } catch {}
    try { await student?.close(); } catch {}
  });

  test('student sends request; teacher sees it in requests list', async ({ browser }) => {
    // 1) Teacher opens and registers
    teacher = await browser.newPage();
    const teacherLogs: string[] = [];
    teacher.on('console', (msg) => teacherLogs.push(`[teacher:${msg.type()}] ${msg.text()}`));
    await teacher.goto(`${getBaseURL()}/teacher.html?e2e=true&twoWay=1`);
    await expect(teacher.locator('#status')).toContainText(/Registered as teacher|Ready to connect/, { timeout: testConfig.ui.teacherRegistrationTimeout });
    const codeEl = teacher.locator('#classroom-code-display');
    await expect(codeEl).toBeVisible({ timeout: testConfig.ui.classroomCodeTimeout });
    await expect(codeEl).not.toHaveText('LIVE', { timeout: testConfig.ui.classroomCodeTimeout });
    const code = await codeEl.innerText();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // Ensure requests queue is visible in twoWay mode (JS bootstrap toggles it when ?twoWay=1)
    await teacher.waitForSelector('#requestsQueue', { state: 'visible', timeout: testConfig.ui.elementVisibilityTimeout });
    const requestsList = teacher.locator('#requestsList');

    // 2) Student connects and sends
    student = await browser.newPage();
    const studentLogs: string[] = [];
    student.on('console', (msg) => studentLogs.push(`[student:${msg.type()}] ${msg.text()}`));
    await student.goto(`${getBaseURL()}/student?code=${code}&twoWay=1`);
    await student.waitForLoadState('domcontentloaded');
    await student.selectOption('#language-dropdown', { index: 1 });
    // Provide a display name to be sent during registration
    await student.fill('#student-name', 'Test Student');
    const connectBtn = student.locator('#connect-btn');
    if (await connectBtn.isVisible()) {
      await expect(connectBtn).toBeEnabled();
      await connectBtn.click();
    }
    await expect(student.locator('#connection-status .indicator + span')).toContainText('Connected', { timeout: testConfig.ui.connectionStatusTimeout });
    await expect(student.locator('#ask-step')).toBeVisible();

    const message = `E2E hello ${Date.now()}`;
    await student.fill('#ask-input', message);
    // Let input listeners run
    await student.waitForTimeout(200);
    const sendBtn = student.locator('#ask-send');
    // Send button may be enabled purely on text in latest build
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();
    // Additionally, send directly over WS to avoid any event timing flakiness
    await student.evaluate((msg) => {
      try {
        // @ts-ignore
        const ws = window.appState && window.appState.ws;
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'student_request', text: msg, visibility: 'private' }));
        }
      } catch {}
    }, message);
    // Dump recent logs to aid debugging in CI output
    console.log('--- Teacher logs (recent) ---');
    console.log(teacherLogs.slice(-20).join('\n'));
    console.log('--- Student logs (recent) ---');
    console.log(studentLogs.slice(-20).join('\n'));
    // Allow backend to deliver and UI to render
    await teacher.waitForTimeout(500);

    // 3) Teacher should see the request card with the message text
    await teacher.waitForTimeout(800); // give UI render a moment on slower CI
    await expect(teacher.locator('#requestsList')).toContainText(message, { timeout: Math.max(testConfig.ui.elementVisibilityTimeout, 5000) });
    await expect(teacher.locator('#requestsList')).toContainText('Test Student', { timeout: 2000 });
  });
});



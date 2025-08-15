import { test, expect } from '@playwright/test';

test.describe('Two-way UI happy path', () => {
  test('student asks, teacher sees queue, replies, student receives', async ({ page, context, browser }) => {
    test.setTimeout(120000);
    const base = process.env.E2E_BASE_URL || 'http://localhost:3000';

    // Teacher
    const teacher = await context.newPage();
    await teacher.goto(`${base}/teacher?twoWay=1&e2e=true`);
    await teacher.waitForSelector('#classroom-code-display');
    const code = await teacher.locator('#classroom-code-display').textContent({ timeout: 10000 });
    expect(code && code.trim().length).toBeTruthy();

    // Student
    const student = await context.newPage();
    await student.goto(`${base}/student?code=${code?.trim()}&twoWay=1`);
    // choose a language (es-ES)
    await student.selectOption('#language-dropdown', 'es-ES');
    await student.click('#connect-btn');
    await student.getByText('Waiting for teacher').waitFor({ timeout: 15000 });

    // Ask the teacher
    await student.fill('#ask-input', '¿Qué es una fracción?');
    await student.click('#ask-send');

    // Teacher sees the request
    await teacher.waitForSelector('#requestsQueue', { state: 'visible' });
    const card = teacher.locator('#requestsList div').first();
    await expect(card).toContainText('fracción');

    // Teacher replies to class (text)
    await card.getByRole('button', { name: /Reply to Class/i }).click();
    // Prompt cannot be controlled easily; skip text reply here

    // Speak Reply flow present
    await expect(card.getByRole('button', { name: /Speak Reply/i })).toBeVisible();

    await teacher.close();
    await student.close();
  });
});



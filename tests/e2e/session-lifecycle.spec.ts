import { test, expect, Page, Browser } from '@playwright/test';

describe('Session Lifecycle E2E Tests', () => {
  let browser: Browser;

  const createTeacherSession = async (page: Page, teacherId: string = 'test-teacher-1') => {
    // Navigate to teacher page with e2e parameter to bypass auth
    await page.goto('http://127.0.0.1:5001/teacher?e2e=true');
    
    // Mock the teacher authentication data with specific teacherId
    await page.addInitScript((teacherId) => {
      localStorage.setItem('teacherUser', JSON.stringify({
        id: teacherId,
        email: `${teacherId}@test.com`,
        name: `Teacher ${teacherId}`
      }));
      localStorage.setItem('jwt', 'mock-jwt-token');
    }, teacherId);
    
    // Reload to apply the auth data
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for teacher registration
    await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
    
    // Get classroom code
    const classroomCodeElement = page.locator('#classroom-code-display');
    await expect(classroomCodeElement).toBeVisible({ timeout: 10000 });
    const classroomCode = await classroomCodeElement.textContent();
    
    return { classroomCode, teacherId };
  };

  const connectStudent = async (page: Page, classroomCode: string, language: string = 'es-ES') => {
    await page.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
    await page.waitForLoadState('domcontentloaded');
    
    // Select language
    await page.selectOption('#language-dropdown', language);
    await expect(page.locator('#selected-language')).toContainText('Selected:', { timeout: 2000 });
    
    // Connect
    await page.click('#connect-btn');
    await expect(page.locator('#connection-status span')).toContainText('Connected', { timeout: 10000 });
    
    return page;
  };

  test.beforeEach(async ({ browser }) => {
    // Mock browser APIs for each test
    await browser.newContext().then(async context => {
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Mock getUserMedia
        Object.defineProperty(navigator, 'mediaDevices', {
          writable: true,
          value: {
            getUserMedia: () => Promise.resolve({
              getTracks: () => [{ kind: 'audio', stop: () => {} }]
            } as any)
          }
        });
        
        // Mock MediaRecorder
        (window as any).MediaRecorder = class {
          state = 'inactive';
          ondataavailable: ((event: any) => void) | null = null;
          onstop: (() => void) | null = null;
          
          start() { 
            this.state = 'recording';
            if (this.ondataavailable) {
              setTimeout(() => {
                const mockBlob = new Blob(['mock'], { type: 'audio/webm' });
                if (this.ondataavailable) this.ondataavailable({ data: mockBlob });
              }, 100);
            }
          }
          
          stop() { 
            this.state = 'inactive';
            if (this.onstop) this.onstop();
          }
        };
        
        // Mock SpeechRecognition
        (window as any).webkitSpeechRecognition = (window as any).SpeechRecognition = class {
          onresult: ((event: any) => void) | null = null;
          onerror: ((event: any) => void) | null = null;
          onend: (() => void) | null = null;
          
          start() {
            setTimeout(() => {
              if (this.onresult) {
                this.onresult({
                  results: [[{ transcript: 'Hello, this is a test transcription' }]]
                });
              }
              if (this.onend) this.onend();
            }, 500);
          }
          
          stop() {}
        };
      });
      await page.close();
      await context.close();
    });
  });

  describe('Teacher Authentication Flow', () => {
    test('should handle teacher authentication and session creation', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        const { classroomCode, teacherId } = await createTeacherSession(page, 'auth-test-teacher');
        
        expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
        expect(teacherId).toBe('auth-test-teacher');
        
        // Verify UI shows correct state
        await expect(page.locator('#status')).toContainText('Registered as teacher');
        await expect(page.locator('#classroom-code-display')).toContainText(classroomCode!);
      } finally {
        await context.close();
      }
    });

    test('should handle invalid token during WebSocket connection', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        await page.goto('http://127.0.0.1:5001/teacher?e2e=true');
        
        // Set invalid auth data
        await page.addInitScript(() => {
          localStorage.setItem('teacherUser', JSON.stringify({
            id: 'invalid-teacher',
            email: 'invalid@test.com',
            name: 'Invalid Teacher'
          }));
          localStorage.setItem('jwt', 'invalid-jwt-token');
        });
        
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        
        // Should still work in test mode due to e2e bypass
        await expect(page.locator('#status')).toContainText('Registered as teacher', { timeout: 10000 });
      } finally {
        await context.close();
      }
    });
  });

  describe('Teacher Disconnection/Reconnection Scenarios', () => {
    test('should reconnect teacher to same session within 10 minutes', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const teacherPage1 = await context1.newPage();
      const teacherPage2 = await context2.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode: code1, teacherId } = await createTeacherSession(teacherPage1, 'reconnect-teacher-1');
        
        // Teacher disconnects (close page)
        await teacherPage1.close();
        await context1.close();
        
        // Wait 2 seconds (well within 10 minute window)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Teacher reconnects with same teacherId
        const { classroomCode: code2 } = await createTeacherSession(teacherPage2, 'reconnect-teacher-1');
        
        // Should get the same classroom code (same session)
        expect(code2).toBe(code1);
        
        // Verify teacher is in the restored session
        await expect(teacherPage2.locator('#classroom-code-display')).toContainText(code1!);
      } finally {
        await context2.close();
      }
    });

    test('should create new session for teacher reconnecting after 10+ minutes', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const teacherPage1 = await context1.newPage();
      const teacherPage2 = await context2.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode: code1 } = await createTeacherSession(teacherPage1, 'new-session-teacher');
        
        // Simulate time passing (mock old session in database)
        await teacherPage1.evaluate(() => {
          // Create a test session that's older than 10 minutes in the database
          return fetch('/api/test/create-old-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacherId: 'new-session-teacher',
              minutesOld: 11
            })
          });
        });
        
        await teacherPage1.close();
        await context1.close();
        
        // Teacher reconnects (should get new session)
        const { classroomCode: code2 } = await createTeacherSession(teacherPage2, 'new-session-teacher');
        
        // Should get a different classroom code (new session)
        expect(code2).not.toBe(code1);
        expect(code2).toMatch(/^[A-Z0-9]{6}$/);
      } finally {
        await context2.close();
      }
    });

    test('should handle teacher disconnection before students join', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const teacherPage = await context1.newPage();
      const studentPage = await context2.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode } = await createTeacherSession(teacherPage, 'disconnect-before-join');
        
        // Teacher disconnects immediately
        await teacherPage.close();
        await context1.close();
        
        // Wait a moment for disconnection to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Student tries to join - should fail since teacher disconnected
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');
        
        await studentPage.selectOption('#language-dropdown', 'es-ES');
        await studentPage.click('#connect-btn');
        
        // Should show error about session not found or teacher disconnected
        await expect(studentPage.locator('#translation-display')).toContainText('Error', { timeout: 5000 });
      } finally {
        await context2.close();
      }
    });

    test('should maintain session when teacher disconnects after students join', async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const studentContext = await browser.newContext();
      const teacher2Context = await browser.newContext();
      
      const teacherPage1 = await teacherContext.newPage();
      const studentPage = await studentContext.newPage();
      const teacherPage2 = await teacher2Context.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode, teacherId } = await createTeacherSession(teacherPage1, 'maintain-session-teacher');
        
        // Student joins
        await connectStudent(studentPage, classroomCode!);
        
        // Verify student is connected
        await expect(studentPage.locator('#connection-status span')).toContainText('Connected');
        
        // Teacher disconnects
        await teacherPage1.close();
        await teacherContext.close();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Teacher reconnects
        const { classroomCode: code2 } = await createTeacherSession(teacherPage2, teacherId);
        
        // Should get same classroom code (session was maintained)
        expect(code2).toBe(classroomCode);
        
        // Student should still be connected
        await expect(studentPage.locator('#connection-status span')).toContainText('Connected');
      } finally {
        await studentContext.close();
        await teacher2Context.close();
      }
    });

    test('should handle multiple teachers with same teacherId (race condition)', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const teacherPage1 = await context1.newPage();
      const teacherPage2 = await context2.newPage();
      
      try {
        // Both pages try to create session with same teacherId simultaneously
        const [result1, result2] = await Promise.allSettled([
          createTeacherSession(teacherPage1, 'duplicate-teacher-id'),
          createTeacherSession(teacherPage2, 'duplicate-teacher-id')
        ]);
        
        // At least one should succeed
        const successfulResults = [result1, result2].filter(r => r.status === 'fulfilled');
        expect(successfulResults.length).toBeGreaterThan(0);
        
        // If both succeed, they should have the same classroom code (same session)
        if (result1.status === 'fulfilled' && result2.status === 'fulfilled') {
          expect(result1.value.classroomCode).toBe(result2.value.classroomCode);
        }
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  describe('Multiple Teachers - Different Sessions', () => {
    test('should ensure different teachers reconnect to their own sessions', async ({ browser }) => {
      const teacher1Context = await browser.newContext();
      const teacher2Context = await browser.newContext();
      const teacher1ReconnectContext = await browser.newContext();
      const teacher2ReconnectContext = await browser.newContext();
      
      const teacher1Page1 = await teacher1Context.newPage();
      const teacher2Page1 = await teacher2Context.newPage();
      const teacher1Page2 = await teacher1ReconnectContext.newPage();
      const teacher2Page2 = await teacher2ReconnectContext.newPage();
      
      try {
        // Teacher 1 creates session
        const { classroomCode: code1, teacherId: id1 } = await createTeacherSession(teacher1Page1, 'unique-teacher-1');
        
        // Teacher 2 creates session
        const { classroomCode: code2, teacherId: id2 } = await createTeacherSession(teacher2Page1, 'unique-teacher-2');
        
        // Verify different classroom codes
        expect(code1).not.toBe(code2);
        expect(id1).not.toBe(id2);
        
        // Both teachers disconnect
        await teacher1Page1.close();
        await teacher2Page1.close();
        await teacher1Context.close();
        await teacher2Context.close();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Both teachers reconnect
        const [reconnect1, reconnect2] = await Promise.all([
          createTeacherSession(teacher1Page2, 'unique-teacher-1'),
          createTeacherSession(teacher2Page2, 'unique-teacher-2')
        ]);
        
        // Each teacher should get their original classroom code
        expect(reconnect1.classroomCode).toBe(code1);
        expect(reconnect2.classroomCode).toBe(code2);
        expect(reconnect1.classroomCode).not.toBe(reconnect2.classroomCode);
        
        // Verify each teacher is in their own session
        await expect(teacher1Page2.locator('#classroom-code-display')).toContainText(code1!);
        await expect(teacher2Page2.locator('#classroom-code-display')).toContainText(code2!);
      } finally {
        await teacher1ReconnectContext.close();
        await teacher2ReconnectContext.close();
      }
    });

    test('should prevent teachers from cross-connecting to wrong sessions', async ({ browser }) => {
      const teacher1Context = await browser.newContext();
      const teacher2Context = await browser.newContext();
      const student1Context = await browser.newContext();
      const student2Context = await browser.newContext();
      
      const teacher1Page = await teacher1Context.newPage();
      const teacher2Page = await teacher2Context.newPage();
      const student1Page = await student1Context.newPage();
      const student2Page = await student2Context.newPage();
      
      try {
        // Teacher 1 creates session
        const { classroomCode: code1 } = await createTeacherSession(teacher1Page, 'isolated-teacher-1');
        
        // Teacher 2 creates session  
        const { classroomCode: code2 } = await createTeacherSession(teacher2Page, 'isolated-teacher-2');
        
        // Student 1 joins Teacher 1's session
        await connectStudent(student1Page, code1!);
        
        // Student 2 joins Teacher 2's session
        await connectStudent(student2Page, code2!);
        
        // Verify students are in correct sessions by sending messages from teachers
        await teacher1Page.click('#recordButton');
        await teacher1Page.waitForTimeout(1000);
        
        await teacher2Page.click('#recordButton');
        await teacher2Page.waitForTimeout(1000);
        
        // Student 1 should receive message from Teacher 1, not Teacher 2
        await expect(student1Page.locator('#transcription')).not.toContainText('Teacher 2', { timeout: 2000 });
        
        // Student 2 should receive message from Teacher 2, not Teacher 1
        await expect(student2Page.locator('#transcription')).not.toContainText('Teacher 1', { timeout: 2000 });
      } finally {
        await teacher1Context.close();
        await teacher2Context.close();
        await student1Context.close();
        await student2Context.close();
      }
    });
  });

  describe('Session Expiration Scenarios', () => {
    test('should handle session expiration while teacher connected', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        const { classroomCode } = await createTeacherSession(page, 'expiration-test-teacher');
        
        // Simulate session expiration by calling cleanup API
        await page.evaluate(() => {
          return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
        });
        
        // Wait for cleanup to process
        await page.waitForTimeout(2000);
        
        // Teacher should still be connected but session may be marked for cleanup
        await expect(page.locator('#status')).toContainText('Registered as teacher');
        await expect(page.locator('#classroom-code-display')).toContainText(classroomCode!);
      } finally {
        await context.close();
      }
    });

    test('should handle student joining expired session', async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const studentContext = await browser.newContext();
      const teacherPage = await teacherContext.newPage();
      const studentPage = await studentContext.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode } = await createTeacherSession(teacherPage, 'expired-session-teacher');
        
        // Teacher disconnects
        await teacherPage.close();
        await teacherContext.close();
        
        // Force session cleanup
        await studentPage.evaluate(() => {
          return fetch('/api/admin/cleanup-sessions', { method: 'POST' });
        });
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Student tries to join expired session
        await studentPage.goto(`http://127.0.0.1:5001/student?code=${classroomCode}`);
        await studentPage.waitForLoadState('domcontentloaded');
        
        await studentPage.selectOption('#language-dropdown', 'es-ES');
        await studentPage.click('#connect-btn');
        
        // Should show error about invalid or expired code
        await expect(studentPage.locator('#translation-display')).toContainText('Error', { timeout: 5000 });
      } finally {
        await studentContext.close();
      }
    });
  });

  describe('Classroom Code Lifecycle', () => {
    test('should generate unique classroom codes across sessions', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      const page3 = await context3.newPage();
      
      try {
        // Create multiple sessions
        const { classroomCode: code1 } = await createTeacherSession(page1, 'unique-code-teacher-1');
        const { classroomCode: code2 } = await createTeacherSession(page2, 'unique-code-teacher-2');
        const { classroomCode: code3 } = await createTeacherSession(page3, 'unique-code-teacher-3');
        
        // All codes should be different
        expect(code1).not.toBe(code2);
        expect(code1).not.toBe(code3);
        expect(code2).not.toBe(code3);
        
        // All codes should match pattern
        expect(code1).toMatch(/^[A-Z0-9]{6}$/);
        expect(code2).toMatch(/^[A-Z0-9]{6}$/);
        expect(code3).toMatch(/^[A-Z0-9]{6}$/);
      } finally {
        await context1.close();
        await context2.close();
        await context3.close();
      }
    });

    test('should persist classroom code across teacher reconnections to same session', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const studentContext = await browser.newContext();
      
      const teacherPage1 = await context1.newPage();
      const teacherPage2 = await context2.newPage();
      const studentPage = await studentContext.newPage();
      
      try {
        // Teacher creates session and student joins
        const { classroomCode: originalCode } = await createTeacherSession(teacherPage1, 'persist-code-teacher');
        await connectStudent(studentPage, originalCode!);
        
        // Teacher disconnects
        await teacherPage1.close();
        await context1.close();
        
        // Teacher reconnects quickly (should get same session)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { classroomCode: reconnectCode } = await createTeacherSession(teacherPage2, 'persist-code-teacher');
        
        // Should get same classroom code
        expect(reconnectCode).toBe(originalCode);
        
        // Student should still be connected and able to receive messages
        await expect(studentPage.locator('#connection-status span')).toContainText('Connected');
      } finally {
        await context2.close();
        await studentContext.close();
      }
    });
  });

  describe('Student Join Edge Cases', () => {
    test('should handle student joining while teacher disconnects', async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const studentContext = await browser.newContext();
      const teacherPage = await teacherContext.newPage();
      const studentPage = await studentContext.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode } = await createTeacherSession(teacherPage, 'disconnect-during-join');
        
        // Start student join process
        const joinPromise = connectStudent(studentPage, classroomCode!);
        
        // Teacher disconnects while student is joining
        await new Promise(resolve => setTimeout(resolve, 500));
        await teacherPage.close();
        await teacherContext.close();
        
        // Student join should either succeed or fail gracefully
        try {
          await joinPromise;
          // If successful, student should be connected
          await expect(studentPage.locator('#connection-status span')).toContainText('Connected');
        } catch (error) {
          // If failed, should show appropriate error
          await expect(studentPage.locator('#translation-display')).toContainText('Error', { timeout: 5000 });
        }
      } finally {
        await studentContext.close();
      }
    });

    test('should handle multiple students joining simultaneously', async ({ browser }) => {
      const teacherContext = await browser.newContext();
      const student1Context = await browser.newContext();
      const student2Context = await browser.newContext();
      const student3Context = await browser.newContext();
      
      const teacherPage = await teacherContext.newPage();
      const student1Page = await student1Context.newPage();
      const student2Page = await student2Context.newPage();
      const student3Page = await student3Context.newPage();
      
      try {
        // Teacher creates session
        const { classroomCode } = await createTeacherSession(teacherPage, 'multiple-students-teacher');
        
        // Multiple students join simultaneously
        const joinPromises = [
          connectStudent(student1Page, classroomCode!, 'es-ES'),
          connectStudent(student2Page, classroomCode!, 'fr-FR'),
          connectStudent(student3Page, classroomCode!, 'de-DE')
        ];
        
        await Promise.all(joinPromises);
        
        // All students should be connected
        await expect(student1Page.locator('#connection-status span')).toContainText('Connected');
        await expect(student2Page.locator('#connection-status span')).toContainText('Connected');
        await expect(student3Page.locator('#connection-status span')).toContainText('Connected');
        
        // Teacher should see multiple students (check UI or send message to verify)
        await teacherPage.click('#recordButton');
        await teacherPage.waitForTimeout(1000);
        
        // All students should receive translations
        await expect(student1Page.locator('#translation-display')).not.toContainText('Waiting for teacher', { timeout: 5000 });
        await expect(student2Page.locator('#translation-display')).not.toContainText('Waiting for teacher', { timeout: 5000 });
        await expect(student3Page.locator('#translation-display')).not.toContainText('Waiting for teacher', { timeout: 5000 });
      } finally {
        await teacherContext.close();
        await student1Context.close();
        await student2Context.close();
        await student3Context.close();
      }
    });
  });

  describe('Database Consistency', () => {
    test('should maintain session state consistency between memory and database', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        const { classroomCode, teacherId } = await createTeacherSession(page, 'consistency-test-teacher');
        
        // Check that session exists in database with correct state
        const dbSession = await page.evaluate(async (teacherId) => {
          const response = await fetch('/api/test/get-session-by-teacher-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId })
          });
          return response.json();
        }, teacherId);
        
        expect(dbSession).toBeTruthy();
        expect(dbSession.isActive).toBe(true);
        expect(dbSession.classCode).toBe(classroomCode);
      } finally {
        await context.close();
      }
    });

    test('should maintain teacherId persistence across all operations', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const studentContext = await browser.newContext();
      
      const teacherPage1 = await context1.newPage();
      const teacherPage2 = await context2.newPage();
      const studentPage = await studentContext.newPage();
      
      try {
        const teacherId = 'persistence-test-teacher';
        
        // Teacher creates session
        const { classroomCode: code1 } = await createTeacherSession(teacherPage1, teacherId);
        
        // Student joins
        await connectStudent(studentPage, code1!);
        
        // Teacher disconnects and reconnects
        await teacherPage1.close();
        await context1.close();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { classroomCode: code2 } = await createTeacherSession(teacherPage2, teacherId);
        
        // Verify teacherId is consistent in database
        const dbSessions = await teacherPage2.evaluate(async (teacherId) => {
          const response = await fetch('/api/test/get-all-sessions-by-teacher-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId })
          });
          return response.json();
        }, teacherId);
        
        // All sessions should have the same teacherId
        expect(dbSessions).toBeTruthy();
        expect(Array.isArray(dbSessions)).toBe(true);
        dbSessions.forEach((session: any) => {
          expect(session.teacherId).toBe(teacherId);
        });
      } finally {
        await context2.close();
        await studentContext.close();
      }
    });
  });
});

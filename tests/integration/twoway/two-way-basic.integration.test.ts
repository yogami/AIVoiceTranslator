import { describe, it, expect } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { createServer } from 'http';
import WebSocket from 'ws';
import { createMockStorage } from '../../mocks/storage.mock';
import { vi } from 'vitest';

describe('Two-way communication (feature-flagged) - integration', () => {
  let httpServer: any;
  let port: number;
  let wss: any;

  it('student_request is delivered to teacher and teacher_reply delivers to students', async () => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    httpServer = createServer((req, res) => res.end('ok'));
    port = 54000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));

    const storage = createMockStorage();
    // Provide minimal active session behavior for validation and updates
    storage.getSessionById = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true } as any));
    storage.getActiveSession = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true } as any));
    storage.updateSession = vi.fn(async () => ({ isActive: true } as any));
    storage.createSession = vi.fn(async (session: any) => ({ id: '1', ...session } as any));

    wss = new TestWebSocketServer(httpServer as any, storage as any);
    const registry: any = (wss as any).getMessageHandlerRegistry?.();
    const types = registry?.getRegisteredTypes?.() || [];
    // Quick sanity check to ensure handlers are registered under flag
    expect(types).toContain('student_request');
    expect(types).toContain('teacher_reply');

    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const student = new WebSocket(`ws://127.0.0.1:${port}`);

    const teacherMessages: any[] = [];
    const studentMessages: any[] = [];
    teacher.on('message', (d) => teacherMessages.push(JSON.parse(String(d))));
    student.on('message', (d) => studentMessages.push(JSON.parse(String(d))));

    await Promise.all([
      new Promise(resolve => teacher.once('open', resolve)),
      new Promise(resolve => student.once('open', resolve))
    ]);

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
    const classroomMessage: any = await new Promise(resolve => {
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'classroom_code') resolve(m);
      });
    });
    const teacherSessionId = classroomMessage.sessionId;
    // Adjust storage to reflect that only teacher session exists in DB; student ephemeral session should be unknown
    (storage.getSessionById as any) = vi.fn(async (sid: string) => (sid === teacherSessionId ? { sessionId: sid, isActive: true } : undefined));
    (storage.getActiveSession as any) = vi.fn(async (sid: string) => (sid === teacherSessionId ? { sessionId: sid, isActive: true } : undefined));

    // Register student and wait until teacher sees student_joined, ensuring routing is ready
    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: classroomMessage.code }));
    await new Promise<void>((resolve) => {
      const to = setTimeout(() => resolve(), 2000);
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'student_joined') {
          clearTimeout(to);
          resolve();
        }
      });
    });

    // Student asks a question
    student.send(JSON.stringify({ type: 'student_request', text: '¿Qué es una fracción?' }));
    const deliveredToTeacher = await new Promise<any>((resolve) => {
      const to = setTimeout(() => resolve(null), 2000);
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'student_request') {
          clearTimeout(to);
          resolve(m);
        }
      });
    });
    expect(deliveredToTeacher?.type).toBe('student_request');

    // Teacher replies (class-wide)
    teacher.send(JSON.stringify({ type: 'teacher_reply', text: 'A fraction represents parts of a whole.', scope: 'class' }));
    const deliveredToStudent = await new Promise<any>((resolve) => {
      const to = setTimeout(() => resolve(null), 4000);
      student.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'translation') {
          clearTimeout(to);
          resolve(m);
        }
      });
    });
    expect(deliveredToStudent?.type).toBe('translation');

    // Teardown
    if (wss && typeof wss.shutdown === 'function') await wss.shutdown();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('teacher can privately reply to a single student', async () => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    httpServer = createServer((req, res) => res.end('ok'));
    port = 54000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));

    const storage = createMockStorage();
    storage.getSessionById = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true } as any));
    storage.getActiveSession = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true } as any));
    storage.updateSession = vi.fn(async () => ({ isActive: true } as any));
    storage.createSession = vi.fn(async (session: any) => ({ id: '1', ...session } as any));

    wss = new TestWebSocketServer(httpServer as any, storage as any);

    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const student = new WebSocket(`ws://127.0.0.1:${port}`);

    await Promise.all([
      new Promise(resolve => teacher.once('open', resolve)),
      new Promise(resolve => student.once('open', resolve))
    ]);

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
    const classroomMessage: any = await new Promise(resolve => {
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'classroom_code') resolve(m);
      });
    });
    const teacherSessionId = classroomMessage.sessionId;
    (storage.getSessionById as any) = vi.fn(async (sid: string) => (sid === teacherSessionId ? { sessionId: sid, isActive: true } : undefined));
    (storage.getActiveSession as any) = vi.fn(async (sid: string) => (sid === teacherSessionId ? { sessionId: sid, isActive: true } : undefined));

    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: classroomMessage.code }));
    await new Promise(r => setTimeout(r, 100));

    // Student asks a question
    let latestRequest: any;
    teacher.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.type === 'student_request') latestRequest = m;
    });
    student.send(JSON.stringify({ type: 'student_request', text: 'Necesito ayuda' }));
    await new Promise(r => setTimeout(r, 150));
    expect(latestRequest?.payload?.requestId).toBeTruthy();

    // Teacher replies privately referencing requestId
    teacher.send(JSON.stringify({ type: 'teacher_reply', text: 'Te ayudo ahora', scope: 'private', requestId: latestRequest.payload.requestId }));
    const privateDelivered = await new Promise<any>((resolve) => {
      const to = setTimeout(() => resolve(null), 4000);
      student.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'translation') {
          clearTimeout(to);
          resolve(m);
        }
      });
    });
    expect(privateDelivered?.type).toBe('translation');

    // Teardown
    if (wss && typeof wss.shutdown === 'function') await wss.shutdown();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });
});



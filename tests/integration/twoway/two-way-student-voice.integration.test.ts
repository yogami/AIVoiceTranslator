import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { createMockStorage } from '../../mocks/storage.mock';
import { createServer } from 'http';
import WebSocket from 'ws';

describe('Two-way - student voice to teacher queue (integration)', () => {
  let httpServer: any;
  let port: number;

  beforeAll(async () => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    httpServer = createServer((req, res) => res.end('ok'));
    port = 56000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));
  });

  afterAll(async () => {
    try { await new Promise<void>(resolve => httpServer.close(() => resolve())); } catch {}
  });

  it('routes student_audio to teacher as student_request', async () => {
    const storage = createMockStorage();
    const wss = new TestWebSocketServer(httpServer as any, storage as any);

    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise(resolve => teacher.once('open', resolve));
    const teacherMessages: any[] = [];
    teacher.on('message', (d) => teacherMessages.push(JSON.parse(String(d))));
    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));

    let teacherSessionId: string | undefined;
    const classroomMessage: any = await new Promise(resolve => {
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'classroom_code') resolve(m);
      });
    });
    teacherSessionId = classroomMessage.sessionId;

    // Ensure getSessionById returns only teacher session as existing so student migrates
    (storage.getSessionById as any).mockImplementation(async (sid: string) => {
      if (sid === teacherSessionId) return { sessionId: sid, isActive: true };
      return null;
    });

    const student = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise(resolve => student.once('open', resolve));
    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: classroomMessage.code }));
    await new Promise(r => setTimeout(r, 100));

    // Send student_audio with transcribedText to bypass STT in CI
    student.send(JSON.stringify({ type: 'student_audio', transcribedText: 'Necesito ayuda', visibility: 'private' }));

    const delivered = await new Promise<any>((resolve) => {
      const to = setTimeout(() => resolve(null), 2000);
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'student_request') { clearTimeout(to); resolve(m); }
      });
    });
    expect(delivered).toBeTruthy();
    expect(delivered.payload.text).toContain('Necesito');
  });
});



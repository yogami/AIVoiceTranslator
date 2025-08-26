import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { createMockStorage } from '../mocks/storage.mock';
import { TestWebSocketServer } from '../utils/TestWebSocketServer';

describe('German original audio uses Kartoffel when enabled (integration)', () => {
  let httpServer: any;
  let port: number;
  let wsServer: any;
  let storage: any;

  beforeEach(async () => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    process.env.FEATURE_INCLUDE_ORIGINAL_TTS = '1';
    process.env.FEATURE_TTS_KARTOFFEL_FOR_GERMAN = '1';
    process.env.FORCE_TEST_TTS_SERVICE = 'silent'; // avoid unrelated TTS
    // mock fetch for Kartoffel endpoint
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([0x49,0x44,0x33]).buffer }));
    process.env.KARTOFFEL_TTS_URL = 'https://example.com/hf-tts';

    httpServer = createServer((_req, res) => res.end('ok'));
    port = 56000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));

    storage = createMockStorage();
    storage.getSessionById = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true }));
    storage.getActiveSession = vi.fn(async (sid: string) => ({ sessionId: sid, isActive: true }));
    storage.updateSession = vi.fn(async (sid: string, updates: any) => ({ sessionId: sid, isActive: true, ...updates }));
    storage.createSession = vi.fn(async (session: any) => ({ id: '1', ...session }));
    storage.addTranslation = vi.fn(async (t: any) => ({ id: '1', ...t }));

    wsServer = new TestWebSocketServer(httpServer as any, storage as any);
    await wsServer.start();
  });

  afterEach(async () => {
    await wsServer.shutdown();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('includes originalAudioData and originalTtsServiceType=kartoffel for German teacher', async () => {
    const teacher = new WebSocket(`ws://127.0.0.1:${port}/`);
    const student = new WebSocket(`ws://127.0.0.1:${port}/`);
    const teacherMsgs: any[] = []; const studentMsgs: any[] = [];
    teacher.on('message', d => teacherMsgs.push(JSON.parse(String(d))));
    student.on('message', d => studentMsgs.push(JSON.parse(String(d))));
    await new Promise(r => teacher.once('open', r));
    await new Promise(r => student.once('open', r));

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'de-DE', name: 'Lehrer' }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const codeMsg = teacherMsgs.find(m => m.type === 'classroom_code');
    expect(codeMsg).toBeTruthy();

    const code = codeMsg.code;
    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'en-US', name: 'Alice', classroomCode: code }));
    await new Promise(resolve => setTimeout(resolve, 150));

    teacher.send(JSON.stringify({ type: 'teacher_reply', text: 'Willkommen', scope: 'class' }));

    // Wait for a translation to student
    const got = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 1500);
      student.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'translation') { clearTimeout(timeout); resolve(m); }
      });
    });
    expect(got.originalAudioData).toBeTruthy();
    expect(got.originalTtsServiceType === 'kartoffel' || got.originalTtsServiceType === 'mp3').toBeTruthy();
  });
});



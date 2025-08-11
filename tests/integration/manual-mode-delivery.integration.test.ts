import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import WebSocket from 'ws';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { DatabaseStorage } from '../../server/database-storage';

describe('Manual mode delivery to student (offline translation, client-speech)', () => {
  let httpServer: any; let port: number; let wss: any;
  beforeAll(async () => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
    process.env.TRANSLATION_SERVICE_TYPE = 'offline';
    process.env.TTS_SERVICE_TYPE = 'browser';
    const app = express();
    httpServer = createServer(app);
    port = 54500 + Math.floor(Math.random() * 1000);
    await new Promise<void>(r => httpServer.listen(port, r));
    const storage = new DatabaseStorage();
    wss = new WebSocketServer(httpServer as any, storage);
  });
  afterAll(async () => { await new Promise<void>(r => httpServer.close(() => r())); });

  it('delivers a translation message to the student after send_translation', async () => {
    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const student = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise(r => teacher.once('open', r));
    await new Promise(r => student.once('open', r));

    const studentMsgs: any[] = [];
    student.on('message', d => studentMsgs.push(JSON.parse(String(d))));

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
    const cc = await new Promise<any>(resolve => teacher.on('message', (d) => { const m = JSON.parse(String(d)); if (m.type === 'classroom_code') resolve(m); }));

    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: cc.code }));
    await new Promise(r => setTimeout(r, 150));
    // Prefer client-side speech on student to avoid server TTS
    student.send(JSON.stringify({ type: 'settings', settings: { useClientSpeech: true } }));
    await new Promise(r => setTimeout(r, 100));

    // Switch teacher to manual mode
    teacher.send(JSON.stringify({ type: 'settings', settings: { translationMode: 'manual' } }));
    await new Promise(r => setTimeout(r, 100));

    // Send manual text
    teacher.send(JSON.stringify({ type: 'send_translation', text: 'Hello students' }));

    const gotTranslation = await new Promise<any>((resolve) => {
      const to = setTimeout(() => resolve(null), 3000);
      student.on('message', (d) => { const m = JSON.parse(String(d)); if (m.type === 'translation') { clearTimeout(to); resolve(m); } });
    });

    expect(gotTranslation && gotTranslation.type).toBe('translation');
    expect(gotTranslation && gotTranslation.targetLanguage).toBe('es-ES');
  });
});



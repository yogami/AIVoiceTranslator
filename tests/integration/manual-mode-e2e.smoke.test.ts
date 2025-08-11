import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import WebSocket from 'ws';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { DatabaseStorage } from '../../server/database-storage';

describe('Manual mode E2E smoke', () => {
  let httpServer: any; let port: number; let wss: any;
  beforeAll(async () => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
    const app = express();
    httpServer = createServer(app);
    port = 54000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(r => httpServer.listen(port, r));
    const storage = new DatabaseStorage();
    wss = new WebSocketServer(httpServer as any, storage);
  });
  afterAll(async () => { await new Promise<void>(r => httpServer.close(() => r())); });

  it('teacher switches to manual; student receives teacher_mode; send_translation delivers', async () => {
    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const student = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise(r => teacher.once('open', r));
    await new Promise(r => student.once('open', r));

    const teacherMsgs: any[] = []; const studentMsgs: any[] = [];
    teacher.on('message', d => teacherMsgs.push(JSON.parse(String(d))));
    student.on('message', d => studentMsgs.push(JSON.parse(String(d))));

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
    const cc = await new Promise<any>(resolve => teacher.on('message', (d) => { const m = JSON.parse(String(d)); if (m.type === 'classroom_code') resolve(m); }));

    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: cc.code }));
    await new Promise(r => setTimeout(r, 200));

    // switch to manual
    teacher.send(JSON.stringify({ type: 'settings', settings: { translationMode: 'manual' } }));
    const gotMode = await new Promise<boolean>((resolve) => {
      const to = setTimeout(() => resolve(false), 1500);
      student.on('message', (d) => { const m = JSON.parse(String(d)); if (m.type === 'teacher_mode' && m.mode === 'manual') { clearTimeout(to); resolve(true); } });
    });
    expect(gotMode).toBe(true);

    // send manual text
    teacher.send(JSON.stringify({ type: 'send_translation', text: 'Hello students' }));
    const gotAck = await new Promise<boolean>((resolve) => {
      const to = setTimeout(() => resolve(false), 2000);
      teacher.on('message', (d) => { const m = JSON.parse(String(d)); if (m.type === 'manual_send_ack' && m.status === 'ok') { clearTimeout(to); resolve(true); } });
    });
    expect(gotAck).toBe(true);
  });
});



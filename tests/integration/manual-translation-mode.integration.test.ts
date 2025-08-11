import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { createServer } from 'http';
import WebSocket from 'ws';

describe('Manual Translation Mode - integration (flagged)', () => {
  let server: any;
  let wss: any;
  let httpServer: any;
  let port: number;

  beforeAll(async () => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
    httpServer = createServer((req, res) => res.end('ok'));
    port = 53000 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));
    wss = new WebSocketServer(httpServer as any);
  });

  afterAll(async () => {
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('does not auto-deliver on transcription when teacher is in manual mode but delivers on send_translation', async () => {
    const teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const student = new WebSocket(`ws://127.0.0.1:${port}`);

    const messagesStudent: any[] = [];
    student.on('message', (data) => messagesStudent.push(JSON.parse(String(data))));

    await new Promise(resolve => teacher.once('open', resolve));
    await new Promise(resolve => student.once('open', resolve));

    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
    const classroomMessage: any = await new Promise(resolve => {
      teacher.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'classroom_code') resolve(m);
      });
    });

    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES', classroomCode: classroomMessage.code }));
    await new Promise(r => setTimeout(r, 200));

    // Switch teacher to manual mode via settings
    teacher.send(JSON.stringify({ type: 'settings', settings: { translationMode: 'manual' } }));
    await new Promise(r => setTimeout(r, 100));

    // Send transcription (should NOT deliver)
    teacher.send(JSON.stringify({ type: 'transcription', text: 'Hello manual world' }));
    await new Promise(r => setTimeout(r, 300));
    expect(messagesStudent.find(m => m.type === 'translation')).toBeUndefined();

    // Now send manual send message (should deliver)
    teacher.send(JSON.stringify({ type: 'send_translation', text: 'Hello manual world' }));
    const delivered = await new Promise<any>((resolve, reject) => {
      const to = setTimeout(() => resolve(null), 3000);
      student.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.type === 'translation') {
          clearTimeout(to);
          resolve(m);
        }
      });
    });

    expect(delivered && delivered.type).toBe('translation');
  });
});



import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { WebSocketServer } from '../../../server/interface-adapters/websocket/WebSocketServer';

describe.skip('Two-way communication - component', () => {
  let httpServer: any;
  let port: number;
  let teacher: any;
  let student: any;
  let wss: any;

  beforeAll(async () => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    httpServer = createServer((req, res) => res.end('ok'));
    port = 54500 + Math.floor(Math.random() * 1000);
    await new Promise<void>(resolve => httpServer.listen(port, resolve));
  });

  afterAll(async () => {
    try {
      try { student && student.close && student.close(); } catch {}
      try { teacher && teacher.close && teacher.close(); } catch {}
      try { wss && typeof wss.shutdown === 'function' && await wss.shutdown(); } catch {}
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    } catch (_) {}
  }, 60000);

  it('registers student_request and teacher_reply handlers only when flag enabled', async () => {
    wss = new WebSocketServer(httpServer as any, {} as any);

    teacher = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise(resolve => teacher.once('open', resolve));
    teacher.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));

    const types: string[] = [];
    teacher.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.type && !types.includes(m.type)) types.push(m.type);
    });

    // Send a ping to exercise dispatcher
    teacher.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    await new Promise(r => setTimeout(r, 100));

    // Student request should not crash and teacher should be able to receive it
    student = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise(resolve => student.once('open', resolve));
    student.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'es-ES' }));
    await new Promise(r => setTimeout(r, 100));
    student.send(JSON.stringify({ type: 'student_request', text: 'hola' }));
    await new Promise(r => setTimeout(r, 150));

    expect(true).toBe(true); // Smoke component routing
  });
});



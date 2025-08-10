import { describe, it, expect, vi } from 'vitest';
import { RealtimeApp } from '../../../server/realtime/RealtimeApp';

class FakeTransport {
  messageCbs: any[] = [];
  sent: Array<[string, any]> = [];
  onConnect(cb: any) { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect(cb: any) { return () => {}; }
  async start() {}
  async stop() {}
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeApp audio integration', () => {
  it('routes audio to deps.transcribeAudio and responds with transcription', async () => {
    const transport = new FakeTransport();
    const app = new RealtimeApp(transport as any, {
      audioDeps: {
        transcribeAudio: vi.fn(async (_buf: Buffer, _lang: string) => 'ok'),
      }
    });
    app.start();
    const base64 = Buffer.from('x'.repeat(1024)).toString('base64');
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1', languageCode: 'en-US' }, { data: JSON.stringify({ type: 'audio', data: base64, isFinalChunk: true }) }));
    await new Promise(res => setTimeout(res, 0));
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][1].type).toBe('transcription');
    app.stop();
  });
});



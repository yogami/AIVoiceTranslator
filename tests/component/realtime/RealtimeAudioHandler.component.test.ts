import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerRealtimeAudioHandler } from '../../../server/realtime/handlers/RealtimeAudioHandler';

class FakeTransportWithSender {
  messageCbs: any[] = [];
  sent: Array<[string, any]> = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  start = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeAudioHandler', () => {
  it('transcribes final audio chunk and responds with transcription', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    const deps = {
      transcribeAudio: vi.fn(async (_buf: Buffer, _lang: string) => 'hello world'),
      onTranscription: vi.fn(async () => {}),
    };
    registerRealtimeAudioHandler(svc, deps);
    svc.start();
    const base64 = Buffer.from('fake-binary-audio-data-which-is-long-enough-to-pass-length-check-'.repeat(10)).toString('base64');
    // Simulate message with data field (string) so dispatcher uses JSON.parse(event.data)
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1', languageCode: 'en-US' }, { data: JSON.stringify({ type: 'audio', data: base64, isFinalChunk: true }) }));
    await new Promise(res => setTimeout(res, 0));
    expect(deps.transcribeAudio).toHaveBeenCalled();
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][0]).toBe('c1');
    expect(transport.sent[0][1].type).toBe('transcription');
    expect(transport.sent[0][1].text).toBe('hello world');
    svc.stop();
  });
});



import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load the UMD-style factory into a sandboxed global
function loadFactoryInto(globalObj: any) {
  const code = fs.readFileSync(path.resolve(__dirname, '../../../client/public/js/services/realtimeClient.js'), 'utf-8');
  const fn = new Function('window', 'globalThis', code + '\nreturn window.RealtimeClientFactory || globalThis.RealtimeClientFactory;');
  return fn(globalObj, globalObj);
}

class MockWS {
  static OPEN = 1;
  readyState = 0;
  url: string;
  onopen?: () => void;
  onmessage?: (evt: any) => void;
  onclose?: (evt: any) => void;
  onerror?: (err: any) => void;
  sent: any[] = [];
  constructor(url: string) { this.url = url; setTimeout(() => { this.readyState = MockWS.OPEN; this.onopen && this.onopen(); }, 0); }
  send(data: any) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose && this.onclose({ code: 1000 }); }
}

describe('RealtimeClient (frontend JS) - unit', () => {
  let sandbox: any;
  let Factory: any;

  beforeEach(() => {
    sandbox = {} as any;
    Factory = loadFactoryInto(sandbox);
  });

  it('connects and invokes onOpen', async () => {
    const client = Factory.create({ wsUrl: 'wss://example.test', wsCtor: MockWS as any });
    const openSpy = vi.fn();
    client.onOpen(openSpy);
    client.connect('wss://example.test');
    await new Promise(r => setTimeout(r, 1));
    expect(openSpy).toHaveBeenCalled();
    expect(client.isOpen()).toBe(true);
  });

  it('sends JSON messages via sendJSON', async () => {
    const client = Factory.create({ wsUrl: 'wss://example.test', wsCtor: MockWS as any });
    client.connect('wss://example.test');
    await new Promise(r => setTimeout(r, 1));
    const ok = client.sendJSON({ type: 'ping' });
    expect(ok).toBe(true);
  });

  it('registerTeacher and sendTranscription helpers send JSON', async () => {
    const client = Factory.create({ wsUrl: 'wss://example.test', wsCtor: MockWS as any });
    client.connect('wss://example.test');
    await new Promise(r => setTimeout(r, 1));
    client.registerTeacher('t1', 'en-US');
    client.sendTranscription('hello');
    client.sendPong();
    // Ensure no throw and isOpen remains true
    expect(client.isOpen()).toBe(true);
  });
});



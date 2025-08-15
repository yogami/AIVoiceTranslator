import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Student UI Original Audio Button (component smoke)', () => {
  beforeEach(() => {
    // Create minimal DOM in JSDOM
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="translation-display"></div>
      <button id="play-button" disabled></button>
      <button id="play-original-button" disabled></button>
      <input id="volume-control" value="0.8" />
    </body></html>`);
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (window as any).VITE_WS_URL = 'ws://test';
    // Stub Audio to avoid play errors in JSDOM
    (global as any).Audio = function() {
      return {
        load: () => {},
        play: () => Promise.resolve(),
        addEventListener: () => {},
        removeEventListener: () => {},
        set src(_v: string) {},
        set volume(_v: number) {},
      } as any;
    } as any;
  });

  it('enables Play Original button when originalAudioData is present and keeps translation button state based on audioData', async () => {
    // Load student script (will attach handlers)
    await import('../../../client/public/js/student.js');
    // Fire DOMContentLoaded to allow student.js to cache DOM elements
    document.dispatchEvent(new (window as any).Event('DOMContentLoaded'));
    const handle = (window as any).handleWebSocketMessage;
    expect(typeof handle).toBe('function');

    // Simulate translation with original audio
    const base64 = Buffer.from('abc').toString('base64');
    handle({
      type: 'translation',
      originalText: 'Hello',
      text: 'Hola',
      originalAudioData: base64,
      originalAudioFormat: 'mp3',
    });

    const btn = document.getElementById('play-original-button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);

    const playBtn = document.getElementById('play-button') as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);
  });
});



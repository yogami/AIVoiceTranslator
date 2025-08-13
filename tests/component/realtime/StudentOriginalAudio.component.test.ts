import { describe, it, expect, beforeEach } from 'vitest';

describe('Student UI Original Audio Button (component smoke)', () => {
  beforeEach(() => {
    // Create minimal DOM
    document.body.innerHTML = `
      <div id="translation-display"></div>
      <button id="play-button" disabled></button>
      <button id="play-original-button" disabled></button>
      <input id="volume-control" value="0.8" />
    `;
    (window as any).VITE_WS_URL = 'ws://test';
  });

  it('enables Play Original button when originalAudioData is present', async () => {
    // Load student script (will attach handlers)
    await import('../../../client/public/js/student.js');
    const handle = (window as any).handleWebSocketMessage;
    expect(typeof handle).toBe('function');

    // Simulate translation with original audio
    const base64 = Buffer.from('abc').toString('base64');
    handle({
      type: 'translation',
      originalText: 'Hello',
      text: 'Hola',
      audioData: base64,
      audioFormat: 'mp3',
      originalAudioData: base64,
      originalAudioFormat: 'mp3',
    });

    const btn = document.getElementById('play-original-button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });
});



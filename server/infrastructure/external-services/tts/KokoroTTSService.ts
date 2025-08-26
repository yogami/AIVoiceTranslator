import type { ITTSService, TTSResult } from '../../../services/tts/TTSService';

/**
 * Kokoro-82M TTS Service (Hugging Face Inference Endpoint)
 * - Preferred free-tier TTS when configured via env (KOKORO_TTS_URL, KOKORO_TTS_TOKEN)
 * - Does not require local download when using HF Inference API
 */
export class KokoroTTSService implements ITTSService {
  private endpointUrl: string;
  private authToken?: string;

  constructor(endpointUrl?: string, authToken?: string) {
    this.endpointUrl = endpointUrl || process.env.KOKORO_TTS_URL || '';
    this.authToken = authToken || process.env.KOKORO_TTS_TOKEN || process.env.HUGGINGFACE_TOKEN;
  }

  async synthesize(text: string, options: { language?: string; voice?: string; speed?: number } = {}): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), error: 'Text cannot be empty', ttsServiceType: 'kokoro' };
    }
    if (!this.endpointUrl || typeof fetch !== 'function') {
      return { audioBuffer: Buffer.alloc(0), error: 'KOKORO_TTS_URL not configured or fetch unavailable', ttsServiceType: 'kokoro' };
    }
    try {
      const body: any = {
        inputs: text,
        parameters: {
          language: options.language,
          voice: options.voice,
          speed: options.speed
        }
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' };
      if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

      const res = await fetch(this.endpointUrl, { method: 'POST', headers, body: JSON.stringify(body) } as any);
      if (!res.ok) {
        const txt = await safeReadText(res);
        return { audioBuffer: Buffer.alloc(0), error: `Kokoro TTS HTTP ${res.status}: ${txt || res.statusText}`, ttsServiceType: 'kokoro' };
      }
      const arr = await res.arrayBuffer();
      const buf = Buffer.from(arr);
      return { audioBuffer: buf, ttsServiceType: guessAudioType(buf) };
    } catch (error) {
      return { audioBuffer: Buffer.alloc(0), error: error instanceof Error ? error.message : String(error), ttsServiceType: 'kokoro' };
    }
  }
}

async function safeReadText(res: any): Promise<string> { try { return await res.text(); } catch { return ''; } }
function guessAudioType(buf: Buffer): string {
  if (!buf || buf.length < 4) return 'kokoro';
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'mp3'; // ID3
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3'; // MPEG frame
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'wav'; // RIFF
  return 'kokoro';
}

export default KokoroTTSService;



import type { ITTSService, TTSResult } from '../../../services/tts/TTSService';

/**
 * KartoffelTTSService
 * Minimal HTTP client for an open-source German TTS (Kartoffel/Chatterbox on Hugging Face).
 *
 * Configuration:
 * - KARTOFFEL_TTS_URL: Full URL to the inference endpoint that accepts JSON { text, language }
 * - HUGGINGFACE_TOKEN (optional): Bearer token for private spaces
 *
 * Contract:
 * - Returns MP3 or WAV audio in the response body
 * - On failure, resolves to empty buffer with error set
 */
export class KartoffelTTSService implements ITTSService {
  private endpointUrl: string;
  private authToken?: string;

  constructor(endpointUrl?: string, authToken?: string) {
    this.endpointUrl = endpointUrl || process.env.KARTOFFEL_TTS_URL || '';
    this.authToken = authToken || process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
  }

  async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      return {
        audioBuffer: Buffer.alloc(0),
        error: 'Text cannot be empty',
        ttsServiceType: 'kartoffel'
      };
    }
    if (!this.endpointUrl || typeof fetch !== 'function') {
      return {
        audioBuffer: Buffer.alloc(0),
        error: 'Kartoffel endpoint not configured or fetch unavailable',
        ttsServiceType: 'kartoffel'
      };
    }

    try {
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
        },
        body: JSON.stringify({ text, language: options.language || 'de-DE', voice: options.voice })
      } as any);

      if (!res.ok) {
        const errText = await safeReadText(res);
        return {
          audioBuffer: Buffer.alloc(0),
          error: `Kartoffel HTTP ${res.status}: ${errText || res.statusText}`,
          ttsServiceType: 'kartoffel'
        };
      }

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      return {
        audioBuffer: buf,
        ttsServiceType: guessAudioType(buf)
      };
    } catch (error) {
      return {
        audioBuffer: Buffer.alloc(0),
        error: error instanceof Error ? error.message : String(error),
        ttsServiceType: 'kartoffel'
      };
    }
  }
}

async function safeReadText(res: any): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function guessAudioType(buf: Buffer): string {
  if (!buf || buf.length < 4) return 'kartoffel';
  // ID3 tag indicates MP3; 0xFFEx indicates MPEG frame; 'RIFF' indicates WAV
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'mp3';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'wav';
  return 'kartoffel';
}

export default KartoffelTTSService;


import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import lamejs from 'lamejs';

export class AudioFormatConverter {
  static async wavToMp3(wavBuffer: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      if (!ffmpegPath) {
        // Fallback: try lamejs encode if ffmpeg not present
        try {
          const mp3 = AudioFormatConverter.encodeWithLame(wavBuffer);
          return resolve(mp3);
        } catch (e) {
          return reject(new Error('ffmpeg-static not available and lamejs fallback failed'));
        }
      }

      // Boost very quiet WAVs before conversion
      try {
        const rms = AudioFormatConverter.computeWavRms(wavBuffer);
        // eslint-disable-next-line no-console
        console.log('[TTS Debug] WAV RMS pre-boost', { rms: Number(rms.toFixed ? rms.toFixed(4) : rms) });
        if (rms < 0.01) {
          // Apply a gentle gain (x3) with clipping safeguard
          wavBuffer = AudioFormatConverter.boostWavPcm(wavBuffer, 3.0);
          const rms2 = AudioFormatConverter.computeWavRms(wavBuffer);
          // eslint-disable-next-line no-console
          console.log('[TTS Debug] WAV RMS post-boost', { rms: Number(rms2.toFixed ? rms2.toFixed(4) : rms2) });
        }
      } catch {}

      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'wav',
        '-i', 'pipe:0',
        '-vn', '-sn',
        '-ac', '1',
        '-ar', '44100',
        '-f', 'mp3',
        '-codec:a', 'libmp3lame',
        '-q:a', '4',
        'pipe:1'
      ];

      const ff = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      const chunks: Buffer[] = [];
      let stderrBuf = '';
      ff.stdout.on('data', (d) => chunks.push(d));
      ff.stderr.on('data', (d) => { try { stderrBuf += d.toString(); } catch {} });
      ff.on('error', reject);
      ff.on('close', (code) => {
        const out = Buffer.concat(chunks);
        const okHeader = AudioFormatConverter.hasMpegOrId3Header(out);
        if (code === 0 && okHeader && out.length > 1024) return resolve(out);
        else {
          if (code !== 0 || !okHeader) {
            // eslint-disable-next-line no-console
            console.warn('[TTS Debug] ffmpeg conversion issue; falling back to lamejs', { code, err: stderrBuf, bytes: out.length, okHeader });
          }
          // Fallback to lamejs if ffmpeg failed at runtime
          try {
            const mp3 = AudioFormatConverter.encodeWithLame(wavBuffer);
            resolve(mp3);
          } catch (e) {
            reject(new Error(`ffmpeg conversion failed and lamejs fallback failed`));
          }
        }
      });

      ff.stdin.write(wavBuffer);
      ff.stdin.end();
    });
  }

  // Very lightweight WAV→MP3 using lamejs (expects PCM 16-bit little-endian mono @ 44100)
  private static encodeWithLame(wav: Buffer): Buffer {
    // Parse minimal WAV header for PCM data
    // RIFF(0..3) WAVE fmt 0x10 chunk etc. This is a best-effort fallback.
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    // Find 'fmt ' chunk at 12.., and 'data' chunk
    let pos = 12;
    let channels = 1;
    let sampleRate = 44100;
    let bitsPerSample = 16;
    let dataOffset = -1;
    let dataSize = 0;
    while (pos + 8 <= wav.length) {
      const id = wav.toString('ascii', pos, pos + 4);
      const size = view.getUint32(pos + 4, true);
      if (id === 'fmt ') {
        const fmtPos = pos + 8;
        const audioFormat = view.getUint16(fmtPos + 0, true);
        channels = view.getUint16(fmtPos + 2, true);
        sampleRate = view.getUint32(fmtPos + 4, true);
        bitsPerSample = view.getUint16(fmtPos + 14, true);
        if (audioFormat !== 1) throw new Error('Only PCM WAV supported for lame fallback');
      } else if (id === 'data') {
        dataOffset = pos + 8;
        dataSize = size;
        break;
      }
      pos += 8 + size;
    }
    if (dataOffset < 0) throw new Error('WAV data chunk not found');
    // Optionally boost if silent
    let boosted = wav;
    try {
      const rms = AudioFormatConverter.computeWavRms(wav);
      if (rms < 0.01) boosted = AudioFormatConverter.boostWavPcm(wav, 3.0);
    } catch {}
    const pcm = boosted.subarray(dataOffset, dataOffset + dataSize);
    // Convert interleaved PCM16 to mono if needed
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, dataSize / 2);
    let mono = samples;
    if (channels > 1) {
      const out = new Int16Array(samples.length / channels);
      for (let i = 0, j = 0; i < samples.length; i += channels, j++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += samples[i + c];
        out[j] = sum / channels;
      }
      mono = out;
    }
    const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const chunkSize = 1152;
    const buffers: Int8Array[] = [];
    for (let i = 0; i < mono.length; i += chunkSize) {
      const chunk = mono.subarray(i, Math.min(i + chunkSize, mono.length));
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) buffers.push(mp3buf);
    }
    const end = mp3Encoder.flush();
    if (end.length > 0) buffers.push(end);
    return Buffer.concat(buffers.map((b) => Buffer.from(b)));
  }

  private static hasMpegOrId3Header(buf: Buffer): boolean {
    if (!buf || buf.length < 4) return false;
    // ID3 tag
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    // MPEG frame sync 0xFFEx
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    // Scan first 256 bytes for a frame sync
    const max = Math.min(buf.length - 1, 256);
    for (let i = 0; i < max; i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) return true;
    }
    return false;
  }

  private static computeWavRms(wav: Buffer): number {
    if (wav.length < 44) return 0;
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    if (!(wav[0] === 0x52 && wav[1] === 0x49 && wav[2] === 0x46 && wav[3] === 0x46)) return 0;
    let pos = 12;
    let channels = 1;
    let bitsPerSample = 16;
    let dataOffset = -1;
    let dataSize = 0;
    while (pos + 8 <= wav.length) {
      const id = wav.toString('ascii', pos, pos + 4);
      const size = view.getUint32(pos + 4, true);
      if (id === 'fmt ') {
        const fmtPos = pos + 8;
        channels = view.getUint16(fmtPos + 2, true);
        bitsPerSample = view.getUint16(fmtPos + 14, true);
      } else if (id === 'data') {
        dataOffset = pos + 8;
        dataSize = size;
        break;
      }
      pos += 8 + size;
    }
    if (dataOffset < 0 || bitsPerSample !== 16) return 0;
    const pcm = wav.subarray(dataOffset, dataOffset + dataSize);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, dataSize / 2);
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < samples.length; i += Math.max(1, channels)) {
      // Mono RMS; for stereo we just sample the first channel
      const v = samples[i] / 32768;
      sumSq += v * v;
      count++;
    }
    if (count === 0) return 0;
    return Math.sqrt(sumSq / count);
  }

  private static boostWavPcm(wav: Buffer, gain: number): Buffer {
    if (wav.length < 44) return wav;
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    if (!(wav[0] === 0x52 && wav[1] === 0x49 && wav[2] === 0x46 && wav[3] === 0x46)) return wav;
    let pos = 12;
    let bitsPerSample = 16;
    let dataOffset = -1;
    let dataSize = 0;
    while (pos + 8 <= wav.length) {
      const id = wav.toString('ascii', pos, pos + 4);
      const size = view.getUint32(pos + 4, true);
      if (id === 'fmt ') {
        const fmtPos = pos + 8;
        bitsPerSample = view.getUint16(fmtPos + 14, true);
      } else if (id === 'data') {
        dataOffset = pos + 8;
        dataSize = size;
        break;
      }
      pos += 8 + size;
    }
    if (dataOffset < 0 || bitsPerSample !== 16) return wav;
    const out = Buffer.from(wav);
    const pcmView = new DataView(out.buffer, out.byteOffset + dataOffset, dataSize);
    for (let i = 0; i < dataSize; i += 2) {
      let sample = pcmView.getInt16(i, true);
      let boosted = Math.max(-32768, Math.min(32767, Math.round(sample * gain)));
      pcmView.setInt16(i, boosted, true);
    }
    return out;
  }
}



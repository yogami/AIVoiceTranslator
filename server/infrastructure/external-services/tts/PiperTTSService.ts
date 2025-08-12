import { ITTSService, TTSResult } from '../../../services/tts/TTSService';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';

type PiperVoiceInfo = {
  modelPath: string; // path to .onnx model
  configPath?: string; // optional .json config path (piper can infer from directory)
};

/**
 * Piper TTS Service
 * - Uses the `piper` binary if available on PATH or via PIPER_PATH
 * - Requires voice model files on disk; locations resolved from env or default directories
 * - High-quality, multi-lingual, offline
 */
export class PiperTTSService implements ITTSService {
  private piperPath: string | null = null;
  private modelsDir: string;

  constructor(modelsDir?: string) {
    this.piperPath = this.resolvePiperPath();
    this.modelsDir = modelsDir || process.env.PIPER_MODELS_DIR || path.join(process.cwd(), 'piper_models');
  }

  public isAvailable(): boolean {
    return !!this.piperPath;
  }

  public isLanguageSupported(language?: string): boolean {
    const info = this.resolveVoiceForLanguage(language);
    return !!info && this.modelExists(info);
  }

  async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    const voice = this.resolveVoiceForLanguage(options.language, options.voice);
    if (!this.piperPath || !voice || !this.modelExists(voice)) {
      return { audioBuffer: Buffer.alloc(0), error: 'Piper not available or model missing', ttsServiceType: 'piper' };
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'piper-'));
    const outPath = path.join(tmpDir, 'out.wav');

    const args = ['-m', voice.modelPath, '-f', outPath];
    if (voice.configPath && fsSync.existsSync(voice.configPath)) {
      args.push('-c', voice.configPath);
    }

    const child = spawn(this.piperPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { try { err += d.toString(); } catch {} });
    // Write text to stdin
    child.stdin.write(text);
    child.stdin.end();

    const exitCode: number = await new Promise((resolve, reject) => {
      child.on('error', (e) => reject(e));
      child.on('close', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
      return { audioBuffer: Buffer.alloc(0), error: `piper exited with code ${exitCode}: ${err}`, ttsServiceType: 'piper' };
    }

    try {
      const buf = await fs.readFile(outPath);
      await fs.rm(tmpDir, { recursive: true, force: true });
      return { audioBuffer: buf, ttsServiceType: 'piper' };
    } catch (e: any) {
      return { audioBuffer: Buffer.alloc(0), error: e?.message || String(e), ttsServiceType: 'piper' };
    }
  }

  private resolvePiperPath(): string | null {
    if (process.env.PIPER_PATH && fsSync.existsSync(process.env.PIPER_PATH)) return process.env.PIPER_PATH;
    // try PATH
    const pathEnv = process.env.PATH || '';
    for (const dir of pathEnv.split(path.delimiter)) {
      const candidate = path.join(dir, process.platform === 'win32' ? 'piper.exe' : 'piper');
      if (fsSync.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private modelExists(info: PiperVoiceInfo): boolean {
    try {
      return fsSync.existsSync(info.modelPath);
    } catch {
      return false;
    }
  }

  private resolveVoiceForLanguage(language?: string, overrideVoice?: string): PiperVoiceInfo | null {
    const lang = (overrideVoice || language || 'en-US').toLowerCase();
    const primary = lang.split('-')[0];

    // Allow explicit mapping via env, e.g., PIPER_MODEL_de=/models/de_DE-.../model.onnx
    const envKeyExact = `PIPER_MODEL_${lang.replace(/[-.]/g, '_')}`.toUpperCase();
    const envKeyPrimary = `PIPER_MODEL_${primary}`.toUpperCase();
    const envPath = process.env[envKeyExact] || process.env[envKeyPrimary];
    if (envPath) {
      return { modelPath: envPath };
    }

    // Built-in suggestions (you must place these models under modelsDir with these names)
    const modelMap: Record<string, string> = {
      // Western/Central Europe
      'en': 'en_US-amy-medium.onnx',
      'en-us': 'en_US-amy-medium.onnx',
      'en-gb': 'en_GB-northern_english_male-medium.onnx',
      'de': 'de_DE-thorsten-medium.onnx',
      'fr': 'fr_FR-gilles-medium.onnx',
      'es': 'es_ES-ana-medium.onnx',
      'it': 'it_IT-riccardo-xlow.onnx',
      'pt': 'pt_BR-edresson-medium.onnx',
      'nl': 'nl_NL-mls-medium.onnx',
      'sv': 'sv_SE-nst-medium.onnx',
      'da': 'da_DK-nst-medium.onnx',
      'no': 'no_NO-nst-medium.onnx',
      'fi': 'fi_FI-tnc-medium.onnx',
      'pl': 'pl_PL-gosia-medium.onnx',
      'cs': 'cs_CZ-krystof-medium.onnx',
      'hu': 'hu_HU-anna-medium.onnx',
      'ro': 'ro_RO-mihai-medium.onnx',
      'ru': 'ru_RU-ruslan-medium.onnx',
      'uk': 'uk_UA-ukrainian-medium.onnx',
      'tr': 'tr_TR-dfki-medium.onnx',

      // Southern/Eastern Europe extras
      'el': 'el_GR-nikolaos-medium.onnx',
      'bg': 'bg_BG-dfki-medium.onnx',
      'sr': 'sr_RS-serbian-medium.onnx',
      'hr': 'hr_HR-croatian-medium.onnx',
      'sk': 'sk_SK-dfki-medium.onnx',

      // Middle Eastern / immigrant languages
      'ar': 'ar_JO-kareem-medium.onnx',
      'fa': 'fa_IR-ava-medium.onnx', // Persian (Farsi) – adjust to actual model filename
      'ku': 'ku_TR-kurdish-medium.onnx', // Kurdish – adjust to actual model filename
      'ps': 'ps_AF-pashto-medium.onnx', // Pashto – adjust to actual model filename
      'ur': 'ur_PK-urdu-medium.onnx', // Urdu – adjust to actual model filename
      'ckb': 'ckb_IQ-kurdish_central-medium.onnx', // Central Kurdish – adjust filename

      // South Asian
      'hi': 'hi_IN-indi-female-medium.onnx', // Hindi – adjust to actual
      'bn': 'bn_IN-bengali-medium.onnx',
      'ta': 'ta_IN-gnani-medium.onnx',
      'te': 'te_IN-telegu-medium.onnx',
      'ml': 'ml_IN-malayalam-medium.onnx',
      'pa': 'pa_IN-punjabi-medium.onnx',
      'gu': 'gu_IN-gujarati-medium.onnx',
      'mr': 'mr_IN-marathi-medium.onnx',

      // East Asia
      'zh': 'zh_CN-huayan-medium.onnx',
      'ja': 'ja_JP-mikoto-medium.onnx',
      'ko': 'ko_KR-hajun-medium.onnx',
    };

    const tryKeys = [lang, lang.replace('_', '-'), primary];
    for (const key of tryKeys) {
      const filename = modelMap[key];
      if (filename) {
        const full = path.isAbsolute(filename) ? filename : path.join(this.modelsDir, filename);
        return { modelPath: full };
      }
    }
    return null;
  }
}



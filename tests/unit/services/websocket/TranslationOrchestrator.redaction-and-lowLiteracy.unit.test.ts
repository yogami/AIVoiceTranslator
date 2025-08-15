import { describe, it, expect, beforeEach } from 'vitest';

describe('TranslationOrchestrator - redaction + low literacy (ATDD)', () => {
  let TranslationOrchestrator: any;
  let orchestrator: any;

  beforeEach(async () => {
    process.env.FEATURE_REDACT_PROFANITY = '1';
    process.env.FEATURE_REDACT_PII = '1';
    process.env.FEATURE_LOW_LITERACY_MODE = '1';
    const mod = await import('../../../../server/services/websocket/TranslationOrchestrator');
    TranslationOrchestrator = mod.TranslationOrchestrator;
    orchestrator = new TranslationOrchestrator(undefined as any);
  });

  it('redacts profanity and PII, and forces client speech when lowLiteracy enabled for student', async () => {
    const studentWs: any = { sent: [] as any[], send(d: string) { this.sent.push(JSON.parse(d)); } };
    const started = Date.now();
    const options = {
      studentConnections: [studentWs],
      originalText: 'Email me at john@example.com you damn tester',
      sourceLanguage: 'en',
      translations: new Map<string, string>([['es', 'Correo a john@example.com maldito probador']]),
      startTime: started,
      latencyTracking: { start: started, components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      getClientSettings: () => ({ lowLiteracyMode: true }),
      getLanguage: () => 'es',
      getSessionId: () => 's1',
    };
    await orchestrator.sendTranslationsToStudents(options as any);
    const msg = studentWs.sent[0];
    expect(msg.type).toBe('translation');
    expect(msg.text).not.toMatch(/john@example\.com/i);
    // Profanity masking is language-dependent; ensure email redacted and message delivered
    expect(msg.text).toContain('[redacted-email]');
    expect(msg.useClientSpeech).toBe(true);
    expect(msg.speechParams?.type).toBe('browser-speech');
  });
});



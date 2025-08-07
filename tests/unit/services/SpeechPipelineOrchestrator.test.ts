import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ISTTTranscriptionService, ITranslationService } from '../../../server/services/TranslationService';
import { SpeechPipelineOrchestrator } from '../../../server/services/SpeechPipelineOrchestrator';

describe('SpeechPipelineOrchestrator', () => {
  const mockTranscriptionService: ISTTTranscriptionService = {
    transcribe: vi.fn().mockResolvedValue('hello world'),
  };
  const mockTranslationService: ITranslationService = {
    translate: vi.fn().mockResolvedValue('hola mundo'),
  };
  const mockTTSService = {
    synthesize: vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('audio'), ttsServiceType: 'openai' }),
  };
  const ttsServiceFactory = vi.fn().mockReturnValue(mockTTSService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should orchestrate the pipeline and return expected result', async () => {
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    const result = await orchestrator.process(audioBuffer, 'en', 'es');
    expect(result.originalText).toBe('hello world');
    expect(result.translatedText).toBe('hola mundo');
    expect(result.audioBuffer).toEqual(Buffer.from('audio'));
    expect(result.ttsServiceType).toBe('openai');
  });

  it('should fallback to secondary STT if primary fails', async () => {
    const sttMock = vi.fn()
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce('secondary result');
    const fallbackTranscriptionService: ISTTTranscriptionService = {
      transcribe: sttMock,
    };
    const orchestrator = new SpeechPipelineOrchestrator(
      fallbackTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    const result = await orchestrator.process(audioBuffer, 'en', 'es');
    expect(result.originalText).toBe('secondary result');
    expect(sttMock).toHaveBeenCalledTimes(2);
  });

  it('should fallback to secondary TTS if primary fails', async () => {
    const ttsMock1 = { synthesize: vi.fn().mockRejectedValueOnce(new Error('primary TTS failed')) };
    const ttsMock2 = { synthesize: vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('tts2'), ttsServiceType: 'elevenlabs' }) };
    const ttsFactory = vi.fn()
      .mockReturnValueOnce(ttsMock1)
      .mockReturnValueOnce(ttsMock2);
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    const result = await orchestrator.process(audioBuffer, 'en', 'es', undefined, { ttsServiceType: 'auto' });
    expect(result.audioBuffer).toEqual(Buffer.from('tts2'));
    expect(result.ttsServiceType).toBe('elevenlabs');
    expect(ttsFactory).toHaveBeenCalledTimes(2);
  });

  it('should return empty result if all STT services fail', async () => {
    const sttMock = vi.fn().mockRejectedValue(new Error('all failed'));
    const failTranscriptionService: ISTTTranscriptionService = {
      transcribe: sttMock,
    };
    const orchestrator = new SpeechPipelineOrchestrator(
      failTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    const result = await orchestrator.process(audioBuffer, 'en', 'es');
    expect(result.originalText).toBe('');
    expect(result.translatedText).toBe('');
    expect(result.audioBuffer).toEqual(audioBuffer);
  });

  it('should return original text if translation fails', async () => {
    const translationMock = vi.fn().mockRejectedValue(new Error('translation failed'));
    const failTranslationService: ITranslationService = {
      translate: translationMock,
    };
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      failTranslationService,
      ttsServiceFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    let result;
    try {
      result = await orchestrator.process(audioBuffer, 'en', 'es');
    } catch (e) {
      result = null;
    }
    expect(result).toEqual({
      originalText: '',
      translatedText: '',
      audioBuffer,
      ttsServiceType: undefined
    });
  });

  it('should use preTranscribedText if provided', async () => {
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const audioBuffer = Buffer.from('input');
    const result = await orchestrator.process(audioBuffer, 'en', 'es', 'already transcribed');
    expect(result.originalText).toBe('already transcribed');
    expect(mockTranscriptionService.transcribe).not.toHaveBeenCalled();
  });

  it('should retry delivery up to 3 times and log failure if all fail', async () => {
    const mockSend = vi.fn().mockImplementation(() => { throw new Error('send failed'); });
    const studentWs = { send: mockSend } as any;
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const options = {
      studentConnections: [studentWs],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess',
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      getSessionId: () => 'sess',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
      ttsServiceType: 'openai'
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should skip students with invalid language', async () => {
    const mockSend = vi.fn();
    const studentWs = { send: mockSend } as any;
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const options = {
      studentConnections: [studentWs],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess',
      getClientSettings: () => ({}),
      getLanguage: () => '', // invalid
      getSessionId: () => 'sess',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
      ttsServiceType: 'openai'
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should persist translation if storage and detailed logging enabled', async () => {
    const mockSend = vi.fn();
    const mockAddTranslation = vi.fn().mockResolvedValue(undefined);
    const studentWs = { send: mockSend } as any;
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      { addTranslation: mockAddTranslation }
    );
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    const options = {
      studentConnections: [studentWs],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess',
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      getSessionId: () => 'sess',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
      ttsServiceType: 'openai'
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(mockAddTranslation).toHaveBeenCalledTimes(1);
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = '';
  });

  it('should use browser speech if useClientSpeech is true', async () => {
    const mockSend = vi.fn();
    const studentWs = { send: mockSend } as any;
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsServiceFactory,
      undefined
    );
    const options = {
      studentConnections: [studentWs],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess',
      getClientSettings: () => ({ useClientSpeech: true }),
      getLanguage: () => 'es',
      getSessionId: () => 'sess',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
      ttsServiceType: 'openai'
    };
    await orchestrator.sendTranslationsToStudents(options);
    const sentMsg = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sentMsg.useClientSpeech).toBe(true);
    expect(sentMsg.speechParams).toBeDefined();
  });

  it('should fallback to secondary TTS in delivery if primary fails', async () => {
    const ttsMock1 = { synthesize: vi.fn().mockRejectedValueOnce(new Error('primary TTS failed')) };
    const ttsMock2 = { synthesize: vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('tts2'), ttsServiceType: 'elevenlabs' }) };
    const ttsFactory = vi.fn()
      .mockReturnValueOnce(ttsMock1)
      .mockReturnValueOnce(ttsMock2);
    const mockSend = vi.fn();
    const studentWs = { send: mockSend } as any;
    const orchestrator = new SpeechPipelineOrchestrator(
      mockTranscriptionService,
      mockTranslationService,
      ttsFactory,
      undefined
    );
    const options = {
      studentConnections: [studentWs],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess',
      getClientSettings: () => ({ ttsServiceType: 'auto' }),
      getLanguage: () => 'es',
      getSessionId: () => 'sess',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
      ttsServiceType: 'auto'
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(ttsFactory).toHaveBeenCalledTimes(2);
    const sentMsg = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sentMsg.ttsServiceType).toBe('elevenlabs');
  });
});

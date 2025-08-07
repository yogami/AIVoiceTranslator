/**
 * Unit Tests for TranscriptionServiceFactory Auto-Fallback
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { getSTTTranscriptionService } from '../../../../server/services/stttranscription/TranscriptionServiceFactory.js';

describe('TranscriptionServiceFactory Auto-Fallback', () => {
  let originalEnv: any;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should create AutoFallbackSTTService when service type is auto', () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should use auto service type from environment variable', () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should create OpenAISTTTranscriptionService when service type is openai', () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('OpenAISTTTranscriptionService');
  });

  it('should fallback to auto when OpenAI key is missing', () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'openai';
    delete process.env.OPENAI_API_KEY;
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should create AutoFallbackSTTService when service type is whisper', () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'whisper';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });
});

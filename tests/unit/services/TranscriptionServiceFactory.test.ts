/**
 * Unit Tests for TranscriptionServiceFactory Auto-Fallback
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TranscriptionServiceFactory, getTranscriptionService } from '../../../server/services/transcription/TranscriptionServiceFactory.js';

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

  it('should create AutoFallbackTranscriptionService when service type is auto', () => {
    // Set environment to auto
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const factory = TranscriptionServiceFactory.getInstance();
    const service = factory.getService('auto');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranscriptionService');
  });

  it('should use auto service type from environment variable', () => {
    // Set environment to auto
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const service = getTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranscriptionService');
  });

  it('should create OpenAI service when service type is openai', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    
    const factory = TranscriptionServiceFactory.getInstance();
    const service = factory.getService('openai');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('OpenAITranscriptionService');
  });

  it('should fallback to whisper when OpenAI key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    
    const factory = TranscriptionServiceFactory.getInstance();
    const service = factory.getService('openai');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('WhisperCppTranscriptionService');
  });

  it('should create WhisperCpp service when service type is whisper', () => {
    const factory = TranscriptionServiceFactory.getInstance();
    const service = factory.getService('whisper');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('WhisperCppTranscriptionService');
  });
});

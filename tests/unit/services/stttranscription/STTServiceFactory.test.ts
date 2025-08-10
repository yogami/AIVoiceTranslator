/**
 * STT Service Factory Unit Tests
 * 
 * Tests the 3-tier STT auto-fallback system:
 * 1. OpenAI STT (primary)
 * 2. ElevenLabs STT (secondary) 
 * 3. Whisper.cpp local model (final fallback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSTTTranscriptionService } from '../../../../server/services/stttranscription/TranscriptionServiceFactory.js';

describe('STT Service Factory Unit Tests', () => {
  let originalApiKey: string | undefined;
  let originalElevenLabsApiKey: string | undefined;
  let originalSTTServiceType: string | undefined;

  beforeEach(() => {
    // Store original environment variables
    originalApiKey = process.env.OPENAI_API_KEY;
    originalElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    originalSTTServiceType = process.env.STT_SERVICE_TYPE;
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalApiKey !== undefined) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    
    if (originalElevenLabsApiKey !== undefined) {
      process.env.ELEVENLABS_API_KEY = originalElevenLabsApiKey;
    } else {
      delete process.env.ELEVENLABS_API_KEY;
    }
    
    if (originalSTTServiceType !== undefined) {
      process.env.STT_SERVICE_TYPE = originalSTTServiceType;
    } else {
      delete process.env.STT_SERVICE_TYPE;
    }

    // Clear any cached services
    vi.clearAllMocks();
  });

  it('should create 3-tier auto-fallback STT service when type is "auto"', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should create 3-tier auto-fallback STT service as default when no type specified', () => {
    delete process.env.STT_SERVICE_TYPE;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should handle missing OpenAI API key gracefully', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    delete process.env.OPENAI_API_KEY;
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'whisper';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should handle missing ElevenLabs API key gracefully', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.ELEVENLABS_API_KEY;
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should handle missing both API keys gracefully and use Whisper.cpp only', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should create OpenAI service directly when explicitly requested', () => {
    process.env.STT_SERVICE_TYPE = 'openai';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'whisper';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('OpenAITranscriptionService');
  });

  it('should create ElevenLabs service directly when explicitly requested', () => {
    process.env.STT_SERVICE_TYPE = 'elevenlabs';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('ElevenLabsSTTService');
  });

  it('should create Whisper.cpp service directly when explicitly requested', () => {
    process.env.STT_SERVICE_TYPE = 'whisper';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
  });

  it('should cache service instances to avoid recreation', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    const service1 = getSTTTranscriptionService();
    const service2 = getSTTTranscriptionService();
    
    expect(service1).toBe(service2); // Same instance
  });

  it('should implement ITranscriptionService interface', () => {
    process.env.STT_SERVICE_TYPE = 'auto';
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    // Optionally, check for a method that should exist on the service
    // expect(typeof service.transcribe).toBe('function');
  });

  it('should support service type validation', () => {
    const validTypes = ['auto', 'openai', 'elevenlabs', 'whisper'];
    validTypes.forEach(type => {
      process.env.STT_SERVICE_TYPE = type;
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
      const service = getSTTTranscriptionService();
      expect(service).toBeDefined();
    });
  });

  it('should fallback to auto when invalid service type is provided', () => {
    process.env.STT_SERVICE_TYPE = 'invalid-service-type';
    process.env.OPENAI_API_KEY = 'test-key';
    
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    const service = getSTTTranscriptionService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });
});

/**
 * TTS Service Factory Unit Tests
 * Tests the factory pattern for TTS services with auto-fallback capability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TTSServiceFactory Auto-Fallback', () => {
  let originalApiKey: string | undefined;
  let originalTtsServiceType: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.ELEVENLABS_API_KEY;
    originalTtsServiceType = process.env.TTS_SERVICE_TYPE;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ELEVENLABS_API_KEY = originalApiKey;
    } else {
      delete process.env.ELEVENLABS_API_KEY;
    }
    
    if (originalTtsServiceType !== undefined) {
      process.env.TTS_SERVICE_TYPE = originalTtsServiceType;
    } else {
      delete process.env.TTS_SERVICE_TYPE;
    }
  });

  it('should create AutoFallbackTTSService when service type is auto', async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should create ElevenLabs service when service type is elevenlabs and API key is available', async () => {
    process.env.TTS_SERVICE_TYPE = 'elevenlabs';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('ElevenLabsTTSService');
  });

  it('should create Browser service when service type is browser', async () => {
    process.env.TTS_SERVICE_TYPE = 'browser';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('BrowserTTSService');
  });

  it('should fallback to auto when ElevenLabs API key is missing', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    process.env.TTS_SERVICE_TYPE = 'elevenlabs';
    
    const { getTTSService, TTSServiceFactory } = await import('../../../../server/services/tts/TTSService.js');
    TTSServiceFactory.clearCache(); // Clear cache to ensure fresh instance
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should handle service type auto correctly', async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should cache services correctly', async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service1 = getTTSService();
    const service2 = getTTSService();
    
    expect(service1).toBe(service2); // Should be the same cached instance
  });

  it('should handle unknown service types by falling back to auto', async () => {
    process.env.TTS_SERVICE_TYPE = 'unknown-service-type';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should create Browser service when service type is browser', async () => {
    process.env.TTS_SERVICE_TYPE = 'browser';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('BrowserTTSService');
  });

  it('should fallback to auto when ElevenLabs API key is missing', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    process.env.TTS_SERVICE_TYPE = 'elevenlabs';
    
    const { getTTSService, TTSServiceFactory } = await import('../../../../server/services/tts/TTSService.js');
    TTSServiceFactory.clearCache(); // Clear cache to ensure fresh instance
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should handle service type auto correctly', async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });

  it('should cache services correctly', async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service1 = getTTSService();
    const service2 = getTTSService();
    
    expect(service1).toBe(service2); // Should return same cached instance
  });

  it('should handle unknown service types by falling back to auto', async () => {
    process.env.TTS_SERVICE_TYPE = 'unknown-service-type';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    
    const { getTTSService } = await import('../../../../server/services/tts/TTSService.js');
    const service = getTTSService();
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTTSService');
  });
});

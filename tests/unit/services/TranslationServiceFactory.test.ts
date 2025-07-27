/**
 * Unit Tests for TranslationServiceFactory Auto-Fallback
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranslationServiceFactory, getTranslationService } from '../../../server/services/translation/TranslationServiceFactory.js';

describe('TranslationServiceFactory Auto-Fallback', () => {
  let originalEnv: any;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear service cache for testing
    TranslationServiceFactory.getInstance().clearCache();
  });

  it('should create AutoFallbackTranslationService when service type is auto', () => {
    // Set environment to auto
    process.env.TRANSLATION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const factory = TranslationServiceFactory.getInstance();
    const service = factory.getService('auto');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranslationService');
  });

  it('should create OpenAI service when service type is openai and API key is available', () => {
    process.env.TRANSLATION_SERVICE_TYPE = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const factory = TranslationServiceFactory.getInstance();
    const service = factory.getService('openai');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('OpenAITranslationService');
  });

  it('should create MyMemory service when service type is mymemory', () => {
    process.env.TRANSLATION_SERVICE_TYPE = 'mymemory';
    
    const factory = TranslationServiceFactory.getInstance();
    const service = factory.getService('mymemory');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('MyMemoryTranslationService');
  });

  it('should fallback to auto when OpenAI API key is missing', () => {
    process.env.TRANSLATION_SERVICE_TYPE = 'openai';
    delete process.env.OPENAI_API_KEY;
    
    const factory = TranslationServiceFactory.getInstance();
    const service = factory.getService('openai');
    
    // Should fallback to auto service which includes MyMemory
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranslationService');
  });

  it('should handle service type auto correctly', () => {
    process.env.TRANSLATION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const service = getTranslationService();
    
    // Should create AutoFallbackTranslationService when explicitly set to auto
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranslationService');
  });

  it('should cache services correctly', () => {
    process.env.TRANSLATION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const factory = TranslationServiceFactory.getInstance();
    const service1 = factory.getService('auto');
    const service2 = factory.getService('auto');
    
    // Should return the same instance (cached)
    expect(service1).toBe(service2);
  });

  it('should handle unknown service types by falling back to auto', () => {
    const factory = TranslationServiceFactory.getInstance();
    const service = factory.getService('unknown-service-type');
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackTranslationService');
  });
});

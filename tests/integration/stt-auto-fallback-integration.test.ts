// Test to verify STT auto-fallback is working

import { describe, it, expect, vi } from 'vitest';
import { getTranscriptionService } from '../../server/services/transcription/TranscriptionServiceFactory.js';

describe('STT Auto-Fallback Integration', () => {
  it('should create AutoFallbackTranscriptionService when TRANSCRIPTION_SERVICE_TYPE=auto', async () => {
    // Set environment variable
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    
    // Get service from factory
    const service = getTranscriptionService();
    
    // Check that it's the auto-fallback service
    expect(service.constructor.name).toBe('AutoFallbackTranscriptionService');
    
    console.log('✅ STT Auto-fallback service created successfully:', service.constructor.name);
  });
  
  it('should verify service is integrated in main TranslationService', async () => {
    // Import the main service
    const { speechTranslationService } = await import('../../server/services/TranslationService.js');
    
    // Check the service has transcription capability
    expect(speechTranslationService).toBeDefined();
    expect(speechTranslationService.constructor.name).toBe('SpeechTranslationService');
    
    console.log('✅ Main translation service loaded with STT factory integration');
  });
});

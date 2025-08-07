// Test to verify STT factory creates correct service types without initializing

import { describe, it, expect, vi } from 'vitest';

describe('STT Factory Service Type Selection', () => {
  it('should create AutoFallbackTranscriptionService for auto type', async () => {
    vi.stubEnv('TRANSCRIPTION_SERVICE_TYPE', 'auto');
    const { getSTTTranscriptionService } = await import('../../../../server/services/stttranscription/TranscriptionServiceFactory');
    const service = getSTTTranscriptionService();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });
  
  it('should use environment variable for service type', async () => {
    vi.stubEnv('TRANSCRIPTION_SERVICE_TYPE', 'auto');
    const { getSTTTranscriptionService } = await import('../../../../server/services/stttranscription/TranscriptionServiceFactory');
    const service = getSTTTranscriptionService();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
    console.log('✅ getTranscriptionService correctly uses environment variable');
  });
});
// End of tests

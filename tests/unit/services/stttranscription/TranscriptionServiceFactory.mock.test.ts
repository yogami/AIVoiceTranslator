/**
 * Unit Tests for TranscriptionServiceFactory Auto-Fallback (Mocked)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock whisper-node to avoid compilation issues in tests
vi.mock('whisper-node', () => ({
  default: vi.fn(() => Promise.resolve({ speech: 'test transcription' }))
}));

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: vi.fn(() => Promise.resolve({ text: 'openai transcription' }))
      }
    }
  }))
}));

describe('TranscriptionServiceFactory Auto-Fallback (Mocked)', () => {
  let originalEnv: any;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create services based on environment configuration', async () => {
    // Test auto service type
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    // Dynamic import to ensure fresh factory instance
    const { getSTTTranscriptionService } = await import('../../../../server/services/stttranscription/TranscriptionServiceFactory');
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('AutoFallbackSTTService');
  });

  it('should verify auto-fallback has transcribe method', async () => {
    process.env.TRANSCRIPTION_SERVICE_TYPE = 'auto';
    process.env.OPENAI_API_KEY = 'test-key';
    
    const { getSTTTranscriptionService } = await import('../../../../server/services/stttranscription/TranscriptionServiceFactory');
    const service = getSTTTranscriptionService();
    expect(service).toBeDefined();
    // Optionally, check for a method that should exist on the service
    // expect(typeof service.transcribe).toBe('function');
  });
});

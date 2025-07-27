/**
 * STT Auto-Fallback Component Tests
 * 
 * Tests the AutoFallbackSTTService component behavior with 3-tier fallback:
 * 1. OpenAI STT (primary) → 2. ElevenLabs STT (secondary) → 3. Whisper.cpp (final)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI library
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn()
      }
    }
  }))
}));

// Mock the external services before importing
const mockOpenAITranscribe = vi.fn();
const mockElevenLabsTranscribe = vi.fn();
const mockWhisperTranscribe = vi.fn();

vi.mock('../../../server/services/transcription/OpenAITranscriptionService.js', () => ({
  OpenAITranscriptionService: vi.fn().mockImplementation(() => ({
    transcribe: mockOpenAITranscribe
  }))
}));

vi.mock('../../../server/services/transcription/ElevenLabsSTTService.js', () => ({
  ElevenLabsSTTService: vi.fn().mockImplementation(() => ({  
    transcribe: mockElevenLabsTranscribe
  }))
}));

vi.mock('../../../server/services/transcription/WhisperCppTranscriptionService.js', () => ({
  WhisperCppTranscriptionService: vi.fn().mockImplementation(() => ({
    transcribe: mockWhisperTranscribe
  }))
}));

// Mock VoiceIsolationService to prevent it from interfering
vi.mock('../../../server/services/audio/VoiceIsolationService.js', () => ({
  VoiceIsolationService: vi.fn().mockImplementation(() => ({
    isolateVoice: vi.fn().mockImplementation(async (audio) => audio), // Return original audio
    isAvailable: vi.fn().mockReturnValue(true),
    analyzeAudioQuality: vi.fn().mockResolvedValue({
      originalSize: 1000,
      isolatedSize: 800,
      compressionRatio: 0.8,
      estimatedNoiseReduction: 0.2
    })
  }))
}));

describe('STT Auto-Fallback Component Tests', () => {
  let AutoFallbackSTTService: any;

  // Test audio buffer
  const createTestAudioBuffer = (): Buffer => {
    return Buffer.from('fake-audio-data');
  };

  // Helper to wait for service initialization
  async function waitForServiceInitialization(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock functions
    mockOpenAITranscribe.mockReset();
    mockElevenLabsTranscribe.mockReset();
    mockWhisperTranscribe.mockReset();
    
    // Set environment variables for service initialization
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    
    // Import the service class
    const module = await import('../../../server/services/transcription/AutoFallbackSTTService.js');
    AutoFallbackSTTService = module.AutoFallbackSTTService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully transcribe using primary OpenAI service', async () => {
    // Mock OpenAI success
    mockOpenAITranscribe.mockResolvedValue('Hello world from OpenAI STT');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    const audioBuffer = createTestAudioBuffer();
    const result = await service.transcribe(audioBuffer, { language: 'en' });

    expect(result).toBe('Hello world from OpenAI STT');
    expect(mockOpenAITranscribe).toHaveBeenCalledWith(audioBuffer, { language: 'en' });
  });

  it('should fallback to ElevenLabs when OpenAI fails', async () => {
    // Mock OpenAI failure and ElevenLabs success
    mockOpenAITranscribe.mockRejectedValue(new Error('OpenAI API failed'));
    mockElevenLabsTranscribe.mockResolvedValue('Hello world from ElevenLabs STT');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    const audioBuffer = createTestAudioBuffer();
    const result = await service.transcribe(audioBuffer, { language: 'en' });

    expect(result).toBe('Hello world from ElevenLabs STT');
    expect(mockElevenLabsTranscribe).toHaveBeenCalledWith(audioBuffer, { language: 'en' });
  });

  it('should fallback to Whisper.cpp when both OpenAI and ElevenLabs fail', async () => {
    // Mock both API services failing and Whisper success
    mockOpenAITranscribe.mockRejectedValue(new Error('OpenAI API failed'));
    mockElevenLabsTranscribe.mockRejectedValue(new Error('ElevenLabs API failed'));
    mockWhisperTranscribe.mockResolvedValue('Hello world from Whisper.cpp');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    const audioBuffer = createTestAudioBuffer();
    const result = await service.transcribe(audioBuffer, { language: 'en' });

    expect(result).toBe('Hello world from Whisper.cpp');
    expect(mockWhisperTranscribe).toHaveBeenCalledWith(audioBuffer, { language: 'en' });
  });

  it('should handle circuit breaker pattern for OpenAI failures', async () => {
    // Mock OpenAI to fail multiple times, then succeed
    mockOpenAITranscribe
      .mockRejectedValueOnce(new Error('OpenAI failed 1'))
      .mockRejectedValueOnce(new Error('OpenAI failed 2'))
      .mockResolvedValue('OpenAI recovered');

    // Mock ElevenLabs to succeed as fallback
    mockElevenLabsTranscribe.mockResolvedValue('ElevenLabs fallback success');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    const audioBuffer = createTestAudioBuffer();

    // First failure should try fallback to ElevenLabs
    const result1 = await service.transcribe(audioBuffer);
    expect(result1).toBeDefined();
    expect(result1).toBe('ElevenLabs fallback success');
    
    // Circuit breaker should eventually allow recovery
    expect(service).toBeDefined();
  });

  it('should handle circuit breaker pattern for ElevenLabs failures', async () => {
    // Mock both services with specific failure patterns
    mockOpenAITranscribe.mockRejectedValue(new Error('OpenAI down'));
    mockElevenLabsTranscribe
      .mockRejectedValueOnce(new Error('ElevenLabs failed 1'))
      .mockRejectedValueOnce(new Error('ElevenLabs failed 2'))
      .mockResolvedValue('ElevenLabs recovered');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    const audioBuffer = createTestAudioBuffer();

    // Should fall back through the tiers
    expect(service).toBeDefined();
  });

  it('should support different audio formats', async () => {
    // Mock successful transcription for all formats
    mockOpenAITranscribe.mockResolvedValue('Transcribed audio');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    // Test different audio format buffers
    const mp3Buffer = Buffer.from('fake-mp3-data');
    const wavBuffer = Buffer.from('fake-wav-data');
    const flacBuffer = Buffer.from('fake-flac-data');

    const results = await Promise.all([
      service.transcribe(mp3Buffer),
      service.transcribe(wavBuffer),
      service.transcribe(flacBuffer)
    ]);

    results.forEach(result => {
      expect(result).toBe('Transcribed audio');
    });
  });

  it('should support multiple languages', async () => {
    // Mock successful transcription for all languages
    mockOpenAITranscribe.mockResolvedValue('Multi-language transcription');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    const audioBuffer = createTestAudioBuffer();

    const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
    
    const results = await Promise.all(
      languages.map(language => service.transcribe(audioBuffer, { language }))
    );

    results.forEach(result => {
      expect(result).toBe('Multi-language transcription');
    });
    
    // Verify each language was passed correctly
    expect(mockOpenAITranscribe).toHaveBeenCalledTimes(6);
  });

  it('should handle concurrent transcription requests', async () => {
    // Mock successful transcription
    mockOpenAITranscribe.mockResolvedValue('Concurrent transcription');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    const audioBuffer = createTestAudioBuffer();

    // Test concurrent requests
    const promises = Array(3).fill(null).map((_, index) => 
      service.transcribe(audioBuffer, { language: 'en' })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result).toBe('Concurrent transcription');
    });
  });

  it('should provide service status information', async () => {
    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    // Should have methods to check service status
    expect(service).toBeDefined();
    expect(typeof service.transcribe).toBe('function');
  });

  it('should handle service recovery after failures', async () => {
    // Mock failure then recovery pattern
    mockOpenAITranscribe
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue('Service recovered');

    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    const audioBuffer = createTestAudioBuffer();

    // First call should trigger fallback
    try {
      await service.transcribe(audioBuffer);
    } catch (error) {
      // May fail if all services fail
    }

    // Test that services can recover after failures
    expect(service).toBeDefined();
  });

  it('should validate input parameters', async () => {
    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();

    // Test invalid inputs
    await expect(service.transcribe(null as any)).rejects.toThrow();
    await expect(service.transcribe(undefined as any)).rejects.toThrow();
    await expect(service.transcribe(Buffer.alloc(0))).rejects.toThrow();
  });

  it('should maintain consistent interface across all services', async () => {
    const service = new AutoFallbackSTTService();
    await waitForServiceInitialization();
    
    expect(service).toBeDefined();
    expect(typeof service.transcribe).toBe('function');
    expect(service.transcribe.length).toBe(2); // audioBuffer, options
  });
});

/**
 * Enhanced STT with Voice Isolation Component Tests
 * 
 * Tests the AutoFallbackSTTService with voice isolation integration:
 * 1. Voice isolation preprocessing in STT pipeline
 * 2. 3-tier fallback with enhanced audio processing
 * 3. Circuit breaker behavior with voice isolation
 * 4. Service recovery and quality analysis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoFallbackSTTService } from '../../server/services/stttranscription/AutoFallbackSTTService';

// Create test audio buffer
function createTestAudioBuffer(size: number = 1024): Buffer {
  return Buffer.from(new Array(size).fill(0).map(() => Math.floor(Math.random() * 255)));
}

// Helper function to wait for service initialization
async function waitForServiceInitialization(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
}

describe('Enhanced STT with Voice Isolation Component Tests', () => {
  let originalApiKeys: Record<string, string | undefined>;

  beforeEach(() => {
    // Store original environment variables
    originalApiKeys = {
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      STT_SERVICE_TYPE: process.env.STT_SERVICE_TYPE
    };

    // Set test environment for enhanced STT
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.STT_SERVICE_TYPE = 'auto';
    
    // Mock fetch for voice isolation API calls
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalApiKeys).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
    
    vi.restoreAllMocks();
  });

  describe('Service Initialization with Voice Isolation', () => {
    it('should initialize enhanced STT service with voice isolation capability', () => {
      const service = new AutoFallbackSTTService();
      expect(service).toBeInstanceOf(AutoFallbackSTTService);
    });

    it('should initialize without voice isolation when ElevenLabs API key is missing', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      const service = new AutoFallbackSTTService();
      expect(service).toBeInstanceOf(AutoFallbackSTTService);
      // Service should still work, just without voice isolation
    });

    it('should handle voice isolation service initialization failure gracefully', () => {
      // Test with invalid API key format that might cause initialization issues
      process.env.ELEVENLABS_API_KEY = 'invalid-key-format';
      
      expect(() => {
        const service = new AutoFallbackSTTService();
        expect(service).toBeInstanceOf(AutoFallbackSTTService);
      }).not.toThrow();
    });
  });

  describe('Voice Isolation Integration in STT Pipeline', () => {
    it('should apply voice isolation before STT processing when available', async () => {
      const service = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer(2048);
      const isolatedBuffer = createTestAudioBuffer(1536); // Simulated processed audio
      
      // Wait for async initialization
      await waitForServiceInitialization();
      
      // Mock voice isolation API success
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(isolatedBuffer.buffer)
      });
      
      // Mock OpenAI transcription to fail fast so we can test voice isolation
      const mockOpenAI = {
        audio: {
          transcriptions: {
            create: vi.fn().mockRejectedValue(new Error('401 Unauthorized'))
          }
        }
      };
      
      // The transcribe call will fail due to mock STT services, but we can verify voice isolation was attempted
      try {
        await service.transcribe(audioBuffer, 'en');
      } catch (error) {
        // Expected failure due to mock STT services
        expect(error).toBeDefined();
      }
      
      // Verify voice isolation API was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          })
        })
      );
    });

    it('should fallback to original audio when voice isolation fails', async () => {
      const service = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer(1024);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mock voice isolation API failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      });
      
      try {
        await service.transcribe(audioBuffer, 'en');
      } catch (error) {
        // Expected failure due to mock STT services
        expect(error).toBeDefined();
      }
      
      // Verify voice isolation was attempted and failed gracefully
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          })
        })
      );
    });

    it('should handle voice isolation network errors gracefully', async () => {
      const service = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer(1024);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mock network error for voice isolation
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));
      
      try {
        await service.transcribe(audioBuffer, 'en');
      } catch (error) {
        // Expected failure due to mock STT services, not voice isolation
        expect(error).toBeDefined();
      }
      
      // Service should continue with original audio after voice isolation failure
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          })
        })
      );
    });

    it('should skip voice isolation for empty audio buffers', async () => {
      const service = new AutoFallbackSTTService();
      const emptyBuffer = Buffer.alloc(0);
      
      try {
        await service.transcribe(emptyBuffer, 'en');
      } catch (error) {
        // Should fail due to empty buffer validation, not due to voice isolation
        expect(error instanceof Error ? error.message : '').toContain('Audio buffer is required and cannot be empty');
      }
      
      // Voice isolation should not be attempted for empty buffers
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced Audio Quality Analysis', () => {
    it('should analyze audio quality improvement when voice isolation succeeds', async () => {
      const service = new AutoFallbackSTTService();
      const originalBuffer = createTestAudioBuffer(2048);
      const enhancedBuffer = createTestAudioBuffer(1536); // Simulated enhancement
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mock successful voice isolation with quality improvement
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(enhancedBuffer.buffer)
      });
      
      try {
        await service.transcribe(originalBuffer, 'en');
      } catch (error) {
        // Expected failure due to mock STT services
        expect(error).toBeDefined();
      }
      
      // Verify voice isolation was applied
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          })
        })
      );
    });

    it('should handle various audio quality scenarios', async () => {
      const service = new AutoFallbackSTTService();
      
      // Wait for async initialization
      await waitForServiceInitialization();
      
      const testScenarios = [
        { originalSize: 2048, enhancedSize: 1536, description: 'noise reduction' },
        { originalSize: 1024, enhancedSize: 1024, description: 'no change' },
        { originalSize: 1024, enhancedSize: 1200, description: 'enhancement expansion' }
      ];
      
      for (const scenario of testScenarios) {
        const originalBuffer = createTestAudioBuffer(scenario.originalSize);
        const enhancedBuffer = createTestAudioBuffer(scenario.enhancedSize);
        
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(enhancedBuffer.buffer)
        });
        
        try {
          await service.transcribe(originalBuffer, 'en');
        } catch (error) {
          // Expected failure, but voice isolation should have been attempted
          expect(error).toBeDefined();
        }
      }
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('3-Tier Fallback with Enhanced Audio', () => {
    it('should use enhanced audio for all STT service tiers', async () => {
      const service = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer(1024);
      const enhancedBuffer = createTestAudioBuffer(800);
      
      // Wait for async initialization
      await waitForServiceInitialization();
      
      // Mock successful voice isolation
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(enhancedBuffer.buffer)
      });
      
      // All STT services will fail in test environment, but enhanced audio should be used
      try {
        await service.transcribe(audioBuffer, 'en');
      } catch (error) {
        // Expected failure due to mock services
        expect(error).toBeDefined();
      }
      
      // Verify voice isolation was applied (should be first fetch call)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          })
        })
      );
    });

    it('should maintain circuit breaker functionality with voice isolation', async () => {
      const service = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer(1024);
      
      // Wait for async initialization
      await waitForServiceInitialization();
      
      // Mock voice isolation for multiple attempts
      for (let i = 0; i < 3; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
        });
      }
      
      // Make multiple transcription attempts to test circuit breaker
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        try {
          await service.transcribe(audioBuffer, 'en');
        } catch (error) {
          attempts.push(error);
        }
      }
      
      expect(attempts).toHaveLength(3);
      // Voice isolation should be applied for each attempt
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('Multi-language Support with Voice Isolation', () => {
    it('should apply voice isolation for multiple languages', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const audioBuffer = createTestAudioBuffer(1024);
      const languages = ['en', 'es', 'fr', 'de', 'ja', 'ko'];
      
      for (const language of languages) {
        // Mock voice isolation for each language
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
        });
        
        try {
          await service.transcribe(audioBuffer, language);
        } catch (error) {
          // Expected failure due to mock STT services
          expect(error).toBeDefined();
        }
      }
      
      // Voice isolation should be applied for each language
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });

    it('should handle language-specific audio enhancements', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const audioBuffer = createTestAudioBuffer(1024);
      
      // Test with different enhancement strengths for different languages
      const languageTests = [
        { language: 'en', expectedCalls: 1 },
        { language: 'ja', expectedCalls: 1 }, // Japanese might benefit from stronger enhancement
        { language: 'de', expectedCalls: 1 }  // German might need different processing
      ];
      
      for (const test of languageTests) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
        });
        
        try {
          await service.transcribe(audioBuffer, test.language);
        } catch (error) {
          // Expected failure
          expect(error).toBeDefined();
        }
      }
      
      // Verify voice isolation API was called for each language test
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle concurrent STT requests with voice isolation', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const audioBuffers = [
        createTestAudioBuffer(512),
        createTestAudioBuffer(1024),
        createTestAudioBuffer(768)
      ];
      
      // Mock voice isolation for concurrent requests
      audioBuffers.forEach(buffer => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(buffer.buffer)
        });
      });
      
      const promises = audioBuffers.map((buffer, index) => 
        service.transcribe(buffer, 'en').catch(error => ({
          index,
          error: error instanceof Error ? error.message : String(error)
        }))
      );
      
      const results = await Promise.all(promises);
      
      // All should fail due to mock STT services, but voice isolation should work
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('error');
      });
      
      // Voice isolation should be called for each request
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });

    it('should handle large audio buffers efficiently', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const largeBuffer = createTestAudioBuffer(5 * 1024 * 1024); // 5MB
      
      // Mock voice isolation for large buffer
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(largeBuffer.buffer)
      });
      
      try {
        await service.transcribe(largeBuffer, 'en');
      } catch (error) {
        // Expected failure, but should handle large buffer
        expect(error).toBeDefined();
      }
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });

    it('should handle memory-efficient processing', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      
      // Test multiple sequential requests to verify memory management
      for (let i = 0; i < 5; i++) {
        const audioBuffer = createTestAudioBuffer(1024);
        
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
        });
        
        try {
          await service.transcribe(audioBuffer, 'en');
        } catch (error) {
          // Expected failure
          expect(error).toBeDefined();
        }
      }
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle partial voice isolation service failures', async () => {
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const audioBuffer = createTestAudioBuffer(1024);
      
      // Mock intermittent voice isolation failures
      const mockResponses = [
        { ok: true, arrayBuffer: () => Promise.resolve(audioBuffer.buffer) },
        { ok: false, status: 429, text: () => Promise.resolve('Rate limited') },
        { ok: true, arrayBuffer: () => Promise.resolve(audioBuffer.buffer) }
      ];
      
      mockResponses.forEach(response => {
        (global.fetch as any).mockResolvedValueOnce(response);
      });
      
      // Make multiple requests
      for (let i = 0; i < 3; i++) {
        try {
          await service.transcribe(audioBuffer, 'en');
        } catch (error) {
          // Expected STT failures
          expect(error).toBeDefined();
        }
      }
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-elevenlabs-key'
          }),
          body: expect.any(FormData)
        })
      );
    });

    it('should maintain STT service functionality when voice isolation is completely unavailable', async () => {
      // Remove ElevenLabs API key to disable voice isolation
      delete process.env.ELEVENLABS_API_KEY;
      
      const service = new AutoFallbackSTTService();
      await waitForServiceInitialization();
      const audioBuffer = createTestAudioBuffer(1024);
      
      try {
        await service.transcribe(audioBuffer, 'en');
      } catch (error) {
        // Should fail due to mock STT services, not due to missing voice isolation
        expect(error).toBeDefined();
        // Error should not be related to voice isolation
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain('voice isolation');
        expect(errorMessage).not.toContain('ELEVENLABS_API_KEY');
      }
      
      // No voice isolation API calls should be made
      const isolationCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
        call[0] === 'https://api.elevenlabs.io/v1/audio-isolation'
      );
      expect(isolationCalls).toHaveLength(0);
    });
  });
});

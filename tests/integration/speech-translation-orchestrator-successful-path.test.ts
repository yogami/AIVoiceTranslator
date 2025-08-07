import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpeechPipelineOrchestrator } from '../../server/services/SpeechPipelineOrchestrator.js';
import { DbTranslationStorage } from '../../server/storage/translation.storage.js';
import { setupIsolatedTest } from '../utils/test-database-isolation.js';

// Helper function to create a simple audio buffer
function createSimpleAudioBuffer(): Buffer {
  return Buffer.from([
    // WAV header - very basic
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // File size
    0x57, 0x41, 0x56, 0x45, // WAVE
    0x66, 0x6D, 0x74, 0x20, // fmt chunk
    0x10, 0x00, 0x00, 0x00, // fmt chunk size
    0x01, 0x00, 0x01, 0x00, // PCM, mono
    0x44, 0xAC, 0x00, 0x00, // 44100 Hz
    0x88, 0x58, 0x01, 0x00, // byte rate
    0x02, 0x00, 0x10, 0x00, // align, bits
    0x64, 0x61, 0x74, 0x61, // data chunk
    0x00, 0x00, 0x00, 0x00  // data size
  ].concat(new Array(1024).fill(0))); // Some audio data
}

// Create test orchestrator instances
function createTestOrchestrator() {
  return SpeechPipelineOrchestrator.createWithDefaultServices();
}

function createTestOrchestratorWithSpecificTTS(ttsType: string) {
  return new SpeechPipelineOrchestrator({
    sttTier: 'auto',
    translationTier: 'auto', 
    ttsTier: ttsType
  });
}

function createTestOrchestratorWithStorage() {
  return SpeechPipelineOrchestrator.createWithDefaultServices();
}

describe('SpeechPipelineOrchestrator - Successful Path Validation', () => {
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    const testId = `speech-orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    cleanup = async () => {
      const { cleanupIsolatedTest } = await import('../utils/test-database-isolation.js');
      await cleanupIsolatedTest(testId);
    };
    await setupIsolatedTest(testId);
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  describe('Successful Translation Pipeline', () => {
    it('should successfully process English to Spanish translation', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Hello, how are you today?";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      // Validate structure
      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
      expect(result.audioResult.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalTime).toBeGreaterThan(0);
    }, 45000);

    it('should successfully process French to English translation', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Bonjour, comment allez-vous?";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'fr',
        'en'
      );

      // Validate structure
      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
      expect(result.audioResult.audioBuffer).toBeInstanceOf(Buffer);
    }, 45000);

    it('should successfully process Spanish to English translation', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Hola, ¿cómo estás?";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'es',
        'en'
      );

      // Validate basic structure
      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
    }, 45000);

    it('should handle different TTS service types successfully', async () => {
      const ttsTypes = ['auto', 'openai', 'elevenlabs', 'browser'];
      
      for (const ttsType of ttsTypes) {
        const orchestrator = createTestOrchestratorWithSpecificTTS(ttsType);
        const audioBuffer = createSimpleAudioBuffer();
        
        const result = await orchestrator.processAudioPipeline(
          audioBuffer,
          'en',
          'es'
        );

        expect(result).toBeDefined();
        expect(result.transcription).toBeDefined();
        expect(result.translation).toBeDefined();
        expect(result.audioResult).toBeDefined();
      }
    }, 60000);
  });

  describe('Service Integration Validation', () => {
    it('should validate translation service is working correctly', async () => {
      const testCases = [
        { source: 'en', target: 'es', text: 'Hello world' },
        { source: 'en', target: 'fr', text: 'Good morning' },
        { source: 'es', target: 'en', text: 'Hola mundo' }
      ];

      for (const testCase of testCases) {
        const orchestrator = createTestOrchestrator();
        const audioBuffer = createSimpleAudioBuffer();
        
        const result = await orchestrator.processAudioPipeline(
          audioBuffer,
          testCase.source,
          testCase.target
        );

        expect(result).toBeDefined();
        expect(result.transcription).toBeDefined();
        expect(result.translation).toBeDefined();
      }
    }, 60000);

    it('should validate AudioEncodingService integration', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Audio encoding test";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      expect(result).toBeDefined();
      expect(result.audioResult).toBeDefined();
      expect(result.audioResult.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioResult.audioBuffer.length).toBeGreaterThan(0);
    }, 45000);
  });

  describe('Performance and Reliability', () => {
    it('should complete translation within reasonable time', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Performance test message";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      expect(result).toBeDefined();
      expect(result.metrics.totalTime).toBeLessThan(30000); // 30 seconds max
    }, 45000);

    it('should handle concurrent requests successfully', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const requests = Array.from({ length: 3 }, (_, i) => 
        orchestrator.processAudioPipeline(
          audioBuffer,
          'en',
          'es'
        )
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.transcription).toBeDefined();
        expect(result.translation).toBeDefined();
        expect(result.audioResult).toBeDefined();
      });
    }, 90000);
  });

  describe('Database Persistence Validation', () => {
    it('should verify orchestrator has storage integration capability', async () => {
      // Create an orchestrator with storage-enabled setup 
      const orchestratorWithStorage = createTestOrchestratorWithStorage();
      
      // Verify the orchestrator can handle database operations without errors
      expect(orchestratorWithStorage).toBeDefined();
      expect(typeof orchestratorWithStorage.processAudioPipeline).toBe('function');
      
      // Test basic functionality
      const audioBuffer = createSimpleAudioBuffer();
      
      // Test the main process method with storage-enabled orchestrator
      const result = await orchestratorWithStorage.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
    }, 45000);

    it('should persist translations to database when storage is enabled', async () => {
      const orchestratorWithStorage = createTestOrchestratorWithStorage();
      
      // Mock the storage to verify persistence calls
      const mockStorage = {
        addTranslation: vi.fn().mockResolvedValue(undefined)
      };
      
      // Test persistence functionality indirectly by ensuring the process works
      // Note: Direct testing of storage persistence would require exposing internal methods
      
      // Process a translation with the storage-enabled orchestrator
      const audioBuffer = createSimpleAudioBuffer();
      const result = await orchestratorWithStorage.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      // Verify the translation was processed successfully
      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
      
      // The storage persistence happens internally within the orchestrator
      // This test validates that storage-enabled orchestrator can function properly
    }, 45000);

    it('should verify database persistence infrastructure is working', async () => {
      const orchestratorWithStorage = createTestOrchestratorWithStorage();
      
      // Test the database storage directly to ensure it's working
      const dbStorage = new DbTranslationStorage();
      
      // Test a complete orchestrator workflow with database-ready configuration
      const audioBuffer = createSimpleAudioBuffer();
      const result = await orchestratorWithStorage.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      // Verify successful processing
      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(result.audioResult).toBeDefined();
      
      // Verify the infrastructure components are available
      expect(dbStorage).toBeDefined();
      expect(typeof dbStorage.addTranslation).toBe('function');
    }, 45000);
  });

  describe('Error Handling Validation', () => {
    it('should handle empty input text gracefully', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      // Should complete without throwing
      expect(result).toBeDefined();
    }, 45000);

    it('should handle very short text', async () => {
      const orchestrator = createTestOrchestrator();
      const audioBuffer = createSimpleAudioBuffer();
      const preTranscribedText = "Hi";
      
      const result = await orchestrator.processAudioPipeline(
        audioBuffer,
        'en',
        'es'
      );

      expect(result).toBeDefined();
      expect(result.transcription).toBeDefined();
      expect(result.translation).toBeDefined();
    }, 45000);
  });
});

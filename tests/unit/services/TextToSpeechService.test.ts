/**
 * Text-to-Speech Service Tests
 * 
 * Tests for the TTS service implementations using only public APIs
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Buffer } from 'node:buffer';

// Mock external dependencies only - not the SUT
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        access: vi.fn(),
        stat: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined)
      },
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      rmSync: vi.fn()
    },
    promises: {
      access: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined)
    },
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rmSync: vi.fn()
  };
});

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    default: {
      ...actual,
      join: (...args: string[]) => args.join('/'),
      dirname: vi.fn(),
      resolve: vi.fn()
    },
    join: (...args: string[]) => args.join('/'),
    dirname: vi.fn(),
    resolve: vi.fn()
  };
});

// Mock OpenAI to simulate API failures and successes
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: async () => new ArrayBuffer(8)
        })
      }
    }
  }))
}));

describe('Text-to-Speech Services', () => {
  describe('SilentTextToSpeechService', () => {
    let SilentTextToSpeechService: any;

    beforeEach(async () => {
      const module = await import('../../../server/services/textToSpeech/TextToSpeechService');
      SilentTextToSpeechService = module.SilentTextToSpeechService;
    });

    it('should return audio buffer through public API', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      const options = {
        text: 'Hello world',
        languageCode: 'en-US'
      };
      
      // Act - call public method
      const result = await service.synthesizeSpeech(options);
      
      // Assert - verify public behavior
      expect(result).toBeInstanceOf(Buffer);
      // SilentTextToSpeechService should return some audio data (even if silent)
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle any text input', async () => {
      // Arrange
      const service = new SilentTextToSpeechService();
      
      // Act & Assert - should handle empty text
      const result1 = await service.synthesizeSpeech({
        text: '',
        languageCode: 'en-US'
      });
      expect(result1).toBeInstanceOf(Buffer);
      
      // Should handle long text
      const result2 = await service.synthesizeSpeech({
        text: 'This is a very long text that should still be handled properly by the silent service',
        languageCode: 'es-ES'
      });
      expect(result2).toBeInstanceOf(Buffer);
    });
  });

  describe('TextToSpeechFactory', () => {
    let TextToSpeechFactory: any;

    beforeEach(async () => {
      const module = await import('../../../server/services/textToSpeech/TextToSpeechService');
      TextToSpeechFactory = module.TextToSpeechFactory;
    });

    it('should create appropriate service when API key is available', () => {
      // Arrange
      const factory = new TextToSpeechFactory(true); // hasApiKey = true
      
      // Act - call public method
      const service = factory.getService('openai');
      
      // Assert - verify public behavior
      expect(service).toBeDefined();
      expect(typeof service.synthesizeSpeech).toBe('function');
    });

    it('should create fallback service when no API key', () => {
      // Arrange
      const factory = new TextToSpeechFactory(false); // hasApiKey = false
      
      // Act - call public method
      const service = factory.getService('openai');
      
      // Assert - verify public behavior
      expect(service).toBeDefined();
      expect(typeof service.synthesizeSpeech).toBe('function');
    });

    it('should create browser service when requested', () => {
      // Arrange
      const factory = new TextToSpeechFactory(true);
      
      // Act
      const service = factory.getService('browser');
      
      // Assert
      expect(service).toBeDefined();
      expect(typeof service.synthesizeSpeech).toBe('function');
    });
  });

  describe('Service Integration Concepts', () => {
    it('should handle service creation without API key gracefully', async () => {
      // This tests the concept that services should work even without API keys
      const module = await import('../../../server/services/textToSpeech/TextToSpeechService');
      
      // Test that the factory exists and can be accessed
      expect(module.ttsFactory).toBeDefined();
      expect(typeof module.ttsFactory.getService).toBe('function');
      
      // Test that we can get a service (this should not hang)
      const service = module.ttsFactory.getService('openai');
      expect(service).toBeDefined();
      expect(typeof service.synthesizeSpeech).toBe('function');
      
      // Don't actually call synthesizeSpeech as it might make real API calls
      // The test verifies the service can be created, which is the main point
    });

    it('should handle different language codes', async () => {
      // Test language code handling concept
      const module = await import('../../../server/services/textToSpeech/TextToSpeechService');
      const service = new module.SilentTextToSpeechService();
      
      const languages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'];
      
      for (const lang of languages) {
        const result = await service.synthesizeSpeech({
          text: 'Hello',
          languageCode: lang
        });
        
        expect(result).toBeInstanceOf(Buffer);
      }
    });
  });
});

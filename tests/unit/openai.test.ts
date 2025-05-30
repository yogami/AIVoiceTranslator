/**
 * OpenAI Service Unit Tests
 * 
 * Tests for OpenAI integration functionality with properly mocked external dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAudioBuffer, createMockWebSocketClient } from './utils/test-helpers';

// Mock only the external OpenAI dependency
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Test transcription' })
      },
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: async () => new ArrayBuffer(1000)
        })
      }
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test translation' } }]
        })
      }
    }
  }))
}));

describe('OpenAI Service', () => {
  let translateSpeech: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import the REAL implementation after mocks are set up
    const module = await import('../../server/openai');
    translateSpeech = module.translateSpeech;
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('translateSpeech - Real Implementation', () => {
    it('should translate audio successfully when valid input provided', async () => {
      const audioBuffer = createMockAudioBuffer(1000);
      const sourceLang = 'en-US';
      const targetLang = 'es-ES';
      
      const result = await translateSpeech(audioBuffer, sourceLang, targetLang);
      
      expect(result).toEqual({
        originalText: 'Test transcription',
        translatedText: 'Test translation',
        audioBuffer: expect.any(Buffer)
      });
    });

    it('should use pre-transcribed text when provided', async () => {
      const audioBuffer = createMockAudioBuffer(1000);
      const preTranscribedText = 'Pre-transcribed text';
      
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'fr-FR',
        preTranscribedText
      );
      
      expect(result.originalText).toBe(preTranscribedText);
      expect(result.translatedText).toBe('Test translation');
    });

    it('should skip translation when source and target languages are the same', async () => {
      const audioBuffer = createMockAudioBuffer(1000);
      const language = 'en-US';
      
      const result = await translateSpeech(audioBuffer, language, language);
      
      expect(result.originalText).toBe('Test transcription');
      expect(result.translatedText).toBe('Test transcription');
    });

    it('should handle empty transcription', async () => {
      // Mock empty transcription
      const OpenAI = (await import('openai')).default;
      const mockInstance = new OpenAI();
      vi.mocked(mockInstance.audio.transcriptions.create).mockResolvedValueOnce({ text: '' });
      
      const audioBuffer = createMockAudioBuffer(1000);
      const result = await translateSpeech(audioBuffer, 'en-US', 'es-ES');
      
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
    });
  });

  describe('Streaming Functionality - Real Implementation', () => {
    it('should handle streaming audio processing', async () => {
      const mockWs = createMockWebSocketClient();
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      
      // Import real streaming functions
      const streamingModule = await import('../../server/openai-streaming');
      const { processStreamingAudio } = streamingModule;
      
      // Test real implementation
      const result = await processStreamingAudio(
        mockWs,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      expect(result).toBe(true);
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
});
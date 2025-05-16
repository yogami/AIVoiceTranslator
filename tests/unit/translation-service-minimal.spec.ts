/**
 * Minimal Translation Service Tests (Vitest Version)
 * 
 * A simple test for the translation service
 */
import { describe, it, expect, vi } from 'vitest';
import { Buffer } from 'buffer';

// We have to mock OpenAI first - using inline values to prevent hoisting issues
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Mocked transcription'
        })
      }
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mocked translation'
              }
            }
          ]
        })
      }
    }
  }))
}));

// Mock TextToSpeechService with inline values
vi.mock('../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio'))
  },
  ttsFactory: {
    getService: vi.fn(() => ({
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio'))
    }))
  }
}));

// Import the module under test after mocking
import { translateSpeech } from '../../server/services/TranslationService';

describe('Translation Service', () => {
  it('should return translated speech', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage
    );
    
    // Assert
    expect(result).toBeDefined();
    expect(result.originalText).toBeDefined();
    expect(result.translatedText).toBeDefined();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
});
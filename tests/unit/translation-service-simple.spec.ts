/**
 * Simple Translation Service Tests (Vitest Version)
 * 
 * A simplified approach to test the TranslationService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Define mock functions early to avoid hoisting issues
const mockTranscribe = vi.fn().mockResolvedValue('Mocked transcription');
const mockTranslate = vi.fn().mockResolvedValue('Mocked translation');
const mockSynthesize = vi.fn().mockResolvedValue(Buffer.from('mock audio'));

// Mock modules before importing the service
vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Mocked transcription from OpenAI'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked translation from OpenAI'
                }
              }
            ]
          })
        }
      }
    }))
  };
});

// Simple mock for TTS service
vi.mock('../../server/services/TextToSpeechService', () => {
  return {
    textToSpeechService: {
      synthesizeSpeech: mockSynthesize
    },
    ttsFactory: {
      getService: vi.fn(() => ({
        synthesizeSpeech: mockSynthesize
      }))
    }
  };
});

// Import after all mocks are defined
import { translateSpeech } from '../../server/services/TranslationService';

describe('Translation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should translate speech using the translate function', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
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
  
  it('should accept preTranscribed text', async () => {
    // Arrange
    const audioBuffer = Buffer.from('test audio data');
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    const preTranscribedText = 'Pre-transcribed test text';
    
    // Act
    const result = await translateSpeech(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );
    
    // Assert
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBeDefined();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
  });
});
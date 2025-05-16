/**
 * TranslationService Tests
 * 
 * This file tests the translation functionality without mocking the SUT.
 * Following the principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock external dependencies only, not the SUT
vi.mock('path', () => ({
  dirname: vi.fn(() => '/mocked/dir'),
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => args.join('/'))
}));

vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mocked/file')
}));

vi.mock('fs', () => ({
  createReadStream: vi.fn(() => 'mock-read-stream'),
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1024, mtime: new Date() })
  }
}));

vi.mock('dotenv', () => ({
  config: vi.fn()
}));

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a test transcription'
          })
        }
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'This is a translated test response' } }]
          })
        }
      }
    }))
  };
});

// Mock TextToSpeechService
vi.mock('../../../server/services/TextToSpeechService', () => ({
  textToSpeechService: {
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
  },
  ttsFactory: {
    getService: vi.fn().mockReturnValue({
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
    })
  }
}));

// Mock storage
vi.mock('../../../server/storage', () => ({
  storage: {
    addTranslation: vi.fn().mockResolvedValue({ id: 1 }),
    getLanguageByCode: vi.fn().mockResolvedValue({ name: 'English', code: 'en-US' })
  }
}));

// Import the module under test - we import it AFTER setting up mocks
import { translateSpeech } from '../../../server/services/TranslationService';

describe('TranslationService', () => {
  // Create all the mocks inside the test class
  const mockTranscribe = vi.fn().mockResolvedValue({
    text: 'This is a test transcription'
  });
  
  const mockCompletion = vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'This is a translated test response' } }]
  });
  
  const mockSynthesizeSpeech = vi.fn().mockResolvedValue(Buffer.from('mock audio data'));
  
  // Mock OpenAI
  vi.mock('openai', () => {
    return {
      default: vi.fn().mockImplementation(() => ({
        audio: {
          transcriptions: {
            create: mockTranscribe
          }
        },
        chat: {
          completions: {
            create: mockCompletion
          }
        }
      }))
    };
  });
  
  // Mock TextToSpeechService
  vi.mock('../../../server/services/TextToSpeechService', () => ({
    textToSpeechService: {
      synthesizeSpeech: mockSynthesizeSpeech
    }
  }));
  
  // Mock storage
  vi.mock('../../../server/storage', () => ({
    storage: {
      addTranslation: vi.fn().mockResolvedValue({ id: 1 }),
      getLanguageByCode: vi.fn().mockResolvedValue({ name: 'English', code: 'en-US' })
    }
  }));
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });
  
  describe('Basic Translation', () => {
    it('should translate speech from audio input', async () => {
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
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a translated test response');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify mock calls
      expect(mockTranscribe).toHaveBeenCalled();
      expect(mockCompletion).toHaveBeenCalled();
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a translated test response',
          languageCode: targetLanguage
        })
      );
    });
    
    it('should skip transcription when text is provided', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en-US';
      const targetLanguage = 'es-ES';
      const preTranscribedText = 'Pre-transcribed test content';
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        sourceLanguage,
        targetLanguage,
        preTranscribedText
      );
      
      // Assert
      expect(result.originalText).toBe(preTranscribedText);
      expect(result.translatedText).toBe('This is a translated test response');
      
      // Verify mock calls
      expect(mockTranscribe).not.toHaveBeenCalled();
      expect(mockSynthesizeSpeech).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      // Arrange - Make the OpenAI transcription call fail
      mockTranscribe.mockRejectedValueOnce(new Error('Transcription API Error'));
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should handle the error and return empty strings
      expect(result).toBeDefined();
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify TTS was still called (with empty string)
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle translation errors gracefully', async () => {
      // Arrange - Make the OpenAI completion (translation) call fail
      mockCompletion.mockRejectedValueOnce(new Error('Translation API Error'));
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should return original text but empty translated text
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('');
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      
      // Verify TTS was still called (with empty string)
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          languageCode: 'es-ES'
        })
      );
    });
    
    it('should handle TTS errors gracefully', async () => {
      // Arrange - Make the TTS call fail
      mockSynthesizeSpeech.mockRejectedValueOnce(new Error('TTS API Error'));
      
      // Act
      const audioBuffer = Buffer.from('test audio data');
      const result = await translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      // Assert - Should return empty audio buffer
      expect(result).toBeDefined();
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a translated test response');
      expect(result.audioBuffer).toEqual(Buffer.from(''));
    });
  });
  
  describe('Language Handling', () => {
    it('should skip translation when source and target languages are the same', async () => {
      // Arrange
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      // Act
      const result = await translateSpeech(
        audioBuffer,
        language,
        language
      );
      
      // Assert
      expect(result.originalText).toBe('This is a test transcription');
      expect(result.translatedText).toBe('This is a test transcription');
      
      // Translation API should not be called when languages are the same
      expect(mockCompletion).not.toHaveBeenCalled();
      
      // TTS should still be called
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a test transcription',
          languageCode: language
        })
      );
    });
  });
});
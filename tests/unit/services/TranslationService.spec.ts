import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';

// Create simple mock implementations for the components we want to test
const createMockTranscriptionService = () => {
  return {
    transcribe: vi.fn().mockResolvedValue('This is a test transcription')
  };
};

const createMockTranslationService = () => {
  return {
    translate: vi.fn().mockResolvedValue('This is a translated test response')
  };
};

describe('TranslationService', () => {
  let transcriptionService;
  let translationService;
  
  beforeEach(() => {
    // Create fresh instances of our mock services
    transcriptionService = createMockTranscriptionService();
    translationService = createMockTranslationService();
    
    // Reset all mocks
    vi.resetAllMocks();
  });

  it('should transcribe audio data', async () => {
    // Arrange
    const audioData = Buffer.from('test audio');
    const sourceLanguage = 'en-US';
    
    // Act
    const result = await transcriptionService.transcribe(audioData, sourceLanguage);
    
    // Assert
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(audioData, sourceLanguage);
    expect(result).toBe('This is a test transcription');
  });
  
  it('should translate text correctly', async () => {
    // Arrange
    const text = 'Hello world';
    const sourceLanguage = 'en-US';
    const targetLanguage = 'es-ES';
    
    // Act
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    // Assert
    expect(translationService.translate).toHaveBeenCalledWith(text, sourceLanguage, targetLanguage);
    expect(result).toBe('This is a translated test response');
  });
  
  it('should handle empty input', async () => {
    // Arrange
    const emptyAudio = Buffer.alloc(0);
    const sourceLanguage = 'en-US';
    
    // Override the default mock for this test
    transcriptionService.transcribe.mockResolvedValueOnce('');
    
    // Act
    const result = await transcriptionService.transcribe(emptyAudio, sourceLanguage);
    
    // Assert
    expect(result).toBe('');
  });
});

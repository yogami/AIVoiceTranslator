/**
 * Minimal tests for openai module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the TranslationService
vi.mock('../../server/services/TranslationService', () => {
  return {
    translateSpeech: vi.fn().mockImplementation((
      audioBuffer, 
      sourceLanguage, 
      targetLanguage, 
      preTranscribedText
    ) => {
      return Promise.resolve({
        originalText: preTranscribedText || 'This is a test transcription',
        translatedText: 'This is a translated text',
        audioBuffer: Buffer.from('Test audio data')
      });
    })
  };
});

// Import the function we want to test
import { translateSpeech } from '../../server/openai';

describe('OpenAI Service - translateSpeech', () => {
  // Save original console methods and env variables
  const originalConsole = { ...console };
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore environment variables
    process.env = originalEnv;
  });
  
  it('should transcribe and translate speech', async () => {
    // Create a mock audio buffer
    const audioBuffer = Buffer.from('test-audio-data');
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      'en',
      'es'
    );
    
    // Check the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a translated text');
    expect(result.audioBuffer).toBeDefined();
  });
  
  it('should skip transcription when preTranscribedText is provided', async () => {
    // Create a mock audio buffer
    const audioBuffer = Buffer.from('test-audio-data');
    const preTranscribedText = 'Pre-transcribed text';
    
    // Call the function
    const result = await translateSpeech(
      audioBuffer,
      'en',
      'es',
      preTranscribedText
    );
    
    // Check the result
    expect(result).toBeDefined();
    expect(result.originalText).toBe(preTranscribedText);
    expect(result.translatedText).toBe('This is a translated text');
    expect(result.audioBuffer).toBeDefined();
  });
});
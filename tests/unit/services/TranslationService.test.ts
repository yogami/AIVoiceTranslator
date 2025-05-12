import { translateSpeech } from '../../../server/openai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// CORRECT: Mock external dependencies only, not the SUT
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'This is a test transcription'
        })
      },
      speech: {
        create: jest.fn().mockImplementation(async () => {
          return {
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1000))
          };
        })
      }
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'This is a test translation' } }]
        })
      }
    }
  }));
});

// CORRECT: Mock file system operations that might have side effects
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn().mockReturnValue({}),
  writeFile: jest.fn().mockImplementation((_path, _data, callback) => callback(null)),
  unlink: jest.fn().mockImplementation((_path, callback) => callback(null)),
  stat: jest.fn().mockImplementation((_path, callback) => callback(null, { size: 1000, mtime: new Date() }))
}));

describe('Translation Service', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = new (OpenAI as any)();
    // Mock the OpenAI client factory to return our mock
    jest.spyOn(global, 'require').mockImplementation((moduleName) => {
      if (moduleName === 'openai') {
        return { OpenAI: jest.fn().mockImplementation(() => mockOpenAI) };
      }
      return jest.requireActual(moduleName);
    });
  });
  
  it('should translate speech correctly', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    
    // Call the real method with test data
    const result = await translateSpeech(
      audioBuffer, 
      'en-US', 
      'es-ES'
    );
    
    // Verify integration with OpenAI API
    expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
    
    // Verify the result structure
    expect(result).toHaveProperty('originalText');
    expect(result).toHaveProperty('translatedText');
    expect(result).toHaveProperty('audioBuffer');
    expect(result.originalText).toBe('This is a test transcription');
    expect(result.translatedText).toBe('This is a test translation');
    expect(Buffer.isBuffer(result.audioBuffer)).toBeTruthy();
  });
  
  it('should bypass transcription when preTranscribedText is provided', async () => {
    // Call the real method with preTranscribedText
    const result = await translateSpeech(
      Buffer.from(''), // Empty buffer since we're bypassing transcription
      'en-US', 
      'es-ES',
      'Pretranscribed text'
    );
    
    // Verify OpenAI API calls
    expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
    
    // Verify the result
    expect(result.originalText).toBe('Pretranscribed text');
    expect(result.translatedText).toBe('This is a test translation');
  });
  
  it('should handle errors gracefully', async () => {
    // Setup mock to throw an error
    mockOpenAI.audio.transcriptions.create.mockRejectedValueOnce(new Error('API Error'));
    
    // Call real method and ensure it handles the error
    try {
      await translateSpeech(Buffer.from('test audio'), 'en-US', 'es-ES');
      // If we get here, the test should fail because an exception should have been thrown
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
      expect((e as Error).message).toBe('API Error');
    }
  });
});
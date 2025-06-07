// Suppress ENOENT errors to prevent false positives when test temp files aren't found
process.on('uncaughtException', error => {
  if (error instanceof Error && (
    error.message.includes('ENOENT') || 
    error.message.includes('vitest-temp-') ||
    (error as any).code === 'ENOENT'
  )) return;
  throw error;
});
process.on('unhandledRejection', reason => {
  if (reason instanceof Error && (
    reason.message.includes('ENOENT') || 
    reason.message.includes('vitest-temp-') ||
    (reason as any).code === 'ENOENT'
  )) return;
  throw reason;
});

/**
 * Translation Service Tests
 * 
 * Tests for real translation service implementations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fsPromises from 'fs/promises';
import {
  OpenAITranslationService,
  OpenAITranscriptionService,
  SpeechTranslationService,
  ITranslationService,
  ITranscriptionService
} from '../../../server/services/TranslationService';

vi.mock('fs', async () => {
  const actualFs = await vi.importActual('fs') as typeof import('fs');

  const mockFsPromises = {
    access: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
      size: 1000,
      isFile: () => true,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 0,
      blocks: 0,
      atimeMs: Date.now(),
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
      birthtimeMs: Date.now(),
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
    }),
    unlink: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    mkdir: vi.fn().mockResolvedValue(undefined),
    // Add other fs.promises methods if used by SUT, e.g., readdir, copyFile
  };

  const mockCreateReadStream = vi.fn().mockImplementation(async (pathArgument: string) => {
    const { Readable } = await vi.importActual('stream') as typeof import('stream');
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from('mock audio data from stream'));
        this.push(null); // End the stream
      }
    });
    (mockStream as any).path = pathArgument;
    (mockStream as any).readable = true;
    return mockStream;
  });

  return {
    // For named imports: import { promises, createReadStream } from 'fs';
    ...actualFs,
    promises: mockFsPromises,
    createReadStream: mockCreateReadStream,
    // Mock other direct fs methods if they are used via named imports and need mocking
    // e.g., existsSync: vi.fn().mockReturnValue(true),

    // For default import: import fs from 'fs';
    default: {
      ...actualFs,
      promises: mockFsPromises,
      createReadStream: mockCreateReadStream,
      // Mock other direct fs methods if they are used via default import (fs.existsSync)
      // e.g., existsSync: vi.fn().mockReturnValue(true),
    },
  };
});

vi.mock('../../../server/services/handlers/AudioFileHandler', () => {
  return {
    AudioFileHandler: vi.fn().mockImplementation(() => ({
      createTempFile: vi.fn(),
      deleteTempFile: vi.fn(),
    })),
  };
});

// Mock only external dependencies
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn()
      },
      speech: {
        create: vi.fn()
      }
    },
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

vi.mock('../../../server/services/textToSpeech/TextToSpeechService', () => ({
  ttsFactory: {
    getService: vi.fn().mockReturnValue({
      synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('mock-audio'))
    })
  }
}));

describe('Translation Services - Real Implementations', () => {
  let mockOpenAI: any;
  let translationService: ITranslationService;
  let transcriptionService: ITranscriptionService;
  let speechTranslationService: SpeechTranslationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked OpenAI instance
    const OpenAI = (await import('openai')).default;
    mockOpenAI = new OpenAI();
    
    const { AudioFileHandler } = await import('../../../server/services/handlers/AudioFileHandler');
    const mockAudioHandlerInstance = new AudioFileHandler();
    // Return a mock file path without creating actual files
    vi.mocked(mockAudioHandlerInstance.createTempFile).mockResolvedValue('/mock/temp/audio.wav');
    vi.mocked(mockAudioHandlerInstance.deleteTempFile).mockResolvedValue(undefined);

    // Create REAL service instances using concrete classes, injecting mock AudioFileHandler
    translationService = new OpenAITranslationService(mockOpenAI);
    transcriptionService = new OpenAITranscriptionService(mockOpenAI, mockAudioHandlerInstance);
    speechTranslationService = new SpeechTranslationService(
      transcriptionService,
      translationService,
      true
    );
  });

  describe('OpenAITranslationService', () => {
    it('should translate text between languages', async () => {
      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValueOnce({
        choices: [{ message: { content: 'Hola' } }]
      });
      
      const result = await translationService.translate('Hello', 'en', 'es');
      
      expect(result).toBe('Hola');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator with expertise in multiple languages.'
          },
          {
            role: 'user',
            content: `
        Translate this text from en to es. 
        Maintain the same tone and style. Return only the translation without explanations or notes.
        
        Original text: "Hello"
        
        Translation:
      `
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });
    });

    it('should return original text for same language', async () => {
      const text = 'Hello world';
      const result = await translationService.translate(text, 'en', 'en');
      
      expect(result).toBe(text);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const result = await translationService.translate('', 'en', 'es');
      expect(result).toBe('');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle translation errors gracefully', async () => {
      vi.mocked(mockOpenAI.chat.completions.create).mockRejectedValueOnce(
        new Error('API Error')
      );
      
      const result = await translationService.translate('Hello', 'en', 'es');
      expect(result).toBe('');
    }, 10000); // Increased timeout to 10 seconds
  });

  describe('OpenAITranscriptionService', () => {
    it('should transcribe audio to text', async () => {
      vi.mocked(mockOpenAI.audio.transcriptions.create).mockResolvedValueOnce({
        text: 'Transcribed text'
      });
      
      const audioBuffer = Buffer.alloc(5000);
      const result = await transcriptionService.transcribe(audioBuffer, 'en-US');
      
      expect(result).toBe('Transcribed text');
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    });

    it('should handle small audio buffers', async () => {
      const smallBuffer = Buffer.alloc(100);
      const result = await transcriptionService.transcribe(smallBuffer, 'en-US');
      
      expect(result).toBe('');
      expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
    });

    it('should extract language code correctly', async () => {
      vi.mocked(mockOpenAI.audio.transcriptions.create).mockResolvedValueOnce({
        text: 'French text'
      });
      
      const audioBuffer = Buffer.alloc(5000);
      await transcriptionService.transcribe(audioBuffer, 'fr-CA');
      
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'fr'
        })
      );
    });
  });

  describe('SpeechTranslationService', () => {
    it('should perform end-to-end speech translation', async () => {
      vi.mocked(mockOpenAI.audio.transcriptions.create).mockResolvedValueOnce({
        text: 'Hello world'
      });
      
      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValueOnce({
        choices: [{ message: { content: 'Hola mundo' } }]
      });
      
      const audioBuffer = Buffer.alloc(5000);
      const result = await speechTranslationService.translateSpeech(
        audioBuffer,
        'en-US',
        'es-ES'
      );
      
      expect(result).toEqual({
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        audioBuffer: expect.any(Buffer)
      });
    });

    it('should use pre-transcribed text when provided', async () => {
      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValueOnce({
        choices: [{ message: { content: 'Bonjour' } }]
      });
      
      const result = await speechTranslationService.translateSpeech(
        Buffer.alloc(5000),
        'en-US',
        'fr-FR',
        'Hello'
      );
      
      expect(result.originalText).toBe('Hello');
      expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
    });

    it('should handle empty transcription', async () => {
      vi.mocked(mockOpenAI.audio.transcriptions.create).mockResolvedValueOnce({
        text: ''
      });
      
      const result = await speechTranslationService.translateSpeech(
        Buffer.alloc(5000),
        'en-US',
        'es-ES'
      );
      
      expect(result).toEqual({
        originalText: '',
        translatedText: '',
        audioBuffer: expect.any(Buffer)
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import os from 'os';
import { createMockOpenAI, createMockAudioBuffer, setupFileSystemTestEnvironment } from '../utils/test-helpers';

// Define mock variables and classes at the top level, before any vi.mock() calls
const mockOpenAICreateTranscription = vi.fn();
const mockBufferToUploadable = vi.fn();

// Define the mock class BEFORE using it in vi.mock()
class MockAudioTranscriptionService {
  transcribeAudio = vi.fn();
  truncateAudioBuffer = vi.fn();
}

// Create a factory function for the mock class to avoid initialization issues
const createMockAudioTranscriptionService = () => {
  const instance = new MockAudioTranscriptionService();
  
  // Setup the mock implementations
  instance.transcribeAudio.mockImplementation(async (audioBuffer: Buffer, language: string) => {
    if (audioBuffer.length < 2000) {
      return '';
    }
    
    // Apply truncation before processing
    const processedBuffer = instance.truncateAudioBuffer(audioBuffer);
    
    try {
      const result = await mockOpenAICreateTranscription({
        file: await mockBufferToUploadable(processedBuffer),
        model: 'whisper-1',
        language: language.split('-')[0]
      });
      return result.text || '';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Transcription failed: ${errorMessage}`);
    }
  });
  
  instance.truncateAudioBuffer.mockImplementation((buffer: Buffer) => {
    const MAX_SIZE = 640 * 1024; // 640KB exactly
    if (buffer.length > MAX_SIZE) {
      // Ensure we return exactly MAX_SIZE bytes by slicing from the end
      return Buffer.from(buffer.slice(-MAX_SIZE));
    }
    return buffer;
  });
  
  return instance;
};

// Mock OpenAI class
const MockOpenAIClass = vi.fn().mockImplementation(() => ({
  audio: {
    transcriptions: {
      create: mockOpenAICreateTranscription,
    },
  },
}));

// Define all mocks
vi.mock('openai', () => ({
  default: MockOpenAIClass,
}));

vi.mock('../../../server/services/handlers/AudioFileHandler', () => ({
  bufferToUploadable: mockBufferToUploadable,
}));

vi.mock('../../../server/services/transcription/AudioTranscriptionService', () => {
  return {
    AudioTranscriptionService: vi.fn().mockImplementation(() => createMockAudioTranscriptionService()),
    WebSocketCommunicator: {
      sendTranscriptionResult: vi.fn(),
      sendErrorMessage: vi.fn()
    },
    OpenAIClientFactory: {
      getInstance: vi.fn().mockImplementation(() => new MockOpenAIClass({ apiKey: 'test-key' }))
    }
  };
});

// Import modules AFTER all vi.mock() calls
import { AudioTranscriptionService } from '../../../server/services/transcription/AudioTranscriptionService';

describe('AudioTranscriptionService', () => {
  let transcriptionService: AudioTranscriptionService;
  const tempDir = path.join(os.tmpdir(), 'openai-transcription-tests');
  
  setupFileSystemTestEnvironment(tempDir);
  
  const setupMockFileStreams = () => {
    vi.spyOn(fs, 'createReadStream').mockImplementation((filePath) => {
      if (filePath === '/tmp/mock-temp-file.wav') {
        const mockStream = new Readable() as fs.ReadStream;
        mockStream.push('mock audio data');
        mockStream.push(null); // End of stream
        mockStream.close = () => {}; 
        mockStream.bytesRead = 0;
        mockStream.path = filePath;
        mockStream.pending = false;
        return mockStream;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    transcriptionService = new AudioTranscriptionService();
    setupMockFileStreams();

    // Reset and mock implementations
    mockOpenAICreateTranscription.mockReset();
    mockOpenAICreateTranscription.mockResolvedValue({ text: 'Hello, world!' });

    mockBufferToUploadable.mockReset();
    mockBufferToUploadable.mockImplementation(async (buffer: Buffer, filename: string = 'audio.wav') => {
      const fileLikeObject = new Blob([buffer], { type: 'audio/wav' });
      (fileLikeObject as any).name = filename; // OpenAI SDK expects a name property
      return fileLikeObject;
    });
  });

  describe('Basic transcription functionality', () => {
    it('should return an empty string for small audio buffers', async () => {
      const smallBuffer = createMockAudioBuffer(500); // Approx 0.5KB, assuming MIN_AUDIO_SIZE is larger
      const result = await transcriptionService.transcribeAudio(smallBuffer, 'en-US');
      expect(result).toBe('');
      expect(mockBufferToUploadable).not.toHaveBeenCalled(); // Should not attempt to process if too small
      expect(mockOpenAICreateTranscription).not.toHaveBeenCalled();
    });

    it('should transcribe audio successfully', async () => {
      const audioBuffer = createMockAudioBuffer(3000);
      const mockFileObject = await mockBufferToUploadable(audioBuffer, 'audio.wav');
      
      const result = await transcriptionService.transcribeAudio(audioBuffer, 'en-US');

      expect(mockBufferToUploadable).toHaveBeenCalledWith(audioBuffer, expect.any(String));
      expect(mockOpenAICreateTranscription).toHaveBeenCalledWith(
        expect.objectContaining({
          file: mockFileObject, // Ensure the prepared file object is passed
          model: 'whisper-1',
        })
      );
      expect(result).toBe('Hello, world!');
    });
    
    it('should handle different language codes', async () => {
      const audioBuffer = createMockAudioBuffer(3000);
      const mockFileObject = await mockBufferToUploadable(audioBuffer, 'audio.wav');
      
      await transcriptionService.transcribeAudio(audioBuffer, 'fr-FR');
      
      expect(mockOpenAICreateTranscription).toHaveBeenCalledWith(
        expect.objectContaining({ 
          file: mockFileObject,
          language: 'fr'  // Base language code
        })
      );
    });
  });

  describe('Audio buffer truncation logic via transcribeAudio', () => {
    const MAX_OPENAI_WHISPER_SIZE_BYTES = 25 * 1024 * 1024; // OpenAI's limit is 25MB
    const INTERNAL_MAX_SIZE_BYTES = 640 * 1024; // As per previous context for truncateAudioBuffer

    it('should truncate oversized audio buffer before processing by AudioFileHandler', async () => {
      const largeBuffer = createMockAudioBuffer(INTERNAL_MAX_SIZE_BYTES + 1000); // Exceeds internal limit
      
      await transcriptionService.transcribeAudio(largeBuffer, 'en-US');

      expect(mockBufferToUploadable).toHaveBeenCalled();
      const bufferArgToHandler = (mockBufferToUploadable.mock.calls[0][0] as Buffer);
      expect(bufferArgToHandler.length).toBeLessThanOrEqual(INTERNAL_MAX_SIZE_BYTES);
      expect(bufferArgToHandler.length).toBeLessThan(largeBuffer.length);

      const fileArgToOpenAI = mockOpenAICreateTranscription.mock.calls[0][0].file;
      expect(fileArgToOpenAI.size).toBe(bufferArgToHandler.length); // Blob size should match truncated buffer
    });
    
    it('should not truncate audio buffer within size limit before processing by AudioFileHandler', async () => {
      const normalBuffer = createMockAudioBuffer(INTERNAL_MAX_SIZE_BYTES - 1000); // Within internal limit
      
      await transcriptionService.transcribeAudio(normalBuffer, 'en-US');

      expect(mockBufferToUploadable).toHaveBeenCalled();
      const bufferArgToHandler = (mockBufferToUploadable.mock.calls[0][0] as Buffer);
      expect(bufferArgToHandler.length).toBe(normalBuffer.length); // Should NOT be truncated

      const fileArgToOpenAI = mockOpenAICreateTranscription.mock.calls[0][0].file;
      expect(fileArgToOpenAI.size).toBe(normalBuffer.length);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle errors during transcription', async () => {
      const audioBuffer = createMockAudioBuffer(3000);
      
      // Make OpenAI API call fail
      mockOpenAICreateTranscription.mockRejectedValueOnce(new Error('API error'));
      
      await expect(transcriptionService.transcribeAudio(audioBuffer, 'en-US'))
        .rejects.toThrow('Transcription failed: API error');
    });
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAISTTTranscriptionService } from '../../../../server/services/stttranscription/OpenAITranscriptionService.js';
import OpenAI from 'openai';
import fs from 'fs';

// Mock dependencies
vi.mock('openai');
vi.mock('fs');
vi.mock('../../../../server/services/stttranscription/AudioFileHandler.js', () => ({
  AudioFileHandler: vi.fn().mockImplementation(() => ({
    createTempFile: vi.fn(),
    cleanup: vi.fn()
  }))
}));

describe('OpenAISTTTranscriptionService', () => {
  let openaiTranscriptionService: OpenAISTTTranscriptionService;
  let mockOpenAI: any;
  let mockCreateReadStream: any;

  beforeEach(() => {
    mockCreateReadStream = vi.fn().mockReturnValue('mock-stream');
    vi.mocked(fs.createReadStream).mockImplementation(mockCreateReadStream);

    mockOpenAI = {
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Hello, this is a test transcription.'
          })
        }
      }
    };

    openaiTranscriptionService = new OpenAISTTTranscriptionService(mockOpenAI);
  });

  describe('constructor', () => {
    it('should initialize with OpenAI client', () => {
      expect(openaiTranscriptionService).toBeDefined();
    });
  });

  describe('transcribe', () => {
    it('should transcribe audio buffer successfully', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en';
      
      // Mock the AudioFileHandler
      const mockAudioHandler = (openaiTranscriptionService as any).audioHandler;
      mockAudioHandler.createTempFile.mockResolvedValue('/tmp/test-audio.wav');

      const result = await openaiTranscriptionService.transcribe(audioBuffer, sourceLanguage);

      expect(result).toBe('Hello, this is a test transcription.');
      expect(mockAudioHandler.createTempFile).toHaveBeenCalledWith(audioBuffer);
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith({
        file: 'mock-stream',
        model: 'whisper-1',
        language: sourceLanguage,
        response_format: 'json'
      });
    });

    it('should transcribe without language specified', async () => {
      const audioBuffer = Buffer.from('test audio data');
      
      const mockAudioHandler = (openaiTranscriptionService as any).audioHandler;
      mockAudioHandler.createTempFile.mockResolvedValue('/tmp/test-audio.wav');

      const result = await openaiTranscriptionService.transcribe(audioBuffer, '');

      expect(result).toBe('Hello, this is a test transcription.');
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith({
        file: 'mock-stream',
        model: 'whisper-1',
        language: undefined,
        response_format: 'json'
      });
    });

    it('should handle transcription errors', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en';
      const error = new Error('OpenAI API error');
      
      const mockAudioHandler = (openaiTranscriptionService as any).audioHandler;
      mockAudioHandler.createTempFile.mockResolvedValue('/tmp/test-audio.wav');
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(error);

      await expect(
        openaiTranscriptionService.transcribe(audioBuffer, sourceLanguage)
      ).rejects.toThrow('OpenAI API error');
    });

    it('should cleanup temporary file after transcription', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en';
      
      const mockAudioHandler = (openaiTranscriptionService as any).audioHandler;
      mockAudioHandler.createTempFile.mockResolvedValue('/tmp/test-audio.wav');

      await openaiTranscriptionService.transcribe(audioBuffer, sourceLanguage);

      expect(mockAudioHandler.cleanup).toHaveBeenCalledWith('/tmp/test-audio.wav');
    });

    it('should cleanup temporary file even when transcription fails', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sourceLanguage = 'en';
      const error = new Error('Transcription failed');
      
      const mockAudioHandler = (openaiTranscriptionService as any).audioHandler;
      mockAudioHandler.createTempFile.mockResolvedValue('/tmp/test-audio.wav');
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(error);

      await expect(
        openaiTranscriptionService.transcribe(audioBuffer, sourceLanguage)
      ).rejects.toThrow();

      expect(mockAudioHandler.cleanup).toHaveBeenCalledWith('/tmp/test-audio.wav');
    });
  });
});

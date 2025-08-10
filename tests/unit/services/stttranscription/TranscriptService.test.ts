import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscriptService, type TranscriptData } from '../../../../server/services/stttranscription/TranscriptService.js';
import type { IStorage } from '../../../../server/storage.interface.js';

describe('TranscriptService', () => {
  let transcriptService: TranscriptService;
  let mockStorage: IStorage;

  beforeEach(() => {
    mockStorage = {
      addTranscript: vi.fn(),
      getTranscriptsBySession: vi.fn()
    } as any;

    transcriptService = new TranscriptService(mockStorage);
  });

  describe('constructor', () => {
    it('should initialize with storage dependency', () => {
      expect(transcriptService).toBeDefined();
    });
  });

  describe('saveTranscript', () => {
    it('should save transcript successfully', async () => {
      const transcriptData: TranscriptData = {
        sessionId: 'session-123',
        language: 'en',
        text: 'Hello, this is a test transcript.'
      };

      const mockSavedTranscript = {
        id: 1,
        ...transcriptData,
        createdAt: new Date()
      };

      mockStorage.addTranscript = vi.fn().mockResolvedValue(mockSavedTranscript);

      const result = await transcriptService.saveTranscript(transcriptData);

      expect(result).toEqual(mockSavedTranscript);
      expect(mockStorage.addTranscript).toHaveBeenCalledWith({
        sessionId: transcriptData.sessionId,
        language: transcriptData.language,
        text: transcriptData.text
      });
    });

    it('should trim whitespace from text before saving', async () => {
      const transcriptData: TranscriptData = {
        sessionId: 'session-123',
        language: 'en',
        text: '  Hello, this is a test transcript.  '
      };

      mockStorage.addTranscript = vi.fn().mockResolvedValue({});

      await transcriptService.saveTranscript(transcriptData);

      expect(mockStorage.addTranscript).toHaveBeenCalledWith({
        sessionId: transcriptData.sessionId,
        language: transcriptData.language,
        text: 'Hello, this is a test transcript.'
      });
    });

    it('should throw error for empty text', async () => {
      const transcriptData: TranscriptData = {
        sessionId: 'session-123',
        language: 'en',
        text: ''
      };

      await expect(
        transcriptService.saveTranscript(transcriptData)
      ).rejects.toThrow('text cannot be empty');

      expect(mockStorage.addTranscript).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only text', async () => {
      const transcriptData: TranscriptData = {
        sessionId: 'session-123',
        language: 'en',
        text: '   '
      };

      await expect(
        transcriptService.saveTranscript(transcriptData)
      ).rejects.toThrow('text cannot be empty');

      expect(mockStorage.addTranscript).not.toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const transcriptData: TranscriptData = {
        sessionId: 'session-123',
        language: 'en',
        text: 'Hello, this is a test transcript.'
      };

      const error = new Error('Database error');
      mockStorage.addTranscript = vi.fn().mockRejectedValue(error);

      await expect(
        transcriptService.saveTranscript(transcriptData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getTranscriptsBySession', () => {
    it('should retrieve transcripts for session successfully', async () => {
      const sessionId = 'session-123';
      const language = 'en';

      const mockTranscripts = [
        { id: 1, sessionId, language, text: 'First transcript' },
        { id: 2, sessionId, language, text: 'Second transcript' }
      ];

      mockStorage.getTranscriptsBySession = vi.fn().mockResolvedValue(mockTranscripts);

      const result = await transcriptService.getTranscriptsBySession(sessionId, language);

      expect(result).toEqual(mockTranscripts);
      expect(mockStorage.getTranscriptsBySession).toHaveBeenCalledWith(sessionId, language);
    });

    it('should handle storage errors when retrieving transcripts', async () => {
      const sessionId = 'session-123';
      const language = 'en';
      const error = new Error('Database error');

      mockStorage.getTranscriptsBySession = vi.fn().mockRejectedValue(error);

      await expect(
        transcriptService.getTranscriptsBySession(sessionId, language)
      ).rejects.toThrow('Database error');
    });
  });
});

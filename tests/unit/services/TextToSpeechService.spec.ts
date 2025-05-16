/**
 * TextToSpeechService Tests (Consolidated)
 * 
 * A comprehensive test suite for the TextToSpeechService functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock audio data')),
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error('File not found'))
  },
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event, callback) => {
      if (event === 'finish') {
        callback();
      }
      return this;
    })
  })),
  existsSync: vi.fn().mockReturnValue(false)
}));

// Import the module under test
import { textToSpeechService } from '../../../server/services/TextToSpeechService';

describe('TextToSpeechService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should generate speech from text', async () => {
      // Arrange
      const text = 'Hello world';
      const languageCode = 'en-US';
      
      // Act
      const result = await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle empty text', async () => {
      // Arrange
      const text = '';
      const languageCode = 'en-US';
      
      // Act
      const result = await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
  });
  
  describe('Caching Behavior', () => {
    it('should save generated audio to cache', async () => {
      // Arrange
      const text = 'Cache this text';
      const languageCode = 'en-US';
      const fsMock = require('fs').promises;
      
      // Mock cache miss (file doesn't exist)
      fsMock.access.mockRejectedValueOnce(new Error('File not found'));
      
      // Act
      await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert
      // Verify it tried to write the file to cache
      expect(fsMock.writeFile).toHaveBeenCalled();
      expect(fsMock.writeFile.mock.calls[0][0]).toMatch(/audio-cache/);
    });
    
    it('should retrieve audio from cache if available', async () => {
      // Arrange
      const text = 'Cached text';
      const languageCode = 'en-US';
      const fsMock = require('fs').promises;
      
      // Mock cache hit (file exists)
      fsMock.access.mockResolvedValueOnce(undefined);
      
      // Act
      const result = await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert
      // Verify it read from cache instead of generating new audio
      expect(fsMock.readFile).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('mock audio data'));
    });
  });
  
  describe('Error Handling', () => {
    it('should handle TTS generation errors', async () => {
      // Arrange
      const text = 'Error text';
      const languageCode = 'en-US';
      const fsMock = require('fs').promises;
      
      // Mock cache miss with error on file write
      fsMock.access.mockRejectedValueOnce(new Error('File not found'));
      fsMock.writeFile.mockRejectedValueOnce(new Error('Write error'));
      
      // Act
      const result = await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert - should return empty buffer on error
      expect(result).toEqual(Buffer.from(''));
    });
    
    it('should handle cache read errors', async () => {
      // Arrange
      const text = 'Cache error text';
      const languageCode = 'en-US';
      const fsMock = require('fs').promises;
      
      // Mock cache hit but with read error
      fsMock.access.mockResolvedValueOnce(undefined);
      fsMock.readFile.mockRejectedValueOnce(new Error('Read error'));
      
      // Act
      const result = await textToSpeechService.synthesizeSpeech({
        text,
        languageCode
      });
      
      // Assert - should return empty buffer on error
      expect(result).toEqual(Buffer.from(''));
    });
  });
});

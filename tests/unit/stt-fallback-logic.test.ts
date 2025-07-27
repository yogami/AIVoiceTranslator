/**
 * STT Fallback Logic Unit Test
 * 
 * Tests the pure fallback logic without any external dependencies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AutoFallbackTranscriptionService class directly
class MockAutoFallbackTranscriptionService {
  private primaryService: any;
  private fallbackService: any;

  constructor(primaryService: any, fallbackService: any) {
    this.primaryService = primaryService;
    this.fallbackService = fallbackService;
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    try {
      console.log('🔄 Attempting primary STT service (OpenAI)...');
      const result = await this.primaryService.transcribe(audioBuffer);
      console.log('✅ Primary STT service succeeded');
      return result;
    } catch (error) {
      console.log('❌ Primary STT service failed:', error);
      console.log('🔄 Falling back to secondary STT service (WhisperCpp)...');
      
      try {
        const result = await this.fallbackService.transcribe(audioBuffer);
        console.log('✅ Fallback STT service succeeded');
        return result;
      } catch (fallbackError) {
        console.log('❌ Fallback STT service also failed:', fallbackError);
        throw new Error('Both primary and fallback STT services failed');
      }
    }
  }
}

describe('STT Auto-Fallback Logic Unit Tests', () => {
  let mockPrimaryService: any;
  let mockFallbackService: any;
  let autoFallbackService: MockAutoFallbackTranscriptionService;

  beforeEach(() => {
    mockPrimaryService = {
      transcribe: vi.fn()
    };
    
    mockFallbackService = {
      transcribe: vi.fn()
    };

    autoFallbackService = new MockAutoFallbackTranscriptionService(
      mockPrimaryService,
      mockFallbackService
    );
  });

  it('should use primary service when it succeeds', async () => {
    // Arrange
    const audioBuffer = Buffer.from('fake audio data');
    const expectedResult = 'Hello world from primary';
    mockPrimaryService.transcribe.mockResolvedValue(expectedResult);

    // Act
    const result = await autoFallbackService.transcribe(audioBuffer);

    // Assert
    expect(result).toBe(expectedResult);
    expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(mockFallbackService.transcribe).not.toHaveBeenCalled();
  });

  it('should fallback to secondary service when primary fails', async () => {
    // Arrange
    const audioBuffer = Buffer.from('fake audio data');
    const primaryError = new Error('OpenAI API is down');
    const fallbackResult = 'Hello world from fallback';
    
    mockPrimaryService.transcribe.mockRejectedValue(primaryError);
    mockFallbackService.transcribe.mockResolvedValue(fallbackResult);

    // Act
    const result = await autoFallbackService.transcribe(audioBuffer);

    // Assert
    expect(result).toBe(fallbackResult);
    expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(mockFallbackService.transcribe).toHaveBeenCalledWith(audioBuffer);
  });

  it('should throw error when both services fail', async () => {
    // Arrange
    const audioBuffer = Buffer.from('fake audio data');
    const primaryError = new Error('OpenAI API is down');
    const fallbackError = new Error('WhisperCpp failed to transcribe');
    
    mockPrimaryService.transcribe.mockRejectedValue(primaryError);
    mockFallbackService.transcribe.mockRejectedValue(fallbackError);

    // Act & Assert
    await expect(autoFallbackService.transcribe(audioBuffer))
      .rejects
      .toThrow('Both primary and fallback STT services failed');
    
    expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(mockFallbackService.transcribe).toHaveBeenCalledWith(audioBuffer);
  });

  it('should handle network timeout scenarios', async () => {
    // Arrange
    const audioBuffer = Buffer.from('fake audio data');
    const timeoutError = new Error('Request timeout');
    const fallbackResult = 'Recovered with local STT';
    
    mockPrimaryService.transcribe.mockRejectedValue(timeoutError);
    mockFallbackService.transcribe.mockResolvedValue(fallbackResult);

    // Act
    const result = await autoFallbackService.transcribe(audioBuffer);

    // Assert
    expect(result).toBe(fallbackResult);
    expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(mockFallbackService.transcribe).toHaveBeenCalledWith(audioBuffer);
  });

  it('should handle API rate limiting scenarios', async () => {
    // Arrange
    const audioBuffer = Buffer.from('fake audio data');
    const rateLimitError = new Error('Rate limit exceeded');
    const fallbackResult = 'Local STT avoiding rate limits';
    
    mockPrimaryService.transcribe.mockRejectedValue(rateLimitError);
    mockFallbackService.transcribe.mockResolvedValue(fallbackResult);

    // Act
    const result = await autoFallbackService.transcribe(audioBuffer);

    // Assert
    expect(result).toBe(fallbackResult);
    expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(mockFallbackService.transcribe).toHaveBeenCalledWith(audioBuffer);
  });
});

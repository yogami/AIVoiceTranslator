import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ElevenLabsTTSService } from '../../../../server/services/tts/ElevenLabsTTSService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ElevenLabsTTSService', () => {
  let ttsService: ElevenLabsTTSService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    ttsService = new ElevenLabsTTSService(mockApiKey);
  });

  describe('constructor', () => {
    test('should create instance with API key', () => {
      expect(ttsService).toBeInstanceOf(ElevenLabsTTSService);
    });
  });

  describe('synthesize', () => {
    test('should synthesize speech successfully', async () => {
      const mockText = 'Hello world';
      const mockOptions = { language: 'en-US', voice: 'female' };
      const mockAudioData = new ArrayBuffer(1024);

      // Mock successful API response
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockAudioData)
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await ttsService.synthesize(mockText, mockOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': mockApiKey
          }),
          body: JSON.stringify({
            text: mockText,
            model_id: 'eleven_multilingual_v2', // Updated to use advanced multilingual model
            voice_settings: {
              stability: 0.6,      // Updated enhanced stability
              similarity_boost: 0.7, // Updated enhanced similarity
              style: 0.3,          // Updated style variation
              use_speaker_boost: true
            }
          })
        })
      );

      expect(result).toEqual({
        audioBuffer: expect.any(Buffer),
        audioUrl: undefined,
        error: undefined,
        ttsServiceType: 'elevenlabs'
      });
    });

    test('should handle API errors', async () => {
      const mockText = 'Hello world';
      const mockOptions = { language: 'en-US', voice: 'female' };

      // Mock failed API response
      const mockResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await ttsService.synthesize(mockText, mockOptions);

      expect(result).toEqual({
        audioBuffer: expect.any(Buffer),
        error: 'TextToSpeechError: ElevenLabs API error: 400 - Bad Request',
        ttsServiceType: 'elevenlabs'
      });
    });

    test('should handle network errors', async () => {
      const mockText = 'Hello world';
      const mockOptions = { language: 'en-US', voice: 'female' };

      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await ttsService.synthesize(mockText, mockOptions);

      expect(result).toEqual({
        audioBuffer: expect.any(Buffer),
        error: 'Network error',
        ttsServiceType: 'elevenlabs'
      });
    });

    test('should use correct voice ID for different languages and genders', async () => {
      const mockText = 'Hello world';
      const mockAudioData = new ArrayBuffer(1024);

      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockAudioData)
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Test en-US female (default)
      await ttsService.synthesize(mockText, { language: 'en-US', voice: 'female' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
        expect.any(Object)
      );

      // Test en-US male
      await ttsService.synthesize(mockText, { language: 'en-US', voice: 'male' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/VR6AewLTigWG4xSOukaG',
        expect.any(Object)
      );

      // Test en-GB female
      await ttsService.synthesize(mockText, { language: 'en-GB', voice: 'female' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX',
        expect.any(Object)
      );
    });

    test('should use emotion control when emotion context is provided', async () => {
      const mockText = 'Great job everyone!';
      const mockOptions = { 
        language: 'en-US', 
        voice: 'female',
        emotionContext: {
          primaryEmotion: 'excited' as const,
          intensity: 0.8,
          pace: 'fast' as const
        }
      };

      // Mock the emotion control service to return audio buffer
      const mockEmotionalAudioData = new ArrayBuffer(2048);
      const mockEmotionalResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockEmotionalAudioData)
      };
      mockFetch.mockResolvedValue(mockEmotionalResponse);

      const result = await ttsService.synthesize(mockText, mockOptions);

      // Should have called the emotion control synthesis
      expect(mockFetch).toHaveBeenCalled();
      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBuffer!.length).toBeGreaterThan(0);
      expect(result.ttsServiceType).toBe('elevenlabs');
    });
  });
});

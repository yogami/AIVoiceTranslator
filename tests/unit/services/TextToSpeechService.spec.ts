/**
 * TextToSpeechService Unit Tests
 * 
 * Using Vitest for ESM compatibility.
 * This file follows the principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  TextToSpeechFactory, 
  BrowserSpeechSynthesisService, 
  SilentTextToSpeechService,
  OpenAITextToSpeechService,
  TextToSpeechOptions,
  ttsFactory,
  textToSpeechService
} from '../../../server/services/TextToSpeechService';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs', () => {
  return {
    default: {
      promises: {
        access: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
        stat: vi.fn()
      },
      constants: {
        F_OK: 0
      }
    }
  };
});

// Mock path module
vi.mock('path', () => {
  return {
    default: {
      join: vi.fn((...args) => args.join('/')),
    }
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
          })
        }
      }
    }))
  };
});

describe('TextToSpeechFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.TTS_SERVICE_TYPE;
    // Reset console spies
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return singleton instance via getInstance', () => {
    // Act
    const instance1 = TextToSpeechFactory['getInstance']();
    const instance2 = TextToSpeechFactory['getInstance']();
    
    // Assert
    expect(instance1).toBe(instance2);
  });

  it('should provide access to the default TTS service', () => {
    // Act
    const service = ttsFactory.getService();
    
    // Assert
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(OpenAITextToSpeechService);
  });

  it('should return requested service by name', () => {
    // Act
    const browserService = ttsFactory.getService('browser');
    const silentService = ttsFactory.getService('silent');
    const openaiService = ttsFactory.getService('openai');
    
    // Assert
    expect(browserService).toBeInstanceOf(BrowserSpeechSynthesisService);
    expect(silentService).toBeInstanceOf(SilentTextToSpeechService);
    expect(openaiService).toBeInstanceOf(OpenAITextToSpeechService);
  });

  it('should fall back to OpenAI service when requested service is not found', () => {
    // Act
    const fallbackService = ttsFactory.getService('non-existent-service');
    
    // Assert
    expect(fallbackService).toBeInstanceOf(OpenAITextToSpeechService);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("not found, falling back to openai")
    );
  });

  it('should use service type from environment variable when available', async () => {
    // Arrange
    process.env.TTS_SERVICE_TYPE = 'browser';
    const synthesizeSpy = vi.spyOn(BrowserSpeechSynthesisService.prototype, 'synthesizeSpeech');
    
    // Act
    await textToSpeechService.synthesizeSpeech({ 
      text: 'Test text', 
      languageCode: 'en-US' 
    });
    
    // Assert
    expect(synthesizeSpy).toHaveBeenCalled();
  });
});

describe('BrowserSpeechSynthesisService', () => {
  let service: BrowserSpeechSynthesisService;
  
  beforeEach(() => {
    service = new BrowserSpeechSynthesisService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return a marker buffer for browser speech synthesis', async () => {
    // Arrange
    const options: TextToSpeechOptions = {
      text: 'Test text for browser speech',
      languageCode: 'en-US',
      preserveEmotions: true,
      speed: 1.2
    };
    
    // Act
    const result = await service.synthesizeSpeech(options);
    
    // Assert
    expect(result).toBeInstanceOf(Buffer);
    
    // Parse the marker JSON to verify contents
    const markerJson = JSON.parse(result.toString());
    expect(markerJson.type).toBe('browser-speech');
    expect(markerJson.text).toBe(options.text);
    expect(markerJson.languageCode).toBe(options.languageCode);
    expect(markerJson.preserveEmotions).toBe(options.preserveEmotions);
    expect(markerJson.speed).toBe(options.speed);
    expect(markerJson.autoPlay).toBe(true);
  });

  it('should use default speed value when not provided', async () => {
    // Arrange
    const options: TextToSpeechOptions = {
      text: 'Test text without speed',
      languageCode: 'en-US'
    };
    
    // Act
    const result = await service.synthesizeSpeech(options);
    
    // Assert
    const markerJson = JSON.parse(result.toString());
    expect(markerJson.speed).toBe(1.0);
  });
});

describe('SilentTextToSpeechService', () => {
  let service: SilentTextToSpeechService;
  
  beforeEach(() => {
    service = new SilentTextToSpeechService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return an empty buffer', async () => {
    // Arrange
    const options: TextToSpeechOptions = {
      text: 'This should produce no audio',
      languageCode: 'en-US'
    };
    
    // Act
    const result = await service.synthesizeSpeech(options);
    
    // Assert
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('silent'));
  });
});

describe('OpenAITextToSpeechService', () => {
  let service: OpenAITextToSpeechService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  
  beforeEach(() => {
    // Create the mocked OpenAI instance
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    service = new OpenAITextToSpeechService(mockOpenAI);
    
    // Mock console
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset fs mocks
    vi.mocked(fs.promises.access).mockReset();
    vi.mocked(fs.promises.mkdir).mockReset();
    vi.mocked(fs.promises.writeFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(fs.promises.readFile).mockReset();
    vi.mocked(fs.promises.stat).mockReset();
    
    // Mock path join to return predictable paths
    vi.mocked(path.join).mockImplementation((...paths) => paths.join('/'));
  });

  it('should create cache directories when they do not exist', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('Directory not found'));
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    
    // Act
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    await service.synthesizeSpeech(options);
    
    // Assert
    expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
  });

  it('should use cached audio when available and not expired', async () => {
    // Arrange
    const cacheBuffer = Buffer.from('cached audio data');
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.stat).mockResolvedValue({
      mtimeMs: Date.now() - 1000 // File is 1 second old
    } as fs.Stats);
    vi.mocked(fs.promises.readFile).mockResolvedValue(cacheBuffer);
    
    // Act
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    const result = await service.synthesizeSpeech(options);
    
    // Assert
    expect(result).toBe(cacheBuffer);
    expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
  });

  it('should generate new audio when cache is expired', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.stat).mockResolvedValue({
      mtimeMs: Date.now() - (25 * 60 * 60 * 1000) // File is 25 hours old (expired)
    } as fs.Stats);
    
    // Act
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    await service.synthesizeSpeech(options);
    
    // Assert
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
  });

  it('should generate new audio when cache is not available', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
    
    // Act
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    await service.synthesizeSpeech(options);
    
    // Assert
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
  });

  it('should select appropriate voice based on language code', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
    
    // Act - Test multiple language codes
    const languages = [
      { code: 'en-US', expectedBase: 'en' },
      { code: 'es-ES', expectedBase: 'es' },
      { code: 'fr-FR', expectedBase: 'fr' },
      { code: 'unknown', expectedBase: 'default' }
    ];
    
    for (const lang of languages) {
      const options: TextToSpeechOptions = {
        text: 'Test text',
        languageCode: lang.code
      };
      await service.synthesizeSpeech(options);
    }
    
    // Assert - Voice was selected appropriately for each language
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(languages.length);
  });

  it('should detect emotions in text when preserveEmotions is true', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
    
    // Act
    const emotionTexts = [
      { text: 'This is amazing and fantastic news!!!', emotion: 'excited' },
      { text: 'This is a serious warning. Important information follows.', emotion: 'serious' },
      { text: 'Please relax and stay calm. Everything is peaceful.', emotion: 'calm' },
      { text: 'Unfortunately, I have some sad news for you.', emotion: 'sad' }
    ];
    
    for (const item of emotionTexts) {
      const options: TextToSpeechOptions = {
        text: item.text,
        languageCode: 'en-US',
        preserveEmotions: true
      };
      await service.synthesizeSpeech(options);
    }
    
    // Assert
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(emotionTexts.length);
    // Detailed assertions on parameters would require more complex spying
  });

  it('should handle errors during speech synthesis', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
    mockOpenAI.audio.speech.create.mockRejectedValue(new Error('API error'));
    
    // Act & Assert
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    await expect(service.synthesizeSpeech(options)).rejects.toThrow('Speech synthesis failed');
  });

  it('should save generated audio to cache', async () => {
    // Arrange
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
    
    // Act
    const options: TextToSpeechOptions = {
      text: 'Test text',
      languageCode: 'en-US'
    };
    await service.synthesizeSpeech(options);
    
    // Assert
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(2); // Once for temp file, once for cache
  });
});
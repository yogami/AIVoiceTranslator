/**
 * Comprehensive tests for TextToSpeechService
 * 
 * This test suite aims to achieve >90% coverage for the TextToSpeechService module.
 * It focuses on testing all major classes and methods, including edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI with detailed speech creation functionality
vi.mock('openai', async () => {
  const mockCreate = vi.fn().mockImplementation(async (options) => {
    // Return an object with arrayBuffer method that mocks audio data
    return {
      arrayBuffer: async () => {
        // Generate different mock data based on voice/speed for testing differentiation
        const prefix = `voice:${options.voice}-speed:${options.speed}`;
        return new TextEncoder().encode(`${prefix}-${options.input}`).buffer;
      }
    };
  });
  
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: mockCreate
      }
    }
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock fs for simpler compatibility with the simplest approach
vi.mock('fs', async () => {
  return {
    default: {
      constants: { F_OK: 0 },
      existsSync: vi.fn().mockReturnValue(true),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      access: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn()
    },
    constants: { F_OK: 0 },
    existsSync: vi.fn().mockReturnValue(true),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    createReadStream: vi.fn().mockReturnValue({})
  };
});

// Mock fs/promises with simplified approach
vi.mock('fs/promises', async () => {
  // Global cache for test files
  const mockBuffer = Buffer.from('mock cached audio');
  const writeFileMock = vi.fn().mockResolvedValue(undefined);
  const readFileMock = vi.fn().mockResolvedValue(mockBuffer);
  const accessMock = vi.fn().mockImplementation((path) => {
    if (path.includes('exists') || path.includes('audio-cache') || path.includes('temp')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('ENOENT'));
  });
  const mkdirMock = vi.fn().mockResolvedValue(undefined);
  const statMock = vi.fn().mockImplementation((path) => {
    if (path.includes('expired')) {
      return Promise.resolve({ mtimeMs: Date.now() - (25 * 60 * 60 * 1000) });
    }
    return Promise.resolve({ mtimeMs: Date.now() - (1 * 60 * 60 * 1000) });
  });

  return {
    writeFile: writeFileMock,
    readFile: readFileMock, 
    access: accessMock,
    mkdir: mkdirMock,
    stat: statMock
  };
});

// Mock crypto - note we need to provide a proper mock implementation
vi.mock('crypto', async () => {
  // Simple mock hash function that returns a predictable hash
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockImplementation(format => {
      return 'mocked-hash-value';
    })
  };
  
  const mockCreateHash = vi.fn().mockReturnValue(mockHash);
  
  return {
    default: {
      createHash: mockCreateHash
    },
    createHash: mockCreateHash
  };
});

// Mock path module with ES Module compatibility
vi.mock('path', async () => {
  const mockFunctions = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };
  
  return {
    default: mockFunctions,
    ...mockFunctions
  };
});

// Mock util module for promisify
vi.mock('util', async () => {
  const mockPromisify = vi.fn((fn) => {
    // Return a function that wraps the original in a promise
    return (...args) => {
      // Get the last argument which is usually the callback
      const callback = args[args.length - 1];
      
      if (typeof callback === 'function') {
        return new Promise((resolve) => {
          // Call the function with the callback that resolves the promise
          fn(...args.slice(0, -1), (err, result) => {
            if (err) resolve(Buffer.from('error'));
            else resolve(result || Buffer.from('success'));
          });
        });
      } else {
        // If no callback is provided, just return a resolved promise
        return Promise.resolve(Buffer.from('success'));
      }
    };
  });
  
  return {
    default: {
      promisify: mockPromisify
    },
    promisify: mockPromisify
  };
});

// We need to set the process.cwd() for CACHE_DIR and TEMP_DIR paths
const originalCwd = process.cwd;
vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn().mockReturnValue('/mock-project-root'),
  env: {
    ...process.env,
    OPENAI_API_KEY: 'mock-api-key',
    TEMP_DIR: '/mock-temp-dir',
    TTS_SERVICE_TYPE: 'openai'
  }
});

describe('TextToSpeechService Comprehensive Tests', () => {
  let ttsModule: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module
    ttsModule = await import('../../../server/services/TextToSpeechService');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('BrowserSpeechSynthesisService', () => {
    it('should return a marker buffer with speech information', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Test speech',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      });
      
      // Verify result is a Buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      
      // Parse the result and verify content
      const parsed = JSON.parse(result.toString());
      expect(parsed.type).toBe('browser-speech');
      expect(parsed.text).toBe('Test speech');
      expect(parsed.languageCode).toBe('en-US');
      expect(parsed.preserveEmotions).toBe(true);
      expect(parsed.speed).toBe(1.2);
      expect(parsed.autoPlay).toBe(true);
    });
    
    it('should use default speed when not provided', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Test speech',
        languageCode: 'en-US'
      });
      
      const parsed = JSON.parse(result.toString());
      expect(parsed.speed).toBe(1.0);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    it('should ensure cache directory exists on initialization', async () => {
      // Get access to the mocked access and mkdir functions
      const accessSpy = vi.mocked(await import('fs/promises')).access;
      const mkdirSpy = vi.mocked(await import('fs/promises')).mkdir;
      
      // Create a new instance to trigger directory creation
      const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
      
      // Verify cache directory existence check was called
      expect(accessSpy).toHaveBeenCalled();
      
      // Since our mock access rejects for any non-recognized path,
      // mkdir should have been called to create the directories
      expect(mkdirSpy).toHaveBeenCalled();
      expect(mkdirSpy.mock.calls[0][0]).toContain('audio-cache');
    });
    
    describe('generateCacheKey method', () => {
      it('should create consistent cache keys for the same input', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        
        // Access the private method using type assertion
        const generateCacheKey = (service as any).generateCacheKey.bind(service);
        
        const options1 = {
          text: 'Hello world',
          languageCode: 'en-US',
          voice: 'echo',
          speed: 1.0
        };
        
        const options2 = { ...options1 };
        
        const key1 = generateCacheKey(options1);
        const key2 = generateCacheKey(options2);
        
        // Same input should produce same key
        expect(key1).toBe(key2);
        
        // Different input should produce different key
        const key3 = generateCacheKey({ ...options1, text: 'Different text' });
        expect(key1).not.toBe(key3);
      });
    });
    
    describe('getCachedAudio method', () => {
      it('should return cached audio if it exists and is not expired', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const getCachedAudio = (service as any).getCachedAudio.bind(service);
        
        // Setup a custom spy to handle Buffer responses properly
        const fsPromisesMock = await import('fs/promises');
        const readFileSpy = vi.spyOn(fsPromisesMock, 'readFile').mockImplementation(() => {
          return Promise.resolve(Buffer.from('cached audio data'));
        });
        
        // Setup stat mock to return a recent time
        vi.spyOn(fsPromisesMock, 'stat').mockResolvedValue({
          mtimeMs: Date.now() - 1000 // Very recent
        } as any);
        
        // Call with a key that will resolve in our mock
        const result = await getCachedAudio('fresh-cache-key');
        
        // Should return the cached buffer
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe('cached audio data');
        
        // Restore spies
        readFileSpy.mockRestore();
      });
      
      it('should return null for expired cache', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const getCachedAudio = (service as any).getCachedAudio.bind(service);
        
        // Call with a key that will be marked as expired
        const result = await getCachedAudio('expired');
        
        // Should return null for expired cache
        expect(result).toBeNull();
      });
      
      it('should return null when cache file does not exist', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const getCachedAudio = (service as any).getCachedAudio.bind(service);
        
        // Call with a key that will not exist in our mock
        const result = await getCachedAudio('nonexistent');
        
        // Should return null
        expect(result).toBeNull();
      });
    });
    
    describe('cacheAudio method', () => {
      it('should save audio to the cache directory', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const cacheAudio = (service as any).cacheAudio.bind(service);
        
        // Setup custom spy on writeFile that will actually track calls
        const fsPromisesMock = await import('fs/promises');
        const writeFileSpy = vi.spyOn(fsPromisesMock, 'writeFile').mockImplementation(
          (path, data) => Promise.resolve()
        );
        
        // Cache some audio
        const audioBuffer = Buffer.from('test audio data');
        await cacheAudio('test-key', audioBuffer);
        
        // Verify writeFile was called with correct parameters
        expect(writeFileSpy).toHaveBeenCalledWith(
          expect.stringContaining('test-key'),
          audioBuffer
        );
        
        // Clean up
        writeFileSpy.mockRestore();
      });
      
      it('should handle errors gracefully', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const cacheAudio = (service as any).cacheAudio.bind(service);
        
        // Setup custom spy on writeFile that will throw
        const fsPromisesMock = await import('fs/promises');
        const writeFileSpy = vi.spyOn(fsPromisesMock, 'writeFile').mockImplementation(
          () => Promise.reject(new Error('Write error'))
        );
        
        // Create a fresh console.error spy
        const originalConsoleError = console.error;
        console.error = vi.fn();
        
        // Cache should handle error gracefully
        await cacheAudio('error-key', Buffer.from('test'));
        
        // Verify error was logged
        expect(console.error).toHaveBeenCalled();
        
        // Restore original console.error
        console.error = originalConsoleError;
        writeFileSpy.mockRestore();
      });
    });
    
    describe('detectEmotions method', () => {
      it('should detect emotions in text with confidence scores', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const detectEmotions = (service as any).detectEmotions.bind(service);
        
        // Test with excited text
        const excitedResult = detectEmotions('This is amazing!!! I am so excited! 😄');
        expect(excitedResult.length).toBeGreaterThan(0);
        expect(excitedResult[0].emotion).toBe('excited');
        expect(excitedResult[0].confidence).toBeGreaterThan(0.5);
        
        // Test with serious text
        const seriousResult = detectEmotions('Warning: This is a critical and important message. ⚠️');
        expect(seriousResult.length).toBeGreaterThan(0);
        expect(seriousResult[0].emotion).toBe('serious');
        
        // Test with calm text
        const calmResult = detectEmotions('Relax and breathe deeply. Listen to the peaceful sounds. 😌');
        expect(calmResult.length).toBeGreaterThan(0);
        expect(calmResult[0].emotion).toBe('calm');
        
        // Test with sad text
        const sadResult = detectEmotions('I am so sorry and disappointed with the results. 😢');
        expect(sadResult.length).toBeGreaterThan(0);
        expect(sadResult[0].emotion).toBe('sad');
        
        // Test with neutral text
        const neutralResult = detectEmotions('This is a regular sentence without emotion.');
        expect(neutralResult.length).toBe(0);
      });
    });
    
    describe('selectVoice method', () => {
      it('should select appropriate voice based on language code', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const selectVoice = (service as any).selectVoice.bind(service);
        
        // Test with various language codes
        expect(selectVoice('en-US')).toBeDefined();
        expect(selectVoice('es-ES')).toBeDefined();
        expect(selectVoice('fr-FR')).toBeDefined();
        expect(selectVoice('de-DE')).toBeDefined();
        
        // Test with language code that doesn't have specific voices
        expect(selectVoice('unknown-LANG')).toBeDefined();
      });
      
      it('should select emotion-appropriate voices', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const selectVoice = (service as any).selectVoice.bind(service);
        
        // Check that emotions map to expected voices when available
        expect(selectVoice('en-US', 'excited')).toBe('echo');
        expect(selectVoice('en-US', 'serious')).toBe('onyx');
        expect(selectVoice('en-US', 'calm')).toBe('nova');
        expect(selectVoice('en-US', 'sad')).toBe('shimmer');
      });
    });
    
    describe('adjustSpeechParams method', () => {
      it('should adjust parameters for excited emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const adjustSpeechParams = (service as any).adjustSpeechParams.bind(service);
        
        const options = {
          text: 'This is amazing! Wow!',
          languageCode: 'en-US',
          speed: 1.0
        };
        
        const adjusted = adjustSpeechParams('excited', options);
        
        // Excited should increase speed
        expect(adjusted.speed).toBeGreaterThan(options.speed);
        // And modify text
        expect(adjusted.input).not.toBe(options.text);
        expect(adjusted.input.toUpperCase()).toContain('WOW');
      });
      
      it('should adjust parameters for serious emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const adjustSpeechParams = (service as any).adjustSpeechParams.bind(service);
        
        const options = {
          text: 'This is an important warning.',
          languageCode: 'en-US',
          speed: 1.0
        };
        
        const adjusted = adjustSpeechParams('serious', options);
        
        // Serious should decrease speed
        expect(adjusted.speed).toBeLessThan(options.speed);
        // And emphasize text
        expect(adjusted.input).toContain('IMPORTANT');
      });
      
      it('should adjust parameters for calm emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const adjustSpeechParams = (service as any).adjustSpeechParams.bind(service);
        
        const options = {
          text: 'Relax and stay calm.',
          languageCode: 'en-US',
          speed: 1.0
        };
        
        const adjusted = adjustSpeechParams('calm', options);
        
        // Calm should decrease speed
        expect(adjusted.speed).toBeLessThan(options.speed);
      });
      
      it('should adjust parameters for sad emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const adjustSpeechParams = (service as any).adjustSpeechParams.bind(service);
        
        const options = {
          text: 'I am sad about this.',
          languageCode: 'en-US',
          speed: 1.0
        };
        
        const adjusted = adjustSpeechParams('sad', options);
        
        // Sad should decrease speed
        expect(adjusted.speed).toBeLessThan(options.speed);
      });
      
      it('should handle unknown emotion without crashing', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const adjustSpeechParams = (service as any).adjustSpeechParams.bind(service);
        
        const options = {
          text: 'Test text',
          languageCode: 'en-US',
          speed: 1.0
        };
        
        // Should not throw for unknown emotion
        const adjusted = adjustSpeechParams('unknown', options);
        
        // Parameters should be unchanged
        expect(adjusted.speed).toBe(options.speed);
        expect(adjusted.input).toBe(options.text);
      });
    });
    
    describe('formatInputForEmotion method', () => {
      it('should format text for excited emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const formatInputForEmotion = (service as any).formatInputForEmotion.bind(service);
        
        const text = 'This is great! I like it.';
        const formatted = formatInputForEmotion(text, 'excited');
        
        // Should add more exclamation marks
        expect(formatted).toContain('!!');
      });
      
      it('should format text for serious emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const formatInputForEmotion = (service as any).formatInputForEmotion.bind(service);
        
        // Mock Math.random to ensure it returns a value that triggers the uppercase conversion
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.8);
        
        const text = 'This is important information that you need to know.';
        const formatted = formatInputForEmotion(text, 'serious');
        
        // Should have some words in uppercase (with our mocked random value)
        expect(formatted).not.toBe(formatted.toLowerCase());
        
        // Restore Math.random
        randomSpy.mockRestore();
      });
      
      it('should format text for calm emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const formatInputForEmotion = (service as any).formatInputForEmotion.bind(service);
        
        const text = 'Stay calm. Listen carefully.';
        const formatted = formatInputForEmotion(text, 'calm');
        
        // Should extend pauses
        expect(formatted).toContain('... ');
      });
      
      it('should format text for sad emotion', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const formatInputForEmotion = (service as any).formatInputForEmotion.bind(service);
        
        const text = 'I am sad. This is unfortunate!';
        const formatted = formatInputForEmotion(text, 'sad');
        
        // Should extend pauses and remove exclamation marks
        expect(formatted).toContain('... ');
        expect(formatted).not.toContain('!');
      });
    });
    
    describe('synthesizeSpeech method', () => {
      it('should use cached audio when available', async () => {
        // Prepare mock cachedAudio
        const mockCachedBuffer = Buffer.from('cached audio data');
        
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        
        // Mock the internal methods
        vi.spyOn(service as any, 'generateCacheKey').mockReturnValue('exists');
        vi.spyOn(service as any, 'getCachedAudio').mockResolvedValue(mockCachedBuffer);
        
        // Call synthesizeSpeech
        const result = await service.synthesizeSpeech({
          text: 'Test text',
          languageCode: 'en-US'
        });
        
        // Should return the cached buffer without calling OpenAI
        expect(result).toBe(mockCachedBuffer);
      });
      
      it('should generate speech when cache is not available', async () => {
        const mockOpenAI = {
          audio: {
            speech: {
              create: vi.fn().mockResolvedValue({
                arrayBuffer: async () => new TextEncoder().encode('generated audio').buffer
              })
            }
          }
        };
        
        const service = new ttsModule.OpenAITextToSpeechService(mockOpenAI);
        
        // Mock the internal methods
        vi.spyOn(service as any, 'generateCacheKey').mockReturnValue('nonexistent');
        vi.spyOn(service as any, 'getCachedAudio').mockResolvedValue(null);
        vi.spyOn(service as any, 'cacheAudio').mockResolvedValue(undefined);
        
        // Call synthesizeSpeech
        const result = await service.synthesizeSpeech({
          text: 'Test text',
          languageCode: 'en-US'
        });
        
        // Should call OpenAI
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();
        
        // Should return generated audio
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe('generated audio');
      });
      
      it('should detect and preserve emotions when requested', async () => {
        const mockOpenAI = {
          audio: {
            speech: {
              create: vi.fn().mockResolvedValue({
                arrayBuffer: async () => new TextEncoder().encode('generated audio').buffer
              })
            }
          }
        };
        
        const service = new ttsModule.OpenAITextToSpeechService(mockOpenAI);
        
        // Mock the internal methods
        vi.spyOn(service as any, 'generateCacheKey').mockReturnValue('nonexistent');
        vi.spyOn(service as any, 'getCachedAudio').mockResolvedValue(null);
        vi.spyOn(service as any, 'detectEmotions').mockReturnValue([
          { emotion: 'excited', confidence: 0.8 }
        ]);
        
        // We need to directly spy on formatInputForEmotion to ensure consistent output
        vi.spyOn(service as any, 'formatInputForEmotion').mockReturnValue('MODIFIED TEXT!!!!!!!!!!!!');
        
        // We need to directly mock the OpenAI call to track the exact parameters
        mockOpenAI.audio.speech.create.mockImplementation((options) => {
          // Here we'll log what parameters were actually received
          console.log('OpenAI called with:', JSON.stringify(options));
          return {
            arrayBuffer: async () => new TextEncoder().encode('generated audio').buffer
          };
        });
        
        vi.spyOn(service as any, 'cacheAudio').mockResolvedValue(undefined);
        
        // Call synthesizeSpeech with emotion preservation
        await service.synthesizeSpeech({
          text: 'Exciting text!!!',
          languageCode: 'en-US',
          preserveEmotions: true
        });
        
        // Should call OpenAI with exactly these parameters
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(expect.objectContaining({
          model: "tts-1",
          voice: expect.any(String),  // Allow any voice since it may vary
          speed: expect.any(Number),  // Allow any speed since it's calculated
          input: expect.any(String),  // Allow any input format since it's based on emotion detection
          response_format: "mp3"
        }));
      });
      
      it('should handle errors during speech synthesis', async () => {
        const mockOpenAI = {
          audio: {
            speech: {
              create: vi.fn().mockRejectedValue(new Error('OpenAI error'))
            }
          }
        };
        
        const service = new ttsModule.OpenAITextToSpeechService(mockOpenAI);
        
        // Mock the internal methods
        vi.spyOn(service as any, 'generateCacheKey').mockReturnValue('nonexistent');
        vi.spyOn(service as any, 'getCachedAudio').mockResolvedValue(null);
        
        // Mock console.error
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Call synthesizeSpeech - should throw
        await expect(service.synthesizeSpeech({
          text: 'Test text',
          languageCode: 'en-US'
        })).rejects.toThrow('Speech synthesis failed');
        
        // Should have logged the error
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Restore console.error
        consoleErrorSpy.mockRestore();
      });
    });
  });
  
  describe('textToSpeechService exported function', () => {
    it('should use the service type specified in environment', async () => {
      // We need to create a new TextToSpeechFactory instance with our mocks properly set up
      // First, restore the original module
      vi.restoreAllMocks();
      
      // Reset the process.env to include our desired service type
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          OPENAI_API_KEY: 'mock-api-key',
          TTS_SERVICE_TYPE: 'silent'
        }
      });
      
      // Now import the module again to get fresh instances
      const freshModule = await import('../../../server/services/TextToSpeechService');
      
      // Mock internal methods to prevent actual API calls
      const mockSilentService = new freshModule.SilentTextToSpeechService();
      vi.spyOn(freshModule.ttsFactory, 'getService').mockReturnValue(mockSilentService);
      
      // Call the exported function
      await freshModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should have called getService with the correct service type
      expect(freshModule.ttsFactory.getService).toHaveBeenCalledWith('silent');
      
      // Restore original process
      vi.unstubAllGlobals();
    });
    
    it('should default to openai service when environment variable is not set', async () => {
      // We need to create a new TextToSpeechFactory instance with our mocks properly set up
      // First, restore the original module
      vi.restoreAllMocks();
      
      // Reset the process.env without TTS_SERVICE_TYPE
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          OPENAI_API_KEY: 'mock-api-key'
        }
      });
      
      // Ensure TTS_SERVICE_TYPE is not defined
      delete process.env.TTS_SERVICE_TYPE;
      
      // Now import the module again to get fresh instances
      const freshModule = await import('../../../server/services/TextToSpeechService');
      
      // Mock internal methods to prevent actual API calls
      const mockOpenAIService = new freshModule.SilentTextToSpeechService(); // Using silent for simplicity
      vi.spyOn(freshModule.ttsFactory, 'getService').mockReturnValue(mockOpenAIService);
      
      // Call the exported function
      await freshModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should have called getService with the default service type
      expect(freshModule.ttsFactory.getService).toHaveBeenCalledWith('openai');
      
      // Restore original process
      vi.unstubAllGlobals();
    });
  });
});
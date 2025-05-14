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

// Mock fs module with ES Module compatibility
vi.mock('fs', async () => {
  const mockExistSync = vi.fn().mockImplementation((path) => {
    // Simulate certain paths existing
    return path.includes('exists') || path.includes('cache');
  });

  const mockConstants = {
    F_OK: 0
  };

  // Mock writeFile, readFile, etc. that are used with promisify
  const mockWriteFile = vi.fn();
  const mockReadFile = vi.fn();
  const mockAccess = vi.fn();
  const mockMkdir = vi.fn();
  const mockStat = vi.fn();

  return {
    default: {
      constants: mockConstants,
      existsSync: mockExistSync,
      writeFile: mockWriteFile,
      readFile: mockReadFile,
      access: mockAccess,
      mkdir: mockMkdir,
      stat: mockStat
    },
    constants: mockConstants,
    existsSync: mockExistSync,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    access: mockAccess,
    mkdir: mockMkdir,
    stat: mockStat,
    createReadStream: vi.fn().mockReturnValue({})
  };
});

// Mock fs/promises with detailed cache read/write behavior
vi.mock('fs/promises', async () => {
  const cachedFiles = new Map(); // In-memory simulation of files
  
  const mockFunctions = {
    writeFile: vi.fn().mockImplementation((path, data) => {
      cachedFiles.set(path, data);
      return Promise.resolve();
    }),
    readFile: vi.fn().mockImplementation((path) => {
      // Return specific data for paths we know about
      if (path.includes('cache') && cachedFiles.has(path)) {
        return Promise.resolve(cachedFiles.get(path));
      }
      if (path.includes('exists')) {
        return Promise.resolve(Buffer.from('mock cached audio'));
      }
      return Promise.reject(new Error('ENOENT: File not found'));
    }),
    access: vi.fn().mockImplementation((path) => {
      // Simulate file existence checks
      if (path.includes('exists') || path.includes('audio-cache') || 
          path.includes('temp') || cachedFiles.has(path)) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT: File not found'));
    }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockImplementation((path) => {
      // Simulate file stats with different creation times
      if (path.includes('expired')) {
        // Return an older time for expired files
        return Promise.resolve({
          mtimeMs: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
        });
      }
      // Return recent time for non-expired files
      return Promise.resolve({
        mtimeMs: Date.now() - (1 * 60 * 60 * 1000) // 1 hour ago
      });
    })
  };
  
  return {
    default: mockFunctions,
    ...mockFunctions
  };
});

// Mock crypto
vi.mock('crypto', async () => {
  // Simple mock hash function that returns a predictable hash
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockImplementation(format => {
      return 'mocked-hash-value';
    })
  };
  
  const mockFunctions = {
    createHash: vi.fn().mockReturnValue(mockHash)
  };
  
  return {
    default: mockFunctions,
    ...mockFunctions
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
        
        // Setup spy on readFile
        const readFileSpy = vi.mocked(await import('fs/promises')).readFile;
        readFileSpy.mockResolvedValueOnce(Buffer.from('cached audio data'));
        
        // Call with a key that will resolve in our mock
        const result = await getCachedAudio('exists');
        
        // Should return the cached buffer
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe('cached audio data');
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
        
        // Setup spy on writeFile
        const writeFileSpy = vi.mocked(await import('fs/promises')).writeFile;
        
        // Cache some audio
        const audioBuffer = Buffer.from('test audio data');
        await cacheAudio('test-key', audioBuffer);
        
        // Verify writeFile was called with correct parameters
        expect(writeFileSpy).toHaveBeenCalledWith(
          expect.stringContaining('test-key'),
          audioBuffer
        );
      });
      
      it('should handle errors gracefully', async () => {
        const service = new ttsModule.OpenAITextToSpeechService({ audio: { speech: { create: vi.fn() } } });
        const cacheAudio = (service as any).cacheAudio.bind(service);
        
        // Setup spy on writeFile to throw an error
        const writeFileSpy = vi.mocked(await import('fs/promises')).writeFile;
        writeFileSpy.mockRejectedValueOnce(new Error('Write error'));
        
        // Mock console.error to verify it was called
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Cache should handle error gracefully
        await cacheAudio('error-key', Buffer.from('test'));
        
        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Restore console.error
        consoleErrorSpy.mockRestore();
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
        
        const text = 'This is important information that you need to know.';
        const formatted = formatInputForEmotion(text, 'serious');
        
        // Should have some words in uppercase
        expect(formatted).not.toBe(text);
        expect(formatted).not.toBe(formatted.toLowerCase());
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
        vi.spyOn(service as any, 'adjustSpeechParams').mockReturnValue({
          voice: 'echo',
          speed: 1.2,
          input: 'MODIFIED TEXT!!!'
        });
        vi.spyOn(service as any, 'cacheAudio').mockResolvedValue(undefined);
        
        // Call synthesizeSpeech with emotion preservation
        await service.synthesizeSpeech({
          text: 'Exciting text!!!',
          languageCode: 'en-US',
          preserveEmotions: true
        });
        
        // Should call OpenAI with modified parameters
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
          expect.objectContaining({
            voice: 'echo',
            speed: 1.2,
            input: 'MODIFIED TEXT!!!'
          })
        );
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
      // Setup environment
      process.env.TTS_SERVICE_TYPE = 'silent';
      
      // Spy on the factory
      const factorySpy = vi.spyOn(ttsModule.ttsFactory, 'getService');
      
      // Call the exported function
      await ttsModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should use the specified service type
      expect(factorySpy).toHaveBeenCalledWith('silent');
      
      // Reset environment
      process.env.TTS_SERVICE_TYPE = 'openai';
    });
    
    it('should default to openai service when environment variable is not set', async () => {
      // Setup environment
      delete process.env.TTS_SERVICE_TYPE;
      
      // Spy on the factory
      const factorySpy = vi.spyOn(ttsModule.ttsFactory, 'getService');
      
      // Call the exported function
      await ttsModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should use the default service type
      expect(factorySpy).toHaveBeenCalledWith('openai');
      
      // Reset environment
      process.env.TTS_SERVICE_TYPE = 'openai';
    });
  });
});
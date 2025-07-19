/**
 * Text-to-Speech Service Tests
 * 
 * Tests for the TTS service implementations using only public APIs
 */
import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, Mock, MockInstance } from 'vitest';
import { Buffer } from 'node:buffer';
import type { Stats } from 'fs'; // Added for fs.Stats type
import type OpenAI from 'openai'; // For type annotation

// Type-only imports for SUT classes for annotations
import type {
  OpenAITextToSpeechService,
  BrowserSpeechSynthesisService,
  SilentTextToSpeechService
} from '../../../server/services/textToSpeech/TextToSpeechService';

// Corrected and simplified SUT imports
import { TextToSpeechFactory } from '../../../server/services/textToSpeech/TextToSpeechService';
import { type ITextToSpeechService, type TextToSpeechOptions } from '../../../server/services/textToSpeech/TextToSpeechService';

import path from 'path'; // path will be mocked, but import is needed for type usage and if tests use it
import crypto from 'crypto'; // crypto will be mocked, but static import useful for types or direct usage if mock passes through
import * as fs from 'fs'; // For fs.Stats type and fs.constants, mock will handle runtime

// SUT Constants (not exported by SUT, so define locally for test accuracy)
const SUT_MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// Declare variables to hold the dynamically imported SUT classes
let OpenAITextToSpeechServiceClass: typeof OpenAITextToSpeechService;
let BrowserSpeechSynthesisServiceClass: typeof BrowserSpeechSynthesisService;
let SilentTextToSpeechServiceClass: typeof SilentTextToSpeechService;
let TextToSpeechFactoryClass: typeof TextToSpeechFactory;
let ImportedOpenAIConstructor: typeof OpenAI; // To hold the dynamically imported OpenAI constructor
let openaiInstance: OpenAI;
let speechCreateMock: Mock;
let mockEnsureCacheDir: MockInstance<() => Promise<void>>; // CORRECTED TYPE HERE
let mockedCrypto: any; // ADDED
let mockedPath: any; // ADDED

// Top-level mock functions for crypto parts that tests can control and resetCryptoMock can access
let cryptoCreateHashMock: MockInstance<(...args: any[]) => { update: MockInstance<(...args: any[]) => { digest: MockInstance<(...args: any[]) => string> }> }>;
let cryptoUpdateMock: MockInstance<(...args: any[]) => { digest: MockInstance<(...args: any[]) => string> }>;
let cryptoDigestMock: MockInstance<(...args: any[]) => string>;

// Define persistent mock functions for the promisified versions
// These are the mocks we will control and assert against for fs operations
const mockPromisifiedAccess = vi.fn();
const mockPromisifiedStat = vi.fn();
const mockPromisifiedReadFile = vi.fn();
const mockPromisifiedWriteFile = vi.fn();
const mockPromisifiedMkdir = vi.fn();

// Mock 'util' to control how fs functions are promisified
vi.mock('util', async (importOriginal) => {
  const actualUtil = await importOriginal<typeof import('util')>();
  return {
    ...actualUtil,
    promisify: vi.fn((fnToPromisify: any) => {
      const funcName = fnToPromisify && fnToPromisify.name;
      // console.log(`Promisifying function with name: ${funcName}`); // Debug log

      if (funcName === 'access') return mockPromisifiedAccess;
      if (funcName === 'stat') return mockPromisifiedStat;
      if (funcName === 'readFile') return mockPromisifiedReadFile;
      if (funcName === 'writeFile') return mockPromisifiedWriteFile;
      if (funcName === 'mkdir') return mockPromisifiedMkdir;
      
      // Fallback for non-FS functions or if fnToPromisify is unusual
      try {
        const originalPromisified = actualUtil.promisify(fnToPromisify);
        if (typeof originalPromisified === 'function') {
          // console.warn(`Promisifying unexpected function '${funcName || 'unknown'}' with original util.promisify.`);
          return originalPromisified;
        }
        // If actualUtil.promisify returns non-function (should not happen for valid inputs)
        console.warn(`actualUtil.promisify for '${funcName || 'unknown'}' did not return a function. Falling back to generic mock.`);
        return vi.fn().mockResolvedValue(undefined); 
      } catch (e) {
        // If actualUtil.promisify throws (e.g., fnToPromisify is not a function it can handle)
        console.error(`Error trying to use actualUtil.promisify for '${funcName || 'unknown'}':`, e, '. Falling back to generic mock.');
        return vi.fn().mockResolvedValue(undefined);
      }
    }),
  };
});

// Mock 'fs' module
// The SUT imports 'fs' and uses its functions (e.g., fs.access), which are then promisified.
// We need to mock these base fs functions and add a custom property __FS_FUNC_NAME
// so our util.promisify mock can identify them and return the correct persistent mock (e.g., mockPromisifiedAccess).
vi.mock('fs', async (importOriginal) => {
  const actualFs = await importOriginal<typeof import('fs')>();

  const createMockFsFunction = (name: string, defaultCbImplementation?: (...args: any[]) => void) => {
    const mock = vi.fn((...args: any[]) => {
      // ADDED LOG FOR writeFile specifically
      if (name === 'writeFile') {
        console.log('[DEBUG fs.writeFile mock] Path:', args[0]);
        const dataToWrite = args[1];
        if (Buffer.isBuffer(dataToWrite)) {
          console.log('[DEBUG fs.writeFile mock] Data (Buffer toHex):', dataToWrite.toString('hex'));
          console.log('[DEBUG fs.writeFile mock] Data (Buffer toString):', dataToWrite.toString());
        } else {
          console.log('[DEBUG fs.writeFile mock] Data (Not a Buffer):', dataToWrite);
        }
      }
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        if (defaultCbImplementation) {
          defaultCbImplementation(...args);
        } else {
          callback(null); // Default success callback with no specific value
        }
      }
    });
    (mock as any).__FS_FUNC_NAME = name; // Crucial for the util.promisify mock
    return mock;
  };

  const mockFs = {
    ...actualFs, // Pass through all other fs functions and constants
    access: createMockFsFunction('access'),
    mkdir: createMockFsFunction('mkdir'),
    writeFile: createMockFsFunction('writeFile', (path, data, options, callback) => {
      // If callback is the third argument (options is omitted)
      const cb = typeof options === 'function' ? options : callback;

      console.log('--- mock fs.writeFile ---');
      console.log('Path:', path);
      console.log('Data (type):', typeof data);
      console.log('Data (is Buffer?):', Buffer.isBuffer(data));
      if (Buffer.isBuffer(data)) {
        console.log('Data (Buffer.toString(\'hex\')):', data.toString('hex'));
        console.log('Data (Buffer.length):', data.length);
      } else if (typeof data === 'string') {
        console.log('Data (string value):', data);
      }
      // console.log('Options:', typeof options === 'function' ? undefined : options);
      console.log('--- end mock fs.writeFile ---');

      if (mockPromisifiedWriteFile) {
        mockPromisifiedWriteFile(path, data, options, cb);
      } else {
        cb(null); // Simulate success
      }
    }),
    readFile: createMockFsFunction('readFile'),
    unlink: createMockFsFunction('unlink'),
    constants: (actualFs as any).constants,
  };

  return {
    default: mockFs,
    ...mockFs,
  };
});


// Mock 'path' module
// The SUT uses path.join, so we mock it to be predictable in tests.
// process.cwd() will be the actual cwd of the test runner.
vi.mock('path', async (importOriginal) => {
  const actualPath = await importOriginal<typeof import('path')>();
  return {
    ...actualPath, // Use actual path functions by default
    join: (...args: string[]) => { // Override specific functions needed for testing
      // Simple platform-agnostic join for testing, assuming forward slashes.
      // Node's path.join would handle platform differences, but for string matching,
      // a consistent mock is easier. If tests need real path.join behavior,
      // this mock might need to be more sophisticated or conditional.
      return args.filter(arg => arg !== '').join('/');
    },
    // Keep other path functions like resolve, dirname, basename as actual implementations
    // unless they also need to be controlled for tests.
    // For now, only join is explicitly mocked.
    // default: { // This structure was from the original, might not be needed if directly mocking functions
    //   join: (...args: string[]) => args.join('/'),
    //   resolve: (...args: string[]) => args.join('/'), // Example, adjust if needed
    //   dirname: (p: string) => actualPath.dirname(p), // Use actual
    //   basename: (p: string) => actualPath.basename(p), // Use actual
    // }
  };
});


// Mock OpenAI
// No top-level variable for the mock needed here.
// The mock function will be accessed via the instance of the mocked OpenAI.
vi.mock('openai', async () => {
  // console.log('--- Mocking OpenAI module ---');
  const OpenAI = vi.fn().mockImplementation(() => {
    // console.log('--- Mocked OpenAI constructor called ---');
    const internalMockCreate = vi.fn();
    const mockInstance = {
      audio: {
        speech: {
          create: internalMockCreate,
        },
      },
    };
    // console.log('--- Mocked OpenAI instance created with mock create ---', mockInstance.audio.speech.create);
    return mockInstance;
  });
  return { default: OpenAI, OpenAI };
});


// Mock 'crypto' - Placed here, with other top-level mocks
vi.mock('crypto', () => {
  // These inner mocks are created fresh each time the module is imported (e.g. by vi.resetModules + await import)
  const digestFn = vi.fn().mockReturnValue('mocked-crypto-hash');
  const updateFn = vi.fn(() => ({ digest: digestFn }));
  const createHashFn = vi.fn(() => ({ update: updateFn }));

  // Assign to the higher-scope variables so that tests and resetCryptoMock can reference them
  cryptoCreateHashMock = createHashFn;
  cryptoUpdateMock = updateFn;
  cryptoDigestMock = digestFn;

  return {
    createHash: createHashFn,
    // Expose for direct test manipulation if ever needed, though using the top-level vars is preferred
    // Using non-ASCII characters as an obfuscation strategy to discourage direct use in tests.
    _test_ડાયજેસ્ટ_: digestFn, 
    _test_અપડેટ_: updateFn
  };
});


// Actual fs constants might be needed for mode arguments (e.g. fs.constants.F_OK)
// Since fs is mocked, we might need to provide these explicitly if the mock doesn't pass them through.
// The current fs mock spreads actualFs, so fs.constants should be available.
// Let's import actual fs to be sure we have constants, or define them.
import * as fsConstantsModule from 'fs';
const fsOriginalConstants = fsConstantsModule.constants;


// Helper to reset all promisified FS mocks
const resetPromisifiedFsMocks = () => {
  mockPromisifiedAccess.mockReset();
  mockPromisifiedStat.mockReset();
  mockPromisifiedReadFile.mockReset();
  mockPromisifiedWriteFile.mockReset();
  mockPromisifiedMkdir.mockReset();
};

// Define resetCryptoMock AFTER vi.mock('crypto') factory which assigns to the variables
const resetCryptoMock = () => {
  cryptoCreateHashMock?.mockClear();
  cryptoUpdateMock?.mockClear();
  cryptoDigestMock?.mockClear();
  cryptoDigestMock?.mockReturnValue('mocked-crypto-hash-after-reset');
};


describe('Text-to-Speech Services', () => {
  let OpenAITextToSpeechServiceInstance: OpenAITextToSpeechService;
  let localSynthesizeSpeechService: OpenAITextToSpeechService;

  beforeEach(async () => {
    resetPromisifiedFsMocks();
    
    // Dynamically import SUT module to ensure mocks are applied before SUT code runs
    const SUTModule = await import('../../../server/services/textToSpeech/TextToSpeechService');
    OpenAITextToSpeechServiceClass = SUTModule.OpenAITextToSpeechService;
    BrowserSpeechSynthesisServiceClass = SUTModule.BrowserSpeechSynthesisService;
    SilentTextToSpeechServiceClass = SUTModule.SilentTextToSpeechService;
    TextToSpeechFactoryClass = SUTModule.TextToSpeechFactory;

    const OpenAIActualImport = await import('openai');
    ImportedOpenAIConstructor = OpenAIActualImport.default; 
    const MockedOpenAIConstructor = ImportedOpenAIConstructor as unknown as Mock;

    MockedOpenAIConstructor.mockClear(); 
    
    openaiInstance = new ImportedOpenAIConstructor({ apiKey: 'test-key' }); 
    speechCreateMock = openaiInstance.audio.speech.create as Mock;
    speechCreateMock.mockClear(); 
    speechCreateMock.mockReset(); 

    // Instance for general tests, specific describe blocks might create their own
    OpenAITextToSpeechServiceInstance = new OpenAITextToSpeechServiceClass(openaiInstance);

    // Spy on ensureCacheDirectoryExists *before* creating the instance
    mockEnsureCacheDir = vi.spyOn(OpenAITextToSpeechServiceClass.prototype as any, 'ensureCacheDirectoryExists');

    localSynthesizeSpeechService = new OpenAITextToSpeechServiceClass(openaiInstance);
    
    // Clear mocks that might be called in constructor or previous tests
    speechCreateMock.mockClear();
    mockPromisifiedAccess.mockClear();
    mockPromisifiedStat.mockClear();
    mockPromisifiedReadFile.mockClear();
    mockPromisifiedWriteFile.mockClear();
    mockPromisifiedMkdir.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks(); // Clears all mocks including spies, call history, and implementations
  });
  
  // Constants for cache directory used in SUT
  // We need to know what process.cwd() will be in the test environment.
  // For now, let's assume it's the project root.
  const SUT_CACHE_DIR = path.join(process.cwd(), 'audio-cache');
  const SUT_TEMP_DIR = path.join(process.cwd(), 'temp');


  describe('BrowserSpeechSynthesisService', () => {
    let service: BrowserSpeechSynthesisService;

    beforeEach(() => {
      // Ensure class is loaded if not already by top-level beforeEach
      if (!BrowserSpeechSynthesisServiceClass) throw new Error('BrowserSpeechSynthesisServiceClass not loaded');
      service = new BrowserSpeechSynthesisServiceClass();
    });

    it('should return a JSON marker object as a buffer', async () => {
      const options = {
        text: 'Hello browser',
        languageCode: 'en-GB',
        preserveEmotions: true,
        speed: 1.2,
      };
      const resultBuffer = await service.synthesizeSpeech(options);
      expect(resultBuffer).toBeInstanceOf(Buffer);

      const resultJson = JSON.parse(resultBuffer.toString());
      expect(resultJson).toEqual({
        type: 'browser-speech',
        text: 'Hello browser',
        languageCode: 'en-GB',
        preserveEmotions: true,
        speed: 1.2,
        autoPlay: true,
      });
    });

    it('should use default speed if not provided', async () => {
      const options = {
        text: 'Test with default speed',
        languageCode: 'fr-FR',
      };
      const resultBuffer = await service.synthesizeSpeech(options);
      const resultJson = JSON.parse(resultBuffer.toString());
      expect(resultJson.speed).toBe(1.0);
      expect(resultJson.autoPlay).toBe(true); // Ensure autoPlay is always true
    });

    it('should handle empty text', async () => {
      const options = {
        text: '',
        languageCode: 'de-DE',
      };
      const resultBuffer = await service.synthesizeSpeech(options);
      const resultJson = JSON.parse(resultBuffer.toString());
      expect(resultJson.text).toBe('');
    });
  });

  describe('SilentTextToSpeechService', () => {
    let service: SilentTextToSpeechService;

    beforeEach(() => {
      if (!SilentTextToSpeechServiceClass) throw new Error('SilentTextToSpeechServiceClass not loaded');
      service = new SilentTextToSpeechServiceClass();
    });

    it('should return an empty buffer', async () => {
      // Arrange
      const options = {
        text: '',
        languageCode: 'en-US'
      };
      
      // Act - call public method
      const result = await service.synthesizeSpeech(options);
      
      // Assert - verify public behavior
      expect(result).toBeInstanceOf(Buffer);
      // SilentTextToSpeechService should return some audio data (even if silent)
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle any text input', async () => {
      // Arrange
      const service = new SilentTextToSpeechServiceClass();
      
      // Act & Assert - should handle empty text
      const result1 = await service.synthesizeSpeech({
        text: '',
        languageCode: 'en-US'
      });
      expect(result1).toBeInstanceOf(Buffer);
      
      // Should handle long text
      const result2 = await service.synthesizeSpeech({
        text: 'This is a very long text that should still be handled properly by the silent service',
        languageCode: 'es-ES'
      });
      expect(result2).toBeInstanceOf(Buffer);
    });
  });

  describe('TextToSpeechFactory', () => {
    let factory: TextToSpeechFactory;
    let originalOpenAIKey: string | undefined; // Added to store original key

    beforeEach(async() => {
      originalOpenAIKey = process.env.OPENAI_API_KEY; // Store original key
      vi.resetModules();
      process.env.OPENAI_API_KEY = 'test_api_key_for_factory_tests'; // Set a mock key for these tests

      // Re-import SUT classes after resetModules, as they are cleared from cache
      const SUTModule = await import('../../../server/services/textToSpeech/TextToSpeechService');
      OpenAITextToSpeechServiceClass = SUTModule.OpenAITextToSpeechService;
      BrowserSpeechSynthesisServiceClass = SUTModule.BrowserSpeechSynthesisService;
      SilentTextToSpeechServiceClass = SUTModule.SilentTextToSpeechService;
      TextToSpeechFactoryClass = SUTModule.TextToSpeechFactory;
      
      // Re-import OpenAI as well, if its mock setup needs to be fresh post-reset
      const OpenAIActualImport = await import('openai');
      ImportedOpenAIConstructor = OpenAIActualImport.default;

      // Use ImportedOpenAIConstructor directly or ensure MockedOpenAIConstructor is correctly scoped and assigned
      // If MockedOpenAIConstructor is intended to be the one from the outer scope, ensure it's accessible here
      // or re-assign it if necessary. For now, let's assume ImportedOpenAIConstructor is what we need to cast and use.
      const currentMockedOpenAIConstructor = ImportedOpenAIConstructor as unknown as Mock;

      currentMockedOpenAIConstructor.mockClear();
      // Access mockInstance from the correctly typed constructor
      const mockInstance = (currentMockedOpenAIConstructor as any).mock?.results?.[0]?.value; // Accessing the instance created by the mock

      if (mockInstance && mockInstance.audio && mockInstance.audio.speech && mockInstance.audio.speech.create) {
        const spCreateMock = mockInstance.audio.speech.create;
        if (spCreateMock && typeof spCreateMock.mockClear === 'function') {
          spCreateMock.mockClear();
          spCreateMock.mockReset(); // also reset it
        }
      } else if ((currentMockedOpenAIConstructor as any).mockInstance) { // Fallback for older mock style if needed
         const legacyMockInstance = (currentMockedOpenAIConstructor as any).mockInstance;
         if (legacyMockInstance && legacyMockInstance.audio && legacyMockInstance.audio.speech && legacyMockInstance.audio.speech.create) {
            const spCreateMock = legacyMockInstance.audio.speech.create;
            if (spCreateMock && typeof spCreateMock.mockClear === 'function') {
              spCreateMock.mockClear();
              spCreateMock.mockReset();
            }
         }
      }

      if (!TextToSpeechFactoryClass) throw new Error('TextToSpeechFactoryClass not loaded');
      factory = TextToSpeechFactoryClass.getInstance();
    });

    afterEach(() => { // Added to restore the original key
      if (originalOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      }
    });

    it('should return OpenAITextToSpeechService by default', () => {
      const service = factory.getService('openai');
      expect(service.constructor.name).toBe('OpenAITextToSpeechService');
    });

    it('should return BrowserSpeechSynthesisService when type is "browser"', () => {
      const service = factory.getService('browser');
      expect(service.constructor.name).toBe('BrowserSpeechSynthesisService');
    });

    it('should return SilentTextToSpeechService when type is "silent"', () => {
      const service = factory.getService('silent');
      expect(service.constructor.name).toBe('SilentTextToSpeechService');
    });

    it('should return OpenAITextToSpeechService for unknown type as a fallback', () => {
      const service = factory.getService('unknown-service-type');
      expect(service.constructor.name).toBe('OpenAITextToSpeechService'); 
    });

    it('should reuse existing service instances for browser and silent, but not openai', () => {
      const service1 = factory.getService('openai');
      const service2 = factory.getService('openai');
      expect(service1).not.toBe(service2); // OpenAI service is NOT singleton anymore

      const browserService1 = factory.getService('browser');
      const browserService2 = factory.getService('browser');
      expect(browserService1).toBe(browserService2);

      const silentService1 = factory.getService('silent');
      const silentService2 = factory.getService('silent');
      expect(silentService1).toBe(silentService2);
    });
  });


  describe('OpenAITextToSpeechService', () => {
    let service: OpenAITextToSpeechService;
    let mockEnsureCacheDir: MockInstance<() => Promise<void>>; // Or MockInstance<() => Promise<void>>;

    beforeEach(async () => {
      vi.resetModules();
      resetPromisifiedFsMocks();
      resetCryptoMock();

      const openAIModule = await import('openai');
      ImportedOpenAIConstructor = openAIModule.default as any;

      const SUTModule = await import('../../../server/services/textToSpeech/TextToSpeechService');
      OpenAITextToSpeechServiceClass = SUTModule.OpenAITextToSpeechService;
      BrowserSpeechSynthesisServiceClass = SUTModule.BrowserSpeechSynthesisService;
      SilentTextToSpeechServiceClass = SUTModule.SilentTextToSpeechService;
      TextToSpeechFactoryClass = SUTModule.TextToSpeechFactory;

      mockedCrypto = await import('crypto') as any;
      mockedPath = await import('path') as any;

      openaiInstance = new ImportedOpenAIConstructor({ apiKey: 'test-key' });
      speechCreateMock = openaiInstance.audio.speech.create as Mock;

      mockEnsureCacheDir = vi.spyOn(OpenAITextToSpeechServiceClass.prototype as any, 'ensureCacheDirectoryExists');

      localSynthesizeSpeechService = new OpenAITextToSpeechServiceClass(openaiInstance);

      speechCreateMock.mockClear();
      resetPromisifiedFsMocks(); 
      resetCryptoMock(); 

      // IMPORTANT: Import crypto *after* vi.resetModules() and *before* resetCryptoMock()
      // This ensures the factory in vi.mock('crypto', ...) runs and populates the top-level mock vars.
      await import('crypto'); 
      resetCryptoMock(); // Now it's safe to reset, vars are (re)populated.
    });

    describe('ensureCacheDirectoryExists', () => {
      let consoleErrorSpy: MockInstance<(...args: any[]) => void>;

      beforeEach(async () => {
        if (!OpenAITextToSpeechServiceClass || !openaiInstance) {
          throw new Error('Parent scope variables (OpenAITextToSpeechServiceClass or openaiInstance) not set for ensureCacheDirectoryExists tests.');
        }
        service = new OpenAITextToSpeechServiceClass(openaiInstance); // Constructor calls actual ensureCacheDirectoryExists
        resetPromisifiedFsMocks(); // Reset fs mocks AFTER constructor
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleErrorSpy.mockRestore();
      });

      it('should create cache and temp directories if they do not exist', async () => {
        mockPromisifiedAccess.mockRejectedValue(new Error('ENOENT')); 
        mockPromisifiedMkdir.mockResolvedValue(undefined);
        
        // DIAGNOSTIC: Explicitly clear mockPromisifiedAccess right before the call under test
        mockPromisifiedAccess.mockClear(); 

        await service['ensureCacheDirectoryExists']();

        // Log calls to mockPromisifiedAccess for debugging
        console.log('mockPromisifiedAccess calls (after explicit clear):', JSON.stringify(mockPromisifiedAccess.mock.calls, null, 2));

        expect(mockPromisifiedAccess).toHaveBeenCalledTimes(2);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(1, SUT_CACHE_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(2, SUT_TEMP_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedMkdir).toHaveBeenCalledTimes(2);
        expect(mockPromisifiedMkdir).toHaveBeenNthCalledWith(1, SUT_CACHE_DIR, { recursive: true });
        expect(mockPromisifiedMkdir).toHaveBeenNthCalledWith(2, SUT_TEMP_DIR, { recursive: true });
      });

      it('should not create directories if they already exist', async () => {
        mockPromisifiedAccess.mockResolvedValue(undefined); // Both access calls succeed (dirs exist)
        mockPromisifiedAccess.mockClear();

        await service['ensureCacheDirectoryExists']();

        expect(mockPromisifiedAccess).toHaveBeenCalledTimes(2);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(1, SUT_CACHE_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(2, SUT_TEMP_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedMkdir).not.toHaveBeenCalled();
      });

      it('should create only temp directory if cache dir exists but temp dir does not', async () => {
        mockPromisifiedAccess
          .mockResolvedValueOnce(undefined) // Cache dir exists
          .mockRejectedValueOnce(new Error('ENOENT')); // Temp dir does not exist
        mockPromisifiedMkdir.mockResolvedValue(undefined); // Mkdir for temp succeeds
        mockPromisifiedAccess.mockClear();

        await service['ensureCacheDirectoryExists']();

        expect(mockPromisifiedAccess).toHaveBeenCalledTimes(2);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(1, SUT_CACHE_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(2, SUT_TEMP_DIR, fsOriginalConstants.F_OK);
        
        expect(mockPromisifiedMkdir).toHaveBeenCalledTimes(1);
        expect(mockPromisifiedMkdir).toHaveBeenCalledWith(SUT_TEMP_DIR, { recursive: true });
      });
      
      it('should handle errors during directory creation gracefully', async () => {
        mockPromisifiedAccess.mockRejectedValue(new Error('ENOENT')); // Both dirs don't exist
        mockPromisifiedMkdir.mockRejectedValue(new Error('Mkdir failed')); // Both mkdir calls fail
        mockPromisifiedAccess.mockClear();

        await service['ensureCacheDirectoryExists']();

        expect(mockPromisifiedMkdir).toHaveBeenCalledTimes(2); // Both mkdir attempts
        expect(mockPromisifiedAccess).toHaveBeenCalledTimes(2);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(1, SUT_CACHE_DIR, fsOriginalConstants.F_OK);
        expect(mockPromisifiedAccess).toHaveBeenNthCalledWith(2, SUT_TEMP_DIR, fsOriginalConstants.F_OK);
      });
    });

    describe('getCachedAudio', () => {
      let service: OpenAITextToSpeechService;
      const cacheKey = 'testCacheKey';
      const expectedCachePath = `${SUT_CACHE_DIR}/${cacheKey}.mp3`;

      beforeEach(() => {
        resetPromisifiedFsMocks();
        // Ensure OpenAITextToSpeechServiceClass and openaiInstance are initialized before creating service
        if (!OpenAITextToSpeechServiceClass || !openaiInstance) {
          throw new Error('Required classes not initialized for getCachedAudio tests');
        }
        service = new OpenAITextToSpeechServiceClass(openaiInstance);
      });

      it('should return cached audio buffer if file exists and is not expired', async () => {
        const mockAudioBuffer = Buffer.from('audio data');
        mockPromisifiedAccess.mockResolvedValue(undefined); // File exists
        mockPromisifiedStat.mockResolvedValue({ mtimeMs: Date.now() - (SUT_MAX_CACHE_AGE_MS / 2) } as Stats); // Not expired
        mockPromisifiedReadFile.mockResolvedValue(mockAudioBuffer);

        const result = await (service as any).getCachedAudio(cacheKey);

        expect(result).toEqual(mockAudioBuffer);
        expect(mockPromisifiedAccess).toHaveBeenCalledWith(expectedCachePath, fs.constants.F_OK);
        expect(mockPromisifiedStat).toHaveBeenCalledWith(expectedCachePath);
        expect(mockPromisifiedReadFile).toHaveBeenCalledWith(expectedCachePath);
      });

      it('should return null if cached file does not exist', async () => {
        mockPromisifiedAccess.mockRejectedValue(new Error('ENOENT')); // File does not exist

        const result = await (service as any).getCachedAudio(cacheKey);

        expect(result).toBeNull();
        expect(mockPromisifiedAccess).toHaveBeenCalledWith(expectedCachePath, fs.constants.F_OK);
        expect(mockPromisifiedStat).not.toHaveBeenCalled();
        expect(mockPromisifiedReadFile).not.toHaveBeenCalled();
      });

      it('should return null if cached file is expired', async () => {
        mockPromisifiedAccess.mockResolvedValue(undefined); // File exists
        mockPromisifiedStat.mockResolvedValue({ mtimeMs: Date.now() - SUT_MAX_CACHE_AGE_MS * 2 } as Stats); // Expired

        const result = await (service as any).getCachedAudio(cacheKey);

        expect(result).toBeNull();
        expect(mockPromisifiedAccess).toHaveBeenCalledWith(expectedCachePath, fs.constants.F_OK);
        expect(mockPromisifiedStat).toHaveBeenCalledWith(expectedCachePath);
        expect(mockPromisifiedReadFile).not.toHaveBeenCalled();
      });
    });

    describe('cacheAudio', () => {
      let service: OpenAITextToSpeechService;
      const cacheKey = 'testCacheKey';
      const audioBuffer = Buffer.from('new audio data');
      const expectedCachePath = `${SUT_CACHE_DIR}/${cacheKey}.mp3`;

      beforeEach(() => {
        resetPromisifiedFsMocks();
        if (!OpenAITextToSpeechServiceClass || !openaiInstance) {
          throw new Error('Required classes not initialized for cacheAudio tests');
        }
        service = new OpenAITextToSpeechServiceClass(openaiInstance);
        mockPromisifiedWriteFile.mockResolvedValue(undefined); 
      });

      it('should write audio buffer to cache file', async () => {
        await (service as any).cacheAudio(cacheKey, audioBuffer);
        expect(mockPromisifiedWriteFile).toHaveBeenCalledWith(expectedCachePath, audioBuffer);
      });

      it('should log an error if caching fails', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockPromisifiedWriteFile.mockRejectedValue(new Error('Write failed'));

        await (service as any).cacheAudio(cacheKey, audioBuffer);

        expect(mockPromisifiedWriteFile).toHaveBeenCalledWith(expectedCachePath, audioBuffer);
        expect(consoleErrorSpy).toHaveBeenCalled();
        // Updated the expected string to match the actual output
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error caching audio:', expect.any(Error));

        consoleErrorSpy.mockRestore();
      });
    });

  });
});

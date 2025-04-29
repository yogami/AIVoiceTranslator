/**
 * TextToSpeechService Adapter
 * 
 * This adapter provides compatibility between the legacy TextToSpeechService API
 * and the new refactored implementation following SOLID principles.
 */

import {
  TextToSpeechFactory,
  ITextToSpeechService,
  TextToSpeechOptions,
  OpenAITextToSpeechService,
  BrowserSpeechSynthesisService,
  SilentTextToSpeechService,
  NodeFileSystem,
  TTSCacheManager,
  EmotionDetector,
  VoiceSelector,
  OpenAITTSApiProvider,
  TTSErrorHandler
} from './TextToSpeechService.refactored';

// Create instances of all dependencies
const fileSystem = new NodeFileSystem();
const cacheManager = new TTSCacheManager(fileSystem);
const emotionProcessor = new EmotionDetector();
const voiceSelector = new VoiceSelector();
const apiProvider = new OpenAITTSApiProvider();
const errorHandler = new TTSErrorHandler();

// Create the OpenAI TTS service with all dependencies
const openAITTSService = new OpenAITextToSpeechService(
  cacheManager,
  emotionProcessor,
  voiceSelector,
  apiProvider,
  errorHandler
);

// Create factory with configured services
const ttsFactory = new TextToSpeechFactory(
  openAITTSService,
  new BrowserSpeechSynthesisService(),
  new SilentTextToSpeechService()
);

// Legacy singleton-style export for compatibility
const textToSpeechService = {
  /**
   * Get audio for the given text in the specified language
   */
  async getAudioForText(text: string, languageCode: string, options: any = {}): Promise<Buffer> {
    const ttsServiceType = options.ttsServiceType || 'openai';
    const preserveEmotions = options.preserveEmotions !== false;
    
    const ttsService = ttsFactory.createTTSService(ttsServiceType);
    
    const ttsOptions: TextToSpeechOptions = {
      text,
      languageCode,
      preserveEmotions,
      voice: options.voice,
      speed: options.speed
    };
    
    return ttsService.synthesizeSpeech(ttsOptions);
  },
  
  /**
   * Get TTS service for the specified type
   */
  getTTSService(ttsServiceType: string): ITextToSpeechService {
    return ttsFactory.createTTSService(ttsServiceType);
  }
};

// Export both the factory and the singleton-style service for compatibility
export { textToSpeechService, ttsFactory };
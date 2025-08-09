import { ITranslationService } from './translation.interfaces';
import { OpenAITranslationService } from './OpenAITranslationService';
import { MyMemoryTranslationService } from './MyMemoryTranslationService';
import { DeepSeekTranslationService } from './DeepSeekTranslationService';
import { OpenAI } from 'openai';

export class AutoFallbackTranslationService implements ITranslationService {
  private primaryService: ITranslationService;
  private fallbackService: ITranslationService;

  constructor(primaryService: ITranslationService, fallbackService: ITranslationService) {
    this.primaryService = primaryService;
    this.fallbackService = fallbackService;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    try {
      console.log('[AutoFallbackTranslation] Attempting primary service...');
      return await this.primaryService.translate(text, sourceLang, targetLang);
    } catch (error) {
      // Log and fallback
      console.warn('[AutoFallbackTranslation] Primary service failed, falling back to secondary:', error instanceof Error ? error.message : error);
      try {
        return await this.fallbackService.translate(text, sourceLang, targetLang);
      } catch (fallbackError) {
        console.error('[AutoFallbackTranslation] Both services failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
        // Return original text as last resort instead of throwing
        console.warn('[AutoFallbackTranslation] Returning original text as last resort');
        return text;
      }
    }
  }
}

// Factory function to create the fallback service
export function createAutoFallbackTranslationService(): ITranslationService {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let primaryService: ITranslationService;
  let fallbackService: ITranslationService;
  
  // Primary: MyMemory (FREE)
  primaryService = new MyMemoryTranslationService();
  
  // Fallback: OpenAI (PAID) if available, otherwise return original text
  if (openaiApiKey) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    fallbackService = new OpenAITranslationService(openai);
  } else {
    // If no OpenAI key, create a service that returns original text
    fallbackService = {
      translate: async (text, _sourceLang, _targetLang) => {
        console.warn('[AutoFallbackTranslation] No OpenAI key, returning original text');
        return text;
      }
    };
  }
  
  return new AutoFallbackTranslationService(primaryService, fallbackService);
}

// New: DeepSeek-first 2-tier auto service (opt-in) without changing existing default behavior
export function createDeepSeekFirstAutoFallbackTranslationService(): ITranslationService {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let primaryService: ITranslationService = new DeepSeekTranslationService();
  let fallbackService: ITranslationService;

  if (openaiApiKey) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    fallbackService = new OpenAITranslationService(openai);
  } else {
    // If OpenAI is not available, fall back to MyMemory as last resort
    fallbackService = new MyMemoryTranslationService();
  }

  return new AutoFallbackTranslationService(primaryService, fallbackService);
}

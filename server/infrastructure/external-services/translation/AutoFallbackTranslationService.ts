import { ITranslationService } from './translation.interfaces';
import { OpenAITranslationService } from './OpenAITranslationService';
import { MyMemoryTranslationService } from './MyMemoryTranslationService';
import { OpenAI } from 'openai';

export class AutoFallbackTranslationService implements ITranslationService {
  private openaiService: ITranslationService;
  private myMemoryService: ITranslationService;

  constructor(openaiService: ITranslationService, myMemoryService: ITranslationService) {
    this.openaiService = openaiService;
    this.myMemoryService = myMemoryService;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    try {
      return await this.openaiService.translate(text, sourceLang, targetLang);
    } catch (error) {
      // Log and fallback
      console.warn('[AutoFallbackTranslation] OpenAI failed, falling back to MyMemory:', error instanceof Error ? error.message : error);
      return await this.myMemoryService.translate(text, sourceLang, targetLang);
    }
  }
}

// Factory function to create the fallback service
export function createAutoFallbackTranslationService(): ITranslationService {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let openaiService: ITranslationService;
  if (openaiApiKey) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    openaiService = new OpenAITranslationService(openai);
  } else {
    // If no OpenAI key, always fallback
    openaiService = {
      translate: async (_text, _sourceLang, _targetLang) => {
        throw new Error('OpenAI API key not configured');
      }
    };
  }
  const myMemoryService = new MyMemoryTranslationService();
  return new AutoFallbackTranslationService(openaiService, myMemoryService);
}

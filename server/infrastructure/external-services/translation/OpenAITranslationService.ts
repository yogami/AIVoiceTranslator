import { ITranslationService } from './translation.interfaces';
import { OpenAI } from 'openai';

export class OpenAITranslationService implements ITranslationService {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // Replace with actual OpenAI translation API call
    // This is a placeholder for demonstration
    try {
      // Example: Use OpenAI's chat/completions endpoint for translation
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Provide only the literal translation without any additional commentary, explanations, or conversational responses. Preserve the original meaning and tone exactly.` },
          { role: 'user', content: text }
        ],
        temperature: 0.1  // Low temperature for consistent, literal translations
      });
      // Extract translation from response
      const translation = response.choices[0]?.message?.content?.trim() || '';
      return translation;
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

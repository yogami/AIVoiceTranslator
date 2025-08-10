import { ITranslationService } from '../../../services/translation/translation.interfaces';

/**
 * Local/offline translation service for tests and offline environments.
 * Performs a simple deterministic pseudo-translation without any network calls.
 */
export class LocalTranslationService implements ITranslationService {
  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const normalizedTarget = (targetLanguage || '').toLowerCase();
    const prefix = this.getLanguageLabel(normalizedTarget);
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    return `${prefix}${safeText}`;
  }

  private getLanguageLabel(lang: string): string {
    const labels: Record<string, string> = {
      'es': '[ES] ', 'es-es': '[ES] ',
      'fr': '[FR] ', 'fr-fr': '[FR] ',
      'de': '[DE] ', 'de-de': '[DE] ',
      'en': '[EN] ', 'en-us': '[EN] ', 'en-gb': '[EN] ',
      'it': '[IT] ', 'it-it': '[IT] ',
      'pt': '[PT] ', 'pt-br': '[PT] ', 'pt-pt': '[PT] ',
    };
    return labels[lang] || '[TX] ';
  }
}



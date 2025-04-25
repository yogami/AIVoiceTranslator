import { useState, useEffect } from 'react';

// Define language support information by TTS service
const languageSupport = {
  // Browser Speech Synthesis support varies by browser
  // This is a conservative list of well-supported languages
  browser: {
    fullySupported: [
      'en', 'en-US', 'en-GB', 'en-AU', 'en-IN',
      'es', 'es-ES', 'es-MX', 'es-419',
      'fr', 'fr-FR', 'fr-CA',
      'de',
      'it',
      'zh', 'zh-CN', 'zh-TW',
      'ja',
      'ko',
      'pt', 'pt-BR', 'pt-PT',
      'ru'
    ],
    partiallySupported: [
      'ar', 'bg', 'ca', 'cs', 'da', 'nl', 'fi', 'el', 'he',
      'hi', 'hu', 'id', 'no', 'pl', 'ro', 'sk', 'sv', 'th', 
      'tr', 'uk', 'vi'
    ]
  },
  
  // OpenAI TTS service supports all languages listed in the selector
  openai: {
    fullySupported: [] as string[], // Will be populated with all available languages
    partiallySupported: [] as string[]
  },
  
  // Silent mode doesn't actually speak, so all languages are "supported"
  silent: {
    fullySupported: [] as string[], // Will be populated with all available languages
    partiallySupported: [] as string[]
  }
};

// Language options for the dropdown (these would come from your API in a real app)
// This is a subset for illustration purposes
const defaultLanguageOptions = [
  // European languages
  { value: 'en-US', label: 'English (US)', group: 'European' },
  { value: 'en-GB', label: 'English (UK)', group: 'European' },
  { value: 'es-ES', label: 'Spanish (Spain)', group: 'European' },
  { value: 'fr-FR', label: 'French', group: 'European' },
  { value: 'de-DE', label: 'German', group: 'European' },
  { value: 'it-IT', label: 'Italian', group: 'European' },
  
  // Asian languages
  { value: 'zh-CN', label: 'Chinese (Simplified)', group: 'Asian' },
  { value: 'ja-JP', label: 'Japanese', group: 'Asian' },
  { value: 'ko-KR', label: 'Korean', group: 'Asian' },
  
  // Other languages
  { value: 'ar-SA', label: 'Arabic', group: 'Other' },
  { value: 'ru-RU', label: 'Russian', group: 'Other' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', group: 'Other' },
  { value: 'hi-IN', label: 'Hindi', group: 'Other' }
];

interface LanguageOption {
  value: string;
  label: string;
  group?: string;
}

export const useLanguageSupport = (ttsService: string = 'browser') => {
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(defaultLanguageOptions);
  
  // Ensure openai and silent services support all languages
  useEffect(() => {
    const allLanguageCodes = languageOptions.map(option => option.value);
    languageSupport.openai.fullySupported = allLanguageCodes;
    languageSupport.silent.fullySupported = allLanguageCodes;
  }, [languageOptions]);
  
  /**
   * Check if a language is supported by a TTS service
   */
  const isLanguageSupported = (langCode: string, service: string = ttsService): boolean => {
    // Default to browser TTS if not specified
    service = service || 'browser';
    
    const support = languageSupport[service as keyof typeof languageSupport];
    if (!support) return false;
    
    // Check full support first
    if (support.fullySupported.includes(langCode)) return true;
    
    // Check partial support
    if (support.partiallySupported.includes(langCode)) return true;
    
    // Check if a parent language is supported
    // e.g., 'en-US' might not be explicitly listed, but 'en' is
    if (langCode.includes('-')) {
      const parentLang = langCode.split('-')[0];
      return support.fullySupported.includes(parentLang) || 
             support.partiallySupported.includes(parentLang);
    }
    
    return false;
  };
  
  /**
   * Get a list of supported languages for a TTS service
   */
  const getSupportedLanguages = (service: string = ttsService): string[] => {
    // Default to browser TTS if not specified
    service = service || 'browser';
    
    const support = languageSupport[service as keyof typeof languageSupport];
    if (!support) return [];
    
    // Combine fully and partially supported languages
    return [...support.fullySupported, ...support.partiallySupported];
  };
  
  /**
   * Get a user-friendly name for a TTS service
   */
  const getTtsServiceName = (service: string): string => {
    const names: Record<string, string> = {
      browser: 'Browser Speech',
      openai: 'OpenAI TTS',
      silent: 'Silent Mode'
    };
    
    return names[service] || service;
  };
  
  // Get supported languages for the current TTS service
  const supportedLanguages = getSupportedLanguages();
  
  // Return the hook API
  return {
    isLanguageSupported,
    getSupportedLanguages,
    getTtsServiceName,
    supportedLanguages,
    languageOptions
  };
};
/**
 * Language Support Hook for AIVoiceTranslator
 * 
 * This module provides language support functionality for the application,
 * including language selection, validation, and common codes.
 */

import { useState, useEffect } from 'react';

// Language option interface
export interface LanguageOption {
  code: string;
  name: string;
  localName?: string;
  flag?: string;
  supported?: boolean;
  ttsSupportLevel?: 'full' | 'limited' | 'unsupported';
}

// Get flag emoji from country code
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  
  // Convert country code to regional indicator symbols
  const codePoints = [
    127397 + countryCode.toUpperCase().charCodeAt(0),
    127397 + countryCode.toUpperCase().charCodeAt(1)
  ];
  
  return String.fromCodePoint(...codePoints);
}

// Parse language code to get country code for flag
function getCountryCodeFromLanguage(languageCode: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    'en': 'US',
    'en-US': 'US',
    'en-GB': 'GB',
    'en-AU': 'AU',
    'en-CA': 'CA',
    'fr': 'FR',
    'fr-FR': 'FR',
    'fr-CA': 'CA',
    'fr-BE': 'BE',
    'es': 'ES',
    'es-ES': 'ES',
    'es-MX': 'MX',
    'es-AR': 'AR',
    'pt': 'PT',
    'pt-PT': 'PT',
    'pt-BR': 'BR',
    'zh': 'CN',
    'zh-CN': 'CN',
    'zh-TW': 'TW',
    'de': 'DE',
    'it': 'IT',
    'ja': 'JP',
    'ko': 'KR',
    'ru': 'RU'
  };
  
  if (specialCases[languageCode]) {
    return specialCases[languageCode];
  }
  
  // For codes like 'en-US', extract 'US'
  const parts = languageCode.split('-');
  if (parts.length > 1 && parts[1].length === 2) {
    return parts[1];
  }
  
  return '';
}

// Common language options
const COMMON_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', localName: 'English', ttsSupportLevel: 'full' },
  { code: 'es-ES', name: 'Spanish', localName: 'Español', ttsSupportLevel: 'full' },
  { code: 'fr-FR', name: 'French', localName: 'Français', ttsSupportLevel: 'full' },
  { code: 'de-DE', name: 'German', localName: 'Deutsch', ttsSupportLevel: 'full' },
  { code: 'it-IT', name: 'Italian', localName: 'Italiano', ttsSupportLevel: 'full' },
  { code: 'ja-JP', name: 'Japanese', localName: '日本語', ttsSupportLevel: 'full' },
  { code: 'ko-KR', name: 'Korean', localName: '한국어', ttsSupportLevel: 'full' },
  { code: 'pt-PT', name: 'Portuguese', localName: 'Português', ttsSupportLevel: 'full' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', localName: '中文 (简体)', ttsSupportLevel: 'full' },
  { code: 'ru-RU', name: 'Russian', localName: 'Русский', ttsSupportLevel: 'full' }
];

// The full list of languages will be loaded from the server or a local file
const ALL_LANGUAGES: LanguageOption[] = [
  ...COMMON_LANGUAGES,
  { code: 'ar-SA', name: 'Arabic', localName: 'العربية', ttsSupportLevel: 'full' },
  { code: 'cs-CZ', name: 'Czech', localName: 'Čeština', ttsSupportLevel: 'full' },
  { code: 'da-DK', name: 'Danish', localName: 'Dansk', ttsSupportLevel: 'full' },
  { code: 'nl-NL', name: 'Dutch', localName: 'Nederlands', ttsSupportLevel: 'full' },
  { code: 'fi-FI', name: 'Finnish', localName: 'Suomi', ttsSupportLevel: 'full' },
  { code: 'el-GR', name: 'Greek', localName: 'Ελληνικά', ttsSupportLevel: 'full' },
  { code: 'he-IL', name: 'Hebrew', localName: 'עברית', ttsSupportLevel: 'full' },
  { code: 'hi-IN', name: 'Hindi', localName: 'हिन्दी', ttsSupportLevel: 'full' },
  { code: 'hu-HU', name: 'Hungarian', localName: 'Magyar', ttsSupportLevel: 'full' },
  { code: 'id-ID', name: 'Indonesian', localName: 'Bahasa Indonesia', ttsSupportLevel: 'full' },
  { code: 'no-NO', name: 'Norwegian', localName: 'Norsk', ttsSupportLevel: 'full' },
  { code: 'pl-PL', name: 'Polish', localName: 'Polski', ttsSupportLevel: 'full' },
  { code: 'ro-RO', name: 'Romanian', localName: 'Română', ttsSupportLevel: 'full' },
  { code: 'sk-SK', name: 'Slovak', localName: 'Slovenčina', ttsSupportLevel: 'full' },
  { code: 'sv-SE', name: 'Swedish', localName: 'Svenska', ttsSupportLevel: 'full' },
  { code: 'th-TH', name: 'Thai', localName: 'ไทย', ttsSupportLevel: 'full' },
  { code: 'tr-TR', name: 'Turkish', localName: 'Türkçe', ttsSupportLevel: 'full' },
  { code: 'uk-UA', name: 'Ukrainian', localName: 'Українська', ttsSupportLevel: 'full' },
  { code: 'vi-VN', name: 'Vietnamese', localName: 'Tiếng Việt', ttsSupportLevel: 'full' }
];

// Add flag emojis to language options
function addFlagsToLanguages(languages: LanguageOption[]): LanguageOption[] {
  return languages.map(lang => ({
    ...lang,
    flag: getFlagEmoji(getCountryCodeFromLanguage(lang.code))
  }));
}

// Language support hook
export function useLanguageSupport() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>(
    addFlagsToLanguages(COMMON_LANGUAGES)
  );
  const [allLanguages, setAllLanguages] = useState<LanguageOption[]>(
    addFlagsToLanguages(ALL_LANGUAGES)
  );
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  
  // Load languages from localStorage on mount
  useEffect(() => {
    const storedLanguage = localStorage.getItem('selectedLanguage');
    if (storedLanguage) {
      setSelectedLanguage(storedLanguage);
    }
  }, []);
  
  // Save selected language to localStorage
  useEffect(() => {
    localStorage.setItem('selectedLanguage', selectedLanguage);
  }, [selectedLanguage]);
  
  // Toggle between showing common languages or all languages
  const toggleLanguageView = () => {
    setShowAllLanguages(prev => !prev);
    setAvailableLanguages(showAllLanguages ? 
      addFlagsToLanguages(COMMON_LANGUAGES) : 
      addFlagsToLanguages(ALL_LANGUAGES)
    );
  };
  
  // Find the currently selected language
  const currentLanguage = allLanguages.find(lang => lang.code === selectedLanguage) || allLanguages[0];
  
  return {
    selectedLanguage,
    setSelectedLanguage,
    availableLanguages,
    currentLanguage,
    showAllLanguages,
    toggleLanguageView,
    allLanguages
  };
}
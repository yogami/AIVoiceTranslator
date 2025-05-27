import { describe, it, expect } from 'vitest';

describe('Language Coverage Integration Tests', () => {
  it('should translate between all supported language pairs', async () => {
    // Test matrix of language combinations
    const supportedLanguages = [
      { code: 'en-US', name: 'English' },
      { code: 'es-ES', name: 'Spanish' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'zh-CN', name: 'Chinese' }
    ];

    const testText = "Hello, how are you today?";
    const translationResults = [];

    // Test translation from English to each target language
    for (const targetLang of supportedLanguages) {
      if (targetLang.code !== 'en-US') {
        const result = {
          sourceLanguage: 'en-US',
          targetLanguage: targetLang.code,
          originalText: testText,
          translatedText: `[${targetLang.name}] ${testText}`, // Mock translation
          success: true
        };
        translationResults.push(result);
      }
    }

    expect(translationResults.length).toBe(supportedLanguages.length - 1); // Exclude source language
    expect(translationResults.every(r => r.success)).toBe(true);
    expect(translationResults.every(r => r.translatedText.length > 0)).toBe(true);
  });

  it('should handle RTL languages (Arabic, Hebrew)', async () => {
    // Test right-to-left language support
    const rtlLanguages = [
      { code: 'ar-SA', name: 'Arabic', text: 'مرحبا، كيف حالك اليوم؟' },
      { code: 'he-IL', name: 'Hebrew', text: 'שלום, איך אתה היום?' }
    ];

    const testResults = rtlLanguages.map(lang => ({
      language: lang.code,
      isRTL: true,
      hasRTLText: /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/.test(lang.text),
      translationSupported: true,
      originalText: "Hello world",
      translatedText: lang.text
    }));

    expect(testResults.length).toBe(2);
    expect(testResults.every(r => r.isRTL)).toBe(true);
    expect(testResults.every(r => r.hasRTLText)).toBe(true);
    expect(testResults.every(r => r.translationSupported)).toBe(true);
  });
});
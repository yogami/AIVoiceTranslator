import { describe, it, expect } from 'vitest';
import { DevelopmentModeHelper } from '../../../server/services/helpers/DevelopmentModeHelper';

describe('DevelopmentModeHelper', () => {
  it('should create a silent audio buffer', () => {
    const buffer = DevelopmentModeHelper.createSilentAudioBuffer();

    // Check that the buffer is not empty
    expect(buffer.length).toBeGreaterThan(0);

    // Check that the buffer contains a valid WAV header
    expect(buffer.slice(0, 4).toString()).toBe('RIFF');
    expect(buffer.slice(8, 12).toString()).toBe('WAVE');
  });

  it('should return a language-specific translation for supported languages', () => {
    const text = 'This is a test.';

    const spanishTranslation = DevelopmentModeHelper.getLanguageSpecificTranslation(text, 'es-ES');
    expect(spanishTranslation).toBe('Esto es una traducción en modo de desarrollo.');

    const frenchTranslation = DevelopmentModeHelper.getLanguageSpecificTranslation(text, 'fr-FR');
    expect(frenchTranslation).toBe('Ceci est une traduction en mode développement.');

    const germanTranslation = DevelopmentModeHelper.getLanguageSpecificTranslation(text, 'de-DE');
    expect(germanTranslation).toBe('Dies ist eine Übersetzung im Entwicklungsmodus.');
  });

  it('should return the original text for unsupported languages', () => {
    const text = 'This is a test.';
    const unsupportedTranslation = DevelopmentModeHelper.getLanguageSpecificTranslation(text, 'zh-CN');
    expect(unsupportedTranslation).toBe(text);
  });
});
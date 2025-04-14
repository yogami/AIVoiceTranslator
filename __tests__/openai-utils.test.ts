import { 
  getVoiceForLanguage, 
  getLanguageName, 
  formatLatency, 
  formatDuration 
} from '../client/src/lib/openai';

describe('OpenAI Utilities', () => {
  describe('getVoiceForLanguage', () => {
    it('returns the correct voice for a known language code', () => {
      expect(getVoiceForLanguage('en-US')).toBe('alloy');
      expect(getVoiceForLanguage('es')).toBe('shimmer');
      expect(getVoiceForLanguage('de')).toBe('onyx');
      expect(getVoiceForLanguage('fr')).toBe('nova');
    });

    it('returns the default voice for an unknown language code', () => {
      expect(getVoiceForLanguage('unknown-code')).toBe('alloy');
    });
  });

  describe('getLanguageName', () => {
    it('returns the correct language name for a known language code', () => {
      expect(getLanguageName('en-US')).toBe('English (US)');
      expect(getLanguageName('es')).toBe('Spanish');
      expect(getLanguageName('de')).toBe('German');
      expect(getLanguageName('fr')).toBe('French');
    });

    it('returns the language code itself for an unknown language code', () => {
      const unknownCode = 'unknown-code';
      expect(getLanguageName(unknownCode)).toBe(unknownCode);
    });
  });

  describe('formatLatency', () => {
    it('formats milliseconds correctly when less than 1 second', () => {
      expect(formatLatency(500)).toBe('500ms');
      expect(formatLatency(0)).toBe('0ms');
      expect(formatLatency(999)).toBe('999ms');
    });

    it('formats seconds correctly when 1 second or more', () => {
      expect(formatLatency(1000)).toBe('1.0s');
      expect(formatLatency(1500)).toBe('1.5s');
      expect(formatLatency(2000)).toBe('2.0s');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds into MM:SS format', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('pads seconds with leading zero when needed', () => {
      expect(formatDuration(1)).toBe('0:01');
      expect(formatDuration(61)).toBe('1:01');
    });
  });
});
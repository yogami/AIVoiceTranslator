import { describe, it, expect } from 'vitest';
import { ACESimplifier } from '../../../server/services/text/ACESimplifier';

describe('ACESimplifier', () => {
  it('splits and chunks long sentences', () => {
    const s = new ACESimplifier({ maxWordsPerSentence: 5 });
    const out = s.simplify('This is a very long sentence, however it should be split and simplified.');
    // Expect connectors simplified and chunks length <= 5 words per chunk
    out.split('. ').forEach(chunk => {
      if (chunk.trim().length === 0) return;
      expect(chunk.trim().split(/\s+/).length).toBeLessThanOrEqual(5);
    });
    expect(/however/i.test(out)).toBe(false);
  });
});




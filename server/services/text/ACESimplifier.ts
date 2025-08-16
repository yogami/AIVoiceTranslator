export interface SimplificationOptions {
  maxWordsPerSentence?: number;
}

export class ACESimplifier {
  constructor(private readonly options: SimplificationOptions = {}) {}

  simplify(text: string): string {
    if (!text || typeof text !== 'string') return text;
    const maxWords = this.options.maxWordsPerSentence ?? 15;

    // Basic rules per spec MVP: split on punctuation and connectors; shorten sentences
    const normalized = text
      .replace(/[()\[\]{}]/g, '')
      .replace(/\b(however|therefore|moreover|furthermore)\b/gi, (m) => ({
        however: 'but', therefore: 'so', moreover: 'and', furthermore: 'and'
      }[m.toLowerCase()] || m));

    const parts = normalized.split(/[.,;:—\-]+\s*/);
    const simplifiedParts: string[] = [];
    for (const p of parts) {
      const words = p.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      // Chunk long sentences into ~maxWords segments
      for (let i = 0; i < words.length; i += maxWords) {
        simplifiedParts.push(words.slice(i, i + maxWords).join(' '));
      }
    }
    return simplifiedParts.join('. ').trim();
  }
}




export interface GlossaryMap {
  // term (source or canonical) -> targetLanguage -> locked term
  [term: string]: { [targetLanguage: string]: string };
}

export class TermLockingService {
  constructor(private readonly glossary: GlossaryMap = {}) {}

  applyLockedTerms(translatedText: string, targetLanguage: string): string {
    if (!translatedText) return translatedText;
    let output = translatedText;
    for (const term of Object.keys(this.glossary)) {
      const locked = this.glossary[term]?.[targetLanguage];
      if (!locked) continue;
      // Word boundary regex; supports multi‑word
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
      output = output.replace(pattern, locked);
    }
    return output;
  }
}




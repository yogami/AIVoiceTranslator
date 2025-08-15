export interface RedactionOptions {
  redactProfanity?: boolean;
  redactPII?: boolean;
}

export class ContentRedactionService {
  private static profanityList = [
    // Minimal starter list; extend via config if needed
    'damn', 'hell'
  ];

  static redact(text: string, options: RedactionOptions): string {
    if (!text || (!options.redactProfanity && !options.redactPII)) return text;
    let result = text;
    if (options.redactProfanity) result = this.redactProfanity(result);
    if (options.redactPII) result = this.redactPII(result);
    return result;
  }

  private static redactProfanity(text: string): string {
    const pattern = new RegExp(`\\b(${this.profanityList.map(w => this.escapeRegExp(w)).join('|')})\\b`, 'gi');
    return text.replace(pattern, (m) => '*'.repeat(m.length));
  }

  private static redactPII(text: string): string {
    // Simple email and phone patterns (not exhaustive)
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const phonePattern = /\+?\d[\d\s().-]{6,}\d/g;
    let result = text.replace(emailPattern, '[redacted-email]');
    result = result.replace(phonePattern, '[redacted-phone]');
    return result;
  }

  private static escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}



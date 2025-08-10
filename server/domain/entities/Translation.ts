/**
 * Domain Entity: Translation
 * 
 * Core business entity representing a translation operation.
 * Contains business rules and invariants for translation data.
 */

export interface TranslationId {
  readonly value: string;
}

export type TranslationStatus = 'pending' | 'completed' | 'failed';

export class Translation {
  constructor(
    public readonly id: TranslationId,
    public readonly sessionId: string,
    public readonly sourceText: string,
    public readonly sourceLanguage: string,
    public readonly targetLanguage: string,
    public readonly translatedText: string,
    public readonly provider: string,
    public readonly createdAt: Date,
    public readonly latency?: number,
    public readonly confidence?: number,
    public readonly status: TranslationStatus = 'completed'
  ) {
    this.validateInvariants();
  }

  /**
   * Business rule: Check if translation is valid
   */
  isValid(): boolean {
    return (
      this.status === 'completed' &&
      this.sourceText.trim() !== '' &&
      this.translatedText.trim() !== '' &&
      this.sourceLanguage !== this.targetLanguage
    );
  }

  /**
   * Business rule: Check if translation is recent
   */
  isRecent(thresholdMs: number = 5 * 60 * 1000): boolean {
    const now = new Date();
    return (now.getTime() - this.createdAt.getTime()) < thresholdMs;
  }

  /**
   * Business rule: Check if translation quality is acceptable
   */
  hasAcceptableQuality(): boolean {
    // If confidence is provided, it should be above threshold
    if (this.confidence !== undefined) {
      return this.confidence >= 0.7; // 70% confidence threshold
    }
    
    // If no confidence, check basic quality indicators
    return (
      this.translatedText.length > 0 &&
      this.translatedText !== this.sourceText &&
      this.status === 'completed'
    );
  }

  /**
   * Business rule: Calculate translation efficiency
   */
  getEfficiencyScore(): number {
    if (!this.latency || this.latency <= 0) {
      return 0;
    }

    // Score based on latency (lower is better)
    // Base score of 100, reduced by latency in seconds
    const latencyInSeconds = this.latency / 1000;
    const score = Math.max(0, 100 - latencyInSeconds);
    
    // Bonus for high confidence
    const confidenceBonus = this.confidence ? (this.confidence - 0.5) * 20 : 0;
    
    return Math.min(100, score + confidenceBonus);
  }

  /**
   * Validate business invariants
   */
  private validateInvariants(): void {
    if (!this.id.value || this.id.value.trim() === '') {
      throw new Error('Translation ID cannot be empty');
    }

    if (!this.sessionId || this.sessionId.trim() === '') {
      throw new Error('Session ID cannot be empty');
    }

    if (!this.sourceText || this.sourceText.trim() === '') {
      throw new Error('Source text cannot be empty');
    }

    if (!this.sourceLanguage || this.sourceLanguage.trim() === '') {
      throw new Error('Source language cannot be empty');
    }

    if (!this.targetLanguage || this.targetLanguage.trim() === '') {
      throw new Error('Target language cannot be empty');
    }

    if (this.sourceLanguage === this.targetLanguage) {
      throw new Error('Source and target languages cannot be the same');
    }

    if (!this.provider || this.provider.trim() === '') {
      throw new Error('Provider cannot be empty');
    }

    if (this.latency !== undefined && this.latency < 0) {
      throw new Error('Latency cannot be negative');
    }

    if (this.confidence !== undefined && (this.confidence < 0 || this.confidence > 1)) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  /**
   * Create a failed translation
   */
  static createFailed(
    id: TranslationId,
    sessionId: string,
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    provider: string,
    error: string
  ): Translation {
    return new Translation(
      id,
      sessionId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      `[Translation failed: ${error}]`,
      provider,
      new Date(),
      undefined,
      0,
      'failed'
    );
  }

  /**
   * Create a copy with updated status
   */
  updateStatus(status: TranslationStatus): Translation {
    return new Translation(
      this.id,
      this.sessionId,
      this.sourceText,
      this.sourceLanguage,
      this.targetLanguage,
      this.translatedText,
      this.provider,
      this.createdAt,
      this.latency,
      this.confidence,
      status
    );
  }
}

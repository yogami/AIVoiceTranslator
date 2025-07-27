/**
 * Cultural Context Adaptation Service
 * 
 * This service enhances translations with cultural awareness, ensuring educational content
 * maintains appropriate cultural context, formality levels, and pedagogical effectiveness
 * across different target cultures and languages.
 */

export interface CulturalContext {
  /** Target culture/country code (e.g., 'jp', 'kr', 'de', 'fr', 'mx', 'br') */
  targetCulture: string;
  /** Educational context */
  educationalLevel: 'elementary' | 'middle' | 'high' | 'university' | 'adult';
  /** Formality level appropriate for the culture */
  formalityLevel: 'formal' | 'semi-formal' | 'casual';
  /** Subject area for context-specific adaptations */
  subjectArea?: 'math' | 'science' | 'literature' | 'history' | 'language' | 'general';
  /** Age group of students */
  studentAgeGroup: 'children' | 'teens' | 'young-adults' | 'adults';
}

export interface CulturalAdaptationOptions {
  /** Original text to adapt */
  originalText: string;
  /** Source language */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Cultural context */
  culturalContext: CulturalContext;
  /** Content type for appropriate adaptation */
  contentType?: 'explanation' | 'instruction' | 'question' | 'encouragement' | 'correction' | 'example';
}

export class CulturalContextService {
  private readonly CULTURAL_ADAPTATIONS: Record<string, {
    formalityMarkers: Record<string, string[]>;
    educationalApproach: string;
    indirectness: string;
    groupHarmony?: boolean;
    precision?: string;
    elegance?: string;
    familial?: boolean;
    friendliness?: string;
  }> = {
    // Japanese culture adaptations
    'jp': {
      formalityMarkers: {
        formal: ['恐れ入りますが', 'いかがでしょうか', 'させていただきます'],
        polite: ['です', 'ます', 'でしょう'],
        honorific: ['お', 'ご', 'さん']
      },
      educationalApproach: 'respectful-hierarchy',
      indirectness: 'high',
      groupHarmony: true
    },
    
    // Korean culture adaptations
    'kr': {
      formalityMarkers: {
        formal: ['습니다', '입니다', '해주세요'],
        polite: ['요', '세요', '시다'],
        honorific: ['님', '선생님', '학생']
      },
      educationalApproach: 'respectful-hierarchy',
      indirectness: 'high',
      groupHarmony: true
    },
    
    // German culture adaptations
    'de': {
      formalityMarkers: {
        formal: ['Sie', 'würden', 'könnten'],
        casual: ['du', 'ihr', 'können wir']
      },
      educationalApproach: 'direct-structured',
      indirectness: 'low',
      precision: 'high'
    },
    
    // French culture adaptations
    'fr': {
      formalityMarkers: {
        formal: ['vous', 'veuillez', 'auriez-vous'],
        casual: ['tu', 'peux-tu', 'on peut']
      },
      educationalApproach: 'intellectual-discourse',
      indirectness: 'medium',
      elegance: 'high'
    },
    
    // Spanish (Mexico) culture adaptations
    'mx': {
      formalityMarkers: {
        formal: ['usted', 'por favor', 'tenga la bondad'],
        casual: ['tú', 'por fa', 'puedes']
      },
      educationalApproach: 'warm-personal',
      indirectness: 'medium',
      familial: true
    },
    
    // Portuguese (Brazil) culture adaptations
    'br': {
      formalityMarkers: {
        formal: ['você', 'por gentileza', 'seria possível'],
        casual: ['tu', 'por favor', 'dá pra']
      },
      educationalApproach: 'warm-inclusive',
      indirectness: 'low',
      friendliness: 'high'
    }
  };

  private readonly SUBJECT_SPECIFIC_TERMS: Record<string, Record<string, Record<string, string>>> = {
    math: {
      'jp': { 'equation': '方程式', 'solve': '解く', 'calculate': '計算する' },
      'kr': { 'equation': '방정식', 'solve': '풀다', 'calculate': '계산하다' },
      'de': { 'equation': 'Gleichung', 'solve': 'lösen', 'calculate': 'berechnen' },
      'fr': { 'equation': 'équation', 'solve': 'résoudre', 'calculate': 'calculer' }
    },
    science: {
      'jp': { 'experiment': '実験', 'hypothesis': '仮説', 'observation': '観察' },
      'kr': { 'experiment': '실험', 'hypothesis': '가설', 'observation': '관찰' },
      'de': { 'experiment': 'Experiment', 'hypothesis': 'Hypothese', 'observation': 'Beobachtung' },
      'fr': { 'experiment': 'expérience', 'hypothesis': 'hypothèse', 'observation': 'observation' }
    },
    literature: {
      'jp': { 'author': '作者', 'novel': '小説', 'poetry': '詩' },
      'kr': { 'author': '작가', 'novel': '소설', 'poetry': '시' },
      'de': { 'author': 'Autor', 'novel': 'Roman', 'poetry': 'Poesie' },
      'fr': { 'author': 'auteur', 'novel': 'roman', 'poetry': 'poésie' }
    },
    history: {
      'jp': { 'century': '世紀', 'dynasty': '王朝', 'revolution': '革命' },
      'kr': { 'century': '세기', 'dynasty': '왕조', 'revolution': '혁명' },
      'de': { 'century': 'Jahrhundert', 'dynasty': 'Dynastie', 'revolution': 'Revolution' },
      'fr': { 'century': 'siècle', 'dynasty': 'dynastie', 'revolution': 'révolution' }
    },
    language: {
      'jp': { 'grammar': '文法', 'vocabulary': '語彙', 'pronunciation': '発音' },
      'kr': { 'grammar': '문법', 'vocabulary': '어휘', 'pronunciation': '발음' },
      'de': { 'grammar': 'Grammatik', 'vocabulary': 'Wortschatz', 'pronunciation': 'Aussprache' },
      'fr': { 'grammar': 'grammaire', 'vocabulary': 'vocabulaire', 'pronunciation': 'prononciation' }
    },
    general: {
      'jp': { 'question': '質問', 'answer': '答え', 'example': '例' },
      'kr': { 'question': '질문', 'answer': '답', 'example': '예' },
      'de': { 'question': 'Frage', 'answer': 'Antwort', 'example': 'Beispiel' },
      'fr': { 'question': 'question', 'answer': 'réponse', 'example': 'exemple' }
    }
  };

  constructor() {
    console.log('[Cultural Context] Service initialized with cultural adaptations for education');
  }

  /**
   * Adapt translated text with cultural context
   */
  async adaptTranslation(options: CulturalAdaptationOptions): Promise<string> {
    const {
      originalText,
      sourceLanguage,
      targetLanguage,
      culturalContext,
      contentType = 'explanation'
    } = options;

    try {
      console.log(`[Cultural Context] Adapting for culture: ${culturalContext.targetCulture}, level: ${culturalContext.educationalLevel}`);
      
      let adaptedText = originalText;
      
      // Apply cultural communication style
      adaptedText = this.applyCommunicationStyle(adaptedText, culturalContext);
      
      // Apply formality level
      adaptedText = this.applyFormalityLevel(adaptedText, culturalContext);
      
      // Apply educational context adaptations
      adaptedText = this.applyEducationalContext(adaptedText, culturalContext, contentType);
      
      // Apply subject-specific terminology if available
      if (culturalContext.subjectArea) {
        adaptedText = this.applySubjectSpecificTerms(adaptedText, culturalContext);
      }
      
      // Apply age-appropriate adaptations
      adaptedText = this.applyAgeAppropriateStyle(adaptedText, culturalContext);
      
      console.log('[Cultural Context] Successfully adapted translation for cultural context');
      
      return adaptedText;
      
    } catch (error) {
      console.error('[Cultural Context] Failed to apply cultural adaptation:', error);
      // Return original text if adaptation fails
      return originalText;
    }
  }

  /**
   * Apply cultural communication style
   */
  private applyCommunicationStyle(text: string, context: CulturalContext): string {
    const cultureData = this.CULTURAL_ADAPTATIONS[context.targetCulture];
    if (!cultureData) return text;

    let adaptedText = text;

    // High-context cultures (Japanese, Korean) - add politeness and indirectness
    if (cultureData.indirectness === 'high') {
      adaptedText = this.addIndirectnessMarkers(adaptedText, context.targetCulture);
    }

    // Cultures that value group harmony
    if (cultureData.groupHarmony) {
      adaptedText = this.addGroupHarmonyMarkers(adaptedText);
    }

    // Precision-focused cultures (German)
    if (cultureData.precision === 'high') {
      adaptedText = this.addPrecisionMarkers(adaptedText);
    }

    return adaptedText;
  }

  /**
   * Apply appropriate formality level
   */
  private applyFormalityLevel(text: string, context: CulturalContext): string {
    const cultureData = this.CULTURAL_ADAPTATIONS[context.targetCulture];
    if (!cultureData?.formalityMarkers) return text;

    const formalityMarkers = cultureData.formalityMarkers[context.formalityLevel];
    if (!formalityMarkers) return text;

    // This is a simplified approach - in production, you'd want more sophisticated NLP
    let adaptedText = text;
    
    // Add cultural formality context markers
    if (context.formalityLevel === 'formal') {
      adaptedText = `[FORMAL_CONTEXT] ${adaptedText}`;
    } else if (context.formalityLevel === 'casual') {
      adaptedText = `[CASUAL_CONTEXT] ${adaptedText}`;
    }

    return adaptedText;
  }

  /**
   * Apply educational context adaptations
   */
  private applyEducationalContext(text: string, context: CulturalContext, contentType: string): string {
    let adaptedText = text;

    // Adapt based on educational level
    switch (context.educationalLevel) {
      case 'elementary':
        adaptedText = this.simplifyForElementary(adaptedText);
        break;
      case 'university':
        adaptedText = this.enhanceForUniversity(adaptedText);
        break;
    }

    // Adapt based on content type
    switch (contentType) {
      case 'encouragement':
        adaptedText = this.addEncouragementContext(adaptedText, context.targetCulture);
        break;
      case 'correction':
        adaptedText = this.addCorrectionContext(adaptedText, context.targetCulture);
        break;
      case 'question':
        adaptedText = this.addQuestionContext(adaptedText, context.targetCulture);
        break;
    }

    return adaptedText;
  }

  /**
   * Apply subject-specific terminology
   */
  private applySubjectSpecificTerms(text: string, context: CulturalContext): string {
    const subjectTerms = this.SUBJECT_SPECIFIC_TERMS[context.subjectArea!];
    if (!subjectTerms || !subjectTerms[context.targetCulture]) return text;

    let adaptedText = text;
    const cultureTerms = subjectTerms[context.targetCulture];

    // Replace common terms with culturally appropriate equivalents
    Object.entries(cultureTerms).forEach(([english, cultural]) => {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      adaptedText = adaptedText.replace(regex, `${english} (${cultural})`);
    });

    return adaptedText;
  }

  /**
   * Apply age-appropriate style adaptations
   */
  private applyAgeAppropriateStyle(text: string, context: CulturalContext): string {
    let adaptedText = text;

    switch (context.studentAgeGroup) {
      case 'children':
        adaptedText = `[CHILD_FRIENDLY] ${adaptedText}`;
        break;
      case 'teens':
        adaptedText = `[TEEN_APPROPRIATE] ${adaptedText}`;
        break;
      case 'adults':
        adaptedText = `[ADULT_LEVEL] ${adaptedText}`;
        break;
    }

    return adaptedText;
  }

  /**
   * Add indirectness markers for high-context cultures
   */
  private addIndirectnessMarkers(text: string, culture: string): string {
    if (culture === 'jp') {
      return `[INDIRECT_JP] ${text}`;
    } else if (culture === 'kr') {
      return `[INDIRECT_KR] ${text}`;
    }
    return text;
  }

  /**
   * Add group harmony markers
   */
  private addGroupHarmonyMarkers(text: string): string {
    return `[GROUP_HARMONY] ${text}`;
  }

  /**
   * Add precision markers for detail-oriented cultures
   */
  private addPrecisionMarkers(text: string): string {
    return `[PRECISE] ${text}`;
  }

  /**
   * Simplify language for elementary level
   */
  private simplifyForElementary(text: string): string {
    return `[SIMPLE] ${text}`;
  }

  /**
   * Enhance complexity for university level
   */
  private enhanceForUniversity(text: string): string {
    return `[ACADEMIC] ${text}`;
  }

  /**
   * Add culturally appropriate encouragement context
   */
  private addEncouragementContext(text: string, culture: string): string {
    const encouragementStyles: Record<string, string> = {
      'jp': '[RESPECTFUL_ENCOURAGEMENT]',
      'kr': '[SUPPORTIVE_ENCOURAGEMENT]',
      'de': '[DIRECT_ENCOURAGEMENT]',
      'fr': '[INTELLECTUAL_ENCOURAGEMENT]',
      'mx': '[WARM_ENCOURAGEMENT]',
      'br': '[FRIENDLY_ENCOURAGEMENT]'
    };
    
    const style = encouragementStyles[culture] || '[NEUTRAL_ENCOURAGEMENT]';
    return `${style} ${text}`;
  }

  /**
   * Add culturally appropriate correction context
   */
  private addCorrectionContext(text: string, culture: string): string {
    const correctionStyles: Record<string, string> = {
      'jp': '[GENTLE_CORRECTION]',
      'kr': '[RESPECTFUL_CORRECTION]',
      'de': '[DIRECT_CORRECTION]',
      'fr': '[CONSTRUCTIVE_CORRECTION]',
      'mx': '[SUPPORTIVE_CORRECTION]',
      'br': '[FRIENDLY_CORRECTION]'
    };
    
    const style = correctionStyles[culture] || '[NEUTRAL_CORRECTION]';
    return `${style} ${text}`;
  }

  /**
   * Add culturally appropriate question context
   */
  private addQuestionContext(text: string, culture: string): string {
    const questionStyles: Record<string, string> = {
      'jp': '[POLITE_QUESTION]',
      'kr': '[RESPECTFUL_QUESTION]',
      'de': '[DIRECT_QUESTION]',
      'fr': '[THOUGHTFUL_QUESTION]',
      'mx': '[INVITING_QUESTION]',
      'br': '[ENGAGING_QUESTION]'
    };
    
    const style = questionStyles[culture] || '[NEUTRAL_QUESTION]';
    return `${style} ${text}`;
  }

  /**
   * Get recommended cultural context for a target language/region
   */
  static getRecommendedContext(targetLanguage: string, region?: string): CulturalContext {
    const languageToCulture: Record<string, Partial<CulturalContext>> = {
      'ja': { targetCulture: 'jp', formalityLevel: 'formal', educationalLevel: 'middle' },
      'ko': { targetCulture: 'kr', formalityLevel: 'formal', educationalLevel: 'middle' },
      'de': { targetCulture: 'de', formalityLevel: 'semi-formal', educationalLevel: 'middle' },
      'fr': { targetCulture: 'fr', formalityLevel: 'formal', educationalLevel: 'middle' },
      'es': { targetCulture: region === 'mx' ? 'mx' : 'mx', formalityLevel: 'semi-formal', educationalLevel: 'middle' },
      'pt': { targetCulture: 'br', formalityLevel: 'casual', educationalLevel: 'middle' }
    };

    const baseContext = languageToCulture[targetLanguage] || {
      targetCulture: 'default',
      formalityLevel: 'semi-formal',
      educationalLevel: 'middle'
    };

    return {
      targetCulture: baseContext.targetCulture!,
      educationalLevel: baseContext.educationalLevel!,
      formalityLevel: baseContext.formalityLevel!,
      studentAgeGroup: 'teens'
    };
  }

  /**
   * Check if cultural adaptation is available for target culture
   */
  isCultureSupported(culture: string): boolean {
    return !!this.CULTURAL_ADAPTATIONS[culture];
  }

  /**
   * Get supported cultures
   */
  getSupportedCultures(): string[] {
    return Object.keys(this.CULTURAL_ADAPTATIONS);
  }
}

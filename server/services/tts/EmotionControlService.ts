/**
 * Emotion Control Service for ElevenLabs TTS
 * 
 * This service adds emotional context to speech synthesis, preserving the teacher's
 * emotional intent (excitement, emphasis, concern) across language barriers.
 * Critical for maintaining pedagogical effectiveness in multilingual classrooms.
 */

export interface EmotionContext {
  /** Primary emotion: excited, calm, concerned, encouraging, serious */
  primaryEmotion: 'excited' | 'calm' | 'concerned' | 'encouraging' | 'serious' | 'neutral';
  /** Emotion intensity 0.0-1.0 (default: 0.6) */
  intensity?: number;
  /** Speaking pace: slow, normal, fast */
  pace?: 'slow' | 'normal' | 'fast';
  /** Voice emphasis for key words */
  emphasis?: string[];
  /** Cultural adaptation context */
  culturalContext?: {
    targetCulture: string;
    formalityLevel: 'formal' | 'casual' | 'academic';
    ageGroup: 'children' | 'teens' | 'adults';
  };
}

export interface EmotionalTTSOptions {
  /** Text to synthesize */
  text: string;
  /** Target language */
  language: string;
  /** Voice ID for the speaker */
  voiceId: string;
  /** Emotional context */
  emotionContext: EmotionContext;
  /** Audio format (default: 'mp3') */
  outputFormat?: 'mp3' | 'wav' | 'opus';
}

export class ElevenLabsEmotionControlService {
  private readonly EMOTION_SETTINGS = {
    excited: {
      stability: 0.3,
      similarityBoost: 0.8,
      style: 0.85,
      speakingRate: 1.15
    },
    calm: {
      stability: 0.8,
      similarityBoost: 0.6,
      style: 0.2,
      speakingRate: 0.9
    },
    concerned: {
      stability: 0.6,
      similarityBoost: 0.7,
      style: 0.4,
      speakingRate: 0.85
    },
    encouraging: {
      stability: 0.5,
      similarityBoost: 0.8,
      style: 0.7,
      speakingRate: 1.05
    },
    serious: {
      stability: 0.9,
      similarityBoost: 0.5,
      style: 0.1,
      speakingRate: 0.95
    },
    neutral: {
      stability: 0.7,
      similarityBoost: 0.7,
      style: 0.5,
      speakingRate: 1.0
    }
  };

  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
  }

  /**
   * Synthesize speech with emotional context
   */
  async synthesizeWithEmotion(options: EmotionalTTSOptions): Promise<Buffer> {
    const {
      text,
      language,
      voiceId,
      emotionContext,
      outputFormat = 'mp3'
    } = options;

    try {
      console.log(`[Emotion Control] Synthesizing with emotion: ${emotionContext.primaryEmotion} (intensity: ${emotionContext.intensity || 0.6})`);
      
      // Get emotion-specific voice settings
      const emotionSettings = this.getEmotionSettings(emotionContext);
      
      // Apply cultural adaptations if specified
      const adaptedText = this.applyCulturalAdaptation(text, emotionContext.culturalContext);
      
      // Add emphasis markers for key words
      const emphasizedText = this.applyEmphasis(adaptedText, emotionContext.emphasis);
      
      // Prepare request to ElevenLabs API
      const requestBody = {
        text: emphasizedText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: emotionSettings.stability,
          similarity_boost: emotionSettings.similarityBoost,
          style: emotionSettings.style,
          use_speaker_boost: true
        },
        pronunciation_dictionary_locators: [
          {
            pronunciation_dictionary_id: 'default',
            version_id: 'latest'
          }
        ]
      };

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': `audio/${outputFormat}`,
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Emotional TTS failed: ${response.status} ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      console.log(`[Emotion Control] Successfully synthesized emotional speech: ${audioBuffer.length} bytes`);
      
      return audioBuffer;
      
    } catch (error) {
      console.error('[Emotion Control] Failed to synthesize emotional speech:', error);
      throw error;
    }
  }

  /**
   * Get voice settings based on emotion context
   */
  public getEmotionSettings(emotionContext: EmotionContext) {
    const baseSettings = this.EMOTION_SETTINGS[emotionContext.primaryEmotion];
    const intensity = emotionContext.intensity || 0.6;
    
    // Adjust settings based on intensity
    return {
      stability: this.adjustSettingByIntensity(baseSettings.stability, intensity, 'invert'),
      similarityBoost: this.adjustSettingByIntensity(baseSettings.similarityBoost, intensity, 'direct'),
      style: this.adjustSettingByIntensity(baseSettings.style, intensity, 'direct'),
      speakingRate: this.adjustSpeakingRate(baseSettings.speakingRate, emotionContext.pace)
    };
  }

  /**
   * Adjust setting value based on emotion intensity
   */
  private adjustSettingByIntensity(baseSetting: number, intensity: number, direction: 'direct' | 'invert'): number {
    const adjustment = (intensity - 0.5) * 0.4; // Scale intensity to ±0.2 range
    
    if (direction === 'direct') {
      return Math.max(0, Math.min(1, baseSetting + adjustment));
    } else {
      return Math.max(0, Math.min(1, baseSetting - adjustment));
    }
  }

  /**
   * Adjust speaking rate based on pace preference
   */
  private adjustSpeakingRate(baseRate: number, pace?: 'slow' | 'normal' | 'fast'): number {
    switch (pace) {
      case 'slow': return baseRate * 0.8;
      case 'fast': return baseRate * 1.2;
      default: return baseRate;
    }
  }

  /**
   * Apply cultural adaptations to text
   */
  public applyCulturalAdaptation(text: string, culturalContext?: EmotionContext['culturalContext']): string {
    if (!culturalContext) return text;
    
    let adaptedText = text;
    
    // Add cultural context markers for formality
    if (culturalContext.formalityLevel === 'formal') {
      // Add respectful language markers
      adaptedText = this.addFormalityMarkers(adaptedText, culturalContext.targetCulture);
    } else if (culturalContext.formalityLevel === 'casual') {
      // Add friendly, approachable markers
      adaptedText = this.addCasualMarkers(adaptedText);
    }
    
    // Adapt for age group
    if (culturalContext.ageGroup === 'children') {
      adaptedText = this.adaptForChildren(adaptedText);
    }
    
    return adaptedText;
  }

  /**
   * Add emphasis markers for key words
   */
  public applyEmphasis(text: string, emphasisWords?: string[]): string {
    if (!emphasisWords || emphasisWords.length === 0) return text;
    
    let emphasizedText = text;
    
    emphasisWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      emphasizedText = emphasizedText.replace(regex, `<emphasis level="strong">${word}</emphasis>`);
    });
    
    return emphasizedText;
  }

  /**
   * Add formality markers based on target culture
   */
  private addFormalityMarkers(text: string, culture: string): string {
    // Culture-specific formality adaptations
    const formalityPrefixes: Record<string, string> = {
      'japanese': '<prosody pitch="-5%">',
      'korean': '<prosody pitch="-3%">',
      'german': '<prosody rate="95%">',
      'french': '<prosody pitch="+2%">',
      'default': '<prosody rate="98%">'
    };
    
    const prefix = formalityPrefixes[culture.toLowerCase()] || formalityPrefixes.default;
    return `${prefix}${text}</prosody>`;
  }

  /**
   * Add casual, friendly markers
   */
  private addCasualMarkers(text: string): string {
    return `<prosody pitch="+3%" rate="102%">${text}</prosody>`;
  }

  /**
   * Adapt speech for children
   */
  private adaptForChildren(text: string): string {
    return `<prosody pitch="+8%" rate="90%"><emphasis level="moderate">${text}</emphasis></prosody>`;
  }

  /**
   * Get recommended emotion for educational content type
   */
  static getEducationalEmotion(contentType: string): EmotionContext {
    const educationalEmotions: Record<string, EmotionContext> = {
      'explanation': { primaryEmotion: 'calm', intensity: 0.7, pace: 'normal' },
      'encouragement': { primaryEmotion: 'encouraging', intensity: 0.8, pace: 'normal' },
      'warning': { primaryEmotion: 'concerned', intensity: 0.6, pace: 'slow' },
      'excitement': { primaryEmotion: 'excited', intensity: 0.9, pace: 'fast' },
      'instruction': { primaryEmotion: 'serious', intensity: 0.5, pace: 'normal' },
      'praise': { primaryEmotion: 'encouraging', intensity: 1.0, pace: 'normal' },
      'question': { primaryEmotion: 'encouraging', intensity: 0.6, pace: 'normal' }
    };

    return educationalEmotions[contentType] || { primaryEmotion: 'neutral', intensity: 0.6 };
  }

  /**
   * Check if emotion control is available
   */
  isAvailable(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Apply emotional context using ElevenLabs voice settings
   * Based on ElevenLabs API documentation for voice settings and style parameters
   */
  async applyEmotionalContext(options: EmotionalTTSOptions): Promise<{
    text: string;
    emotionSettings: any;
    culturalAdaptations?: any;
    emphasis?: string[];
    audioBuffer?: Buffer;
  }> {
    // Get ElevenLabs emotion-specific voice settings
    const emotionSettings = this.getEmotionSettings(options.emotionContext);
    
    // Apply cultural adaptation to text
    const culturalAdaptations = this.adjustForCulture(options.emotionContext);
    const adaptedText = this.applyCulturalAdaptation(options.text, culturalAdaptations.culturalContext);
    
    // Apply emphasis markers for ElevenLabs SSML-like formatting
    const emphasizedText = this.applyEmphasis(adaptedText, options.emotionContext.emphasis);
    
    // Synthesize audio with emotional context
    let audioBuffer: Buffer | undefined = undefined;
    try {
      audioBuffer = await this.synthesizeWithEmotion({
        ...options,
        text: emphasizedText,
        emotionContext: { ...options.emotionContext, ...culturalAdaptations }
      });
    } catch (error) {
      console.warn('[EmotionControl] Synthesis failed, continuing without audio:', error instanceof Error ? error.message : error);
    }
    
    return {
      text: emphasizedText,
      emotionSettings: {
        ...emotionSettings,
        intensity: options.emotionContext.intensity || 0.6,
        pace: options.emotionContext.pace,
        elevenLabsSettings: {
          stability: emotionSettings.stability,
          similarity_boost: emotionSettings.similarityBoost,
          style: emotionSettings.style,
          use_speaker_boost: true
        }
      },
      culturalAdaptations: culturalAdaptations.culturalAdaptations,
      emphasis: options.emotionContext.emphasis,
      audioBuffer
    };
  }

  /**
   * Get supported emotions based on ElevenLabs voice settings capabilities
   */
  getSupportedEmotions(): string[] {
    return Object.keys(this.EMOTION_SETTINGS) as Array<keyof typeof this.EMOTION_SETTINGS>;
  }

  /**
   * Get available pace options for speech rate control
   */
  getPaceOptions(): string[] {
    return ['slow', 'normal', 'fast'];
  }

  /**
   * Validate emotion context against ElevenLabs supported parameters
   */
  validateEmotionContext(context: EmotionContext): boolean {
    const validEmotions = this.getSupportedEmotions();
    const validPaces = this.getPaceOptions();
    
    // Check if emotion is supported
    if (!validEmotions.includes(context.primaryEmotion)) {
      return false;
    }
    
    // Check intensity range (ElevenLabs accepts 0.0-1.0)
    if (context.intensity !== undefined && (context.intensity < 0 || context.intensity > 1)) {
      return false;
    }
    
    // Check pace options
    if (context.pace !== undefined && !validPaces.includes(context.pace)) {
      return false;
    }
    
    // Check cultural context structure
    if (context.culturalContext) {
      const validFormalityLevels = ['formal', 'casual', 'academic'];
      const validAgeGroups = ['children', 'teens', 'adults'];
      
      if (context.culturalContext.formalityLevel && 
          !validFormalityLevels.includes(context.culturalContext.formalityLevel)) {
        return false;
      }
      
      if (context.culturalContext.ageGroup && 
          !validAgeGroups.includes(context.culturalContext.ageGroup)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extract emotion from text using linguistic analysis for ElevenLabs emotion control
   * Based on prosodic and semantic patterns that map to ElevenLabs voice settings
   */
  extractEmotionFromText(text: string): EmotionContext {
    const lowerText = text.toLowerCase();
    const hasExclamation = text.includes('!');
    const hasQuestion = text.includes('?');
    const punctuationCount = (text.match(/[!?]/g) || []).length;
    
    // Excited patterns - high energy, enthusiasm
    if (hasExclamation || 
        lowerText.match(/\b(great|amazing|wonderful|fantastic|excellent|awesome|wow)\b/) ||
        punctuationCount >= 2) {
      return { 
        primaryEmotion: 'excited', 
        intensity: Math.min(0.7 + (punctuationCount * 0.1), 1.0),
        pace: 'fast'
      };
    }
    
    // Concerned patterns - care, worry, attention
    if (lowerText.match(/\b(careful|watch|careful|attention|important|warning|concern)\b/) ||
        lowerText.includes('please be')) {
      return { 
        primaryEmotion: 'concerned', 
        intensity: 0.7,
        pace: 'normal'
      };
    }
    
    // Encouraging patterns - support, positive reinforcement
    if (lowerText.match(/\b(well done|good job|keep going|you can|believe|try)\b/)) {
      return { 
        primaryEmotion: 'encouraging', 
        intensity: 0.8,
        pace: 'normal'
      };
    }
    
    // Serious patterns - formal, important information
    if (lowerText.match(/\b(however|therefore|important|must|required|necessary)\b/) ||
        text.length > 100) {
      return { 
        primaryEmotion: 'serious', 
        intensity: 0.6,
        pace: 'slow'
      };
    }
    
    // Calm patterns - gentle, peaceful instruction
    if (lowerText.match(/\b(please|slowly|gently|calmly|relax|breathe)\b/)) {
      return { 
        primaryEmotion: 'calm', 
        intensity: 0.5,
        pace: 'slow'
      };
    }
    
    // Default to neutral with question handling
    return { 
      primaryEmotion: 'neutral', 
      intensity: hasQuestion ? 0.6 : 0.5,
      pace: 'normal'
    };
  }

  /**
   * Adjust emotion context for cultural considerations using ElevenLabs voice parameters
   * Based on cultural communication patterns and ElevenLabs voice customization
   */
  adjustForCulture(context: EmotionContext): EmotionContext & { culturalAdaptations?: any } {
    const adjusted = { ...context };
    const adaptations: any = { applied: false, adjustments: [] };
    
    if (!context.culturalContext) {
      return { ...adjusted, culturalAdaptations: adaptations };
    }
    
    const { targetCulture, formalityLevel, ageGroup } = context.culturalContext;
    
    // Cultural emotion intensity adjustments
    if (targetCulture) {
      switch (targetCulture.toLowerCase()) {
        case 'japanese':
        case 'korean':
          // East Asian cultures often prefer more subdued emotional expression
          adjusted.intensity = Math.max((adjusted.intensity || 0.6) * 0.8, 0.3);
          adaptations.adjustments.push('reduced_intensity_east_asian');
          break;
          
        case 'italian':
        case 'spanish':
        case 'brazilian':
          // Mediterranean/Latin cultures often appreciate more expressive emotions
          adjusted.intensity = Math.min((adjusted.intensity || 0.6) * 1.2, 1.0);
          adaptations.adjustments.push('increased_intensity_latin');
          break;
          
        case 'german':
        case 'de':
        case 'dutch':
          // Germanic cultures often prefer more formal, controlled expression
          if (adjusted.primaryEmotion === 'excited') {
            adjusted.intensity = Math.min((adjusted.intensity || 0.7) * 0.9, 0.8);
          }
          adaptations.adjustments.push('controlled_expression_germanic');
          break;
          
        case 'british':
          // British culture often values understatement
          adjusted.intensity = Math.max((adjusted.intensity || 0.6) * 0.85, 0.4);
          adaptations.adjustments.push('understatement_british');
          break;
      }
      adaptations.applied = true;
    }
    
    // Formality level adjustments
    if (formalityLevel) {
      switch (formalityLevel) {
        case 'formal':
          adjusted.intensity = Math.min((adjusted.intensity || 0.6) * 0.8, 0.7);
          if (adjusted.primaryEmotion === 'excited') {
            adjusted.primaryEmotion = 'encouraging';
          }
          adaptations.adjustments.push('formal_tone_adjustment');
          break;
          
        case 'academic':
          adjusted.pace = 'slow';
          adjusted.intensity = Math.max(Math.min((adjusted.intensity || 0.6) * 0.8, 0.8), 0.6);
          if (['excited', 'encouraging'].includes(adjusted.primaryEmotion)) {
            adjusted.primaryEmotion = 'serious';
          }
          adaptations.adjustments.push('academic_tone_adjustment');
          break;
          
        case 'casual':
          adjusted.intensity = Math.min((adjusted.intensity || 0.6) * 1.1, 1.0);
          adaptations.adjustments.push('casual_tone_adjustment');
          break;
      }
      adaptations.applied = true;
    }
    
    // Age group adjustments
    if (ageGroup) {
      switch (ageGroup) {
        case 'children':
          adjusted.pace = adjusted.pace === 'fast' ? 'normal' : 'slow';
          if (adjusted.primaryEmotion === 'serious') {
            adjusted.primaryEmotion = 'encouraging';
          }
          adaptations.adjustments.push('child_friendly_adjustment');
          break;
          
        case 'teens':
          if (adjusted.intensity && adjusted.intensity < 0.5) {
            adjusted.intensity = 0.6; // Teens respond to more energy
          }
          adaptations.adjustments.push('teen_engagement_adjustment');
          break;
          
        case 'adults':
          // No specific adjustments needed for adults
          adaptations.adjustments.push('adult_standard');
          break;
      }
      adaptations.applied = true;
    }
    
    return {
      ...adjusted,
      culturalAdaptations: {
        ...adaptations,
        targetCulture,
        formalityLevel,
        ageGroup,
        originalIntensity: context.intensity,
        adjustedIntensity: adjusted.intensity
      }
    };
  }
}

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

export class EmotionControlService {
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
  private getEmotionSettings(emotionContext: EmotionContext) {
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
  private applyCulturalAdaptation(text: string, culturalContext?: EmotionContext['culturalContext']): string {
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
  private applyEmphasis(text: string, emphasisWords?: string[]): string {
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
}

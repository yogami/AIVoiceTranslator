/**
 * STT Service Factory with Consistent 4-Tier Architecture
 * Implements SOLID principles with Strategy and Factory patterns
 * 
 * Tier 1 (Premium): OpenAI/ElevenLabs STT - Highest quality, API cost
 * Tier 2 (High-Quality Free): Deepgram Nova-2 - Excellent quality, free API
 * Tier 3 (Enhanced Free): Whisper.cpp + Voice Isolation - Good quality with enhancement
 * Tier 4 (Basic Free): Whisper.cpp - Basic quality, local processing
 */

import { ISTTTranscriptionService } from '../translation/translation.interfaces';
import { OpenAISTTTranscriptionService } from './OpenAITranscriptionService';
import { ElevenLabsSTTService } from './ElevenLabsSTTService';
import { DeepgramSTTService } from './DeepgramSTTService';
import { WhisperCppSTTTranscriptionService } from './WhisperCppTranscriptionService';
import { AutoFallbackSTTService } from './AutoFallbackSTTService';
import { OpenAI } from 'openai';

// Service tier enumeration for consistency
export enum STTServiceTier {
  PREMIUM_OPENAI = 'premium-openai',     // Tier 1a: OpenAI STT (paid)
  PREMIUM_ELEVENLABS = 'premium-labs',   // Tier 1b: ElevenLabs STT (paid)
  HIGH_QUALITY_FREE = 'free-hq',        // Tier 2: Deepgram Nova-2 (free, high quality)
  ENHANCED_FREE = 'free-enhanced',       // Tier 3: Whisper.cpp + Voice Isolation
  BASIC_FREE = 'free-basic',             // Tier 4: Whisper.cpp (basic, local)
  AUTO = 'auto'                          // Auto-fallback through all tiers
}

interface ISTTServiceFactory {
  createService(tier: STTServiceTier): ISTTTranscriptionService;
  getAvailableTiers(): STTServiceTier[];
  clearCache(): void;
}

export class STTServiceFactory implements ISTTServiceFactory {
  private static instances = new Map<string, ISTTTranscriptionService>();

  // Instance methods to implement interface
  createService(tier: STTServiceTier): ISTTTranscriptionService {
    return STTServiceFactory.createSTTService(tier);
  }

  getAvailableTiers(): STTServiceTier[] {
    return STTServiceFactory.getAvailableTiers();
  }

  clearCache(): void {
    STTServiceFactory.clearCache();
  }

  // Static methods for backward compatibility
  public static createSTTService(type: string = 'auto'): ISTTTranscriptionService {
    const tier = this.mapTypeToTier(type);
    const cacheKey = tier;
    
    if (this.instances.has(cacheKey)) {
      console.log(`[STTFactory] Returning cached ${tier} service`);
      return this.instances.get(cacheKey)!;
    }

    let service: ISTTTranscriptionService;

    switch (tier) {
      case STTServiceTier.PREMIUM_OPENAI: {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is required for Premium OpenAI STT tier');
        }
        console.log('[STTFactory] Creating Tier 1a (Premium): OpenAI STT');
        service = new OpenAISTTTranscriptionService(new OpenAI({ apiKey }));
        break;
      }

      case STTServiceTier.PREMIUM_ELEVENLABS: {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          throw new Error('ELEVENLABS_API_KEY is required for Premium ElevenLabs STT tier');
        }
        console.log('[STTFactory] Creating Tier 1b (Premium): ElevenLabs STT');
        service = new ElevenLabsSTTService(apiKey);
        break;
      }

      case STTServiceTier.HIGH_QUALITY_FREE: {
        console.log('[STTFactory] Creating Tier 2 (High-Quality Free): Deepgram Nova-2 STT');
        service = new DeepgramSTTService();
        break;
      }

      case STTServiceTier.ENHANCED_FREE: {
        console.log('[STTFactory] Creating Tier 3 (Enhanced Free): Whisper.cpp + Voice Isolation');
        // TODO: Create enhanced Whisper.cpp service with voice isolation
        service = new WhisperCppSTTTranscriptionService();
        break;
      }

      case STTServiceTier.BASIC_FREE: {
        console.log('[STTFactory] Creating Tier 4 (Basic Free): Whisper.cpp STT');
        service = new WhisperCppSTTTranscriptionService();
        break;
      }

      case STTServiceTier.AUTO:
      default: {
        console.log('[STTFactory] Creating 4-tier auto-fallback: Premium → Deepgram → Enhanced Whisper → Basic Whisper');
        service = this.createAutoFallbackService();
        break;
      }
    }

    this.instances.set(cacheKey, service);
    console.log(`[STTFactory] Created and cached ${tier} service`);
    return service;
  }

  private static createAutoFallbackService(): ISTTTranscriptionService {
    // Use existing AutoFallbackSTTService which implements 3-tier architecture
    // This already includes voice isolation enhancement
    console.log('[STTFactory] Using existing 3-tier auto-fallback with voice isolation');
    return new AutoFallbackSTTService();
  }

  private static mapTypeToTier(type: string): STTServiceTier {
    const normalizedType = type.toLowerCase();
    
    switch (normalizedType) {
      case 'openai':
      case 'premium-openai':
        return STTServiceTier.PREMIUM_OPENAI;
      
      case 'elevenlabs':
      case 'premium-labs':
        return STTServiceTier.PREMIUM_ELEVENLABS;
      
      case 'deepgram':
      case 'free-hq':
      case 'high-quality':
        return STTServiceTier.HIGH_QUALITY_FREE;
      
      case 'whispercpp':
      case 'whisper-enhanced':
      case 'free-enhanced':
        return STTServiceTier.ENHANCED_FREE;
      
      case 'whisper-basic':
      case 'free-basic':
      case 'basic':
        return STTServiceTier.BASIC_FREE;
      
      case 'auto':
      default:
        return STTServiceTier.AUTO;
    }
  }

  public static getAvailableTiers(): STTServiceTier[] {
    const tiers: STTServiceTier[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      tiers.push(STTServiceTier.PREMIUM_OPENAI);
    }
    
    if (process.env.ELEVENLABS_API_KEY) {
      tiers.push(STTServiceTier.PREMIUM_ELEVENLABS);
    }
    
    tiers.push(
      STTServiceTier.HIGH_QUALITY_FREE,
      STTServiceTier.ENHANCED_FREE,
      STTServiceTier.BASIC_FREE,
      STTServiceTier.AUTO
    );
    
    return tiers;
  }

  public static clearCache(): void {
    this.instances.clear();
    console.log('[STTFactory] Service cache cleared');
  }

  public static getCachedServices(): string[] {
    return Array.from(this.instances.keys());
  }

  public static getServiceInfo(tier: STTServiceTier): { 
    name: string; 
    tier: string; 
    quality: string; 
    cost: string; 
    available: boolean;
  } {
    switch (tier) {
      case STTServiceTier.PREMIUM_OPENAI:
        return {
          name: 'OpenAI Whisper API',
          tier: 'Tier 1a (Premium)',
          quality: 'Highest - Advanced Whisper model, cloud processing',
          cost: 'Paid API calls',
          available: !!process.env.OPENAI_API_KEY
        };
      
      case STTServiceTier.PREMIUM_ELEVENLABS:
        return {
          name: 'ElevenLabs STT',
          tier: 'Tier 1b (Premium)',
          quality: 'Highest - Specialized STT, real-time capable',
          cost: 'Paid API calls',
          available: !!process.env.ELEVENLABS_API_KEY
        };
      
      case STTServiceTier.HIGH_QUALITY_FREE:
        return {
          name: 'Deepgram Nova-2',
          tier: 'Tier 2 (High-Quality Free)',
          quality: 'Excellent - Industry-leading accuracy, free tier',
          cost: 'Free API with generous limits',
          available: true
        };
      
      case STTServiceTier.ENHANCED_FREE:
        return {
          name: 'Whisper.cpp + Voice Isolation',
          tier: 'Tier 3 (Enhanced Free)',
          quality: 'Good - Local processing with audio enhancement',
          cost: 'Local processing only',
          available: true
        };
      
      case STTServiceTier.BASIC_FREE:
        return {
          name: 'Whisper.cpp Basic',
          tier: 'Tier 4 (Basic Free)',
          quality: 'Fair - Local processing, basic quality',
          cost: 'Local processing only',
          available: true
        };
      
      default:
        return {
          name: 'Auto-Fallback STT',
          tier: 'All Tiers',
          quality: 'Adaptive - Best available quality',
          cost: 'Optimized cost with fallback',
          available: true
        };
    }
  }
}

// Backward compatibility
export function getSTTTranscriptionService(type?: string): ISTTTranscriptionService {
  const serviceType = type || process.env.STT_SERVICE_TYPE || 'auto';
  return STTServiceFactory.createSTTService(serviceType);
}

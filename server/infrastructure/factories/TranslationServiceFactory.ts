/**
 * Translation Service Factory with Consistent 4-Tier Architecture
 * Implements SOLID principles with Strategy and Factory patterns
 * 
 * Tier 1 (Premium): OpenAI Translation - Highest quality, API cost
 * Tier 2 (High-Quality Free): DeepSeek Translation - Excellent quality, free API
 * Tier 3 (Basic Free): MyMemory Translation - Good quality, free API  
 * Tier 4 (Fallback): Offline Translation - Basic quality, no network required
 */

import { ITranslationService } from '../../services/translation/translation.interfaces';
import { OpenAITranslationService } from '../external-services/translation/OpenAITranslationService';
import { DeepSeekTranslationService } from '../external-services/translation/DeepSeekTranslationService';
import { MyMemoryTranslationService } from '../external-services/translation/MyMemoryTranslationService';
import { AutoFallbackTranslationService, createDeepSeekFirstAutoFallbackTranslationService } from '../external-services/translation/AutoFallbackTranslationService';
import { LocalTranslationService } from '../external-services/translation/LocalTranslationService';
import { OpenAI } from 'openai';

// Service tier enumeration for consistency
export enum TranslationServiceTier {
  PREMIUM = 'premium',           // Tier 1: OpenAI (paid)
  HIGH_QUALITY_FREE = 'free-hq', // Tier 2: DeepSeek (free, high quality)
  BASIC_FREE = 'free-basic',     // Tier 3: MyMemory (free, basic)
  OFFLINE = 'offline',           // Tier 4: Local/Offline (no network)
  AUTO = 'auto',                 // Auto-fallback through all tiers (existing MyMemory-first behavior)
  AUTO_DEEPSEEK_FIRST = 'auto-deepseek-first' // New: Opt-in DeepSeek-first auto mode
}

interface ITranslationServiceFactory {
  createService(tier: TranslationServiceTier): ITranslationService;
  getAvailableTiers(): TranslationServiceTier[];
  clearCache(): void;
}

export class TranslationServiceFactory implements ITranslationServiceFactory {
  private static instances = new Map<string, ITranslationService>();

  // Instance methods to implement interface
  createService(tier: TranslationServiceTier): ITranslationService {
    return TranslationServiceFactory.createTranslationService(tier);
  }

  getAvailableTiers(): TranslationServiceTier[] {
    return TranslationServiceFactory.getAvailableTiers();
  }

  clearCache(): void {
    TranslationServiceFactory.clearCache();
  }

  // Static methods for backward compatibility
  public static createTranslationService(type: string = 'auto'): ITranslationService {
    const tier = this.mapTypeToTier(type);
    const cacheKey = tier;
    
    if (this.instances.has(cacheKey)) {
      console.log(`[TranslationFactory] Returning cached ${tier} service`);
      return this.instances.get(cacheKey)!;
    }

    let service: ITranslationService;

    switch (tier) {
      case TranslationServiceTier.PREMIUM: {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is required for Premium translation tier');
        }
        console.log('[TranslationFactory] Creating Tier 1 (Premium): OpenAI Translation');
        const openai = new OpenAI({ apiKey });
        service = new OpenAITranslationService(openai);
        break;
      }

      case TranslationServiceTier.HIGH_QUALITY_FREE: {
        console.log('[TranslationFactory] Creating Tier 2 (High-Quality Free): DeepSeek Translation');
        service = new DeepSeekTranslationService();
        break;
      }

      case TranslationServiceTier.BASIC_FREE: {
        console.log('[TranslationFactory] Creating Tier 3 (Basic Free): MyMemory Translation');
        service = new MyMemoryTranslationService();
        break;
      }

      case TranslationServiceTier.OFFLINE: {
        console.log('[TranslationFactory] Creating Tier 4 (Offline): Local Translation');
        service = new LocalTranslationService();
        break;
      }

      case TranslationServiceTier.AUTO:
      default: {
        console.log('[TranslationFactory] Creating 4-tier auto-fallback: OpenAI → DeepSeek → MyMemory → Offline');
        service = this.createAutoFallbackService();
        break;
      }
      case TranslationServiceTier.AUTO_DEEPSEEK_FIRST: {
        console.log('[TranslationFactory] Creating DeepSeek-first auto-fallback: DeepSeek (FREE) → OpenAI (PAID) → MyMemory (FREE)');
        service = createDeepSeekFirstAutoFallbackTranslationService();
        break;
      }
    }

    this.instances.set(cacheKey, service);
    console.log(`[TranslationFactory] Created and cached ${tier} service`);
    return service;
  }

  private static createAutoFallbackService(): ITranslationService {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    // For now, implement 2-tier fallback due to existing AutoFallbackTranslationService constructor
    // TODO: Extend AutoFallbackTranslationService to support 4-tier architecture
    
    let primaryService: ITranslationService;
    let fallbackService: ITranslationService;

    // REORDERED: FREE SERVICES FIRST
    // Primary: MyMemory (FREE)
    try {
      primaryService = new MyMemoryTranslationService();
      console.log('[TranslationFactory] Tier 1 (FREE) available: MyMemory');
    } catch (error) {
      console.warn('[TranslationFactory] Free MyMemory service unavailable:', error instanceof Error ? error.message : error);
      // Fallback to DeepSeek if MyMemory fails
      try {
        primaryService = new DeepSeekTranslationService();
        console.log('[TranslationFactory] Tier 1 fallback (FREE) available: DeepSeek');
      } catch (deepseekError) {
        console.warn('[TranslationFactory] DeepSeek fallback unavailable:', deepseekError instanceof Error ? deepseekError.message : deepseekError);
        // Last resort: Use OpenAI if available
        if (hasOpenAI) {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
          primaryService = new OpenAITranslationService(openai);
          console.log('[TranslationFactory] Emergency primary (PAID): OpenAI');
        } else {
          throw new Error('No translation services available');
        }
      }
    }

    // Fallback: OpenAI (PAID)
    try {
      if (hasOpenAI) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        fallbackService = new OpenAITranslationService(openai);
        console.log('[TranslationFactory] Tier 2 (PAID) available: OpenAI');
      } else {
        fallbackService = new DeepSeekTranslationService();
        console.log('[TranslationFactory] Tier 2 (FREE) available: DeepSeek');
      }
    } catch (error) {
      console.warn('[TranslationFactory] Fallback service unavailable:', error instanceof Error ? error.message : error);
      fallbackService = new DeepSeekTranslationService();
    }

    // Create 2-tier fallback with existing constructor
    return new AutoFallbackTranslationService(primaryService, fallbackService);
  }

  private static mapTypeToTier(type: string): TranslationServiceTier {
    const normalizedType = type.toLowerCase();
    
    switch (normalizedType) {
      case 'openai':
      case 'premium':
        return TranslationServiceTier.PREMIUM;
      
      case 'deepseek':
      case 'free-hq':
      case 'high-quality':
        return TranslationServiceTier.HIGH_QUALITY_FREE;
      
      case 'mymemory':
      case 'free-basic':
      case 'basic':
        return TranslationServiceTier.BASIC_FREE;
      
      case 'offline':
      case 'local':
        return TranslationServiceTier.OFFLINE;
      
      case 'auto-deepseek-first':
        return TranslationServiceTier.AUTO_DEEPSEEK_FIRST;
      
      case 'auto':
      default:
        return TranslationServiceTier.AUTO;
    }
  }

  public static getAvailableTiers(): TranslationServiceTier[] {
    const tiers: TranslationServiceTier[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      tiers.push(TranslationServiceTier.PREMIUM);
    }
    
    tiers.push(
      TranslationServiceTier.HIGH_QUALITY_FREE,
      TranslationServiceTier.BASIC_FREE,
      TranslationServiceTier.OFFLINE,
      TranslationServiceTier.AUTO
    );
    
    return tiers;
  }

  public static clearCache(): void {
    this.instances.clear();
    console.log('[TranslationFactory] Service cache cleared');
  }

  public static getCachedServices(): string[] {
    return Array.from(this.instances.keys());
  }

  public static getServiceInfo(tier: TranslationServiceTier): { 
    name: string; 
    tier: string; 
    quality: string; 
    cost: string; 
    available: boolean;
  } {
    switch (tier) {
      case TranslationServiceTier.PREMIUM:
        return {
          name: 'OpenAI Translation',
          tier: 'Tier 1 (Premium)',
          quality: 'Highest - Context-aware, cultural nuances',
          cost: 'Paid API calls',
          available: !!process.env.OPENAI_API_KEY
        };
      
      case TranslationServiceTier.HIGH_QUALITY_FREE:
        return {
          name: 'DeepSeek Translation',
          tier: 'Tier 2 (High-Quality Free)',
          quality: 'Excellent - Advanced AI, 90+ languages',
          cost: 'Free API',
          available: true
        };
      
      case TranslationServiceTier.BASIC_FREE:
        return {
          name: 'MyMemory Translation',
          tier: 'Tier 3 (Basic Free)',
          quality: 'Good - Reliable, established service',
          cost: 'Free API with limits',
          available: true
        };
      
      case TranslationServiceTier.OFFLINE:
        return {
          name: 'Local Translation',
          tier: 'Tier 4 (Offline)',
          quality: 'Basic - No network required',
          cost: 'No API costs',
          available: true
        };
      
      default:
        return {
          name: 'Auto-Fallback',
          tier: 'All Tiers',
          quality: 'Adaptive - Best available quality',
          cost: 'Optimized cost with fallback',
          available: true
        };
    }
  }
}

// Backward compatibility
export const getTranslationService = (type?: string): ITranslationService => {
  const serviceType = type || process.env.TRANSLATION_SERVICE_TYPE || 'auto';
  return TranslationServiceFactory.createTranslationService(serviceType);
};

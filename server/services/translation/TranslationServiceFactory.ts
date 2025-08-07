/**
 * Translation Service Factory
 * 
 * Factory pattern implementation for creating translation services with auto-fallback capability.
 * Supports OpenAI Translation API as primary service and MyMemory API as free fallback.
 * 
 * Design Patterns Used:
 * - Factory Pattern: Creates appropriate translation service instances
 * - Strategy Pattern: Allows switching between different translation strategies
 * - Circuit Breaker Pattern: Prevents repeated calls to failing services
 */

import { ITranslationService } from './translation.interfaces';
import { createAutoFallbackTranslationService } from './AutoFallbackTranslationService';

export { createAutoFallbackTranslationService };

/**
 * Comprehensive Auto-Fallback Translation Service
 * Automatically falls back to MyMemory when OpenAI fails for any reason
 */


/**
 * Factory for creating translation services
 */


// Export factory instance
// Always return the auto-fallback translation service
const autoFallbackTranslationService = createAutoFallbackTranslationService();
export const getTranslationService = (): ITranslationService => autoFallbackTranslationService;

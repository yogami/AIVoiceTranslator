// This is a client-side utility for working with OpenAI API responses
import OpenAI from 'openai';

// Cached client instance
let openAIClientInstance: OpenAI | null = null;

/**
 * Create and return an OpenAI client
 * The client is cached to avoid creating multiple instances
 */
export function createOpenAIClient(): OpenAI | null {
  try {
    // Return cached instance if available
    if (openAIClientInstance) {
      return openAIClientInstance;
    }
    
    // Try to get an API key
    const apiKey = getOpenAIApiKey();
    
    if (!apiKey) {
      console.warn('OpenAI API key is not available. Some features will be limited.');
      return null;
    }
    
    // Create a new instance
    openAIClientInstance = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Note: Only for development in Replit environment
    });
    
    return openAIClientInstance;
  } catch (error) {
    console.error('Error creating OpenAI client:', error);
    return null;
  }
}

/**
 * Get the OpenAI API key from environment
 * This is needed for client-side access to the API
 */
export function getOpenAIApiKey(): string | null {
  // In a real production app, you'd never expose API keys to the client
  // For this educational prototype, we're using a special endpoint that
  // provides a scoped API key with limited permissions
  
  try {
    // Get key from environment (injected by the server)
    const apiKey = (window as any).OPENAI_API_KEY || null;
    
    // Validate basic key format
    if (apiKey && (typeof apiKey === 'string') && apiKey.startsWith('sk-')) {
      return apiKey;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting OpenAI API key:', error);
    return null;
  }
}

/**
 * Get a voice for a specific language code
 */
export function getVoiceForLanguage(languageCode: string): string {
  const voiceMap: Record<string, string> = {
    "en-US": "alloy",
    "en-GB": "fable",
    "es": "shimmer",
    "de": "onyx",
    "fr": "nova"
  };
  
  return voiceMap[languageCode] || "alloy";
}

/**
 * Get a readable language name from a language code
 */
export function getLanguageName(languageCode: string): string {
  const languageMap: Record<string, string> = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "en-AU": "English (Australia)",
    "es": "Spanish",
    "de": "German",
    "fr": "French"
  };
  
  return languageMap[languageCode] || languageCode;
}

/**
 * Format latency value for display
 */
export function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * Format duration in seconds for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

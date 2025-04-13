// This is a client-side utility for working with OpenAI API responses

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

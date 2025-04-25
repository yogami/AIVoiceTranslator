// Simple utility functions for testing

// Map language codes to voice names
function getVoiceForLanguage(languageCode) {
  const voiceMap = {
    "en-US": "alloy",
    "en-GB": "fable",
    "es": "shimmer",
    "de": "onyx",
    "fr": "nova"
  };
  
  return voiceMap[languageCode] || "alloy";
}

// Get readable language name from code
function getLanguageName(languageCode) {
  const languageMap = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "en-AU": "English (Australia)",
    "es": "Spanish",
    "de": "German",
    "fr": "French"
  };
  
  return languageMap[languageCode] || languageCode;
}

// Format latency for display
function formatLatency(latencyMs) {
  if (latencyMs < 1000) {
    return `${latencyMs}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

// Format duration in seconds
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Export functions for testing
module.exports = {
  getVoiceForLanguage,
  getLanguageName,
  formatLatency,
  formatDuration
};
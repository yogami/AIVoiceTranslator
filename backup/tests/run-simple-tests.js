// Simple test runner for utility functions

// Import functions directly for testing
// Note: This way avoids using require() or complex imports

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

console.log('Running simple utility tests...');

// Run the tests manually
try {
  // Map language codes to voice names
  console.log('Testing getVoiceForLanguage:');
  const voice1 = getVoiceForLanguage('en-US');
  const voice2 = getVoiceForLanguage('es');
  const voice3 = getVoiceForLanguage('unknown');
  
  console.log(`  en-US -> ${voice1} (expected: alloy)`);
  console.log(`  es -> ${voice2} (expected: shimmer)`);
  console.log(`  unknown -> ${voice3} (expected: alloy)`);
  
  // Get readable language name from code
  console.log('\nTesting getLanguageName:');
  const name1 = getLanguageName('en-US');
  const name2 = getLanguageName('es');
  const name3 = getLanguageName('unknown');
  
  console.log(`  en-US -> ${name1} (expected: English (US))`);
  console.log(`  es -> ${name2} (expected: Spanish)`);
  console.log(`  unknown -> ${name3} (expected: unknown)`);
  
  // Format latency for display
  console.log('\nTesting formatLatency:');
  const latency1 = formatLatency(500);
  const latency2 = formatLatency(1500);
  
  console.log(`  500 -> ${latency1} (expected: 500ms)`);
  console.log(`  1500 -> ${latency2} (expected: 1.5s)`);
  
  // Format duration in seconds
  console.log('\nTesting formatDuration:');
  const duration1 = formatDuration(0);
  const duration2 = formatDuration(61);
  
  console.log(`  0 -> ${duration1} (expected: 0:00)`);
  console.log(`  61 -> ${duration2} (expected: 1:01)`);
  
  // Run assertions
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
  
  // Check all results
  assert(voice1 === 'alloy', 'getVoiceForLanguage en-US failed');
  assert(voice2 === 'shimmer', 'getVoiceForLanguage es failed');
  assert(voice3 === 'alloy', 'getVoiceForLanguage unknown failed');
  
  assert(name1 === 'English (US)', 'getLanguageName en-US failed');
  assert(name2 === 'Spanish', 'getLanguageName es failed');
  assert(name3 === 'unknown', 'getLanguageName unknown failed');
  
  assert(latency1 === '500ms', 'formatLatency 500 failed');
  assert(latency2 === '1.5s', 'formatLatency 1500 failed');
  
  assert(duration1 === '0:00', 'formatDuration 0 failed');
  assert(duration2 === '1:01', 'formatDuration 61 failed');
  
  console.log('\nAll tests completed successfully! ✅');
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}